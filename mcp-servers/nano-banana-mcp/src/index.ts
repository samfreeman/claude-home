#!/usr/bin/env node

import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { GoogleGenAI } from '@google/genai'
import { findProjectRoot } from '@mcp-local/shared'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'

const MODEL_ALIASES: Record<string, string> = {
	nb2: 'gemini-3.1-flash-image-preview',
	pro: 'gemini-3-pro-image-preview'
}

const DEFAULT_MODEL = 'nb2'

const apiKey = process.env.GEMINI_API_KEY ?? ''
const ai = new GoogleGenAI({ apiKey })

function resolveOutputDir(cwd?: string): string {
	if (cwd) {
		const projectRoot = findProjectRoot(cwd)
		if (projectRoot)
			return path.join(projectRoot, 'images/nano-banana')
	}
	const configured = process.env.NB_OUTPUT_DIR
	if (configured)
		return configured.replace(/^~/, os.homedir())
	return path.join(os.homedir(), '.claude', 'images', 'nano-banana')
}

function openFile(filepath: string): void {
	if (process.platform === 'darwin')
		spawn('open', [filepath], { detached: true, stdio: 'ignore' }).unref()
	else if (process.env.WSL_DISTRO_NAME)
		spawn('explorer.exe', [filepath], { detached: true, stdio: 'ignore' }).unref()
	else
		spawn('xdg-open', [filepath], { detached: true, stdio: 'ignore' }).unref()
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
		.slice(0, 40)
}

function formatTimestamp(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0')
	const date = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
	const time = `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
	return `${date}_${time}`
}

function getImageDimensions(buf: Buffer): { width: number, height: number } {
	// JPEG: scan for SOF marker (0xFF 0xC0 or 0xFF 0xC2)
	if (buf[0] === 0xFF && buf[1] === 0xD8) {
		let i = 2
		while (i < buf.length - 8) {
			if (buf[i] !== 0xFF) break
			const marker = buf[i + 1]
			if (marker === 0xC0 || marker === 0xC2) {
				return {
					height: buf.readUInt16BE(i + 5),
					width: buf.readUInt16BE(i + 7)
				}
			}
			i += 2 + buf.readUInt16BE(i + 2)
		}
	}
	// PNG: fixed offsets
	if (buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
		return {
			width: buf.readUInt32BE(16),
			height: buf.readUInt32BE(20)
		}
	}
	return { width: 0, height: 0 }
}

const server = new McpServer({
	name: 'nano-banana-mcp',
	version: '1.0.0'
})

server.registerTool(
	'generate_image',
	{
		description: 'Generate images using the Nano Banana (Gemini) image generation API',
		inputSchema: {
			prompt: z.string().describe('Text description of the image to generate'),
			// nb2 also supports '512' (no K suffix), but only for that model
			resolution: z.enum(['1K', '2K', '4K']).optional().default('2K').describe('Output resolution (default: 2K)'),
			// nb2 also supports extreme ratios: 4:5, 5:4, 1:4, 4:1, 1:8, 8:1 — not exposed here as they are nb2-only
			aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9']).optional().default('16:9').describe('Aspect ratio (default: 16:9)'),
			count: z.number().int().min(1).max(4).optional().default(1).describe('Number of images to generate, 1-4 (default: 1)'),
			model: z.enum(['nb2', 'pro']).optional().default(DEFAULT_MODEL).describe('Model alias: nb2 (gemini-3.1-flash-image-preview) or pro (gemini-3-pro-image-preview). Default: nb2'),
			cwd: z.string().optional().describe('Caller\'s working directory — used to locate the project root. Pass this when calling from CC.')
		}
	},
	async ({ prompt, resolution, aspectRatio, count, model, cwd }) => {
		try {
			if (!apiKey)
				throw new Error('GEMINI_API_KEY environment variable is required')

			const resolvedModel = MODEL_ALIASES[model]

			const saveDir = resolveOutputDir(cwd)
			fs.mkdirSync(saveDir, { recursive: true })

			const ts = formatTimestamp(new Date())
			const slug = slugify(prompt)
			const savedPaths: string[] = []

			for (let i = 0; i < count; i++) {
				const response = await ai.models.generateContent({
					model: resolvedModel,
					contents: prompt,
					config: {
						responseModalities: ['IMAGE'],
						imageConfig: {
							aspectRatio,
							imageSize: resolution
						}
					}
				})
				const parts = response.candidates?.[0]?.content?.parts ?? []
				for (const part of parts) {
					if (!part.inlineData?.mimeType?.startsWith('image/'))
						continue
					const buf = Buffer.from(part.inlineData.data!, 'base64')
					const { width, height } = getImageDimensions(buf)
					const ext = part.inlineData.mimeType!.split('/')[1]
					const index = savedPaths.length + 1
					const filename = `${ts}-${width}x${height}-${resolution}-${slug}_${index}.${ext}`
					const filepath = path.join(saveDir, filename)
					fs.writeFileSync(filepath, buf)
					savedPaths.push(filepath)
				openFile(filepath)
				}
			}

			const text = savedPaths.length > 0
				? `Generated ${savedPaths.length} image(s):\n${savedPaths.join('\n')}`
				: 'No images were generated'

			return {
				content: [{ type: 'text' as const, text }]
			}
		}
		catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			return {
				content: [{ type: 'text' as const, text: `Error: ${message}` }],
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
