import type { CallToolResult } from '@modelcontextprotocol/server'
import { convertibleByName, convertibleType } from '../convert'
import { DropboxError } from '../dropbox/client'
import { contentHash } from '../dropbox/hash'
import type { DbxAccount, DbxListFolderResult, DbxMetadata, DbxSearchResult } from '../dropbox/types'
import { inScope, nsPath, parentPath } from '../scope'
import { decodeText, encodeText, sliceLines, toBase64 } from '../text'
import {
	decodeCursor,
	describeEntry,
	encodeCursor,
	json,
	openUrl,
	requireFolder,
	resolve,
	ToolError,
	verifyWrite,
	type ToolContext
} from './context'
import { ensurePrivateLink } from './sharing'

export async function whoAmI(ctx: ToolContext) {
	const account = await ctx.dropbox.rpc<DbxAccount>('users/get_current_account')
	return json({
		account_id: account.account_id,
		display_name: account.name.display_name,
		email: account.email,
		country: account.country,
		locale: account.locale,
		team_id: account.team?.id,
		team_name: account.team?.name,
		root_namespace_id: account.root_info.root_namespace_id,
		home_namespace_id: account.root_info.home_namespace_id,
		scope_root: ctx.scope.root
	})
}

export interface ListFolderArgs {
	path?: string
	cursor?: string
	recursive?: boolean
	object_types?: ('file' | 'folder')[]
	max_results?: number
}

export async function listFolder(ctx: ToolContext, args: ListFolderArgs) {
	let page: DbxListFolderResult
	let types: string[] | undefined
	if (args.cursor != null) {
		if (args.path != null || args.recursive != null || args.object_types != null || args.max_results != null)
			throw new ToolError('Send cursor alone when paginating; drop path and the other options.')
		const cursor = decodeCursor<{ c: string, t?: string[] }>(args.cursor)
		types = cursor.t
		page = await ctx.dropbox.rpc<DbxListFolderResult>('files/list_folder/continue', { cursor: cursor.c })
	}
	else {
		if (args.path == null)
			throw new ToolError('path is required on the first list_folder call')
		const path = await resolve(ctx, args.path)
		types = args.object_types?.length ? args.object_types : undefined
		page = await ctx.dropbox.rpc<DbxListFolderResult>(
			'files/list_folder',
			{
				path,
				recursive: args.recursive ?? true,
				limit: args.max_results || 300
			})
	}
	const entries = page.entries
		.filter(e => e['.tag'] != 'deleted' && e.path_display != null && inScope(ctx.scope, e.path_display))
		.filter(e => types == null || types.includes(e['.tag']))
		.map(e => describeEntry(ctx.scope, e))
	return json({
		entries,
		cursor: page.has_more ? encodeCursor({ c: page.cursor, t: types }) : '',
		has_more: page.has_more
	})
}

export interface SearchArgs {
	query?: string
	cursor?: string
	path?: string
	max_results?: number
	file_extensions?: string[]
	file_categories?: string[]
	filename_only?: boolean
	search_mode?: 'title_only'
	include_folders?: boolean
	order_by?: 'relevance' | 'last_modified'
	reverse_order?: boolean
	last_modified_after?: string
	last_modified_before?: string
}

interface SearchState {
	c: string
	f: boolean
	r: boolean
	a?: string
	b?: string
}

const matchTypes: Record<string, string> = {
	filename: 'FILENAME',
	file_content: 'FILE_CONTENT',
	filename_and_content: 'BOTH_FILENAME_AND_CONTENT',
	image_content: 'IMAGE_CONTENT'
}

export async function search(ctx: ToolContext, args: SearchArgs) {
	let page: DbxSearchResult
	let state: SearchState
	if (args.cursor != null) {
		if (Object.entries(args).some(([key, value]) => key != 'cursor' && value != null))
			throw new ToolError('Send cursor alone when paginating; drop query and the filters.')
		state = decodeCursor<SearchState>(args.cursor)
		page = await ctx.dropbox.rpc<DbxSearchResult>('files/search/continue_v2', { cursor: state.c })
	}
	else {
		if (!args.query)
			throw new ToolError('query is required for a new search')
		if (args.search_mode == 'title_only' && args.filename_only == false)
			throw new ToolError('search_mode=title_only can\'t be combined with filename_only=false')
		const path = await resolve(ctx, args.path || ctx.scope.root)
		state = {
			c: '',
			f: args.include_folders == true,
			r: args.reverse_order == true,
			a: args.last_modified_after,
			b: args.last_modified_before
		}
		page = await ctx.dropbox.rpc<DbxSearchResult>(
			'files/search_v2',
			{
				query: args.query,
				options: {
					path,
					max_results: args.max_results ?? 100,
					file_status: 'active',
					filename_only: args.filename_only == true || args.search_mode == 'title_only',
					file_extensions: args.file_extensions,
					file_categories: args.file_categories?.map(c => c.toLowerCase()),
					order_by: args.order_by == null ? undefined : args.order_by == 'last_modified' ? 'last_modified_time' : 'relevance'
				}
			})
	}
	const after = state.a == null ? undefined : Date.parse(state.a)
	const before = state.b == null ? undefined : Date.parse(state.b)
	const results = page.matches
		.map(match => ({ match, m: match.metadata.metadata }))
		.filter(({ m }) => m.path_display != null && inScope(ctx.scope, m.path_display))
		.filter(({ m }) => state.f || m['.tag'] == 'file')
		.filter(({ m }) => {
			const modified = m.server_modified == null ? undefined : Date.parse(m.server_modified)
			return (after == null || (modified != null && modified >= after))
				&& (before == null || (modified != null && modified <= before))
		})
		.map(({ match, m }, index) => ({
			id: m.id ?? '',
			title: m.name,
			url: openUrl(m),
			path: nsPath(ctx.scope, m.path_display!),
			path_display: m.path_display,
			object_type: m['.tag'],
			match_type: matchTypes[match.match_type?.['.tag'] ?? ''] ?? match.match_type?.['.tag'],
			size: m.size,
			last_modified: m.server_modified,
			rev: m.rev,
			rank: index + 1
		}))
	if (state.r)
		results.reverse()
	return json({
		results,
		has_more: page.has_more,
		cursor: page.has_more && page.cursor != null ? encodeCursor({ ...state, c: page.cursor }) : '',
		total_results: results.length
	})
}

export interface FetchArgs {
	id: string
	start_line?: number
	end_line?: number
}

export async function fetchFile(ctx: ToolContext, args: FetchArgs): Promise<CallToolResult> {
	const path = await resolve(ctx, args.id)
	const info = await ctx.dropbox.rpc<DbxMetadata>('files/get_metadata', { path })
	if (info['.tag'] != 'file')
		throw new ToolError(`${args.id} is a folder, not a file. Use list_folder.`)
	// Documents that get extracted return a little text however large the file, so they get a higher limit
	const limit = convertibleByName(info.name) != undefined ? ctx.maxExtractBytes : ctx.maxReadBytes
	if ((info.size ?? 0) > limit)
		throw new ToolError(`${info.path_display} is ${info.size} bytes; the read limit for this file is ${limit} bytes. Use download_link instead.`)
	const { metadata, bytes } = await ctx.dropbox.download(path)
	if (metadata.content_hash != null && await contentHash(bytes) != metadata.content_hash)
		throw new ToolError(`The bytes downloaded for rev ${metadata.rev} don't match Dropbox's content_hash. Not returning possibly corrupt content.`)
	const text = decodeText(bytes)
	if (bytes.length > ctx.maxReadBytes && (text != undefined || convertibleType(metadata.name, bytes) == undefined))
		throw new ToolError(`${metadata.path_display} is ${bytes.length} bytes but isn't a document that can be extracted; the read limit for it is ${ctx.maxReadBytes} bytes. Use download_link instead.`)
	const ranged = args.start_line != null || args.end_line != null
	if (ranged && text == undefined)
		throw new ToolError('start_line/end_line only apply to UTF-8 text files; this file is binary.')
	let lines: ReturnType<typeof sliceLines> | undefined
	try {
		lines = ranged ? sliceLines(text!, args.start_line ?? 1, args.end_line) : undefined
	}
	catch (error) {
		throw new ToolError((error as Error).message)
	}
	const extractFrom = text == undefined ? convertibleType(metadata.name, bytes) : undefined
	const extracted = extractFrom == undefined ? undefined : await extractText(ctx, metadata, bytes, extractFrom)
	const header = {
		id: args.id,
		title: metadata.name,
		url: openUrl(metadata),
		encoding: extracted != undefined ? 'extracted' : text == undefined ? 'base64' : 'utf-8',
		extracted_from: extracted == undefined ? undefined : extractFrom,
		tokens: extracted?.tokens,
		metadata: {
			path_display: metadata.path_display,
			path: metadata.path_display == null ? undefined : nsPath(ctx.scope, metadata.path_display),
			file_id: metadata.id,
			rev: metadata.rev,
			content_hash: metadata.content_hash,
			size: metadata.size ?? 0,
			server_modified: metadata.server_modified,
			client_modified: metadata.client_modified
		},
		lines: lines == null ? undefined : { start: lines.start, end: lines.end, total: lines.total },
		contents: extracted != undefined
			? 'The next content block is text extracted from this file as Markdown, not the file as stored: layout and images are not included, and it can\'t be edited in place.'
			: 'The next content block is the file exactly as stored'
				+ (text == undefined ? ', base64-encoded because it is not UTF-8 text.' : ', byte for byte. Pass metadata.rev as expected_rev to edit it.')
	}
	return {
		content: [
			{ type: 'text', text: JSON.stringify(header, null, 2) },
			{ type: 'text', text: lines?.text ?? text ?? extracted?.markdown ?? toBase64(bytes) }
		]
	}
}

async function extractText(ctx: ToolContext, metadata: DbxMetadata, bytes: Uint8Array, mimeType: string) {
	const url = openUrl(metadata)
	if (ctx.convert == undefined)
		throw new ToolError(`Text extraction isn't configured on this server, so ${metadata.name} can't be read here. Open it in Dropbox: ${url}`)
	try {
		return await ctx.convert({ name: metadata.name, bytes, mimeType })
	}
	catch (error) {
		throw new ToolError(`Couldn't extract text from ${metadata.name}: ${(error as Error).message}. Open it in Dropbox: ${url}`)
	}
}

export async function getFileMetadata(ctx: ToolContext, args: { path_or_file_id: string }) {
	const path = await resolve(ctx, args.path_or_file_id)
	const m = await ctx.dropbox.rpc<DbxMetadata>('files/get_metadata', { path, include_has_explicit_shared_members: true })
	const common = {
		tag: m['.tag'],
		id: m.id,
		name: m.name,
		path_display: m.path_display,
		path_lower: m.path_lower,
		path: m.path_display == null ? undefined : nsPath(ctx.scope, m.path_display),
		sharing_info: m.sharing_info,
		url: openUrl(m)
	}
	if (m['.tag'] != 'file')
		return json({ metadata_type: 'folder', folder: common })
	const dot = m.name.lastIndexOf('.')
	return json({
		metadata_type: 'file',
		file: {
			...common,
			client_modified: m.client_modified,
			server_modified: m.server_modified,
			size: m.size ?? 0,
			size_display: formatSize(m.size ?? 0),
			is_downloadable: m.is_downloadable,
			rev: m.rev,
			content_hash: m.content_hash,
			ext: dot > 0 ? m.name.slice(dot + 1).toLowerCase() : '',
			has_explicit_shared_members: m.has_explicit_shared_members
		}
	})
}

function formatSize(bytes: number) {
	const units = ['B', 'KB', 'MB', 'GB']
	let value = bytes
	let unit = 0
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit++
	}
	return unit == 0
		? `${bytes} B`
		: `${value.toFixed(1)} ${units[unit]}`
}

const thumbnailExtensions = new Set(['jpg', 'jpeg', 'png', 'tiff', 'tif', 'gif', 'webp', 'ppm', 'bmp', 'heic'])

export async function filePreview(ctx: ToolContext, args: { file_paths: string[] }): Promise<CallToolResult> {
	const results: Record<string, unknown>[] = []
	const images: { type: 'image', data: string, mimeType: string }[] = []
	for (const input of args.file_paths) {
		try {
			const path = await resolve(ctx, input)
			const m = await ctx.dropbox.rpc<DbxMetadata>('files/get_metadata', { path })
			const dot = m.name.lastIndexOf('.')
			const ext = dot > 0 ? m.name.slice(dot + 1).toLowerCase() : ''
			const { link } = await ensurePrivateLink(ctx, path)
			let message = m['.tag'] == 'folder'
				? 'Folder'
				: `${formatSize(m.size ?? 0)} file, rev ${m.rev}`
			if (m['.tag'] == 'file' && thumbnailExtensions.has(ext)) {
				const { bytes } = await ctx.dropbox.content(
					'files/get_thumbnail_v2',
					{
						resource: { '.tag': 'path', path },
						format: 'jpeg',
						size: 'w256h256',
						mode: 'bestfit'
					})
				images.push({ type: 'image', data: toBase64(bytes), mimeType: 'image/jpeg' })
				message += `; thumbnail is image ${images.length} below`
			}
			results.push({
				file_name: m.name,
				file_type: m['.tag'] == 'folder' ? 'folder' : ext,
				open_in_dropbox_url: openUrl(m),
				copy_link_url: link.url,
				thumbnail_url: '',
				message
			})
		}
		catch (error) {
			results.push({ file_name: input, message: `Preview failed: ${error instanceof Error ? error.message : String(error)}` })
		}
	}
	return { content: [{ type: 'text', text: JSON.stringify({ results }, null, 2) }, ...images] }
}

export async function downloadLink(ctx: ToolContext, args: { entries: string[], expiration_in_sec?: number }) {
	if (args.entries.length == 0 || args.entries.length > 25)
		throw new ToolError('entries must hold 1 to 25 files')
	const paths: string[] = []
	for (const entry of args.entries)
		paths.push(await resolve(ctx, entry))
	const entries = []
	for (const path of paths) {
		const { metadata: m, link } = await ctx.dropbox.rpc<{ metadata: DbxMetadata, link: string }>('files/get_temporary_link', { path })
		entries.push({
			download_url: link,
			expiration_in_sec: 14400,
			path: m.path_display == null ? undefined : nsPath(ctx.scope, m.path_display),
			path_display: m.path_display,
			name: m.name,
			id: m.id,
			size: m.size ?? 0,
			content_hash: m.content_hash,
			rev: m.rev
		})
	}
	const requested = args.expiration_in_sec ?? 0
	return json({
		entries,
		note: 'Dropbox temporary links last 4 hours and are not single-use. Anyone with the URL can download the file until it expires.'
			+ (requested != 0 && requested != 14400 ? ` expiration_in_sec=${requested} was not applied: Dropbox's API doesn't let callers set it.` : '')
	})
}

export async function createFile(ctx: ToolContext, args: { path: string, content: string }) {
	const path = await resolve(ctx, args.path, { forbidRoot: true })
	const bytes = encodeText(args.content)
	if (bytes.length > ctx.maxWriteBytes)
		throw new ToolError(`CONTENT_TOO_LARGE: ${bytes.length} bytes; the limit is ${ctx.maxWriteBytes}.`)
	await requireFolder(ctx, parentPath(path))
	let written: DbxMetadata
	try {
		written = await ctx.dropbox.upload(path, bytes, { '.tag': 'add' })
	}
	catch (error) {
		if (error instanceof DropboxError && error.summary.startsWith('path/conflict'))
			throw new ToolError(`ALREADY_EXISTS: something already exists at ${args.path}. Nothing was written. To change an existing file, use overwrite or an edit tool with its rev.`)
		throw error
	}
	return json({ file: describeEntry(ctx.scope, written), ...await verifyWrite(bytes, written) })
}

export async function createFolder(ctx: ToolContext, args: { path: string }) {
	const path = await resolve(ctx, args.path, { forbidRoot: true })
	await requireFolder(ctx, parentPath(path))
	let created: { metadata: DbxMetadata }
	try {
		created = await ctx.dropbox.rpc<{ metadata: DbxMetadata }>('files/create_folder_v2', { path, autorename: false })
	}
	catch (error) {
		if (error instanceof DropboxError && error.summary.startsWith('path/conflict'))
			throw new ToolError(`ALREADY_EXISTS: something already exists at ${args.path}.`)
		throw error
	}
	return json({ folder: describeEntry(ctx.scope, { ...created.metadata, '.tag': 'folder' }) })
}
