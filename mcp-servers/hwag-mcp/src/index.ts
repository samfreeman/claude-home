#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { validateCommand } from './policy.js'
import { makeMessenger, defaultChannel, askInSession, DEFAULT_ASK_TIMEOUT_MS, type AskChannel } from './sms.js'

// ─── helpers ─────────────────────────────────────────────────────────────────

function ok(text: string) {
	return { content: [{ type: 'text' as const, text }] }
}

function err(e: unknown) {
	const msg = e instanceof Error ? e.message : String(e)
	return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
}

function expand(p: string): string {
	if (p == '~' || p.startsWith('~/'))
		return path.join(os.homedir(), p.slice(1))
	return p
}

// ─── write-path allowlist (for log_decision / checkpoint) ───────────────────
//
// Allowed roots come from positional argv, same as fs-mcp. The guarded `run`
// tool needs no path allowlist (its safety is the command policy), but file
// writes hwag performs itself must stay inside an allowed root.

const ALLOWED_ROOTS = process.argv.slice(2)
	.map(s => s.trim())
	.filter(Boolean)
	.map(p => path.resolve(expand(p)))

function resolveWrite(p: string): string {
	const abs = path.resolve(expand(p))
	const parent = path.dirname(abs)
	let canonical: string
	try {
		canonical = path.join(fs.realpathSync(parent), path.basename(abs))
	}
	catch {
		canonical = abs
	}
	if (ALLOWED_ROOTS.length == 0)
		return canonical
	if (!ALLOWED_ROOTS.some(r => canonical == r || canonical.startsWith(r + path.sep)))
		throw new Error(`Path outside allowlist: ${canonical}`)
	return canonical
}

// ─── server ──────────────────────────────────────────────────────────────────

const server = new McpServer({
	name: 'hwag-mcp',
	version: '0.1.0'
})

const messenger = makeMessenger()

// ─── run ───────────────────────────────────────────────────────────────────
//
// The ONLY way the confined subtree touches git/gh/build/test. Every command is
// validated by the policy first; chaining and merge/push-to-main are rejected.
// No merge capability exists anywhere in this server.

server.registerTool(
	'run',
	{
		description: 'Run a single guarded shell command (git / gh / build / test only). No chaining, no merge, no push to main — rejected by policy. This is the confined subtree\'s only path to the shell.',
		inputSchema: {
			command: z.string().describe('One command, no chaining (&&, ;, |, etc. are rejected)'),
			cwd: z.string().describe('Working directory (project root)'),
			timeoutMs: z.number().int().min(1000).optional().describe('Max runtime (default 600000)')
		}
	},
	async ({ command, cwd, timeoutMs }) => {
		const verdict = validateCommand(command)
		if (!verdict.ok)
			return err(`Blocked by policy: ${verdict.reason}`)
		try {
			const dir = path.resolve(expand(cwd))
			const r = spawnSync(command, {
				cwd: dir,
				shell: true,
				encoding: 'utf8',
				timeout: timeoutMs ?? 600000,
				maxBuffer: 32 * 1024 * 1024
			})
			if (r.error)
				return err(r.error)
			const parts = []
			if (r.stdout)
				parts.push(r.stdout)
			if (r.stderr)
				parts.push(r.stderr)
			parts.push(`[exit ${r.status ?? 'null'}]`)
			return ok(parts.join('\n'))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── ask ─────────────────────────────────────────────────────────────────────
//
// Blocking human-bridge. Sends the question, blocks up to the per-message
// window, returns the reply. Loop this tool for a multi-turn discussion. On
// timeout returns a NO-ANSWER sentinel — the agent should then checkpoint + halt.

server.registerTool(
	'ask',
	{
		description: 'Ask the human a question and BLOCK for the reply (channel: sms | session). Loop for multi-turn discussion. On timeout returns "[hwag:no-answer]" — checkpoint and halt when you see that.',
		inputSchema: {
			question: z.string().describe('The question, phrased so a short reply resolves it'),
			channel: z.enum(['sms', 'session']).optional().describe('Delivery channel; defaults to the run channel'),
			timeoutMs: z.number().int().min(1000).optional().describe('Per-message window (default from HWAG_ASK_TIMEOUT_MS)')
		}
	},
	async ({ question, channel, timeoutMs }) => {
		const ch: AskChannel = channel ?? defaultChannel()
		const ms = timeoutMs ?? DEFAULT_ASK_TIMEOUT_MS
		try {
			const reply = ch == 'session'
				? await askInSession(question, ms)
				: await messenger.ask(question, ms)
			if (reply == null)
				return ok('[hwag:no-answer]')
			return ok(reply)
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── notify ──────────────────────────────────────────────────────────────────

server.registerTool(
	'notify',
	{
		description: 'Send a one-way message to the human (no reply expected). Use for "PR is up" / "halted on snag X".',
		inputSchema: {
			message: z.string().describe('The message to send')
		}
	},
	async ({ message }) => {
		try {
			await messenger.send(message)
			return ok('sent')
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── log_decision ────────────────────────────────────────────────────────────
//
// Appends one structured entry to the run's decision log. Schema mirrors
// wag/templates/decision-log.md so the log-grill can read it consistently.

server.registerTool(
	'log_decision',
	{
		description: 'Append one design decision to the run decision log. Confidence=low AND blastRadius=high means you must NOT self-decide — escalate via ask first, then log with disposition=escalated-sms.',
		inputSchema: {
			logPath: z.string().describe('Path to the run decision-log markdown file'),
			title: z.string(),
			question: z.string(),
			options: z.array(z.string()).min(1).describe('Each "Label — tradeoff"'),
			chosen: z.string(),
			justification: z.string(),
			source: z.string().describe('[G-NNN] | [L-NNN] | none (novel call)'),
			confidence: z.enum(['high', 'medium', 'low']),
			blastRadius: z.enum(['low', 'medium', 'high']),
			disposition: z.enum(['decided-by-rule', 'decided-self', 'escalated-sms'])
		}
	},
	async ({ logPath, title, question, options, chosen, justification, source, confidence, blastRadius, disposition }) => {
		try {
			const safe = resolveWrite(logPath)
			const opts = options.map(o => `  - ${o}`).join('\n')
			const entry = [
				``,
				`### ${title}`,
				`- **Question:** ${question}`,
				`- **Options:**`,
				opts,
				`- **Chosen:** ${chosen}`,
				`- **Justification:** ${justification}`,
				`- **Source:** ${source}`,
				`- **Confidence:** ${confidence}`,
				`- **Blast radius:** ${blastRadius}`,
				`- **Disposition:** ${disposition}`,
				``
			].join('\n')
			fs.appendFileSync(safe, entry, 'utf8')
			return ok(`logged: ${title}`)
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── checkpoint ──────────────────────────────────────────────────────────────
//
// Written on a hard-stop (snag / drift / no-answer timeout) so a later manual
// resume can pick up where the run halted.

server.registerTool(
	'checkpoint',
	{
		description: 'Write a resume checkpoint on a hard-stop (snag, template drift, or no-answer timeout). Records where the run halted and why.',
		inputSchema: {
			path: z.string().describe('Path to the checkpoint file'),
			reason: z.string().describe('Why the run halted'),
			state: z.string().describe('Free-form state needed to resume (current PBI, decisions so far, next step)')
		}
	},
	async ({ path: p, reason, state }) => {
		try {
			const safe = resolveWrite(p)
			const body = `# HWAG checkpoint\n\n**Reason:** ${reason}\n\n## State\n\n${state}\n`
			fs.writeFileSync(safe, body, 'utf8')
			return ok(`checkpoint written: ${safe}`)
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
