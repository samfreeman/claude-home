import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export type ToolResult = CallToolResult

export interface InboxItem {
	id: number
	source: string
	target: string
	title: string
	content: string | null
	project: string | null
	status: string
	created: string
	updated: string
}

export interface InboxSendArgs {
	source: string
	target: string
	title: string
	content?: string
	project?: string
}

export interface InboxListArgs {
	target?: string
	status?: string
}

export interface InboxReadArgs {
	id: number
}

export interface InboxUpdateArgs {
	id: number
	status: string
}

export interface InboxDeleteArgs {
	id: number
}
