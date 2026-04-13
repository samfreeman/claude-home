import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FakeGemini } from './fake-gemini.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverEntry = path.resolve(here, '..', 'dist', 'index.js')

type TestCtx = {
	client: Client
	transport: StdioClientTransport
	fakeGemini: FakeGemini
	tempCacheDir: string
}

let ctx: TestCtx

function buildEnv(extra: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {}
	for (const [k, v] of Object.entries(process.env))
		if (v != null) out[k] = v
	for (const [k, v] of Object.entries(extra))
		out[k] = v
	return out
}

beforeEach(async () => {
	const tempCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gai-mcp-test-'))
	const fakeGemini = new FakeGemini()
	const fakeUrl = await fakeGemini.start()

	const transport = new StdioClientTransport({
		command: 'node',
		args: [serverEntry],
		env: buildEnv({
			GEMINI_API_KEY: 'test-key',
			GEMINI_BASE_URL: fakeUrl,
			GOOGLE_AI_MCP_CACHE_DIR: tempCacheDir
		})
	})
	const client = new Client({ name: 'google-ai-mcp-test', version: '0.0.0' }, { capabilities: {} })
	await client.connect(transport)

	ctx = { client, transport, fakeGemini, tempCacheDir }
})

afterEach(async () => {
	try {
		await ctx.client.close()
	}
	catch {}
	try {
		await ctx.fakeGemini.stop()
	}
	catch {}
	fs.rmSync(ctx.tempCacheDir, { recursive: true, force: true })
})

describe('google-ai-mcp integration', () => {
	it('list_transcripts returns empty on a fresh cache dir', async () => {
		const result = await ctx.client.callTool({
			name: 'list_transcripts',
			arguments: {}
		})
		const text = (result.content as Array<{ type: string, text: string }>)[0].text
		expect(text).toMatch(/No cached transcripts/i)
	})
})
