#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { initDb } from './db.js'
import {
	handleMemoryRead,
	handleMemoryWrite,
	handleMemorySearch,
	handleMemoryDelete,
	handleMemoryExport,
	handleMemoryImport
} from './handlers/memory.js'

const VERSION = '1.0.0'

const server = new McpServer({ name: 'claude-memory-2-mcp', version: VERSION })

server.registerTool('memory_read', {
	description: "Read from personal memory. category='all' lists categories. For hardware/project, key is optional. For facts, specify category name.",
	inputSchema: {
		category: z.string().describe("'all', 'hardware', 'project', or a fact category name"),
		key: z.string().optional().describe('Specific key/name to read (optional)')
	}
}, (args) => {
	return handleMemoryRead({ category: args.category, key: args.key })
})

server.registerTool('memory_write', {
	description: "Write to personal memory. type='fact' for general facts, 'hardware' for gear, 'project' for projects.",
	inputSchema: {
		type: z.enum(['fact', 'hardware', 'project']).describe('Entry type'),
		category: z.string().optional().describe("For facts: category name (e.g., 'preference', 'personal')"),
		key: z.string().describe('Key or name identifier'),
		value: z.string().describe('Main value (fact value, hardware specs, or project notes)'),
		purpose: z.string().optional().describe("For hardware: what it's used for"),
		location: z.string().optional().describe('For hardware: where it lives'),
		status: z.string().optional().describe('For projects: status (active/paused/done)')
	}
}, (args) => {
	return handleMemoryWrite(args)
})

server.registerTool('memory_search', {
	description: 'Search all memory tables for a term.',
	inputSchema: {
		query: z.string().describe('Search term')
	}
}, (args) => {
	return handleMemorySearch({ query: args.query })
})

server.registerTool('memory_delete', {
	description: 'Delete a memory entry.',
	inputSchema: {
		type: z.enum(['fact', 'hardware', 'project']).describe('Entry type'),
		category: z.string().optional().describe('For facts: category name'),
		key: z.string().describe('Key or name to delete')
	}
}, (args) => {
	return handleMemoryDelete(args)
})

server.registerTool('memory_export', {
	description: 'Export memory to a portable SQLite file at a given path.',
	inputSchema: {
		path: z.string().describe('Destination file path for the export')
	}
}, () => {
	return handleMemoryExport()
})

server.registerTool('memory_import', {
	description: 'Import memory from a portable SQLite file. Newer updated timestamps win.',
	inputSchema: {
		path: z.string().describe('Source file path to import from')
	}
}, () => {
	return handleMemoryImport()
})

async function main() {
	initDb()
	const transport = new StdioServerTransport()
	await server.connect(transport)
	console.error(`claude-memory-2-mcp running (v${VERSION})`)
}

main().catch((err) => {
	console.error('Fatal:', err)
	process.exit(1)
})
