#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { initDb } from './db.js'
import { handleInboxSend, handleInboxList, handleInboxRead, handleInboxUpdate, handleInboxDelete } from './handlers/inbox.js'

const VERSION = '1.0.0'

// Participants — adding a new one is a one-line change here
const PARTICIPANTS = ['desktop', 'code'] as const
const STATUSES = ['pending', 'picked_up', 'done'] as const

const server = new McpServer({ name: 'claude-inbox-mcp', version: VERSION })

server.registerTool('inbox_send', {
	description: 'Send an item to the inbox for Desktop or Code to pick up.',
	inputSchema: {
		source: z.enum(PARTICIPANTS).describe('Who is sending this'),
		target: z.enum(PARTICIPANTS).describe('Who should pick this up'),
		title: z.string().describe('Short title'),
		content: z.string().optional().describe('Full content (idea, plan, request, update)'),
		project: z.string().optional().describe('Project/directory this message relates to')
	}
}, async (args) => {
	return handleInboxSend(args)
})

server.registerTool('inbox_list', {
	description: 'List inbox items. Filter by target and/or status.',
	inputSchema: {
		target: z.enum(PARTICIPANTS).optional().describe('Filter by target'),
		status: z.enum(STATUSES).optional().describe('Filter by status')
	}
}, async (args) => {
	return handleInboxList(args)
})

server.registerTool('inbox_read', {
	description: 'Read a specific inbox item by ID.',
	inputSchema: {
		id: z.number().describe('Inbox item ID')
	}
}, async (args) => {
	return handleInboxRead({ id: args.id })
})

server.registerTool('inbox_update', {
	description: 'Update an inbox item status.',
	inputSchema: {
		id: z.number().describe('Inbox item ID'),
		status: z.enum(STATUSES).describe('New status')
	}
}, async (args) => {
	return handleInboxUpdate({ id: args.id, status: args.status })
})

server.registerTool('inbox_delete', {
	description: 'Delete an inbox item permanently.',
	inputSchema: {
		id: z.number().describe('Inbox item ID')
	}
}, async (args) => {
	return handleInboxDelete({ id: args.id })
})

async function main() {
	initDb()
	const transport = new StdioServerTransport()
	await server.connect(transport)
	console.error(`claude-inbox-mcp running (v${VERSION})`)
}

main().catch((err) => {
	console.error('Fatal:', err)
	process.exit(1)
})
