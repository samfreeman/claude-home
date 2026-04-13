#!/usr/bin/env node

// sidecar-mcp — unified access layer for CC skills and commands.
// Exposes both under a single abstraction (the "sidecar") with a uniform
// interface: list and read. Any MCP client can fetch sidecars by
// "namespace:name" address. File or folder shape is transparent to the
// client — folder-shaped sidecars return a folder path so the client can
// read supporting files via its own filesystem MCP. See PLAN.md for the
// full design.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import os from 'os'

const SKILLS_ROOT = process.env.SKILLS_ROOT || path.join(os.homedir(), '.claude', 'skills')
const COMMANDS_ROOT = process.env.COMMANDS_ROOT || path.join(os.homedir(), '.claude', 'commands')
const CLAUDE_DESKTOP_CONFIG = process.env.CLAUDE_DESKTOP_CONFIG

// ─── Frontmatter parsing ─────────────────────────────────────────────

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

// ─── Client filesystem context ───────────────────────────────────────

interface MCPServerEntry {
	command?: string
	args?: string[]
	env?: Record<string, string>
}

interface ClaudeDesktopConfigShape {
	mcpServers?: Record<string, MCPServerEntry>
}

function getClientFilesystemPaths(): string[] {
	if (!CLAUDE_DESKTOP_CONFIG) return []
	if (!fs.existsSync(CLAUDE_DESKTOP_CONFIG)) return []

	try {
		const raw = fs.readFileSync(CLAUDE_DESKTOP_CONFIG, 'utf-8')
		const config = JSON.parse(raw) as ClaudeDesktopConfigShape

		for (const entry of Object.values(config.mcpServers || {})) {
			const args = entry.args || []
			const fsIdx = args.findIndex(a => a.includes('server-filesystem'))
			if (fsIdx >= 0)
				return args.slice(fsIdx + 1)
		}
		return []
	}
	catch {
		return []
	}
}

// ─── Sidecar entries ─────────────────────────────────────────────────

interface SidecarEntry {
	name: string
	description: string
	source: 'command' | 'skill'
	shape: 'file' | 'folder'
	path: string
	folder: string | null
}

function walkCommands(): SidecarEntry[] {
	if (!fs.existsSync(COMMANDS_ROOT)) return []

	const entries: SidecarEntry[] = []

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
					source: 'command',
					shape: 'file',
					path: full,
					folder: null
				})
			}
			catch {}
		}
	}

	collect(COMMANDS_ROOT, '')
	return entries
}

function walkSkills(): SidecarEntry[] {
	if (!fs.existsSync(SKILLS_ROOT)) return []

	const entries: SidecarEntry[] = []

	const collect = (dir: string, namespace: string) => {
		for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
			if (!dirent.isDirectory()) continue
			const subdir = path.join(dir, dirent.name)
			const skillPath = path.join(subdir, 'SKILL.md')

			if (fs.existsSync(skillPath)) {
				const name = namespace ? `${namespace}:${dirent.name}` : dirent.name
				try {
					const raw = fs.readFileSync(skillPath, 'utf-8')
					const { frontmatter } = parseDoc(raw)
					entries.push({
						name,
						description: frontmatter.description || '(no description)',
						source: 'skill',
						shape: 'folder',
						path: skillPath,
						folder: subdir
					})
				}
				catch {}
			}
			else if (namespace.length == 0) {
				collect(subdir, dirent.name)
			}
		}
	}

	collect(SKILLS_ROOT, '')
	return entries
}

function listAll(): SidecarEntry[] {
	const commands = walkCommands()
	const skills = walkSkills()

	const seen = new Set<string>()
	const result: SidecarEntry[] = []

	for (const e of commands) {
		if (seen.has(e.name)) continue
		seen.add(e.name)
		result.push(e)
	}
	for (const e of skills) {
		if (seen.has(e.name)) continue
		seen.add(e.name)
		result.push(e)
	}

	result.sort((a, b) => a.name.localeCompare(b.name))
	return result
}

function resolve(name: string): SidecarEntry | null {
	let namespace: string | null = null
	let base = name
	const colonIdx = name.indexOf(':')
	if (colonIdx >= 0) {
		namespace = name.slice(0, colonIdx)
		base = name.slice(colonIdx + 1)
	}

	const cmdPath = namespace
		? path.join(COMMANDS_ROOT, namespace, `${base}.md`)
		: path.join(COMMANDS_ROOT, `${base}.md`)
	if (fs.existsSync(cmdPath)) {
		try {
			const raw = fs.readFileSync(cmdPath, 'utf-8')
			const { frontmatter } = parseDoc(raw)
			return {
				name,
				description: frontmatter.description || '(no description)',
				source: 'command',
				shape: 'file',
				path: cmdPath,
				folder: null
			}
		}
		catch {}
	}

	const skillFolder = namespace
		? path.join(SKILLS_ROOT, namespace, base)
		: path.join(SKILLS_ROOT, base)
	const skillPath = path.join(skillFolder, 'SKILL.md')
	if (fs.existsSync(skillPath)) {
		try {
			const raw = fs.readFileSync(skillPath, 'utf-8')
			const { frontmatter } = parseDoc(raw)
			return {
				name,
				description: frontmatter.description || '(no description)',
				source: 'skill',
				shape: 'folder',
				path: skillPath,
				folder: skillFolder
			}
		}
		catch {}
	}

	return null
}

function listFolderContents(folder: string): string[] {
	const results: string[] = []

	const walk = (dir: string, prefix: string) => {
		for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
			if (dirent.name.startsWith('.')) continue
			const full = path.join(dir, dirent.name)
			const rel = prefix ? `${prefix}/${dirent.name}` : dirent.name

			if (dirent.isDirectory()) {
				walk(full, rel)
				continue
			}
			if (rel == 'SKILL.md') continue
			results.push(rel)
		}
	}

	try {
		walk(folder, '')
	}
	catch {}

	results.sort()
	return results
}

function buildReadResponse(entry: SidecarEntry): string {
	const parts: string[] = []

	const fsPaths = getClientFilesystemPaths()
	if (fsPaths.length > 0) {
		parts.push('<!-- sidecar: client filesystem context -->')
		parts.push('Before claiming a file is unreachable, your filesystem MCP currently grants you access to these directories:')
		for (const p of fsPaths)
			parts.push(`  - ${p}`)
		parts.push('<!-- end filesystem context -->')
		parts.push('')
	}

	if (entry.folder) {
		const siblings = listFolderContents(entry.folder)
		parts.push('<!-- sidecar: folder context -->')
		parts.push(`This sidecar is served from a folder. Absolute path: ${entry.folder}`)
		if (siblings.length > 0) {
			parts.push('Supporting files alongside the body (read via your filesystem MCP as needed):')
			for (const s of siblings)
				parts.push(`  - ${s}`)
		}
		else {
			parts.push('No supporting files alongside the body.')
		}
		parts.push('<!-- end folder context -->')
		parts.push('')
	}

	try {
		const raw = fs.readFileSync(entry.path, 'utf-8')
		parts.push(raw)
	}
	catch (err) {
		parts.push(`Error reading body from ${entry.path}: ${err instanceof Error ? err.message : String(err)}`)
	}

	return parts.join('\n')
}

// ─── Server ──────────────────────────────────────────────────────────

const server = new McpServer({
	name: 'sidecar-mcp',
	version: '1.0.0'
})

server.registerTool(
	'list',
	{
		description: [
			'Lists all available sidecars — CC skills and commands — under a unified namespace.',
			'Entries are returned as "namespace:name" (or bare "name" for flat top-level entries) with a one-line description.',
			'A sidecar is a text instruction set that the model reads and follows. Shape (file or folder) is transparent; call read to fetch the body.',
			'Commands win over skills on name collision.'
		].join(' '),
		inputSchema: {}
	},
	async () => {
		try {
			const entries = listAll()
			if (entries.length == 0)
				return { content: [{ type: 'text' as const, text: 'No sidecars found.' }] }

			const lines = entries.map(e => `${e.name} — ${e.description}`)
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
	'read',
	{
		description: [
			'Reads a sidecar by name and returns its body plus any folder context.',
			'Name can be "namespace:base" (e.g. "wag1.5:adr", "kwiki:capture") or bare "name" (e.g. "push").',
			'Commands are checked first, then skills.',
			'For folder-shaped sidecars, the response includes the folder\'s absolute path and a list of sibling files the client can fetch via its filesystem MCP.',
			'The returned text is the instructions for the sidecar — follow them in your next turn to execute.'
		].join(' '),
		inputSchema: {
			name: z.string().describe('Sidecar name, e.g. "push", "kwiki:capture", "wag1.5:adr"')
		}
	},
	async ({ name }) => {
		try {
			const entry = resolve(name)
			if (!entry)
				return {
					content: [{ type: 'text' as const, text: `Sidecar not found: ${name}. Call list to see available sidecars.` }],
					isError: true
				}

			const text = buildReadResponse(entry)
			return { content: [{ type: 'text' as const, text }] }
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
