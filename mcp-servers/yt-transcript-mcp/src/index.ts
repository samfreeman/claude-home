#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { fetchTranscript, formatTranscript } from './youtube-fetcher.js'

const server = new McpServer({
	name: 'yt-transcript-mcp',
	version: '1.0.0'
})

server.tool(
	'get_transcript',
	'Extract transcript from a YouTube video',
	{
		url: z.string().describe('YouTube video URL, Shorts URL, or bare video ID'),
		lang: z.string().optional().default('en').describe('Language code (default: en). Falls back to English then first available.'),
		include_timestamps: z.boolean().optional().default(false).describe('Prefix each line with [m:ss] or [h:mm:ss] timestamps')
	},
	async ({ url, lang, include_timestamps }) => {
		try {
			const result = await fetchTranscript(url, lang)
			const transcript = formatTranscript(result, include_timestamps)

			return {
				content: [
					{
						type: 'text' as const,
						text: transcript
					}
				],
				structuredContent: {
					meta: {
						title: result.title,
						author: result.author,
						videoId: result.videoId,
						segmentCount: result.segments.length
					},
					transcript
				}
			}
		}
		catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error: ${message}`
					}
				],
				isError: true
			}
		}
	}
)

async function main() {
	const transport = new StdioServerTransport()
	await server.connect(transport)
}

main().catch(console.error)
