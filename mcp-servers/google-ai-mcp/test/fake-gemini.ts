import http from 'node:http'
import type { AddressInfo } from 'node:net'

type RequestLogEntry = {
	method: string
	url: string
	bodyPreview: string
}

export class FakeGemini {
	private server: http.Server | null = null
	public url: string = ''
	public requestLog: RequestLogEntry[] = []
	private generateQueue: string[] = []
	private fileCounter = 0

	async start(): Promise<string> {
		this.server = http.createServer(async (req, res) => {
			const chunks: Buffer[] = []
			for await (const chunk of req)
				chunks.push(chunk)
			const body = Buffer.concat(chunks).toString('utf-8')
			const url = req.url ?? ''
			const method = req.method ?? '?'
			this.requestLog.push({ method, url, bodyPreview: body.slice(0, 200) })

			// File upload — return mock file handle.
			// @google/genai posts to /upload/v1beta/files
			if (url.includes('/upload/v1beta/files') || url.includes('upload')) {
				const fileName = `files/fake-${++this.fileCounter}`
				res.writeHead(200, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify({
					file: {
						name: fileName,
						uri: `http://127.0.0.1/${fileName}`,
						mimeType: 'video/mp4',
						state: 'ACTIVE',
						sizeBytes: '1000'
					}
				}))
				return
			}

			// File status poll
			if (method == 'GET' && url.includes('/v1beta/files/')) {
				const name = url.match(/\/files\/([^?]+)/)?.[1] ?? 'unknown'
				res.writeHead(200, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify({ name: `files/${name}`, state: 'ACTIVE' }))
				return
			}

			// Streaming generate — SSE framed
			if (url.includes('streamGenerateContent')) {
				const text = this.generateQueue.shift() ?? '[stub: no canned response]'
				const chunk = {
					candidates: [{
						content: { parts: [{ text }] },
						finishReason: 'STOP'
					}]
				}
				res.writeHead(200, {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					'Connection': 'keep-alive'
				})
				res.write(`data: ${JSON.stringify(chunk)}\n\n`)
				res.end()
				return
			}

			// Non-streaming generate
			if (url.includes(':generateContent')) {
				const text = this.generateQueue.shift() ?? '[stub: no canned response]'
				res.writeHead(200, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify({
					candidates: [{
						content: { parts: [{ text }] },
						finishReason: 'STOP'
					}]
				}))
				return
			}

			// Fallback — log and 404
			res.writeHead(404, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({
				error: { message: `fake-gemini: no handler for ${method} ${url}` }
			}))
		})

		await new Promise<void>((resolve) => {
			this.server!.listen(0, '127.0.0.1', () => resolve())
		})
		const addr = this.server.address() as AddressInfo
		this.url = `http://127.0.0.1:${addr.port}`
		return this.url
	}

	enqueueGenerate(text: string): void {
		this.generateQueue.push(text)
	}

	async stop(): Promise<void> {
		if (!this.server) return
		await new Promise<void>((resolve, reject) => {
			this.server!.close((err) => err ? reject(err) : resolve())
		})
		this.server = null
	}
}
