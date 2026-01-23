export type WagMode = 'DOCS' | 'ADR' | 'DEV' | null

export type WagRole = 'user' | 'pm' | 'architect' | 'dev'

export type MessageType = 'chat' | 'proposal' | 'review' | 'diff' | 'decision' | 'system' | 'context'

export interface WagHeader {
	mode: WagMode
	app: string
	branch: string
	context: string
}

export interface WagMessage {
	id: string
	timestamp: number
	header: WagHeader
	role: WagRole
	type: MessageType
	content: string
	metadata?: {
		file?: string
		task?: number
		pbi?: string
		approved?: boolean
	}
}

export interface WagState {
	header: WagHeader
	activePbi?: string
	currentTask?: number
	totalTasks?: number
}

export type SSEEvent =
	| { event: 'message'; data: WagMessage }
	| { event: 'state'; data: WagState }
	| { event: 'connected'; data: { timestamp: number } }

export interface StoredMessage {
	id: string
	timestamp: number
	mode: WagMode
	app: string
	branch: string
	context: string
	role: WagRole
	type: MessageType
	content: string
	metadata: string | null
}
