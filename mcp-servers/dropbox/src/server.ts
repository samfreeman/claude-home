import { McpServer, type CallToolResult, type ToolAnnotations } from '@modelcontextprotocol/server'
import * as z from 'zod'
import { failure, type ToolContext } from './tools/context'
import { appendText, insertText, overwrite, strReplace } from './tools/edit'
import { createFileRequest, getFileRequest, listFileRequests } from './tools/file-requests'
import {
	createFile,
	createFolder,
	downloadLink,
	fetchFile,
	filePreview,
	getFileMetadata,
	listFolder,
	search,
	whoAmI
} from './tools/files'
import { checkJobStatus, deleteEntries, relocate } from './tools/jobs'
import { createSharedLink, getSharedLinkMetadata, listSharedLinks } from './tools/sharing'

export const serverVersion = '0.1.0'

const pathHelp = 'Accepts a path like "/Claude/notes.md", an ns_path like "ns:123//Claude/notes.md", or a file id like "id:AbCd-_12".'

const instructions = (root: string) => `Dropbox file tools scoped to ${root}: nothing outside ${root} can be read or changed.

Reads are verbatim. fetch returns two content blocks: a JSON header (metadata, including rev and content_hash) and the file's contents exactly as stored, byte for byte, with no HTML-to-text conversion or sanitizing. Binary files come back base64-encoded.

Edits are rev-safe. str_replace, append, insert and overwrite each take expected_rev (from fetch or get_file_metadata) and use Dropbox's rev-pinned update mode: if the file changed since you read it, the write fails and nothing is written. Every write returns the new rev plus Dropbox's content_hash, checked against the bytes sent (verified: true). Bytes outside the edited text are preserved exactly.

Failures are reported plainly and never retried or worked around. Large copy, move and delete jobs may return in_progress; poll check_job_status with the operation_id.`

const readOnly: ToolAnnotations = { readOnlyHint: true, openWorldHint: false }
const writes: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
const destructive: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, openWorldHint: false }

type Run<S extends z.ZodObject> = (args: z.infer<S>) => Promise<CallToolResult>

function register<S extends z.ZodObject>(
	server: McpServer,
	name: string,
	description: string,
	schema: S,
	annotations: ToolAnnotations,
	run: Run<S>) {
	const callback = async (args: z.infer<S>) => {
		try {
			return await run(args)
		}
		catch (error) {
			return failure(error)
		}
	}
	server.registerTool(name, { description, inputSchema: schema, annotations }, callback as never)
}

const path = z.string().describe(pathHelp)
const expectedRev = z.string().describe('The rev returned by your latest fetch or get_file_metadata of this file. A stale rev fails the write.')

export function buildServer(ctx: ToolContext) {
	const server = new McpServer({ name: 'dropbox', version: serverVersion }, { instructions: instructions(ctx.scope.root) })
	const root = ctx.scope.root

	register(
		server,
		'who_am_i',
		'Get the connected Dropbox user\'s identity, team, namespace roots, and the folder this server is scoped to.',
		z.object({}),
		readOnly,
		() => whoAmI(ctx))

	register(
		server,
		'list_folder',
		`List folder contents under ${root}, with cursor pagination. recursive defaults to true; pass recursive=false for immediate children only. `
		+ 'Pagination: send cursor alone. Treat results as partial while has_more is true. File entries include rev and content_hash.',
		z.object({
			path: path.optional().describe(`Folder to list (first call only). ${pathHelp}`),
			cursor: z.string().min(1).optional().describe('Cursor from a previous list_folder response; send it alone.'),
			recursive: z.boolean().optional(),
			object_types: z.array(z.enum(['file', 'folder'])).optional(),
			max_results: z.number().int().min(0).max(600).optional()
		}),
		readOnly,
		args => listFolder(ctx, args))

	register(
		server,
		'search',
		`Search files (and optionally folders) under ${root} by name or content. A new search needs query; pagination sends cursor alone. `
		+ 'Folders are returned only with include_folders=true.',
		z.object({
			query: z.string().min(1).optional(),
			cursor: z.string().min(1).optional(),
			path: z.string().optional().describe(`Folder to search within; defaults to ${root}.`),
			max_results: z.number().int().min(1).max(1000).optional(),
			file_extensions: z.array(z.string()).optional(),
			file_categories: z.array(z.string()).optional(),
			filename_only: z.boolean().optional(),
			search_mode: z.enum(['title_only']).optional(),
			include_folders: z.boolean().optional(),
			order_by: z.enum(['relevance', 'last_modified']).optional(),
			reverse_order: z.boolean().optional(),
			last_modified_after: z.string().optional(),
			last_modified_before: z.string().optional()
		}),
		readOnly,
		args => search(ctx, args))

	register(
		server,
		'fetch',
		'Read a file verbatim. Returns a JSON header (rev, content_hash, size, path) followed by a second content block holding the file '
		+ 'exactly as stored: HTML, XML, SVG and markdown come back byte for byte, angle brackets intact. Non-UTF-8 files come back base64. '
		+ `Optional start_line/end_line (1-based, inclusive) return just those lines verbatim. Max ${ctx.maxReadBytes} bytes.`,
		z.object({
			id: path,
			start_line: z.number().int().min(1).optional(),
			end_line: z.number().int().min(1).optional()
		}),
		readOnly,
		args => fetchFile(ctx, args))

	register(
		server,
		'get_file_metadata',
		'Get metadata for a file or folder, including the file\'s rev (needed to edit it) and content_hash.',
		z.object({ path_or_file_id: path }),
		readOnly,
		args => getFileMetadata(ctx, args))

	register(
		server,
		'file_preview',
		'Preview files: Open in Dropbox links, a private view-only share link (created or reused), and a thumbnail image for image files.',
		z.object({ file_paths: z.array(z.string()).min(1) }),
		writes,
		args => filePreview(ctx, args))

	register(
		server,
		'download_link',
		'Get temporary direct-download URLs for up to 25 files. If any entry fails, the whole call fails. '
		+ 'Dropbox temporary links last 4 hours; anyone with the URL can download, so treat it as sensitive.',
		z.object({
			entries: z.array(z.string()).min(1).max(25),
			expiration_in_sec: z.number().int().optional()
		}),
		readOnly,
		args => downloadLink(ctx, args))

	register(
		server,
		'create_file',
		'Create a new UTF-8 text file. Fails if anything already exists at the path; the parent folder must exist. '
		+ 'Returns the new rev and content_hash, verified against the bytes sent.',
		z.object({ path, content: z.string() }),
		writes,
		args => createFile(ctx, args))

	register(
		server,
		'create_folder',
		'Create a folder. The parent must already exist; fails if something exists at the path.',
		z.object({ path }),
		writes,
		args => createFolder(ctx, args))

	register(
		server,
		'str_replace',
		'Replace an exact string in an existing text file. old_str must match exactly once (overlapping matches count), else the call fails '
		+ 'and reports how many matches there were. Requires expected_rev; a stale rev fails without writing. Everything outside old_str is '
		+ 'preserved byte for byte. Returns the new rev and verified content_hash.',
		z.object({
			path,
			old_str: z.string().min(1),
			new_str: z.string(),
			expected_rev: expectedRev
		}),
		destructive,
		args => strReplace(ctx, args))

	register(
		server,
		'append',
		'Append text to the end of an existing text file, exactly as given (include a leading newline if you want one). '
		+ 'Requires expected_rev; returns the new rev.',
		z.object({ path, text: z.string(), expected_rev: expectedRev }),
		destructive,
		args => appendText(ctx, args))

	register(
		server,
		'insert',
		'Insert text at the start of line N (1-based) of an existing text file, exactly as given; include a trailing newline to make it its own line. '
		+ 'line may be one past the last line to add at the end. Requires expected_rev; returns the new rev.',
		z.object({
			path,
			line: z.number().int().min(1),
			text: z.string(),
			expected_rev: expectedRev
		}),
		destructive,
		args => insertText(ctx, args))

	register(
		server,
		'overwrite',
		'Replace the whole contents of an existing file. Requires expected_rev; a stale rev fails without writing. Returns the new rev.',
		z.object({ path, content: z.string(), expected_rev: expectedRev }),
		destructive,
		args => overwrite(ctx, args))

	const relocation = z.object({
		entries: z.array(z.object({ source_path: path, destination_path: path })).min(1).max(1000),
		autorename: z.boolean().optional()
	})

	register(
		server,
		'copy',
		'Copy files or folders to new locations (1-1000 entries). Returns per-entry results with each copy\'s rev and content_hash, '
		+ 'or status in_progress with an operation_id for check_job_status.',
		relocation,
		writes,
		args => relocate(ctx, 'copy', args))

	register(
		server,
		'move',
		'Move or rename files or folders (1-1000 entries). Returns per-entry results, or status in_progress with an operation_id for check_job_status.',
		relocation,
		destructive,
		args => relocate(ctx, 'move', args))

	register(
		server,
		'delete',
		'Delete files or folders (1-1000 entries). They go to Dropbox\'s Deleted files and stay recoverable; this is not a permanent wipe. '
		+ 'Returns per-entry results, or status in_progress with an operation_id.',
		z.object({ entries: z.array(z.object({ source_path: path })).min(1).max(1000) }),
		destructive,
		args => deleteEntries(ctx, args))

	register(
		server,
		'check_job_status',
		'Poll a copy, move or delete job by operation_id. wait_ms (0-30000) waits for completion. Completed jobs report every entry\'s result.',
		z.object({
			operation_id: z.string().min(1),
			wait_ms: z.number().int().optional()
		}),
		readOnly,
		args => checkJobStatus(ctx, args))

	register(
		server,
		'create_shared_link',
		'Create or reuse a private, view-only link (audience no_one) and optionally invite viewers by email (files only). '
		+ 'An existing link is never modified; a warning lists settings that differ.',
		z.object({
			path_or_file_id: path,
			emails: z.array(z.string()).optional(),
			audience: z.string().optional(),
			access_level: z.string().optional(),
			password: z.string().optional(),
			expires: z.string().optional(),
			allow_download: z.object({ value: z.boolean() }).nullable().optional()
		}),
		writes,
		args => createSharedLink(ctx, args))

	register(
		server,
		'list_shared_links',
		`List your shared links under ${root}, optionally for one path. Pagination: send cursor alone.`,
		z.object({
			path: z.string().optional(),
			cursor: z.string().min(1).optional()
		}),
		readOnly,
		args => listSharedLinks(ctx, args))

	register(
		server,
		'get_shared_link_metadata',
		`Inspect a shared link URL: its target, audience, access level and settings. Only links to items under ${root} are shown.`,
		z.object({ url: z.string() }),
		readOnly,
		args => getSharedLinkMetadata(ctx, args))

	register(
		server,
		'create_file_request',
		`Create a file request: a public upload URL that lets other people add files to a folder under ${root}.`,
		z.object({
			title: z.string().min(1),
			destination: path,
			deadline: z.string().optional(),
			deadline_allow_late_uploads: z.enum(['one_day', 'two_days', 'seven_days', 'thirty_days', 'always']).optional(),
			closed: z.boolean().optional(),
			description: z.string().optional(),
			video_project_id: z.string().optional()
		}),
		writes,
		args => createFileRequest(ctx, args))

	register(
		server,
		'get_file_request',
		'Get one file request by its raw id (from list_file_requests or create_file_request).',
		z.object({ id: z.string().min(1).regex(/^[-_0-9A-Za-z]+$/) }),
		readOnly,
		args => getFileRequest(ctx, args))

	register(
		server,
		'list_file_requests',
		`List your file requests whose destination is under ${root}. Pagination: send cursor alone.`,
		z.object({
			limit: z.number().int().min(0).max(1000).optional(),
			cursor: z.string().min(1).optional()
		}),
		readOnly,
		args => listFileRequests(ctx, args))

	return server
}
