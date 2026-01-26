#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
	CallToolRequestSchema,
	ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import Database from 'better-sqlite3'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { mkdirSync, existsSync } from 'fs'

// Config - override with MCP_MEMORY_DB env var
const DB_PATH = process.env.MCP_MEMORY_DB || join(homedir(), '.claude', 'memory.db')

// Ensure directory exists
const dbDir = dirname(DB_PATH)
if (!existsSync(dbDir)) {
	mkdirSync(dbDir, { recursive: true })
}

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

// Initialize schema
db.exec(`
	-- Memory tables
	CREATE TABLE IF NOT EXISTS facts (
		id INTEGER PRIMARY KEY,
		category TEXT NOT NULL,
		key TEXT NOT NULL,
		value TEXT NOT NULL,
		added TEXT DEFAULT CURRENT_TIMESTAMP,
		updated TEXT DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(category, key)
	);

	CREATE TABLE IF NOT EXISTS hardware (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		specs TEXT,
		purpose TEXT,
		location TEXT,
		added TEXT DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS projects (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		status TEXT DEFAULT 'active',
		notes TEXT,
		added TEXT DEFAULT CURRENT_TIMESTAMP,
		updated TEXT DEFAULT CURRENT_TIMESTAMP
	);

	-- Inbox table (simple messages)
	CREATE TABLE IF NOT EXISTS inbox (
		id INTEGER PRIMARY KEY,
		source TEXT NOT NULL,
		target TEXT NOT NULL,
		title TEXT NOT NULL,
		content TEXT,
		status TEXT DEFAULT 'pending',
		created TEXT DEFAULT CURRENT_TIMESTAMP,
		updated TEXT DEFAULT CURRENT_TIMESTAMP
	);

	-- Relay tables (structured work packages)
	CREATE TABLE IF NOT EXISTS relays (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		status TEXT DEFAULT 'active',
		spec TEXT,
		created TEXT DEFAULT (datetime('now')),
		updated TEXT DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS relay_context (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		relay_id INTEGER NOT NULL,
		type TEXT NOT NULL,
		content TEXT NOT NULL,
		added TEXT DEFAULT (datetime('now')),
		FOREIGN KEY (relay_id) REFERENCES relays(id)
	);

	CREATE TABLE IF NOT EXISTS relay_tasks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		relay_id INTEGER NOT NULL,
		description TEXT NOT NULL,
		status TEXT DEFAULT 'pending',
		assigned_to TEXT,
		created TEXT DEFAULT (datetime('now')),
		FOREIGN KEY (relay_id) REFERENCES relays(id)
	);

	-- Indexes
	CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
	CREATE INDEX IF NOT EXISTS idx_facts_key ON facts(key);
	CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox(status);
	CREATE INDEX IF NOT EXISTS idx_inbox_target ON inbox(target);
	CREATE INDEX IF NOT EXISTS idx_relays_status ON relays(status);
`)

// Prepared statements
const stmts = {
	// Facts
	getFact: db.prepare('SELECT * FROM facts WHERE category = ? AND key = ?'),
	getFactsByCategory: db.prepare('SELECT key, value FROM facts WHERE category = ?'),
	getCategories: db.prepare('SELECT category, COUNT(*) as count FROM facts GROUP BY category'),
	upsertFact: db.prepare(`
		INSERT INTO facts (category, key, value, added, updated) VALUES (?, ?, ?, datetime('now'), datetime('now'))
		ON CONFLICT(category, key) DO UPDATE SET value = excluded.value, updated = datetime('now')
	`),
	deleteFact: db.prepare('DELETE FROM facts WHERE category = ? AND key = ?'),
	searchFacts: db.prepare('SELECT category, key, value FROM facts WHERE key LIKE ? OR value LIKE ?'),

	// Hardware
	getHardware: db.prepare('SELECT * FROM hardware WHERE name = ?'),
	getAllHardware: db.prepare('SELECT name, purpose, location FROM hardware'),
	upsertHardware: db.prepare(`
		INSERT INTO hardware (name, specs, purpose, location, added) VALUES (?, ?, ?, ?, datetime('now'))
		ON CONFLICT(name) DO UPDATE SET specs = excluded.specs, purpose = excluded.purpose, location = excluded.location
	`),
	deleteHardware: db.prepare('DELETE FROM hardware WHERE name = ?'),
	searchHardware: db.prepare('SELECT name, specs, purpose, location FROM hardware WHERE name LIKE ? OR specs LIKE ? OR purpose LIKE ?'),
	countHardware: db.prepare('SELECT COUNT(*) as count FROM hardware'),

	// Projects
	getProject: db.prepare('SELECT * FROM projects WHERE name = ?'),
	getAllProjects: db.prepare('SELECT name, status, notes FROM projects'),
	upsertProject: db.prepare(`
		INSERT INTO projects (name, status, notes, added, updated) VALUES (?, ?, ?, datetime('now'), datetime('now'))
		ON CONFLICT(name) DO UPDATE SET status = excluded.status, notes = excluded.notes, updated = datetime('now')
	`),
	deleteProject: db.prepare('DELETE FROM projects WHERE name = ?'),
	searchProjects: db.prepare('SELECT name, status, notes FROM projects WHERE name LIKE ? OR notes LIKE ?'),
	countProjects: db.prepare('SELECT COUNT(*) as count FROM projects'),

	// Inbox
	createInbox: db.prepare(`
		INSERT INTO inbox (source, target, title, content, status, created, updated)
		VALUES (?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
	`),
	getInbox: db.prepare('SELECT * FROM inbox WHERE id = ?'),
	listInbox: db.prepare(`
		SELECT * FROM inbox
		WHERE (target = ? OR target = 'any' OR ? IS NULL)
		AND (status = ? OR ? IS NULL)
		ORDER BY created DESC
	`),
	updateInboxStatus: db.prepare(`
		UPDATE inbox SET status = ?, updated = datetime('now') WHERE id = ?
	`),
	deleteInbox: db.prepare('DELETE FROM inbox WHERE id = ?'),
	countInboxPending: db.prepare("SELECT COUNT(*) as count FROM inbox WHERE status = 'pending'"),

	// Relays
	createRelay: db.prepare('INSERT INTO relays (title, spec) VALUES (?, ?)'),
	getRelay: db.prepare('SELECT * FROM relays WHERE id = ?'),
	listRelays: db.prepare('SELECT * FROM relays WHERE status = ? OR ? IS NULL ORDER BY updated DESC'),
	updateRelay: db.prepare("UPDATE relays SET status = COALESCE(?, status), spec = COALESCE(?, spec), updated = datetime('now') WHERE id = ?"),
	deleteRelay: db.prepare('DELETE FROM relays WHERE id = ?'),
	countRelays: db.prepare("SELECT COUNT(*) as count FROM relays WHERE status = 'active'"),

	// Relay Context
	addContext: db.prepare('INSERT INTO relay_context (relay_id, type, content) VALUES (?, ?, ?)'),
	getContext: db.prepare('SELECT * FROM relay_context WHERE relay_id = ? ORDER BY added'),
	deleteContext: db.prepare('DELETE FROM relay_context WHERE relay_id = ?'),

	// Relay Tasks
	addTask: db.prepare('INSERT INTO relay_tasks (relay_id, description, assigned_to) VALUES (?, ?, ?)'),
	getTasks: db.prepare('SELECT * FROM relay_tasks WHERE relay_id = ? ORDER BY created'),
	getTask: db.prepare('SELECT * FROM relay_tasks WHERE id = ?'),
	updateTask: db.prepare('UPDATE relay_tasks SET status = COALESCE(?, status), description = COALESCE(?, description) WHERE id = ?'),
	deleteTasks: db.prepare('DELETE FROM relay_tasks WHERE relay_id = ?')
}

const server = new Server(
	{ name: 'claude-memory-mcp', version: '2.1.0' },
	{ capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		// Memory tools
		{
			name: 'memory_read',
			description: "Read from personal memory. category='all' lists categories. For hardware/project, key is optional. For facts, specify category name.",
			inputSchema: {
				type: 'object',
				properties: {
					category: { type: 'string', description: "'all', 'hardware', 'project', or a fact category name" },
					key: { type: 'string', description: 'Specific key/name to read (optional)' }
				},
				required: ['category']
			}
		},
		{
			name: 'memory_write',
			description: "Write to personal memory. type='fact' for general facts, 'hardware' for gear, 'project' for projects.",
			inputSchema: {
				type: 'object',
				properties: {
					type: { type: 'string', enum: ['fact', 'hardware', 'project'], description: 'Entry type' },
					category: { type: 'string', description: "For facts: category name (e.g., 'preference', 'workflow')" },
					key: { type: 'string', description: 'Key or name identifier' },
					value: { type: 'string', description: 'Main value (fact value, hardware specs, or project notes)' },
					purpose: { type: 'string', description: "For hardware: what it's used for" },
					location: { type: 'string', description: 'For hardware: where it lives (office/couch/floating)' },
					status: { type: 'string', description: 'For projects: status (active/paused/done)' }
				},
				required: ['type', 'key', 'value']
			}
		},
		{
			name: 'memory_search',
			description: 'Search all memory tables for a term.',
			inputSchema: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'Search term' }
				},
				required: ['query']
			}
		},
		{
			name: 'memory_delete',
			description: 'Delete a memory entry.',
			inputSchema: {
				type: 'object',
				properties: {
					type: { type: 'string', enum: ['fact', 'hardware', 'project'], description: 'Entry type' },
					category: { type: 'string', description: 'For facts: category name' },
					key: { type: 'string', description: 'Key or name to delete' }
				},
				required: ['type', 'key']
			}
		},
		// Inbox tools
		{
			name: 'inbox_send',
			description: 'Send an item to the inbox for Desktop or Code to pick up.',
			inputSchema: {
				type: 'object',
				properties: {
					source: { type: 'string', enum: ['desktop', 'code'], description: 'Who is sending this' },
					target: { type: 'string', enum: ['desktop', 'code', 'any'], description: 'Who should pick this up' },
					title: { type: 'string', description: 'Short title' },
					content: { type: 'string', description: 'Full content (idea, plan, request, update)' }
				},
				required: ['source', 'target', 'title']
			}
		},
		{
			name: 'inbox_list',
			description: 'List inbox items. Filter by target (desktop/code/any) and/or status (pending/picked_up/done).',
			inputSchema: {
				type: 'object',
				properties: {
					target: { type: 'string', enum: ['desktop', 'code', 'any'], description: 'Filter by target' },
					status: { type: 'string', enum: ['pending', 'picked_up', 'done'], description: 'Filter by status' }
				}
			}
		},
		{
			name: 'inbox_read',
			description: 'Read a specific inbox item by ID.',
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'number', description: 'Inbox item ID' }
				},
				required: ['id']
			}
		},
		{
			name: 'inbox_update',
			description: 'Update an inbox item status (pending -> picked_up -> done).',
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'number', description: 'Inbox item ID' },
					status: { type: 'string', enum: ['pending', 'picked_up', 'done'], description: 'New status' }
				},
				required: ['id', 'status']
			}
		},
		{
			name: 'inbox_delete',
			description: 'Delete an inbox item.',
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'number', description: 'Inbox item ID' }
				},
				required: ['id']
			}
		},
		// Relay tools
		{
			name: 'relay_create',
			description: 'Create a new relay with title and spec. Returns the relay ID.',
			inputSchema: {
				type: 'object',
				properties: {
					title: { type: 'string', description: 'Relay title' },
					spec: { type: 'string', description: 'Full specification/plan' }
				},
				required: ['title']
			}
		},
		{
			name: 'relay_read',
			description: 'Get a relay with all its context and tasks.',
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'number', description: 'Relay ID' }
				},
				required: ['id']
			}
		},
		{
			name: 'relay_list',
			description: 'List relays, optionally filtered by status (active, complete, archived).',
			inputSchema: {
				type: 'object',
				properties: {
					status: { type: 'string', description: 'Filter by status' }
				}
			}
		},
		{
			name: 'relay_update',
			description: "Update a relay's status or spec.",
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'number', description: 'Relay ID' },
					status: { type: 'string', description: 'New status' },
					spec: { type: 'string', description: 'Updated spec' }
				},
				required: ['id']
			}
		},
		{
			name: 'relay_delete',
			description: 'Delete a relay and all its context/tasks.',
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'number', description: 'Relay ID' }
				},
				required: ['id']
			}
		},
		{
			name: 'context_add',
			description: 'Add context (decision, note, file reference, code) to a relay.',
			inputSchema: {
				type: 'object',
				properties: {
					relay_id: { type: 'number', description: 'Relay ID' },
					type: { type: 'string', description: 'Context type: decision, note, file, code, reference' },
					content: { type: 'string', description: 'The context content' }
				},
				required: ['relay_id', 'type', 'content']
			}
		},
		{
			name: 'task_add',
			description: 'Add a task to a relay.',
			inputSchema: {
				type: 'object',
				properties: {
					relay_id: { type: 'number', description: 'Relay ID' },
					description: { type: 'string', description: 'Task description' },
					assigned_to: { type: 'string', description: 'Assign to: desktop, code, or human' }
				},
				required: ['relay_id', 'description']
			}
		},
		{
			name: 'task_update',
			description: "Update a task's status or description.",
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'number', description: 'Task ID' },
					status: { type: 'string', description: 'New status: pending, in_progress, complete' },
					description: { type: 'string', description: 'Updated description' }
				},
				required: ['id']
			}
		}
	]
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params

	try {
		switch (name) {
			// Memory handlers
			case 'memory_read':
				return handleMemoryRead(args as { category: string; key?: string })
			case 'memory_write':
				return handleMemoryWrite(args as { type: string; category?: string; key: string; value: string; purpose?: string; location?: string; status?: string })
			case 'memory_search':
				return handleMemorySearch(args as { query: string })
			case 'memory_delete':
				return handleMemoryDelete(args as { type: string; category?: string; key: string })
			// Inbox handlers
			case 'inbox_send':
				return handleInboxSend(args as { source: string; target: string; title: string; content?: string })
			case 'inbox_list':
				return handleInboxList(args as { target?: string; status?: string })
			case 'inbox_read':
				return handleInboxRead(args as { id: number })
			case 'inbox_update':
				return handleInboxUpdate(args as { id: number; status: string })
			case 'inbox_delete':
				return handleInboxDelete(args as { id: number })
			// Relay handlers
			case 'relay_create':
				return handleRelayCreate(args as { title: string; spec?: string })
			case 'relay_read':
				return handleRelayRead(args as { id: number })
			case 'relay_list':
				return handleRelayList(args as { status?: string })
			case 'relay_update':
				return handleRelayUpdate(args as { id: number; status?: string; spec?: string })
			case 'relay_delete':
				return handleRelayDelete(args as { id: number })
			case 'context_add':
				return handleContextAdd(args as { relay_id: number; type: string; content: string })
			case 'task_add':
				return handleTaskAdd(args as { relay_id: number; description: string; assigned_to?: string })
			case 'task_update':
				return handleTaskUpdate(args as { id: number; status?: string; description?: string })
			default:
				return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] }
		}
	}
	catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		return { content: [{ type: 'text', text: `Error: ${message}` }] }
	}
})

// Memory handlers
function handleMemoryRead(args: { category: string; key?: string }) {
	const { category, key } = args

	if (category == 'all') {
		const lines: string[] = []
		const cats = stmts.getCategories.all() as { category: string; count: number }[]
		for (const c of cats) {
			lines.push(`facts/${c.category}: ${c.count}`)
		}
		const hwCount = (stmts.countHardware.get() as { count: number }).count
		lines.push(`hardware: ${hwCount}`)
		const projCount = (stmts.countProjects.get() as { count: number }).count
		lines.push(`projects: ${projCount}`)
		const inboxCount = (stmts.countInboxPending.get() as { count: number }).count
		lines.push(`inbox (pending): ${inboxCount}`)
		const relayCount = (stmts.countRelays.get() as { count: number }).count
		lines.push(`relays (active): ${relayCount}`)
		return { content: [{ type: 'text', text: lines.join('\n') || 'Memory is empty.' }] }
	}

	if (category == 'hardware') {
		if (key) {
			const row = stmts.getHardware.get(key)
			return { content: [{ type: 'text', text: row ? JSON.stringify(row, null, 2) : `Hardware '${key}' not found.` }] }
		}
		const rows = stmts.getAllHardware.all() as { name: string; purpose: string; location: string }[]
		const text = rows.map((r) => `${r.name}: ${r.purpose} (${r.location})`).join('\n')
		return { content: [{ type: 'text', text: text || 'No hardware entries.' }] }
	}

	if (category == 'project') {
		if (key) {
			const row = stmts.getProject.get(key)
			return { content: [{ type: 'text', text: row ? JSON.stringify(row, null, 2) : `Project '${key}' not found.` }] }
		}
		const rows = stmts.getAllProjects.all() as { name: string; status: string; notes: string }[]
		const text = rows.map((r) => `${r.name} [${r.status}]: ${r.notes || ''}`).join('\n')
		return { content: [{ type: 'text', text: text || 'No projects.' }] }
	}

	// Fact category
	if (key) {
		const row = stmts.getFact.get(category, key) as { value: string } | undefined
		return { content: [{ type: 'text', text: row ? row.value : `No fact: ${category}/${key}` }] }
	}
	const rows = stmts.getFactsByCategory.all(category) as { key: string; value: string }[]
	const text = rows.map((r) => `${r.key}: ${r.value}`).join('\n')
	return { content: [{ type: 'text', text: text || `No facts in '${category}'.` }] }
}

function handleMemoryWrite(args: { type: string; category?: string; key: string; value: string; purpose?: string; location?: string; status?: string }) {
	const { type, category, key, value, purpose, location, status } = args

	if (type == 'hardware') {
		stmts.upsertHardware.run(key, value, purpose || '', location || '')
		return { content: [{ type: 'text', text: `Saved hardware: ${key}` }] }
	}

	if (type == 'project') {
		stmts.upsertProject.run(key, status || 'active', value)
		return { content: [{ type: 'text', text: `Saved project: ${key}` }] }
	}

	// Fact
	if (!category) {
		return { content: [{ type: 'text', text: 'Facts require a category.' }] }
	}
	stmts.upsertFact.run(category, key, value)
	return { content: [{ type: 'text', text: `Saved fact: ${category}/${key}` }] }
}

function handleMemorySearch(args: { query: string }) {
	// Split query into words, filter out short/common words
	const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'about', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'it', 'its', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'they', 'them', 'their', 'theirs', 'themselves'])

	const words = args.query
		.toLowerCase()
		.split(/\s+/)
		.filter(w => w.length >= 2 && !stopWords.has(w))

	// If no valid words after filtering, try the whole query
	if (words.length == 0) {
		words.push(args.query.toLowerCase())
	}

	// Use Maps to deduplicate by unique key
	const factResults = new Map<string, { category: string; key: string; value: string }>()
	const hwResults = new Map<string, { name: string; specs: string; purpose: string; location: string }>()
	const projResults = new Map<string, { name: string; status: string; notes: string }>()

	// Search for each word
	for (const word of words) {
		const search = `%${word}%`

		const facts = stmts.searchFacts.all(search, search) as { category: string; key: string; value: string }[]
		for (const r of facts) {
			factResults.set(`${r.category}/${r.key}`, r)
		}

		const hw = stmts.searchHardware.all(search, search, search) as { name: string; specs: string; purpose: string; location: string }[]
		for (const r of hw) {
			hwResults.set(r.name, r)
		}

		const proj = stmts.searchProjects.all(search, search) as { name: string; status: string; notes: string }[]
		for (const r of proj) {
			projResults.set(r.name, r)
		}
	}

	// Build results
	const results: string[] = []

	for (const r of factResults.values()) {
		results.push(`[fact] ${r.category}/${r.key}: ${r.value}`)
	}

	for (const r of hwResults.values()) {
		results.push(`[hardware] ${r.name}: ${r.purpose} (${r.location})`)
	}

	for (const r of projResults.values()) {
		results.push(`[project] ${r.name} [${r.status}]`)
	}

	return { content: [{ type: 'text', text: results.join('\n') || `No results for '${args.query}'.` }] }
}

function handleMemoryDelete(args: { type: string; category?: string; key: string }) {
	const { type, category, key } = args

	if (type == 'hardware') {
		stmts.deleteHardware.run(key)
	}
	else if (type == 'project') {
		stmts.deleteProject.run(key)
	}
	else {
		if (!category) return { content: [{ type: 'text', text: 'Facts require a category.' }] }
		stmts.deleteFact.run(category, key)
	}

	return { content: [{ type: 'text', text: `Deleted: ${type}/${category || ''}/${key}` }] }
}

// Inbox handlers
function handleInboxSend(args: { source: string; target: string; title: string; content?: string }) {
	const { source, target, title, content } = args
	const result = stmts.createInbox.run(source, target, title, content || null)
	return {
		content: [{
			type: 'text',
			text: JSON.stringify({ id: result.lastInsertRowid, title, from: source, to: target }, null, 2)
		}]
	}
}

function handleInboxList(args: { target?: string; status?: string }) {
	const { target, status } = args
	const rows = stmts.listInbox.all(target || null, target || null, status || null, status || null) as {
		id: number; source: string; target: string; title: string; status: string; created: string
	}[]

	if (rows.length == 0) {
		return { content: [{ type: 'text', text: 'Inbox is empty.' }] }
	}

	const text = rows.map((r) =>
		`[${r.id}] ${r.title} (${r.source}→${r.target}) [${r.status}] ${r.created}`
	).join('\n')

	return { content: [{ type: 'text', text }] }
}

function handleInboxRead(args: { id: number }) {
	const row = stmts.getInbox.get(args.id)
	if (!row) {
		return { content: [{ type: 'text', text: `Inbox item ${args.id} not found.` }] }
	}
	return { content: [{ type: 'text', text: JSON.stringify(row, null, 2) }] }
}

function handleInboxUpdate(args: { id: number; status: string }) {
	const { id, status } = args
	const existing = stmts.getInbox.get(id)
	if (!existing) {
		return { content: [{ type: 'text', text: `Inbox item ${id} not found.` }] }
	}
	stmts.updateInboxStatus.run(status, id)
	return { content: [{ type: 'text', text: `Inbox item ${id} marked as '${status}'.` }] }
}

function handleInboxDelete(args: { id: number }) {
	const existing = stmts.getInbox.get(args.id)
	if (!existing) {
		return { content: [{ type: 'text', text: `Inbox item ${args.id} not found.` }] }
	}
	stmts.deleteInbox.run(args.id)
	return { content: [{ type: 'text', text: `Inbox item ${args.id} deleted.` }] }
}

// Relay handlers
function handleRelayCreate(args: { title: string; spec?: string }) {
	const result = stmts.createRelay.run(args.title, args.spec || null)
	return {
		content: [{
			type: 'text',
			text: JSON.stringify({ id: result.lastInsertRowid, title: args.title }, null, 2)
		}]
	}
}

function handleRelayRead(args: { id: number }) {
	const relay = stmts.getRelay.get(args.id)
	if (!relay) {
		return { content: [{ type: 'text', text: `Relay ${args.id} not found` }] }
	}
	const context = stmts.getContext.all(args.id)
	const tasks = stmts.getTasks.all(args.id)
	return {
		content: [{
			type: 'text',
			text: JSON.stringify({ relay, context, tasks }, null, 2)
		}]
	}
}

function handleRelayList(args: { status?: string }) {
	const relays = stmts.listRelays.all(args.status || null, args.status || null)
	if ((relays as unknown[]).length == 0) {
		return { content: [{ type: 'text', text: 'No relays.' }] }
	}
	return {
		content: [{ type: 'text', text: JSON.stringify(relays, null, 2) }]
	}
}

function handleRelayUpdate(args: { id: number; status?: string; spec?: string }) {
	const existing = stmts.getRelay.get(args.id)
	if (!existing) {
		return { content: [{ type: 'text', text: `Relay ${args.id} not found` }] }
	}
	stmts.updateRelay.run(args.status || null, args.spec || null, args.id)
	const updated = stmts.getRelay.get(args.id)
	return {
		content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }]
	}
}

function handleRelayDelete(args: { id: number }) {
	stmts.deleteContext.run(args.id)
	stmts.deleteTasks.run(args.id)
	stmts.deleteRelay.run(args.id)
	return {
		content: [{ type: 'text', text: `Relay ${args.id} deleted` }]
	}
}

function handleContextAdd(args: { relay_id: number; type: string; content: string }) {
	const result = stmts.addContext.run(args.relay_id, args.type, args.content)
	return {
		content: [{
			type: 'text',
			text: JSON.stringify({ id: result.lastInsertRowid, type: args.type }, null, 2)
		}]
	}
}

function handleTaskAdd(args: { relay_id: number; description: string; assigned_to?: string }) {
	const result = stmts.addTask.run(args.relay_id, args.description, args.assigned_to || null)
	return {
		content: [{
			type: 'text',
			text: JSON.stringify({ id: result.lastInsertRowid, description: args.description }, null, 2)
		}]
	}
}

function handleTaskUpdate(args: { id: number; status?: string; description?: string }) {
	const existing = stmts.getTask.get(args.id)
	if (!existing) {
		return { content: [{ type: 'text', text: `Task ${args.id} not found` }] }
	}
	stmts.updateTask.run(args.status || null, args.description || null, args.id)
	return {
		content: [{ type: 'text', text: `Task ${args.id} updated` }]
	}
}

// Start server
const transport = new StdioServerTransport()
server.connect(transport)
console.error('claude-memory-mcp running (v2.1.0)')
