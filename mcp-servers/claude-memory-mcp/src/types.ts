import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export type ToolResult = CallToolResult

export interface Fact {
	id: number
	category: string
	key: string
	value: string
	added: string
	updated: string
}

export interface Hardware {
	id: number
	name: string
	specs: string | null
	purpose: string | null
	location: string | null
	added: string
	updated: string | null
}

export interface Project {
	id: number
	name: string
	status: string
	notes: string | null
	added: string
	updated: string
}

export interface MemoryReadArgs {
	category: string
	key?: string
}

export interface MemoryWriteArgs {
	type: string
	category?: string
	key: string
	value: string
	purpose?: string
	location?: string
	status?: string
}

export interface MemorySearchArgs {
	query: string
}

export interface MemoryDeleteArgs {
	type: string
	category?: string
	key: string
}
