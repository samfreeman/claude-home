import { contentHash } from '../src/dropbox/hash'
import type { DbxMetadata, DbxSharedLink } from '../src/dropbox/types'

interface Entry {
	tag: 'file' | 'folder'
	path: string
	id: string
	rev?: string
	bytes?: Uint8Array
	hash?: string
	modified: string
}

type Json = Record<string, any>

class Reply {
	constructor(readonly status: number, readonly body: unknown, readonly bytes?: Uint8Array) {}
}

const ok = (body: unknown, bytes?: Uint8Array) =>
	new Reply(200, body, bytes)

const conflict = (summary: string, error: unknown) =>
	new Reply(409, { error_summary: summary, error })

export const rootNamespaceId = '100'
export const accountId = 'dbid:test-account'

export class FakeDropbox {
	readonly entries = new Map<string, Entry>()
	readonly links = new Map<string, DbxSharedLink>()
	readonly fileRequests = new Map<string, Json>()
	readonly calls: string[] = []
	asyncJobs = false
	pendingChecks = 0
	beforeUpload?: (path: string) => Promise<void>
	private jobs = new Map<string, Json>()
	private counter = 0

	constructor() {
		this.addFolder('/Claude')
		this.addFolder('/Private')
	}

	private next() {
		this.counter++
		return this.counter.toString(16).padStart(9, '0')
	}

	private key = (path: string) =>
		path.toLowerCase()

	addFolder(path: string) {
		this.entries.set(this.key(path), { tag: 'folder', path, id: `id:folder${this.next()}`, modified: new Date().toISOString() })
	}

	async addFile(path: string, content: string | Uint8Array) {
		const bytes = typeof content == 'string' ? new TextEncoder().encode(content) : content
		const existing = this.entries.get(this.key(path))
		const entry: Entry = {
			tag: 'file',
			path: existing?.path ?? path,
			id: existing?.id ?? `id:file${this.next()}`,
			rev: `rev${this.next()}`,
			bytes,
			hash: await contentHash(bytes),
			modified: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
		}
		this.entries.set(this.key(path), entry)
		return entry
	}

	file(path: string) {
		return this.entries.get(this.key(path))
	}

	text(path: string) {
		return new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }).decode(this.file(path)?.bytes)
	}

	private metadata(entry: Entry): DbxMetadata {
		const name = entry.path.slice(entry.path.lastIndexOf('/') + 1)
		const common = { name, id: entry.id, path_lower: entry.path.toLowerCase(), path_display: entry.path }
		return entry.tag == 'folder'
			? { '.tag': 'folder', ...common }
			: {
				'.tag': 'file',
				...common,
				rev: entry.rev,
				size: entry.bytes!.length,
				content_hash: entry.hash,
				server_modified: entry.modified,
				client_modified: entry.modified,
				is_downloadable: true
			}
	}

	private lookup(path: string) {
		if (path.startsWith('id:')) {
			const slash = path.indexOf('/')
			const id = slash == -1 ? path : path.slice(0, slash)
			const base = [...this.entries.values()].find(e => e.id == id)
			if (base == null)
				return undefined
			return slash == -1 ? base : this.entries.get(this.key(base.path + path.slice(slash)))
		}
		return this.entries.get(this.key(path))
	}

	private parentExists(path: string) {
		const parent = path.slice(0, path.lastIndexOf('/'))
		return parent == '' || this.entries.get(this.key(parent))?.tag == 'folder'
	}

	private children(path: string, recursive: boolean) {
		const prefix = this.key(path) + '/'
		return [...this.entries.values()]
			.filter(e => e.path.toLowerCase().startsWith(prefix))
			.filter(e => recursive || !e.path.slice(prefix.length).includes('/'))
			.sort((a, b) => a.path.localeCompare(b.path))
	}

	readonly fetch = async (input: string, init?: RequestInit) => {
		const url = new URL(input)
		const endpoint = url.pathname.replace(/^\/2\//, '')
		this.calls.push(endpoint)
		const headers = new Headers(init?.headers)
		if (headers.get('authorization') != 'Bearer test-token')
			return Response.json({ error_summary: 'invalid_access_token/' }, { status: 401 })
		const isContent = url.hostname == 'content.dropboxapi.com'
		const args = isContent
			? JSON.parse(headers.get('dropbox-api-arg')!)
			: init?.body == null ? null : JSON.parse(init.body as string)
		const body = isContent && init?.body != null ? new Uint8Array(init.body as Uint8Array) : undefined
		const reply = await this.handle(endpoint, args, body)
		if (reply.status != 200)
			return Response.json(reply.body, { status: reply.status })
		if (reply.bytes != null)
			return new Response(reply.bytes as Uint8Array<ArrayBuffer>, { headers: { 'Dropbox-API-Result': JSON.stringify(reply.body) } })
		return Response.json(reply.body)
	}

	private async handle(endpoint: string, args: Json, body?: Uint8Array): Promise<Reply> {
		switch (endpoint) {
			case 'users/get_current_account':
				return ok({
					account_id: accountId,
					name: { display_name: 'Test User' },
					email: 'test@example.com',
					country: 'US',
					locale: 'en',
					root_info: { '.tag': 'user', root_namespace_id: rootNamespaceId, home_namespace_id: rootNamespaceId }
				})
			case 'files/get_metadata': {
				const entry = this.lookup(args.path)
				return entry == null
					? conflict('path/not_found/', { '.tag': 'path', path: { '.tag': 'not_found' } })
					: ok(this.metadata(entry))
			}
			case 'files/download': {
				const entry = this.lookup(args.path)
				if (entry == null)
					return conflict('path/not_found/', { '.tag': 'path', path: { '.tag': 'not_found' } })
				if (entry.tag != 'file')
					return conflict('path/not_file/', { '.tag': 'path', path: { '.tag': 'not_file' } })
				return ok(this.metadata(entry), entry.bytes)
			}
			case 'files/upload':
				return this.upload(args, body!)
			case 'files/create_folder_v2': {
				if (this.lookup(args.path) != null)
					return conflict('path/conflict/folder/', { '.tag': 'path', path: { '.tag': 'conflict' } })
				this.addFolder(args.path)
				const { '.tag': _, ...metadata } = this.metadata(this.lookup(args.path)!)
				return ok({ metadata })
			}
			case 'files/list_folder': {
				const all = this.children(args.path, args.recursive).map(e => this.metadata(e))
				return this.listPage(all, 0, args.limit)
			}
			case 'files/list_folder/continue': {
				const { all, offset, limit } = JSON.parse(args.cursor)
				return this.listPage(all, offset, limit)
			}
			case 'files/search_v2': {
				const query = String(args.query).toLowerCase()
				const matches = this.children(args.options.path, true)
					.filter(e => e.path.slice(e.path.lastIndexOf('/') + 1).toLowerCase().includes(query))
					.map(e => ({ match_type: { '.tag': 'filename' }, metadata: { '.tag': 'metadata', metadata: this.metadata(e) } }))
				return ok({ matches, has_more: false })
			}
			case 'files/get_temporary_link': {
				const entry = this.lookup(args.path)
				return entry == null
					? conflict('path/not_found/', { '.tag': 'path' })
					: ok({ metadata: this.metadata(entry), link: `https://dl.example/${entry.id}` })
			}
			case 'files/get_thumbnail_v2':
				return ok({ file_metadata: {} }, new Uint8Array([0xff, 0xd8, 0xff]))
			case 'files/copy_batch_v2':
			case 'files/move_batch_v2':
				return this.batch(await this.relocate(args.entries, endpoint == 'files/move_batch_v2'))
			case 'files/delete_batch':
				return this.batch(args.entries.map((e: Json) => this.remove(e.path)))
			case 'files/copy_batch/check_v2':
			case 'files/move_batch/check_v2':
			case 'files/delete_batch/check': {
				const job = this.jobs.get(args.async_job_id)
				if (job == null)
					return conflict('invalid_async_job_id/', { '.tag': 'invalid_async_job_id' })
				if (this.pendingChecks > 0) {
					this.pendingChecks--
					return ok({ '.tag': 'in_progress' })
				}
				return ok(job)
			}
			case 'sharing/create_shared_link_with_settings': {
				const entry = this.lookup(args.path)!
				const existing = this.links.get(entry.path.toLowerCase())
				if (existing != null)
					return conflict('shared_link_already_exists/metadata/', {
						'.tag': 'shared_link_already_exists',
						shared_link_already_exists: { '.tag': 'metadata', metadata: existing }
					})
				const link: DbxSharedLink = {
					'.tag': entry.tag,
					url: `https://www.dropbox.com/scl/fi/${entry.id}`,
					name: entry.path.slice(entry.path.lastIndexOf('/') + 1),
					id: entry.id,
					path_lower: entry.path.toLowerCase(),
					expires: args.settings.expires,
					link_permissions: {
						effective_audience: { '.tag': args.settings.audience },
						link_access_level: { '.tag': args.settings.access },
						require_password: args.settings.require_password ?? false,
						allow_download: args.settings.allow_download ?? true
					}
				}
				this.links.set(entry.path.toLowerCase(), link)
				return ok(link)
			}
			case 'sharing/list_shared_links': {
				const links = [...this.links.values()]
					.filter(l => args.path == null || l.path_lower == this.lookup(args.path)?.path.toLowerCase())
				return ok({ links, has_more: false })
			}
			case 'sharing/get_shared_link_metadata': {
				const link = [...this.links.values()].find(l => l.url == args.url)
				return link == null
					? conflict('shared_link_not_found/', { '.tag': 'shared_link_not_found' })
					: ok(link)
			}
			case 'sharing/add_file_member':
				return ok(args.members.map((m: Json) => ({ member: { '.tag': 'email', email: m.email }, result: { '.tag': 'success' } })))
			case 'file_requests/create': {
				const id = `fr${this.next()}`
				const request = {
					id,
					url: `https://www.dropbox.com/request/${id}`,
					title: args.title,
					destination: args.destination,
					created: '2026-11-03T00:00:00Z',
					is_open: args.open,
					file_count: 0,
					deadline: args.deadline == null
						? undefined
						: { deadline: args.deadline.deadline, allow_late_uploads: args.deadline.allow_late_uploads == null ? undefined : { '.tag': args.deadline.allow_late_uploads } },
					description: args.description
				}
				if (this.lookup(args.destination) == null)
					this.addFolder(args.destination)
				this.fileRequests.set(id, request)
				return ok(request)
			}
			case 'file_requests/get': {
				const request = this.fileRequests.get(args.id)
				return request == null ? conflict('not_found/', { '.tag': 'not_found' }) : ok(request)
			}
			case 'file_requests/list_v2':
				return ok({ file_requests: [...this.fileRequests.values()], cursor: '', has_more: false })
			default:
				return new Reply(400, { error_summary: `fake has no endpoint ${endpoint}` })
		}
	}

	private listPage(all: DbxMetadata[], offset: number, limit: number) {
		const end = offset + limit
		const has_more = end < all.length
		return ok({
			entries: all.slice(offset, end),
			has_more,
			cursor: has_more ? JSON.stringify({ all, offset: end, limit }) : ''
		})
	}

	private async upload(args: Json, body: Uint8Array) {
		if (this.beforeUpload != null)
			await this.beforeUpload(args.path)
		const existing = this.lookup(args.path)
		const mode = args.mode['.tag']
		const conflictReply = () =>
			conflict('path/conflict/file/...', { '.tag': 'path', path: { reason: { '.tag': 'conflict', conflict: { '.tag': 'file' } } } })
		if (mode == 'add' && existing != null)
			return conflictReply()
		if (mode == 'update' && (existing == null || existing.rev != args.mode.update || args.strict_conflict != true))
			return conflictReply()
		if (!this.parentExists(args.path)) {
			const parent = args.path.slice(0, args.path.lastIndexOf('/'))
			this.addFolder(parent)
		}
		if (existing != null && existing.hash == await contentHash(body))
			return ok(this.metadata(existing))
		return ok(this.metadata(await this.addFile(args.path, body)))
	}

	private async relocate(entries: Json[], move: boolean) {
		const results = []
		for (const entry of entries) {
			const source = this.lookup(entry.from_path)
			if (source == null) {
				results.push({ '.tag': 'failure', failure: { '.tag': 'relocation_error', relocation_error: { '.tag': 'from_lookup', from_lookup: { '.tag': 'not_found' } } } })
				continue
			}
			if (this.lookup(entry.to_path) != null) {
				results.push({ '.tag': 'failure', failure: { '.tag': 'relocation_error', relocation_error: { '.tag': 'to', to: { '.tag': 'conflict', conflict: { '.tag': 'file' } } } } })
				continue
			}
			const moved = [source, ...this.children(source.path, true)]
			for (const item of moved) {
				const target = entry.to_path + item.path.slice(source.path.length)
				const copy = { ...item, path: target, id: move ? item.id : `id:copy${this.next()}`, rev: item.tag == 'file' ? `rev${this.next()}` : undefined }
				if (move)
					this.entries.delete(this.key(item.path))
				this.entries.set(this.key(target), copy)
			}
			results.push({ '.tag': 'success', success: this.metadata(this.lookup(entry.to_path)!) })
		}
		return results
	}

	private remove(path: string) {
		const entry = this.lookup(path)
		if (entry == null)
			return { '.tag': 'failure', failure: { '.tag': 'path_lookup', path_lookup: { '.tag': 'not_found' } } }
		const metadata = this.metadata(entry)
		for (const item of [entry, ...this.children(entry.path, true)])
			this.entries.delete(this.key(item.path))
		return { '.tag': 'success', metadata }
	}

	private batch(results: Json[]) {
		const complete = { '.tag': 'complete', entries: results }
		if (!this.asyncJobs)
			return ok(complete)
		const id = `dbjid:job${this.next()}`
		this.jobs.set(id, complete)
		return ok({ '.tag': 'async_job_id', async_job_id: id })
	}
}
