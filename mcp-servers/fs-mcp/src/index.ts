#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import fs from 'fs'
import os from 'os'
import path from 'path'
import fg from 'fast-glob'
import { PathTranslator, detectMode, type WslConfig } from './path-translator.js'
import { ok, err, requireExists, MIME_MAP } from './utils.js'

// ─── Config (env + argv) ───────────────────────────────────────────────────

const WSL_DISTRO = process.env.FS_MCP_WSL_DISTRO || ''
const WSL_USER = process.env.FS_MCP_WSL_USER || ''
const WSL_PREFIXES = (process.env.FS_MCP_WSL_PREFIXES || '')
	.split(',')
	.map(s => s.trim())
	.filter(Boolean)

const wslConfig: WslConfig | undefined = (WSL_DISTRO && WSL_USER)
	? { distro: WSL_DISTRO, user: WSL_USER, prefixes: WSL_PREFIXES }
	: undefined

const MODE = detectMode()
const HOME = os.homedir()

const translator = new PathTranslator({
	mode: MODE,
	home: HOME,
	wsl: wslConfig
})

// ─── Allowlist ─────────────────────────────────────────────────────────────
//
// Every tool funnels through resolveAllowed() before touching the filesystem.
// Allowed roots come from positional argv.

function collectRoots(): string[] {
	const argv = process.argv.slice(2).map(s => s.trim()).filter(Boolean)
	if (argv.length == 0)
		throw new Error('fs-mcp requires at least one allowed path as an argument')
	return argv.map(p => path.resolve(translator.translate(p)))
}

function cmpKey(p: string): string {
	return MODE == 'windows' ? p.toLowerCase() : p
}

const ALLOWED_ROOTS = collectRoots()
const ALLOWED_CMP = ALLOWED_ROOTS.map(cmpKey)

function resolveAllowed(p: string): string {
	const abs = path.resolve(translator.translate(p))
	let canonical: string
	try {
		canonical = fs.realpathSync(abs)
	}
	catch {
		// Target may not exist yet (writes, mkdir). Canonicalise the parent
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
	if (!ALLOWED_CMP.some(r => cmp == r || cmp.startsWith(r + path.sep)))
		throw new Error(`Path outside allowlist: ${canonical}`)
	return canonical
}

// ─── Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
	name: 'fs-mcp',
	version: '0.2.0'
})

// ─── fs_read ───────────────────────────────────────────────────────────────

server.registerTool(
	'fs_read',
	{
		description: 'Read a text file. Use offset + limit to slice large files (line-based, 1-indexed). Read-only.',
		inputSchema: {
			path: z.string().describe('Path to the file'),
			offset: z.number().int().min(1).optional().describe('1-indexed start line'),
			limit: z.number().int().min(1).optional().describe('Max lines to return')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ path: p, offset, limit }) => {
		try {
			const safe = resolveAllowed(p)
			requireExists(safe, 'file')
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

// ─── fs_read_many ──────────────────────────────────────────────────────────

server.registerTool(
	'fs_read_many',
	{
		description: 'Read multiple text files in one call. Errors on individual files are reported inline. Read-only.',
		inputSchema: {
			paths: z.array(z.string()).min(1).describe('Paths to read')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ paths }) => {
		const parts: string[] = []
		for (const p of paths) {
			try {
				const safe = resolveAllowed(p)
				requireExists(safe, 'file')
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

// ─── fs_read_media ─────────────────────────────────────────────────────────

server.registerTool(
	'fs_read_media',
	{
		description: 'Read a binary/image file as base64. Returns data and MIME type. Read-only.',
		inputSchema: {
			path: z.string().describe('Path to the file')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ path: p }) => {
		try {
			const safe = resolveAllowed(p)
			requireExists(safe, 'file')
			const ext = path.extname(safe).toLowerCase()
			const mime = MIME_MAP[ext] || 'application/octet-stream'
			const buf = fs.readFileSync(safe)
			const b64 = buf.toString('base64')
			return ok(JSON.stringify({
				path: safe,
				mime,
				size: buf.length,
				data: b64
			}, null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_list ───────────────────────────────────────────────────────────────

server.registerTool(
	'fs_list',
	{
		description: 'List entries in a directory. Returns JSON array of {name, type, size?}. Read-only.',
		inputSchema: {
			path: z.string().describe('Path to the directory'),
			with_sizes: z.boolean().optional().default(false).describe('Include file sizes in bytes')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ path: p, with_sizes }) => {
		try {
			const safe = resolveAllowed(p)
			requireExists(safe, 'dir')
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

// ─── fs_tree ───────────────────────────────────────────────────────────────

server.registerTool(
	'fs_tree',
	{
		description: 'Print a directory tree to the given depth. Default depth 3. Read-only.',
		inputSchema: {
			path: z.string().describe('Path to the root directory'),
			depth: z.number().int().min(1).max(10).optional().default(3).describe('Max depth (default 3)')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ path: p, depth }) => {
		try {
			const safe = resolveAllowed(p)
			requireExists(safe, 'dir')
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
					const suffix = e.isDirectory() ? path.sep : ''
					lines.push(prefix + branch + e.name + suffix)
					if (e.isDirectory()) {
						walk(
							path.join(dir, e.name),
							prefix + (last ? '    ' : '│   '),
							remaining - 1)
					}
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

// ─── fs_info ───────────────────────────────────────────────────────────────

server.registerTool(
	'fs_info',
	{
		description: 'Stat a path. Returns JSON with existence, type, size, mtime. Returns {exists: false} if missing (the "does this exist" tool; other tools error on missing paths). Read-only.',
		inputSchema: {
			path: z.string().describe('Path to stat')
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

// ─── fs_find ───────────────────────────────────────────────────────────────

server.registerTool(
	'fs_find',
	{
		description: 'Find files by glob pattern, recursing from the given path. Read-only.',
		inputSchema: {
			path: z.string().describe('Path to search from'),
			pattern: z.string().describe('Glob pattern (e.g. "**/*.md")'),
			exclude: z.array(z.string()).optional().describe('Glob patterns to exclude'),
			type: z.enum(['file', 'dir']).optional().describe('Limit to files or directories'),
			max_results: z.number().int().min(1).max(1000).optional().default(250).describe('Cap on results (default 250)')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ path: p, pattern, exclude, type, max_results }) => {
		try {
			const safe = resolveAllowed(p)
			requireExists(safe, 'dir')
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
			const suffix = results.length > max_results
				? `\n(truncated: ${results.length} total, showing ${max_results})`
				: ''
			return ok(capped.join('\n') + suffix)
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_grep ───────────────────────────────────────────────────────────────
//
// Pure-JS (no ripgrep dependency): glob files, read each, match line by line.

const DEFAULT_GREP_EXCLUDES = [
	'**/node_modules/**',
	'**/.git/**',
	'**/dist/**',
	'**/build/**',
	'**/.next/**',
	'**/.cache/**'
]

server.registerTool(
	'fs_grep',
	{
		description: 'Search file contents with a regex. Output modes: "content" (matching lines with line numbers), "files_with_matches" (paths, default), "count" (per-file counts). Noisy directories (node_modules, .git, dist, build, .next, .cache) are excluded by default; pass exclude to override. Read-only.',
		inputSchema: {
			pattern: z.string().describe('Regex pattern (or literal if fixed_string: true)'),
			path: z.string().describe('Path to search (file or directory)'),
			glob: z.string().optional().describe('File glob filter (e.g. "**/*.ts"). Defaults to all files if path is a directory.'),
			exclude: z.array(z.string()).optional().describe(`Glob patterns to exclude (overrides defaults: ${DEFAULT_GREP_EXCLUDES.join(', ')})`),
			output_mode: z.enum(['content', 'files_with_matches', 'count']).optional()
				.default('files_with_matches').describe('Output format (default: files_with_matches)'),
			case_insensitive: z.boolean().optional().default(false).describe('Case-insensitive match'),
			context: z.number().int().min(0).max(20).optional().default(0).describe('Lines of context (content mode only)'),
			fixed_string: z.boolean().optional().default(false).describe('Treat pattern as literal string'),
			head_limit: z.number().int().min(1).max(1000).optional().default(250).describe('Cap on output lines/files (default 250)'),
			max_files: z.number().int().min(1).max(50000).optional().default(5000).describe('Max files to scan (default 5000)')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ pattern, path: p, glob, exclude, output_mode, case_insensitive, context, fixed_string, head_limit, max_files }) => {
		try {
			const safe = resolveAllowed(p)
			const st = requireExists(safe)

			const escaped = fixed_string
				? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
				: pattern
			let regex: RegExp
			try {
				regex = new RegExp(escaped, case_insensitive ? 'i' : '')
			}
			catch (e) {
				throw new Error(`Invalid regex: ${e instanceof Error ? e.message : String(e)}`)
			}

			const targets: string[] = []
			let scanCappedAt: number | null = null
			if (st.isFile())
				targets.push(safe)
			else {
				const found = await fg(glob || '**/*', {
					cwd: safe,
					absolute: true,
					onlyFiles: true,
					dot: true,
					suppressErrors: true,
					ignore: exclude ?? DEFAULT_GREP_EXCLUDES
				})
				if (found.length > max_files)
					scanCappedAt = found.length
				targets.push(...found.slice(0, max_files))
			}

			const contentLines: string[] = []
			const matchedFiles: string[] = []
			const counts: Array<{ file: string; count: number }> = []

			for (const file of targets) {
				let text: string
				try {
					text = fs.readFileSync(file, 'utf8')
				}
				catch {
					continue
				}
				const lines = text.split('\n')
				let fileCount = 0
				const fileHits: number[] = []
				for (let i = 0; i < lines.length; i++) {
					if (regex.test(lines[i])) {
						fileCount++
						fileHits.push(i)
					}
				}
				if (fileCount == 0)
					continue

				if (output_mode == 'files_with_matches') {
					matchedFiles.push(file)
				}
				else if (output_mode == 'count') {
					counts.push({ file, count: fileCount })
				}
				else {
					const printed = new Set<number>()
					for (const hit of fileHits) {
						const start = Math.max(0, hit - context)
						const end = Math.min(lines.length - 1, hit + context)
						for (let i = start; i <= end; i++) {
							if (printed.has(i))
								continue
							printed.add(i)
							const sep = i == hit ? ':' : '-'
							contentLines.push(`${file}${sep}${i + 1}${sep}${lines[i]}`)
						}
					}
				}
			}

			let out: string
			if (output_mode == 'files_with_matches') {
				const capped = matchedFiles.slice(0, head_limit)
				const suffix = matchedFiles.length > head_limit
					? `\n(truncated: ${matchedFiles.length} total, showing ${head_limit})`
					: ''
				out = capped.length == 0 ? '(no matches)' : capped.join('\n') + suffix
			}
			else if (output_mode == 'count') {
				const capped = counts.slice(0, head_limit)
				const suffix = counts.length > head_limit
					? `\n(truncated: ${counts.length} total, showing ${head_limit})`
					: ''
				out = capped.length == 0
					? '(no matches)'
					: capped.map(c => `${c.file}:${c.count}`).join('\n') + suffix
			}
			else {
				const capped = contentLines.slice(0, head_limit)
				const suffix = contentLines.length > head_limit
					? `\n(truncated: ${contentLines.length} total lines, showing ${head_limit})`
					: ''
				out = capped.length == 0 ? '(no matches)' : capped.join('\n') + suffix
			}

			if (scanCappedAt != null)
				out = `(scan capped: ${scanCappedAt} files matched, scanned first ${max_files} — raise max_files or narrow glob/exclude)\n${out}`

			return ok(out)
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_write ──────────────────────────────────────────────────────────────

server.registerTool(
	'fs_write',
	{
		description: 'Write content to a file. Overwrites by default. Auto-creates parent directories. Ask the user before calling on an existing file unless they just requested the write.',
		inputSchema: {
			path: z.string().describe('Path to the file'),
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

// ─── fs_edit ───────────────────────────────────────────────────────────────

server.registerTool(
	'fs_edit',
	{
		description: 'Find-and-replace in a file. old_string must match exactly once unless replace_all is true. Expand old_string with surrounding context if not unique. Pass dry_run: true to preview the change as a diff without writing.',
		inputSchema: {
			path: z.string().describe('Path to the file'),
			old_string: z.string().min(1).describe('Text to replace (must be unique)'),
			new_string: z.string().describe('Replacement text'),
			replace_all: z.boolean().optional().default(false).describe('Replace every occurrence'),
			dry_run: z.boolean().optional().default(false).describe('Preview the change as a diff without writing')
		},
		annotations: { destructiveHint: true }
	},
	async ({ path: p, old_string, new_string, replace_all, dry_run }) => {
		try {
			const safe = resolveAllowed(p)
			requireExists(safe, 'file')
			const content = fs.readFileSync(safe, 'utf8')
			const count = content.split(old_string).length - 1
			if (count == 0)
				throw new Error('old_string not found in file')
			if (count > 1 && !replace_all)
				throw new Error(`old_string matches ${count} times — expand with surrounding context or pass replace_all: true`)
			const replacements = replace_all ? count : 1

			if (dry_run) {
				const minusLines = old_string.split('\n').map(l => `- ${l}`)
				const plusLines = new_string.split('\n').map(l => `+ ${l}`)
				const diff = [
					`--- ${safe} (${replacements} replacement${replacements == 1 ? '' : 's'})`,
					...minusLines,
					...plusLines
				].join('\n')
				return ok(diff)
			}

			const updated = replace_all
				? content.split(old_string).join(new_string)
				: content.replace(old_string, new_string)
			fs.writeFileSync(safe, updated)
			return ok(JSON.stringify({ path: safe, replacements }, null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_mkdir ──────────────────────────────────────────────────────────────

server.registerTool(
	'fs_mkdir',
	{
		description: 'Create a directory. Recursive by default (parents auto-created).',
		inputSchema: {
			path: z.string().describe('Path to create'),
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

// ─── fs_copy ───────────────────────────────────────────────────────────────

server.registerTool(
	'fs_copy',
	{
		description: 'Copy a file or directory. For directories, recursive must be true. Fails if dst exists unless overwrite is true.',
		inputSchema: {
			src: z.string().describe('Source path'),
			dst: z.string().describe('Destination path'),
			recursive: z.boolean().optional().default(false).describe('Required for directories'),
			overwrite: z.boolean().optional().default(false).describe('Allow overwriting dst if it exists')
		},
		annotations: { destructiveHint: true }
	},
	async ({ src, dst, recursive, overwrite }) => {
		try {
			const safeSrc = resolveAllowed(src)
			const safeDst = resolveAllowed(dst)
			const srcStat = requireExists(safeSrc)
			if (srcStat.isDirectory() && !recursive)
				throw new Error('src is a directory — pass recursive: true')
			if (!overwrite && fs.existsSync(safeDst))
				throw new Error(`dst already exists: ${safeDst} — pass overwrite: true to replace`)
			fs.mkdirSync(path.dirname(safeDst), { recursive: true })
			fs.cpSync(safeSrc, safeDst, { recursive, force: overwrite })
			return ok(JSON.stringify({ src: safeSrc, dst: safeDst, overwritten: overwrite }, null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_move ───────────────────────────────────────────────────────────────

server.registerTool(
	'fs_move',
	{
		description: 'Move or rename a file or directory. Fails if dst exists. Auto-creates parent dirs.',
		inputSchema: {
			src: z.string().describe('Source path'),
			dst: z.string().describe('Destination path')
		},
		annotations: { destructiveHint: true }
	},
	async ({ src, dst }) => {
		try {
			const safeSrc = resolveAllowed(src)
			const safeDst = resolveAllowed(dst)
			requireExists(safeSrc)
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

// ─── fs_delete ─────────────────────────────────────────────────────────────

server.registerTool(
	'fs_delete',
	{
		description: 'Delete a file or directory. For directories, recursive must be true. ALWAYS ask the user before calling unless they requested the deletion.',
		inputSchema: {
			path: z.string().describe('Path to delete'),
			recursive: z.boolean().optional().default(false).describe('Required for non-empty directories')
		},
		annotations: { destructiveHint: true }
	},
	async ({ path: p, recursive }) => {
		try {
			const safe = resolveAllowed(p)
			const st = requireExists(safe)
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

// ─── fs_path ───────────────────────────────────────────────────────────────
//
// Pure path translation. Does not touch the filesystem and does not apply
// the allowlist — callers use it to discover what a path expression resolves
// to in the native form for the current OS.

server.registerTool(
	'fs_path',
	{
		description: 'Translate one or more path expressions to native form for the current OS and report existence/type. Handles ~/ expansion, %VAR% expansion, and WSL/Windows path conversion. Returns {input, path, allowed, exists, type} for a single input, or an array of such objects for an array input. Read-only.',
		inputSchema: {
			path: z.union([z.string(), z.array(z.string()).min(1)]).describe('Path expression, or array of path expressions')
		},
		annotations: { readOnlyHint: true }
	},
	async ({ path: p }: { path: string | string[] }) => {
		const resolveOne = (input: string) => {
			let resolved = path.resolve(translator.translate(input))
			let allowed = false
			try {
				resolved = resolveAllowed(input)
				allowed = true
			}
			catch {}
			let exists = false
			let type: string | null = null
			if (allowed) {
				try {
					const st = fs.statSync(resolved)
					exists = true
					type = st.isFile() ? 'file' : st.isDirectory() ? 'dir' : 'other'
				}
				catch {}
			}
			return { input, path: resolved, allowed, exists, type }
		}

		try {
			if (Array.isArray(p)) {
				const results = p.map(input => {
					try {
						return resolveOne(input)
					}
					catch (e) {
						return {
							input,
							error: e instanceof Error ? e.message : String(e)
						}
					}
				})
				return ok(JSON.stringify(results, null, 2))
			}
			return ok(JSON.stringify(resolveOne(p), null, 2))
		}
		catch (e) {
			return err(e)
		}
	}
)

// ─── fs_config ─────────────────────────────────────────────────────────────

server.registerTool(
	'fs_config',
	{
		description: 'Show current fs-mcp configuration: mode, home, WSL settings, allowed roots, and example path resolutions. Read-only.',
		inputSchema: {},
		annotations: { readOnlyHint: true }
	},
	async () => {
		const examples: Record<string, string> = {}
		const tryResolve = (label: string, raw: string) => {
			try {
				examples[label] = translator.translate(raw)
			}
			catch (e) {
				examples[label] = `(error: ${e instanceof Error ? e.message : String(e)})`
			}
		}
		tryResolve('~', '~')
		tryResolve('~/Dropbox', '~/Dropbox')
		tryResolve('~/.claude', '~/.claude')
		tryResolve('%APPDATA%', '%APPDATA%')
		tryResolve('C:\\Code\\Unity', 'C:\\Code\\Unity')
		tryResolve('/home/samfr', '/home/samfr')
		tryResolve('/mnt/c/foo', '/mnt/c/foo')

		return ok(JSON.stringify({
			mode: MODE,
			platform: process.platform,
			home: HOME,
			wsl: wslConfig ?? null,
			allowed_roots: ALLOWED_ROOTS,
			example_resolutions: examples
		}, null, 2))
	}
)

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
	const transport = new StdioServerTransport()
	await server.connect(transport)
}

main().catch(e => {
	console.error('fs-mcp fatal:', e)
	process.exit(1)
})
