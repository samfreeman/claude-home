import type { CallToolResult } from '@modelcontextprotocol/server'
import type { Converter } from '../src/convert'
import { DropboxClient } from '../src/dropbox/client'
import { makeScope } from '../src/scope'
import type { ToolContext } from '../src/tools/context'
import { FakeDropbox, rootNamespaceId } from './fake-dropbox'

export function setup(limits?: { maxReadBytes?: number, maxWriteBytes?: number, convert?: Converter }) {
	const fake = new FakeDropbox()
	const ctx: ToolContext = {
		dropbox: new DropboxClient(fake.fetch, async () => 'test-token'),
		scope: makeScope('/Claude', rootNamespaceId),
		maxReadBytes: limits?.maxReadBytes ?? 5 * 1024 * 1024,
		maxWriteBytes: limits?.maxWriteBytes ?? 5 * 1024 * 1024,
		convert: limits?.convert
	}
	return { fake, ctx }
}

export const block = (result: CallToolResult, index = 0) =>
	(result.content[index] as { type: 'text', text: string }).text

export const body = (result: CallToolResult) =>
	JSON.parse(block(result))
