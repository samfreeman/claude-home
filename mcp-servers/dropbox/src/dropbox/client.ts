import type { DbxMetadata } from './types'

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

export class DropboxError extends Error {
	constructor(
		readonly endpoint: string,
		readonly status: number,
		readonly summary: string,
		readonly error: unknown) {
		super(`Dropbox ${endpoint} failed (HTTP ${status}): ${summary}`)
	}
}

export type WriteMode =
	| { '.tag': 'add' }
	| { '.tag': 'overwrite' }
	| { '.tag': 'update', update: string }

const apiBase = 'https://api.dropboxapi.com/2/'
const contentBase = 'https://content.dropboxapi.com/2/'

// HTTP headers must be ASCII, so Dropbox wants non-ASCII JSON escaped.
export const headerArg = (value: unknown) =>
	JSON.stringify(value).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))

export async function toDropboxError(endpoint: string, response: Response) {
	const text = await response.text()
	let parsed: { error_summary?: string, error?: unknown } | undefined
	try {
		parsed = JSON.parse(text)
	}
	catch {
		parsed = undefined
	}
	const retry = response.headers.get('retry-after')
	const summary = (parsed?.error_summary ?? (text || response.statusText))
		+ (retry == null ? '' : ` (retry after ${retry}s)`)
	return new DropboxError(endpoint, response.status, summary, parsed?.error)
}

export class DropboxClient {
	constructor(
		private readonly fetchFn: FetchFn,
		private readonly getToken: () => Promise<string>) {}

	async rpc<T>(endpoint: string, args?: unknown): Promise<T> {
		const headers: Record<string, string> = { Authorization: `Bearer ${await this.getToken()}` }
		if (args != null)
			headers['Content-Type'] = 'application/json'
		const response = await this.fetchFn(
			apiBase + endpoint,
			{
				method: 'POST',
				headers,
				body: args == null ? undefined : JSON.stringify(args)
			})
		if (!response.ok)
			throw await toDropboxError(endpoint, response)
		return await response.json() as T
	}

	async content(endpoint: string, arg: unknown, body?: Uint8Array) {
		const headers: Record<string, string> = {
			'Authorization': `Bearer ${await this.getToken()}`,
			'Dropbox-API-Arg': headerArg(arg)
		}
		if (body != null)
			headers['Content-Type'] = 'application/octet-stream'
		const response = await this.fetchFn(contentBase + endpoint, { method: 'POST', headers, body })
		if (!response.ok)
			throw await toDropboxError(endpoint, response)
		const header = response.headers.get('dropbox-api-result')
		const bytes = new Uint8Array(await response.arrayBuffer())
		return header == null
			? { result: JSON.parse(new TextDecoder().decode(bytes)) as unknown, bytes: new Uint8Array() }
			: { result: JSON.parse(header) as unknown, bytes }
	}

	async download(path: string) {
		const { result, bytes } = await this.content('files/download', { path })
		return { metadata: result as DbxMetadata, bytes }
	}

	async upload(path: string, bytes: Uint8Array, mode: WriteMode) {
		const { result } = await this.content(
			'files/upload',
			{
				path,
				mode,
				autorename: false,
				mute: false,
				strict_conflict: true
			},
			bytes)
		return result as DbxMetadata
	}
}
