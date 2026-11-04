import { createMcpHandler } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'
import { buildServer } from '../src/server'
import { setup } from './helpers'

const expectedTools = [
	'append',
	'check_job_status',
	'copy',
	'create_file',
	'create_file_request',
	'create_folder',
	'create_shared_link',
	'delete',
	'download_link',
	'fetch',
	'file_preview',
	'get_file_metadata',
	'get_file_request',
	'get_shared_link_metadata',
	'insert',
	'list_file_requests',
	'list_folder',
	'list_shared_links',
	'move',
	'overwrite',
	'search',
	'str_replace',
	'who_am_i'
]

async function call(handler: ReturnType<typeof createMcpHandler>, method: string, params?: unknown) {
	const response = await handler.fetch(new Request('https://dropbox.example/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json, text/event-stream',
			'MCP-Protocol-Version': '2025-06-18'
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
	}))
	const text = await response.text()
	const json = response.headers.get('content-type')?.includes('text/event-stream')
		? text.split('\n').filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6))).find(m => m.id == 1)
		: JSON.parse(text)
	return json
}

describe('MCP endpoint', () => {
	it('advertises exactly the expected tools', async () => {
		const { ctx } = setup()
		const handler = createMcpHandler(() => buildServer(ctx))
		const listed = await call(handler, 'tools/list')
		expect(listed.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(expectedTools)
	})

	it('serves fetch over HTTP with the file contents verbatim in the second block', async () => {
		const { fake, ctx } = setup()
		const html = '<div class="a">&amp; <b>bold</b></div>\r\n'
		await fake.addFile('/Claude/x.html', html)
		const handler = createMcpHandler(() => buildServer(ctx))
		const response = await call(handler, 'tools/call', { name: 'fetch', arguments: { id: '/Claude/x.html' } })
		expect(response.result.isError).toBeFalsy()
		expect(response.result.content[1].text).toBe(html)
	})

	it('reports tool failures plainly as isError results', async () => {
		const { ctx } = setup()
		const handler = createMcpHandler(() => buildServer(ctx))
		const response = await call(handler, 'tools/call', { name: 'fetch', arguments: { id: '/Private/x' } })
		expect(response.result.isError).toBe(true)
		expect(response.result.content[0].text).toMatch(/outside \/Claude/)
	})
})
