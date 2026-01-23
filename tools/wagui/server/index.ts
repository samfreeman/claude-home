import { createServer, IncomingMessage, ServerResponse } from 'http'
import { randomUUID } from 'crypto'
import {
	initDb,
	saveMessage,
	getMessages,
	clearMessages,
	upsertApp,
	getApps,
	getApp,
	type WagMessage,
	type WagMode,
	type WagRole,
	type MessageType,
	type App
} from './db'

const PORT = parseInt(process.env.PORT || '3099')
const HOST = process.env.HOST || '0.0.0.0'

interface WagState {
	header: {
		mode: WagMode
		app: string
		branch: string
		context: string
	}
	activePbi?: string
	currentTask?: number
	totalTasks?: number
	selectedApp?: App
}

let state: WagState = {
	header: {
		mode: null,
		app: '',
		branch: 'dev',
		context: ''
	}
}

const sseClients: Set<ServerResponse> = new Set()

initDb(process.env.DB_PATH)

function broadcast(event: string, data: unknown): void {
	const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
	for (const client of sseClients)
		client.write(payload)
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		let body = ''
		req.on('data', chunk => {
			body += chunk
		})
		req.on('end', () => {
			try {
				resolve(body ? JSON.parse(body) : {})
			}
			catch (e) {
				reject(e)
			}
		})
		req.on('error', reject)
	})
}

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
	res.writeHead(status, { 'Content-Type': 'application/json' })
	res.end(JSON.stringify(data))
}

function handleState(req: IncomingMessage, res: ServerResponse): void {
	if (req.method == 'GET') {
		sendJson(res, { success: true, state })
		return
	}

	if (req.method == 'POST') {
		parseBody(req).then(body => {
			const { app, mode, branch, context, pbi, task, totalTasks, appRoot, repo } = body as {
				app: string
				mode: WagMode
				branch?: string
				context: string
				pbi?: string
				task?: number
				totalTasks?: number
				appRoot?: string
				repo?: string
			}

			// Upsert app if appRoot provided
			if (appRoot) {
				upsertApp(app, appRoot, repo)
				state.selectedApp = {
					name: app,
					appRoot,
					repoRoot: repo || null,
					lastUsed: Date.now()
				}
			}

			state = {
				header: {
					mode,
					app,
					branch: (branch as string) || 'dev',
					context
				},
				activePbi: pbi as string | undefined,
				currentTask: task as number | undefined,
				totalTasks: totalTasks as number | undefined,
				selectedApp: state.selectedApp
			}

			broadcast('state', state)

			const parts: string[] = []
			if (mode)
				parts.push(`Mode: ${mode}`)
			if (pbi)
				parts.push(pbi as string)
			if (task && totalTasks)
				parts.push(`Task ${task}/${totalTasks}`)
			if (context)
				parts.push(context)

			const contextMessage: WagMessage = {
				id: randomUUID(),
				timestamp: Date.now(),
				header: { ...state.header },
				role: 'dev',
				type: 'context',
				content: parts.join(' | ')
			}

			saveMessage(contextMessage)
			broadcast('message', contextMessage)

			sendJson(res, { success: true, state })
		}).catch(err => {
			sendJson(res, { success: false, error: err.message }, 400)
		})
		return
	}

	sendJson(res, { error: 'Method not allowed' }, 405)
}

function handleMessages(req: IncomingMessage, res: ServerResponse): void {
	if (req.method == 'GET') {
		const url = new URL(req.url || '/', `http://localhost:${PORT}`)
		const limit = parseInt(url.searchParams.get('limit') || '100')
		const messages = getMessages(limit)
		sendJson(res, { success: true, count: messages.length, messages })
		return
	}

	if (req.method == 'POST') {
		parseBody(req).then(body => {
			const { role, type, content, file, task, pbi, approved } = body as {
				role: WagRole
				type: MessageType
				content: string
				file?: string
				task?: number
				pbi?: string
				approved?: boolean
			}

			const metadata: WagMessage['metadata'] = {}
			if (file)
				metadata.file = file
			if (task)
				metadata.task = task
			if (pbi)
				metadata.pbi = pbi
			if (approved != undefined)
				metadata.approved = approved

			const message: WagMessage = {
				id: randomUUID(),
				timestamp: Date.now(),
				header: { ...state.header },
				role,
				type,
				content,
				metadata: Object.keys(metadata).length > 0 ? metadata : undefined
			}

			saveMessage(message)
			broadcast('message', message)

			sendJson(res, { success: true, message })
		}).catch(err => {
			sendJson(res, { success: false, error: err.message }, 400)
		})
		return
	}

	if (req.method == 'DELETE') {
		clearMessages()
		state = {
			header: {
				mode: null,
				app: '',
				branch: 'dev',
				context: ''
			}
		}
		broadcast('clear', {})
		broadcast('state', state)
		sendJson(res, { success: true, message: 'Messages cleared' })
		return
	}

	sendJson(res, { error: 'Method not allowed' }, 405)
}

function handleEvents(req: IncomingMessage, res: ServerResponse): void {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	})

	res.write(`event: connected\n`)
	res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`)

	res.write(`event: state\n`)
	res.write(`data: ${JSON.stringify(state)}\n\n`)

	const history = getMessages(50)
	for (const msg of history) {
		res.write(`event: message\n`)
		res.write(`data: ${JSON.stringify(msg)}\n\n`)
	}

	sseClients.add(res)

	req.on('close', () => {
		sseClients.delete(res)
	})
}

function handleHealth(res: ServerResponse): void {
	sendJson(res, { status: 'ok', clients: sseClients.size })
}

function handleApps(req: IncomingMessage, res: ServerResponse): void {
	if (req.method == 'GET') {
		const apps = getApps()
		sendJson(res, { success: true, apps })
		return
	}

	sendJson(res, { error: 'Method not allowed' }, 405)
}

function handleSelect(req: IncomingMessage, res: ServerResponse): void {
	if (req.method == 'POST') {
		parseBody(req).then(body => {
			const { app: appName } = body as { app: string }

			if (!appName) {
				sendJson(res, { success: false, error: 'app is required' }, 400)
				return
			}

			const app = getApp(appName)
			if (!app) {
				sendJson(res, { success: false, error: `App "${appName}" not found` }, 404)
				return
			}

			state.selectedApp = app
			state.header.app = app.name

			broadcast('state', state)
			broadcast('app-changed', { app })

			sendJson(res, { success: true, app })
		}).catch(err => {
			sendJson(res, { success: false, error: err.message }, 400)
		})
		return
	}

	sendJson(res, { error: 'Method not allowed' }, 405)
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

	if (req.method == 'OPTIONS') {
		res.writeHead(204)
		res.end()
		return
	}

	const url = req.url || '/'

	if (url == '/api/v1/state' || url.startsWith('/api/v1/state?'))
		return handleState(req, res)

	if (url == '/api/v1/messages' || url.startsWith('/api/v1/messages?'))
		return handleMessages(req, res)

	if (url == '/api/v1/apps')
		return handleApps(req, res)

	if (url == '/api/v1/select')
		return handleSelect(req, res)

	if (url == '/events')
		return handleEvents(req, res)

	if (url == '/health')
		return handleHealth(res)

	res.writeHead(404, { 'Content-Type': 'text/plain' })
	res.end('Not found')
})

server.listen(PORT, HOST, () => {
	console.log(`wagui server listening on http://${HOST}:${PORT}`)
	console.log(`  API: http://localhost:${PORT}/api/v1/`)
	console.log(`  SSE: http://localhost:${PORT}/events`)
	console.log(`  Health: http://localhost:${PORT}/health`)
})
