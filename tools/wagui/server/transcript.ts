import fs from 'fs'
import path from 'path'
import os from 'os'
import { WagMessage, getTranscriptOffset, setTranscriptOffset } from './db'

interface TranscriptEntry {
	type: 'user' | 'assistant' | 'progress' | string
	message?: { content: unknown }
	uuid: string
	timestamp: string
}

let pollInterval: NodeJS.Timeout | null = null
let currentApp: string | null = null

export function getTranscriptDir(appRoot: string): string {
	const encoded = appRoot.replace(/[\/\.]/g, '-')
	return path.join(os.homedir(), '.claude', 'projects', encoded)
}

export function findLatestTranscript(dir: string): string | null {
	if (!fs.existsSync(dir))
		return null

	const files = fs.readdirSync(dir)
		.filter(f => f.endsWith('.jsonl'))
		.map(f => {
			const fullPath = path.join(dir, f)
			return { name: f, mtime: fs.statSync(fullPath).mtimeMs }
		})
		.sort((a, b) => b.mtime - a.mtime)

	return files[0]?.name
		? path.join(dir, files[0].name)
		: null
}

export function parseTranscriptEntry(entry: TranscriptEntry, app: string): WagMessage | null {
	if (!['user', 'assistant'].includes(entry.type))
		return null
	if (!entry.message?.content)
		return null

	const content = entry.message.content
	let text: string

	if (Array.isArray(content)) {
		const textBlocks = content.filter((c: { type: string; text?: string }) => c.type == 'text')
		if (textBlocks.length == 0)
			return null
		text = textBlocks.map((b: { text?: string }) => b.text).join('\n')
	}
	else if (typeof content == 'string')
		text = content
	else
		return null

	if (!text)
		return null

	return {
		id: entry.uuid,
		timestamp: new Date(entry.timestamp).getTime(),
		header: {
			mode: null,
			app,
			branch: 'dev',
			context: 'From transcript'
		},
		role: entry.type == 'user' ? 'user' : 'dev',
		type: 'chat',
		content: text,
		metadata: { source: 'transcript' }
	}
}

function readNewEntries(filePath: string, offset: number): { entries: TranscriptEntry[], newOffset: number } {
	let fd: number
	try {
		fd = fs.openSync(filePath, 'r')
	}
	catch {
		return { entries: [], newOffset: offset }
	}

	const stats = fs.fstatSync(fd)

	if (stats.size <= offset) {
		fs.closeSync(fd)
		return { entries: [], newOffset: offset }
	}

	const buffer = Buffer.alloc(stats.size - offset)
	fs.readSync(fd, buffer, 0, buffer.length, offset)
	fs.closeSync(fd)

	const lines = buffer.toString('utf8').split('\n').filter(l => l.trim())
	const entries: TranscriptEntry[] = []

	for (const line of lines) {
		try {
			entries.push(JSON.parse(line))
		}
		catch {
			// Incomplete line, will retry next poll
		}
	}

	return { entries, newOffset: stats.size }
}

export function startPolling(
	app: string,
	appRoot: string,
	onMessage: (msg: WagMessage) => void
): void {
	stopPolling()
	currentApp = app

	const transcriptDir = getTranscriptDir(appRoot)

	pollInterval = setInterval(
		() => {
			const filePath = findLatestTranscript(transcriptDir)
			if (!filePath)
				return

			const offset = getTranscriptOffset(app)

			if (offset && offset.filePath != filePath)
				setTranscriptOffset(app, filePath, 0)

			const currentOffset = offset?.filePath == filePath ? offset.byteOffset : 0
			const newMessages = readNewEntries(filePath, currentOffset)

			for (const entry of newMessages.entries) {
				const msg = parseTranscriptEntry(entry, app)
				if (msg)
					onMessage(msg)
			}

			setTranscriptOffset(app, filePath, newMessages.newOffset)
		},
		500)
}

export function stopPolling(): void {
	if (pollInterval) {
		clearInterval(pollInterval)
		pollInterval = null
	}
	currentApp = null
}