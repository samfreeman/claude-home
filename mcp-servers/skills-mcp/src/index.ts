#!/usr/bin/env node

// skills-mcp — exposes CC skills and commands over MCP so any MCP client (CD
// especially) can discover and execute them. The model reads a skill's body
// and follows the instructions, same way CC's native Skill tool works.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import os from 'os'

const SKILLS_ROOT = process.env.SKILLS_ROOT || path.join(os.homedir(), '.claude', 'skills')
const COMMANDS_ROOT = process.env.COMMANDS_ROOT || path.join(os.homedir(), '.claude', 'commands')

interface Frontmatter {
	description?: string
	name?: string
	[key: string]: unknown
}

interface ParsedDoc {
	frontmatter: Frontmatter
	body: string
	raw: string
}

function parseDoc(raw: string): ParsedDoc {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
	if (!match)
		return { frontmatter: {}, body: raw, raw }

	const fmText = match[1]
	const body = match[2]
	const frontmatter: Frontmatter = {}

	for (const line of fmText.split('\n')) {
		const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
		if (!kv) continue
		let value = kv[2].trim()
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
			value = value.slice(1, -1)
		frontmatter[kv[1]] = value
	}

	return { frontmatter, body, raw }
}

// ─── Skills ─────────────────────────────────────────────────────────────────

interface SkillEntry {
	name: string
	description: string
	path: string
}

function listSkills(): SkillEntry[] {
	if (!fs.existsSync(SKILLS_ROOT))
		return []

	const entries: SkillEntry[] = []

	for (const dirent of fs.readdirSync(SKILLS_ROOT, { withFileTypes: true })) {
		if (!dirent.isDirectory()) continue
		const skillPath = path.join(SKILLS_ROOT, dirent.name, 'SKILL.md')
		if (!fs.existsSync(skillPath)) continue

		try {
			const raw = fs.readFileSync(skillPath, 'utf-8')
			const { frontmatter } = parseDoc(raw)
			entries.push({
				name: dirent.name,
				description: frontmatter.description || '(no description)',
				path: skillPath
			})
		}
		catch {}
	}

	entries.sort((a, b) => a.name.localeCompare(b.name))
	return entries
}

function readSkill(name: string): string {
	const skillPath = path.join(SKILLS_ROOT, name, 'SKILL.md')
	if (!fs.existsSync(skillPath))
		throw new Error(`Skill not found: ${name} (looked in ${skillPath})`)
	return fs.readFileSync(skillPath, 'utf-8')
}

// ─── Commands ───────────────────────────────────────────────────────────────
//
// Commands live flat at $COMMANDS_ROOT/*.md or namespaced at
// $COMMANDS_ROOT/<ns>/*.md. Namespaced commands are named "<ns>:<file>" to
// match CC's slash-command convention (e.g. wag:adr).

interface CommandEntry {
	name: string
	description: string
	path: string
}

function listCommands(): CommandEntry[] {
	if (!fs.existsSync(COMMANDS_ROOT))
		return []

	const entries: CommandEntry[] = []

	const collect = (dir: string, namespace: string) => {
		for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, dirent.name)
			if (dirent.isDirectory()) {
				if (namespace.length > 0) continue
				collect(full, dirent.name)
				continue
			}
			if (!dirent.name.endsWith('.md')) continue

			const base = dirent.name.slice(0, -3)
			const name = namespace ? `${namespace}:${base}` : base

			try {
				const raw = fs.readFileSync(full, 'utf-8')
				const { frontmatter } = parseDoc(raw)
				entries.push({
					name,
					description: frontmatter.description || '(no description)',
					path: full
				})
			}
			catch {}
		}
	}

	collect(COMMANDS_ROOT, '')
	entries.sort((a, b) => a.name.localeCompare(b.name))
	return entries
}

function readCommand(name: string): string {
	let relPath: string
	if (name.includes(':')) {
		const [ns, base] = name.split(':', 2)
		relPath = path.join(ns, `${base}.md`)
	}
	else
		relPath = `${name}.md`

	const full = path.join(COMMANDS_ROOT, relPath)
	if (!fs.existsSync(full))
		throw new Error(`Command not found: ${name} (looked in ${full})`)
	return fs.readFileSync(full, 'utf-8')
}

// ─── Server ─────────────────────────────────────────────────────────────────

const server = new McpServer({
	name: 'skills-mcp',
	version: '1.0.0'
})

server.registerTool(
	'skill_list',
	{
		description: [
			'Lists all available CC skills with their names and descriptions.',
			'Use this to discover what skills exist before reading one.',
			'Skills are workflows CC executes natively; this server exposes them to any MCP client.'
		].join(' '),
		inputSchema: {}
	},
	async () => {
		try {
			const skills = listSkills()
			if (skills.length == 0)
				return { content: [{ type: 'text' as const, text: `No skills found in ${SKILLS_ROOT}` }] }

			const lines = skills.map(s => `${s.name} — ${s.description}`)
			return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
		}
		catch (error) {
			return {
				content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true
			}
		}
	}
)

server.registerTool(
	'skill_read',
	{
		description: [
			'Reads a skill by name and returns its full SKILL.md content.',
			'The returned text is the instructions for the skill — follow them in your next turn to execute the skill.',
			'Call skill_list first if you don\'t know the skill name.'
		].join(' '),
		inputSchema: {
			name: z.string().describe('Skill name (directory name under skills/, e.g. "yt", "kwiki-capture")')
		}
	},
	async ({ name }) => {
		try {
			const body = readSkill(name)
			return { content: [{ type: 'text' as const, text: body }] }
		}
		catch (error) {
			return {
				content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true
			}
		}
	}
)

server.registerTool(
	'command_list',
	{
		description: [
			'Lists all available CC slash-commands with their names and descriptions.',
			'Commands live in ~/.claude/commands/ and are the older CC workflow format (still supported).',
			'Namespaced commands use "ns:name" (e.g. "wag:adr").'
		].join(' '),
		inputSchema: {}
	},
	async () => {
		try {
			const commands = listCommands()
			if (commands.length == 0)
				return { content: [{ type: 'text' as const, text: `No commands found in ${COMMANDS_ROOT}` }] }

			const lines = commands.map(c => `${c.name} — ${c.description}`)
			return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
		}
		catch (error) {
			return {
				content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true
			}
		}
	}
)

server.registerTool(
	'command_read',
	{
		description: [
			'Reads a CC slash-command by name and returns its full markdown body.',
			'Use "ns:name" for namespaced commands (e.g. "wag:adr" reads commands/wag/adr.md).',
			'The returned text is the command\'s instructions — follow them in your next turn to execute the command.'
		].join(' '),
		inputSchema: {
			name: z.string().describe('Command name (e.g. "inbox", "push", "wag:adr")')
		}
	},
	async ({ name }) => {
		try {
			const body = readCommand(name)
			return { content: [{ type: 'text' as const, text: body }] }
		}
		catch (error) {
			return {
				content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true
			}
		}
	}
)

const transport = new StdioServerTransport()
await server.connect(transport)
