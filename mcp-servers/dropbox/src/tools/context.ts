import type { CallToolResult } from '@modelcontextprotocol/server'
import { DropboxError, type DropboxClient } from '../dropbox/client'
import { contentHash } from '../dropbox/hash'
import type { DbxMetadata } from '../dropbox/types'
import { nsPath, parentPath, resolvePath, ScopeError, type Scope } from '../scope'

export interface ToolContext {
	dropbox: DropboxClient
	scope: Scope
	maxReadBytes: number
	maxWriteBytes: number
}

export class ToolError extends Error {}

export function resolve(ctx: ToolContext, input: string, options?: { forbidRoot?: boolean }) {
	const lookupId = async (id: string) => {
		const metadata = await ctx.dropbox.rpc<DbxMetadata>('files/get_metadata', { path: id })
		if (metadata.path_lower == null)
			throw new ScopeError(`${id} has no path in your Dropbox`)
		return metadata.path_lower
	}
	return resolvePath(ctx.scope, input, lookupId, options)
}

export const json = (data: unknown): CallToolResult => ({
	content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
})

export function errorMessage(error: unknown) {
	if (error instanceof ToolError || error instanceof ScopeError)
		return error.message
	if (error instanceof DropboxError)
		return `Dropbox rejected ${error.endpoint}: ${error.summary}`
	return error instanceof Error
		? error.message
		: String(error)
}

export const failure = (error: unknown): CallToolResult => ({
	isError: true,
	content: [{ type: 'text', text: errorMessage(error) }]
})

export function openUrl(metadata: DbxMetadata) {
	const path = metadata.path_display ?? metadata.path_lower ?? ''
	return metadata['.tag'] == 'folder'
		? `https://www.dropbox.com/home${encodeURI(path)}`
		: `https://www.dropbox.com/home${encodeURI(parentPath(path))}?preview=${encodeURIComponent(metadata.name)}`
}

export function describeEntry(scope: Scope, metadata: DbxMetadata) {
	const entry = {
		name: metadata.name,
		path: metadata.path_display == null ? undefined : nsPath(scope, metadata.path_display),
		path_display: metadata.path_display,
		file_id: metadata.id,
		object_type: metadata['.tag'],
		modified_time: metadata.server_modified,
		client_modified: metadata.client_modified
	}
	return metadata['.tag'] == 'file'
		? { ...entry, file: { size: metadata.size ?? 0, rev: metadata.rev, content_hash: metadata.content_hash } }
		: { ...entry, folder: {} }
}

export function tagPath(value: unknown) {
	const tags: string[] = []
	let current = value as Record<string, unknown> | undefined
	while (current != null && typeof current == 'object' && typeof current['.tag'] == 'string') {
		const tag = current['.tag'] as string
		tags.push(tag)
		current = current[tag] as Record<string, unknown> | undefined
	}
	return tags.join('/') || 'unknown_error'
}

export async function verifyWrite(bytes: Uint8Array, written: DbxMetadata) {
	const expected = await contentHash(bytes)
	if (written.content_hash != expected)
		throw new ToolError(
			`Dropbox stored rev ${written.rev} of ${written.path_display}, but its content_hash (${written.content_hash}) `
			+ `doesn't match the bytes sent (${expected}). Treat this write as failed and re-read the file.`)
	return { verified: true, rev: written.rev, content_hash: written.content_hash, size: written.size ?? 0 }
}

export async function requireFolder(ctx: ToolContext, path: string) {
	let metadata: DbxMetadata
	try {
		metadata = await ctx.dropbox.rpc<DbxMetadata>('files/get_metadata', { path })
	}
	catch (error) {
		if (error instanceof DropboxError && error.summary.startsWith('path/not_found'))
			throw new ToolError(`PARENT_NOT_FOUND: ${path} doesn't exist. Create it first.`)
		throw error
	}
	if (metadata['.tag'] != 'folder')
		throw new ToolError(`PARENT_NOT_FOLDER: ${path} is a file, not a folder.`)
}

export const encodeCursor = (value: unknown) =>
	btoa(JSON.stringify(value))

export function decodeCursor<T>(cursor: string): T {
	try {
		return JSON.parse(atob(cursor)) as T
	}
	catch {
		throw new ToolError('INVALID_CURSOR: that cursor didn\'t come from this server. Start a new listing.')
	}
}

export function dropboxTime(value: string, field: string) {
	const time = new Date(value)
	if (isNaN(time.getTime()))
		throw new ToolError(`${field} must be an ISO 8601 / RFC 3339 timestamp: ${value}`)
	return time.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
