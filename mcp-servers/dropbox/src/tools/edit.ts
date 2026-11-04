import { DropboxError } from '../dropbox/client'
import type { DbxMetadata } from '../dropbox/types'
import { countOccurrences, decodeText, encodeText, insertAtLine } from '../text'
import { describeEntry, json, resolve, ToolError, verifyWrite, type ToolContext } from './context'

const stale = (path: string | undefined, expected: string, current: string | undefined) =>
	new ToolError(
		`STALE_REV: ${path} is at rev ${current}, not the rev ${expected} you passed. Nothing was written. `
		+ 'Read it again and redo the edit against the current contents.')

// Every write is a Dropbox update-mode upload pinned to expected_rev, so a stale rev fails instead of clobbering.
async function writeEdit(
	ctx: ToolContext,
	input: string,
	expectedRev: string,
	change: (text: string) => string,
	needsText: boolean) {
	if (!expectedRev)
		throw new ToolError('expected_rev is required: read the file first (fetch or get_file_metadata) and pass its rev.')
	const path = await resolve(ctx, input, { forbidRoot: true })
	let next: string
	let current: DbxMetadata
	if (needsText) {
		const { metadata, bytes } = await ctx.dropbox.download(path)
		current = metadata
		if (metadata.rev != expectedRev)
			throw stale(metadata.path_display, expectedRev, metadata.rev)
		if (bytes.length > ctx.maxReadBytes)
			throw new ToolError(`${metadata.path_display} is ${bytes.length} bytes; in-place edits are limited to ${ctx.maxReadBytes} bytes.`)
		const text = decodeText(bytes)
		if (text == undefined)
			throw new ToolError(`${metadata.path_display} isn't UTF-8 text, so it can't be edited in place. Nothing was written.`)
		next = change(text)
	}
	else {
		current = await ctx.dropbox.rpc<DbxMetadata>('files/get_metadata', { path })
		if (current['.tag'] != 'file')
			throw new ToolError(`${input} is a folder, not a file.`)
		if (current.rev != expectedRev)
			throw stale(current.path_display, expectedRev, current.rev)
		next = change('')
	}
	const bytes = encodeText(next)
	if (bytes.length > ctx.maxWriteBytes)
		throw new ToolError(`The edited file would be ${bytes.length} bytes; the write limit is ${ctx.maxWriteBytes}. Nothing was written.`)
	let written: DbxMetadata
	try {
		written = await ctx.dropbox.upload(path, bytes, { '.tag': 'update', update: expectedRev })
	}
	catch (error) {
		if (error instanceof DropboxError && error.summary.startsWith('path/conflict'))
			throw new ToolError(
				`STALE_REV: Dropbox rejected the write because ${current.path_display} changed after rev ${expectedRev}. `
				+ 'Nothing was written. Read it again and redo the edit.')
		throw error
	}
	return json({ file: describeEntry(ctx.scope, written), previous_rev: expectedRev, ...await verifyWrite(bytes, written) })
}

export function strReplace(ctx: ToolContext, args: { path: string, old_str: string, new_str: string, expected_rev: string }) {
	if (args.old_str == '')
		throw new ToolError('old_str must not be empty')
	return writeEdit(
		ctx,
		args.path,
		args.expected_rev,
		text => {
			const count = countOccurrences(text, args.old_str)
			if (count != 1)
				throw new ToolError(
					`old_str must match exactly once; it matches ${count} times. Nothing was written.`
					+ (count == 0 ? ' Check it against the file\'s exact current contents.' : ' Include more surrounding text to make it unique.'))
			const index = text.indexOf(args.old_str)
			return text.slice(0, index) + args.new_str + text.slice(index + args.old_str.length)
		},
		true)
}

export const appendText = (ctx: ToolContext, args: { path: string, text: string, expected_rev: string }) =>
	writeEdit(ctx, args.path, args.expected_rev, text => text + args.text, true)

export const insertText = (ctx: ToolContext, args: { path: string, line: number, text: string, expected_rev: string }) =>
	writeEdit(
		ctx,
		args.path,
		args.expected_rev,
		text => {
			try {
				return insertAtLine(text, args.line, args.text)
			}
			catch (error) {
				throw new ToolError(`${(error as Error).message}. Nothing was written.`)
			}
		},
		true)

export const overwrite = (ctx: ToolContext, args: { path: string, content: string, expected_rev: string }) =>
	writeEdit(ctx, args.path, args.expected_rev, () => args.content, false)
