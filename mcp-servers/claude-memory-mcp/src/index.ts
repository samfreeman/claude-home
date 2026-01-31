#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { initDb } from './db.js'
import { handleMemoryRead, handleMemoryWrite, handleMemorySearch, handleMemoryDelete } from './handlers/memory.js'
import { handleInboxSend, handleInboxList, handleInboxRead, handleInboxUpdate, handleInboxDelete } from './handlers/inbox.js'
import {
	handleRelayCreate,
	handleRelayRead,
	handleRelayList,
	handleRelayUpdate,
	handleRelayDelete,
	handleContextAdd,
	handleTaskAdd,
	handleTaskUpdate
} from './handlers/relay.js'

const VERSION = '2.3.0'

const server = new McpServer({ name: 'claude-memory-mcp', version: VERSION })

// Memory tools
server.registerTool('memory_read', {
	description: "Read from personal memory. category='all' lists categories. For hardware/project, key is optional. For facts, specify category name.",
	inputSchema: {
		category: z.string().describe("'all', 'hardware', 'project', or a fact category name"),
		key: z.string().optional().describe('Specific key/name to read (optional)')
	}
}, async (args) => {
	return await handleMemoryRead({ category: args.category, key: args.key })
})

server.registerTool('memory_write', {
	description: "Write to personal memory. type='fact' for general facts, 'hardware' for gear, 'project' for projects.",
	inputSchema: {
		type: z.enum(['fact', 'hardware', 'project']).describe('Entry type'),
		category: z.string().optional().describe("For facts: category name (e.g., 'preference', 'workflow')"),
		key: z.string().describe('Key or name identifier'),
		value: z.string().describe('Main value (fact value, hardware specs, or project notes)'),
		purpose: z.string().optional().describe("For hardware: what it's used for"),
		location: z.string().optional().describe('For hardware: where it lives (office/couch/floating)'),
		status: z.string().optional().describe('For projects: status (active/paused/done)')
	}
}, async (args) => {
	return await handleMemoryWrite(args)
})

server.registerTool('memory_search', {
	description: 'Search all memory tables for a term.',
	inputSchema: {
		query: z.string().describe('Search term')
	}
}, async (args) => {
	return await handleMemorySearch({ query: args.query })
})

server.registerTool('memory_delete', {
	description: 'Delete a memory entry.',
	inputSchema: {
		type: z.enum(['fact', 'hardware', 'project']).describe('Entry type'),
		category: z.string().optional().describe('For facts: category name'),
		key: z.string().describe('Key or name to delete')
	}
}, async (args) => {
	return await handleMemoryDelete(args)
})

// Inbox tools
server.registerTool('inbox_send', {
	description: 'Send an item to the inbox for Desktop or Code to pick up.',
	inputSchema: {
		source: z.enum(['desktop', 'code']).describe('Who is sending this'),
		target: z.enum(['desktop', 'code', 'any']).describe('Who should pick this up'),
		title: z.string().describe('Short title'),
		content: z.string().optional().describe('Full content (idea, plan, request, update)'),
		project: z.string().optional().describe('Project/directory this message is sent from (e.g. ~/.claude)')
	}
}, async (args) => {
	return await handleInboxSend(args)
})

server.registerTool('inbox_list', {
	description: 'List inbox items. Filter by target (desktop/code/any) and/or status (pending/picked_up/done).',
	inputSchema: {
		target: z.enum(['desktop', 'code', 'any']).optional().describe('Filter by target'),
		status: z.enum(['pending', 'picked_up', 'done']).optional().describe('Filter by status')
	}
}, async (args) => {
	return await handleInboxList(args)
})

server.registerTool('inbox_read', {
	description: 'Read a specific inbox item by ID.',
	inputSchema: {
		id: z.number().describe('Inbox item ID')
	}
}, async (args) => {
	return await handleInboxRead({ id: args.id })
})

server.registerTool('inbox_update', {
	description: 'Update an inbox item status (pending -> picked_up -> done).',
	inputSchema: {
		id: z.number().describe('Inbox item ID'),
		status: z.enum(['pending', 'picked_up', 'done']).describe('New status')
	}
}, async (args) => {
	return await handleInboxUpdate({ id: args.id, status: args.status })
})

server.registerTool('inbox_delete', {
	description: 'Delete an inbox item.',
	inputSchema: {
		id: z.number().describe('Inbox item ID')
	}
}, async (args) => {
	return await handleInboxDelete({ id: args.id })
})

// Relay tools
server.registerTool('relay_create', {
	description: 'Create a new relay with title and spec. Returns the relay ID.',
	inputSchema: {
		title: z.string().describe('Relay title'),
		spec: z.string().optional().describe('Full specification/plan')
	}
}, async (args) => {
	return await handleRelayCreate(args)
})

server.registerTool('relay_read', {
	description: 'Get a relay with all its context and tasks.',
	inputSchema: {
		id: z.number().describe('Relay ID')
	}
}, async (args) => {
	return await handleRelayRead({ id: args.id })
})

server.registerTool('relay_list', {
	description: 'List relays, optionally filtered by status (active, complete, archived).',
	inputSchema: {
		status: z.string().optional().describe('Filter by status')
	}
}, async (args) => {
	return await handleRelayList(args)
})

server.registerTool('relay_update', {
	description: "Update a relay's status or spec.",
	inputSchema: {
		id: z.number().describe('Relay ID'),
		status: z.string().optional().describe('New status'),
		spec: z.string().optional().describe('Updated spec')
	}
}, async (args) => {
	return await handleRelayUpdate(args)
})

server.registerTool('relay_delete', {
	description: 'Delete a relay and all its context/tasks.',
	inputSchema: {
		id: z.number().describe('Relay ID')
	}
}, async (args) => {
	return await handleRelayDelete({ id: args.id })
})

server.registerTool('context_add', {
	description: 'Add context (decision, note, file reference, code) to a relay.',
	inputSchema: {
		relay_id: z.number().describe('Relay ID'),
		type: z.string().describe('Context type: decision, note, file, code, reference'),
		content: z.string().describe('The context content')
	}
}, async (args) => {
	return await handleContextAdd(args)
})

server.registerTool('task_add', {
	description: 'Add a task to a relay.',
	inputSchema: {
		relay_id: z.number().describe('Relay ID'),
		description: z.string().describe('Task description'),
		assigned_to: z.string().optional().describe('Assign to: desktop, code, or human')
	}
}, async (args) => {
	return await handleTaskAdd(args)
})

server.registerTool('task_update', {
	description: "Update a task's status or description.",
	inputSchema: {
		id: z.number().describe('Task ID'),
		status: z.string().optional().describe('New status: pending, in_progress, complete'),
		description: z.string().optional().describe('Updated description')
	}
}, async (args) => {
	return await handleTaskUpdate(args)
})

// Initialize and start
async function main() {
	await initDb()
	const transport = new StdioServerTransport()
	await server.connect(transport)
	console.error(`claude-memory-mcp running (v${VERSION})`)
}

main().catch((err) => {
	console.error('Fatal error:', err)
	process.exit(1)
})
