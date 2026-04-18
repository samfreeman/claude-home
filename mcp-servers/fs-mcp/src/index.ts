#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync, spawnSync } from 'child_process'
import fg from 'fast-glob'

// ─── Path allowlist ─────────────────────────────────────────────────────────
//
// Every tool funnels through resolveAllowed() before touching the filesystem —
// that's the hard seam. Tool descriptions tell the model to ask before
// destructive ops; this layer is the only thing the client can't bypass.
//
// Allowed roots come from positional argv, matching the pattern of the stock
// @modelcontextprotocol/server-filesystem that fs-mcp replaces. CD config
// registers the MCP with a list of paths as arguments, each of which may use
// `~` — the one expression that resolves portably across users and platforms.
// No in-code defaults: if argv is empty the server errors, same as stock.

// Detect WSL once. fs-mcp may be running in a Linux process hosted for a
// Windows Claude Desktop — in which case os.homedir() returns the Linux home
// but the *user's* real files live under the Windows profile, reachable via
// /mnt/c/Users/<name>/ from here.
const IS_WSL = (() => {
	if (process.platform != 'linux')
		return false
	try {
		return /microsoft|wsl/i.test(fs.readFileSync('/proc/version', 'utf8'))
	}
	catch {
		return false
	}
})()

// `~` in fs-mcp means "the CD user's home" — where their real files live from
// Claude Desktop's perspective. In WSL thaaamt's the Windows profile, translated
// to its /mnt mount. Everywhere else, os.homedir() already returns the right
// thing (Mac: /Users/<name>, native Windows: C:\Users\<name>).
function detectHome(): string {
	if (IS_WSL) {
		try {
			const profile = execSync('cmd.exe /c echo %USERPROFILE%', { encoding: 'utf8' })
				.trim().replace(/\r$/, '')
			if (profile) {
				const wslPath = execSync(
					`wslpath ${JSON.stringify(profile)}`,
					{ encoding: 'utf8' }
				).trim()
				if (wslPath)
					return wslPath
			}
		}
		catch {}
	}
	return os.homedir()
}

const HOME = detectHome()

// translatePath takes any path expression a CD config or tool call might
// reasonably produce and returns what the current platform's node runtime can
// actually open. Throws if the path isn't reachable from here — e.g. a Windows
// drive path on a Mac process.
//
// Accepts:
//   ~ / ~/...              — CD user's home (see detectHome)
//   C:\... / D:\...        — Windows drive path
//   /mnt/<drive>/...       — WSL mount of a Windows drive
//   /foo/...               — Unix absolute path
//   relative               — resolved against cwd
function translatePath(raw: string): string {
	// 1. Tilde
	let p = raw
	if (p == '~')
		p = HOME
	else if (p.startsWith('~/') || p.startsWith('~\\'))
		p = path.join(HOME, p.slice(2))

	// 2. Windows drive path (C:\foo or C:/foo)
	if (/^[A-Za-z]:[\\/]/.test(p)) {
		if (process.platform == 'win32')
			return path.normalize(p)
		if (IS_WSL) {
			const out = execSync(`wslpath ${JSON.stringify(p)}`, { encoding: 'utf8' }).trim()
			return out
		}
		throw new Error(`Windows drive path not reachable on ${process.platform}: ${p}`)
	}

	// 3. WSL mount path (/mnt/c/foo)
	if (/^\/mnt\/[a-z]\//i.test(p)) {
		if (IS_WSL || process.platform == 'linux')
			return p
		if (process.platform == 'win32') {
			const out = execSync(`wsl.exe wslpath -w ${JSON.stringify(p)}`, { encoding: 'utf8' })
				.trim().replace(/\r$/, '')
			return out
		}
		throw new Error(`WSL mount path not reachable on ${process.platform}: ${p}`)
	}

	// 4. Unix absolute — works everywhere except native Windows
	if (p.startsWith('/')) {
		if (process.platform == 'win32')
			throw new Error(`Unix-style absolute path not reachable on win32: ${p}`)
		return p
	}

	// 5. Relative — resolve against cwd
	return path.resolve(p)
}

function collectRoots(): string[] {
	const argv = process.argv.slice(2).map(s => s.trim()).filter(Boolean)
	if (argv.length == 0)
		throw new Error('fs-mcp requires at least one allowed path as an argument')
	return argv.map(translatePath).map(p => path.resolve(p))
}

// Windows filesystems are case-insensitive. Mac's default APFS is too (though
// can be case-sensitive). Linux is case-sensitive. For the allowlist check,
// lower-case both sides on win32/darwin; preserve case for ops.
function cmpKey(p: string): string {
	if (process.platform == 'win32' || process.platform == 'darwin')
		return p.toLowerCase()
	return p
}

const ALLOWED_ROOTS = collectRoots()
const ALLOWED_CMP = ALLOWED_ROOTS.map(cmpKey)

function resolveAllowed(p: string): string {
	const abs = path.resolve(translatePath(p))
	let canonical: string
	try {
		canonical = fs.realpathSync(abs)
	}
	catch {
		// target may not exist yet (writes, mkdir). Canonicalise the parent
		// to prevent symlink escape via a non-existent leaf.
		const parent = path.dirname(abs)
		try {
			canonical = path.join(fs.realpathSync(parent), path.basename(abs))
		}
		catch {
			canonical = abs
		}
	}
	const cmp = cmpKey(canonical)
	const allowed = ALLOWED_CMP.some(r => cmp == r || cmp.startsWith(r + path.sep))
	if (!allowed)
		throw new Error(`Path outside allowlist: ${canonical}`)
	return canonical
}

// ─── Response helpers ───────────────────────────────────────────────────────

function ok(text: string) {
	return { content: [{ type: 'text' as const, text }] }
}
function err(e: unknown) {
	const msg = e instanceof Error ? e.message : String(e)
	return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
}

// ─── Server ─────────────────────────────────────────────────────────────────

const server = new McpServer({
	name: 'fs-mcp',
	version: '0.1.0'
})

// ─── fs_read ────────────────────────────────────────────────────────────────

server.registerTool(
	'fs_read',
	{
		description: [
			'Read a file from disk. Returns full content by default.',
			'Use offset + limit to read a slice of a large file (line-based, 1-indexed).',
			'Read-only.'
		].join(' '),
		inputSchema: {
			path: z.string().describe('Absolute path to the file'),
			offset: z.number().int().min(1).optional().describe('1-indexed line to start reading from'),
			limit: z.number().int().min(1).optional().describe('Max lines to read')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ path: p, offset, limit }) => {
		try {
			const safe = resolveAllowed(p)
			const content = fs.readFileSync(safe, 'utf8')
			if (offset == undefined && limit == undefined)
				return ok(content)
			const lines = content.split('\n')
			const start = (offset ?? 1) - 1
			const end = limit == undefined ? lines.length : start + limit
			return ok(lines.slice(start, end).join('\n'))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_read_many ───────────────────────────────────────────────────────────

server.registerTool(
	'fs_read_many',
	{
		description: [
			'Read multiple files in one call. Returns each file with a header and its content.',
			'Errors on individual files are reported inline and do not abort the batch.',
			'Read-only.'
		].join(' '),
		inputSchema: {
			paths: z.array(z.string()).min(1).describe('Absolute paths to read')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ paths }) => {
		const parts: string[] = []
		for (const p of paths) {
			try {
				const safe = resolveAllowed(p)
				const content = fs.readFileSync(safe, 'utf8')
				parts.push(`=== ${safe} ===\n${content}`)
			}
			catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				parts.push(`=== ${p} ===\nError: ${msg}`)
			}
		}
		return ok(parts.join('\n\n'))
	}
)

// ─── fs_list ────────────────────────────────────────────────────────────────

server.registerTool(
	'fs_list',
	{
		description: [
			'List entries in a directory. Returns JSON array of {name, type, size?}.',
			'Type is "file", "dir", or "other" (symlink, socket, etc.).',
			'Read-only.'
		].join(' '),
		inputSchema: {
			path: z.string().describe('Absolute path to the directory'),
			with_sizes: z.boolean().optional().default(false).describe('Include file sizes in bytes')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ path: p, with_sizes }) => {
		try {
			const safe = resolveAllowed(p)
			const entries = fs.readdirSync(safe, { withFileTypes: true })
			const out = entries.map(e => {
				const type = e.isFile() ? 'file' : e.isDirectory() ? 'dir' : 'other'
				const row: { name: string; type: string; size?: number } = { name: e.name, type }
				if (with_sizes && e.isFile()) {
					try {
						row.size = fs.statSync(path.join(safe, e.name)).size
					}
					catch {}
				}
				return row
			})
			return ok(JSON.stringify(out, null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_tree ────────────────────────────────────────────────────────────────

server.registerTool(
	'fs_tree',
	{
		description: [
			'Print a directory tree to the given depth.',
			'Default depth is 3. Hidden files (leading dot) are included.',
			'Read-only.'
		].join(' '),
		inputSchema: {
			path: z.string().describe('Absolute path to the root directory'),
			depth: z.number().int().min(1).max(10).optional().default(3).describe('Max depth (default 3)')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ path: p, depth }) => {
		try {
			const safe = resolveAllowed(p)
			const lines: string[] = [safe]
			const walk = (dir: string, prefix: string, remaining: number) => {
				if (remaining <= 0)
					return
				let entries: fs.Dirent[]
				try {
					entries = fs.readdirSync(dir, { withFileTypes: true })
				}
				catch {
					return
				}
				entries.sort((a, b) => a.name.localeCompare(b.name))
				entries.forEach((e, i) => {
					const last = i == entries.length - 1
					const branch = last ? '└── ' : '├── '
					const suffix = e.isDirectory() ? '/' : ''
					lines.push(prefix + branch + e.name + suffix)
					if (e.isDirectory())
						walk(path.join(dir, e.name), prefix + (last ? '    ' : '│   '), remaining - 1)
				})
			}
			walk(safe, '', depth)
			return ok(lines.join('\n'))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_info ────────────────────────────────────────────────────────────────

server.registerTool(
	'fs_info',
	{
		description: [
			'Stat a path. Returns JSON with existence, type, size, and mtime.',
			'Does not throw if the path is missing — returns {exists: false}.',
			'Read-only.'
		].join(' '),
		inputSchema: {
			path: z.string().describe('Absolute path to stat')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ path: p }) => {
		try {
			const safe = resolveAllowed(p)
			let st: fs.Stats
			try {
				st = fs.statSync(safe)
			}
			catch {
				return ok(JSON.stringify({ path: safe, exists: false }, null, 2))
			}
			const type = st.isFile() ? 'file' : st.isDirectory() ? 'dir' : 'other'
			return ok(JSON.stringify({
				path: safe,
				exists: true,
				type,
				size: st.size,
				mtime: st.mtime.toISOString(),
				ctime: st.ctime.toISOString()
			}, null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_find ────────────────────────────────────────────────────────────────

server.registerTool(
	'fs_find',
	{
		description: [
			'Find files by name pattern (glob). Recurses from the given path.',
			'Pattern examples: "**/*.md", "src/**/*.ts", "*.json".',
			'Returns newline-separated absolute paths.',
			'Read-only.'
		].join(' '),
		inputSchema: {
			path: z.string().describe('Absolute path to search from'),
			pattern: z.string().describe('Glob pattern to match (e.g. "**/*.md")'),
			exclude: z.array(z.string()).optional().describe('Glob patterns to exclude'),
			type: z.enum(['file', 'dir']).optional().describe('Limit to files or directories'),
			max_results: z.number().int().min(1).max(1000).optional().default(250).describe('Cap on results (default 250)')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ path: p, pattern, exclude, type, max_results }) => {
		try {
			const safe = resolveAllowed(p)
			const results = await fg(pattern, {
				cwd: safe,
				absolute: true,
				onlyFiles: type == 'file',
				onlyDirectories: type == 'dir',
				ignore: exclude,
				dot: true,
				suppressErrors: true
			})
			const capped = results.slice(0, max_results)
			const truncated = results.length > max_results
				? `\Yn(truncated: ${results.length} total, showing ${max_results})`
				: ''
			return ok(capped.join('\n') + truncated)
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_grep ────────────────────────────────────────────────────────────────

server.registerTool(
	'fs_grep',
	{
		description: [
			'Search file contents with ripgrep. Mirrors Claude Code\'s Grep tool.',
			'Output modes: "content" shows matching lines with optional context,',
			'"files_with_matches" shows only file paths (default),',
			'"count" shows match counts per file.',
			'Use fixed_string: true to search for a literal string instead of regex.',
			'Requires ripgrep (rg) on PATH.',
			'Read-only.'
		].join(' '),
		inputSchema: {
			pattern: z.string().describe('Regex pattern (or literal if fixed_string: true)'),
			path: z.string().describe('Absolute path to search (file or directory)'),
			glob: z.string().optional().describe('File glob filter (e.g. "*.ts")'),
			type: z.string().optional().describe('rg file type filter (e.g. "js", "py")'),
			output_mode: z.enum(['content', 'files_with_matches', 'count']).optional()
				.default('files_with_matches').describe('Output format (default: files_with_matches)'),
			case_insensitive: z.boolean().optional().default(false).describe('Case-insensitive match'),
			context: z.number().int().min(0).max(20).optional().describe('Lines of symmetric context (content mode only)'),
			multiline: z.boolean().optional().default(false).describe('Pattern can match across lines'),
			fixed_string: z.boolean().optional().default(false).describe('Treat pattern as literal string'),
			head_limit: z.number().int().min(1).max(1000).optional().default(250).describe('Cap on output lines (default 250)')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ pattern, path: p, glob, type, output_mode, case_insensitive, context, multiline, fixed_string, head_limit }) => {
		try {
			const safe = resolveAllowed(p)
			const args: string[] = []
			if (output_mode == 'files_with_matches')
				args.push('-l')
			else if (output_mode == 'count')
				args.push('-c')
			else {
				args.push('-n')
				if (context != undefined)
					args.push('-C', String(context))
			}
			if (case_insensitive)
				args.push('-i')
			if (multiline)
				args.push('-U', '--multiline-dotall')
			if (fixed_string)
				args.push('-F')
			if (glob)
				args.push('--glob', glob)
			if (type)
				args.push('--type', type)
			args.push('--', pattern, safe)
			const res = spawnSync('rg', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
			// rg exit 0 = match, 1 = no match, 2 = error
			if (res.status == 1)
				return ok('(no matches)')
			if (res.status != 0) {
				const stderr = res.stderr || '(no stderr)'
				return err(new Error(`rg failed (exit ${res.status}): ${stderr.trim()}`))
			}
			const lines = (res.stdout || '').split('\n')
			const capped = lines.slice(0, head_limit).join('\n')
			const truncated = lines.length > head_limit
				? `\n(truncated: ${lines.length} total lines, showing ${head_limit})`
				: ''
			return ok(capped + truncated)
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_write ───────────────────────────────────────────────────────────────

server.registerTool(
	'fs_write',
	{
		description: [
			'Write content to a file. Destructive: overwrites existing files.',
			'Auto-creates parent directories.',
			'Ask the user before calling this on an existing file unless they just told you to write.',
			'Returns bytes written and whether the file existed before.'
		].join(' '),
		inputSchema: {
			path: z.string().describe('Absolute path to the file'),
			content: z.string().describe('Content to write'),
			append: z.boolean().optional().default(false).describe('Append instead of overwrite')
		},
		annotations: { destructiveHint: true }
	},
	async ({ path: p, content, append }) => {
		try {
			const safe = resolveAllowed(p)
			const existed = fs.existsSync(safe)
			fs.mkdirSync(path.dirname(safe), { recursive: true })
			if (append)
				fs.appendFileSync(safe, content)
			else
				fs.writeFileSync(safe, content)
			const bytes = Buffer.byteLength(content, 'utf8')
			return ok(JSON.stringify({
				path: safe,
				bytes,
				existed,
				mode: append ? 'append' : 'overwrite'
			}, null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_edit ────────────────────────────────────────────────────────────────

server.registerTool(
	'fs_edit',
	{
		description: [
			'Edit a file by replacing old_string with new_string. Destructive.',
			'old_string must match exactly once unless replace_all is true.',
			'If old_string is not unique (and replace_all is false), the tool fails — expand',
			'old_string with surrounding context until it is unique.',
			'Ask the user before calling this unless they just asked for the change.'
		].join(' '),
		inputSchema: {
			path: z.string().describe('Absolute path to the file'),
			old_string: z.string().min(1).describe('Text to replace (must be unique in the file)'),
			new_string: z.string().describe('Replacement text'),
			replace_all: z.boolean().optional().default(false).describe('Replace every occurrence')
		},
		annotations: { destructiveHint: true }
	},
	async ({ path: p, old_string, new_string, replace_all }) => {
		try {
			const safe = resolveAllowed(p)
			const content = fs.readFileSync(safe, 'utf8')
			const occurrences = content.split(old_string).length - 1
			if (occurrences == 0)
				throw new Error('old_string not found in file')
			if (occurrences > 1 && !replace_all)
				throw new Error(`old_string matches ${occurrences} times — expand it with surrounding context to make it unique, or pass replace_all: true`)
			const updated = replace_all
				? content.split(old_string).join(new_string)
				: content.replace(old_string, new_string)
			fs.writeFileSync(safe, updated)
			return ok(JSON.stringify({
				path: safe,
				replacements: replace_all ? occurrences : 1
			}, null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_mkdir ───────────────────────────────────────────────────────────────

server.registerTool(
	'fs_mkdir',
	{
		description: [
			'Create a directory. Recursive by default (parent directories auto-created).',
			'Returns whether the directory already existed.'
		].join(' '),
		inputSchema: {
			path: z.string().describe('Absolute path to create'),
			recursive: z.boolean().optional().default(true).describe('Create parent directories (default true)')
		},
		annotations: { idempotentHint: true }
	},
	async ({ path: p, recursive }) => {
		try {
			const safe = resolveAllowed(p)
			const existed = fs.existsSync(safe)
			fs.mkdirSync(safe, { recursive })
			return ok(JSON.stringify({ path: safe, existed }, null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_copy ────────────────────────────────────────────────────────────────

server.registerTool(
	'fs_copy',
	{
		description: [
			'Copy a file or directory. Auto-creates parent directories of dst.',
			'For directories, recursive must be true.',
			'Overwrites dst if it exists — destructive.'
		].join(' '),
		inputSchema: {
			src: z.string().describe('Absolute source path'),
			dst: z.string().describe('Absolute destination path'),
			recursive: z.boolean().optional().default(false).describe('Required for directories')
		},
		annotations: { destructiveHint: true }
	},
	async ({ src, dst, recursive }) => {
		try {
			const safeSrc = resolveAllowed(src)
			const safeDst = resolveAllowed(dst)
			const srcStat = fs.statSync(safeSrc)
			if (srcStat.isDirectory() && !recursive)
				throw new Error('src is a directory — pass recursive: true')
			fs.mkdirSync(path.dirname(safeDst), { recursive: true })
			fs.cpSync(safeSrc, safeDst, { recursive, force: true })
			return ok(JSON.stringify({ src: safeSrc, dst: safeDst }, null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_move ────────────────────────────────────────────────────────────────

server.registerTool(
	'fs_move',
	{
		description: [
			'Move or rename a file or directory. Auto-creates parent directories of dst.',
			'Fails if dst already exists.',
			'Destructive: removes src from its original location.'
		].join(' '),
		inputSchema: {
			src: z.string().describe('Absolute source path'),
			dst: z.string().describe('Absolute destination path')
		},
		annotations: { destructiveHint: true }
	},
	async ({ src, dst }) => {
		try {
			const safeSrc = resolveAllowed(src)
			const safeDst = resolveAllowed(dst)
			if (fs.existsSync(safeDst))
				throw new Error(`dst already exists: ${safeDst}`)
			fs.mkdirSync(path.dirname(safeDst), { recursive: true })
			fs.renameSync(safeSrc, safeDst)
			return ok(JSON.stringify({ src: safeSrc, dst: safeDst }, null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_delete ──────────────────────────────────────────────────────────────

server.registerTool(
	'fs_delete',
	{
		description: [
			'Delete a file or directory. Destructive and irreversible.',
			'For directories, recursive must be true — the opt-in is the hard seam.',
			'ALWAYS ask the user before calling this tool unless they just asked for the deletion.',
			'Returns what was deleted.'
		].join(' '),
		inputSchema: {
			path: z.string().describe('Absolute path to delete'),
			recursive: z.boolean().optional().default(false).describe('Required for directories')
		},
		annotations: { destructiveHint: true }
	},
	async ({ path: p, recursive }) => {
		try {
			const safe = resolveAllowed(p)
			const st = fs.statSync(safe)
			const type = st.isDirectory() ? 'dir' : 'file'
			if (type == 'dir' && !recursive)
				throw new Error('path is a directory — pass recursive: true')
			fs.rmSync(safe, { recursive, force: false })
			return ok(JSON.stringify({ path: safe, type, deleted: true }, null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
	const transport = new StdioServerTransport()
	await server.connect(transport)
}

main().catch(e => {
	console.error('fs-mcp fatal:', e)
	process.exit(1)
})
