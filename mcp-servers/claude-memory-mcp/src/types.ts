import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

// Re-export the SDK type for convenience
export type ToolResult = CallToolResult

// Memory types
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
}

export interface Project {
	id: number
	name: string
	status: string
	notes: string | null
	added: string
	updated: string
}

// Inbox types
export interface InboxItem {
	id: number
	source: string
	target: string
	title: string
	content: string | null
	status: string
	created: string
	updated: string
}

// Relay types
export interface Relay {
	id: number
	title: string
	status: string
	spec: string | null
	created: string
	updated: string
}

export interface RelayContext {
	id: number
	relay_id: number
	type: string
	content: string
	added: string
}

export interface RelayTask {
	id: number
	relay_id: number
	description: string
	status: string
	assigned_to: string | null
	created: string
}

// Handler argument types
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

export interface InboxSendArgs {
	source: string
	target: string
	title: string
	content?: string
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

export interface RelayCreateArgs {
	title: string
	spec?: string
}

export interface RelayReadArgs {
	id: number
}

export interface RelayListArgs {
	status?: string
}

export interface RelayUpdateArgs {
	id: number
	status?: string
	spec?: string
}

export interface RelayDeleteArgs {
	id: number
}

export interface ContextAddArgs {
	relay_id: number
	type: string
	content: string
}

export interface TaskAddArgs {
	relay_id: number
	description: string
	assigned_to?: string
}

export interface TaskUpdateArgs {
	id: number
	status?: string
	description?: string
}
