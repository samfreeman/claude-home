import { createClient, Client, InValue } from '@libsql/client'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { SCHEMA } from './schema.js'

let client: Client

export interface DbConfig {
	localPath?: string
	syncUrl?: string
	authToken?: string
	syncInterval?: number
}

// Get current timestamp in ISO format
export function now(): string {
	return new Date().toISOString()
}

// Initialize database connection
export async function initDb(config: DbConfig = {}): Promise<void> {
	const localPath = config.localPath || process.env.MCP_MEMORY_DB || join(homedir(), '.claude', 'memory.db')
	const syncUrl = config.syncUrl || process.env.TURSO_DATABASE_URL
	const authToken = config.authToken || process.env.TURSO_AUTH_TOKEN
	const syncInterval = config.syncInterval ?? 60

	// Ensure directory exists
	const dbDir = dirname(localPath)
	if (!existsSync(dbDir)) {
		mkdirSync(dbDir, { recursive: true })
	}

	// Create client - embedded replica if sync credentials provided
	if (syncUrl && authToken) {
		client = createClient({
			url: `file:${localPath}`,
			syncUrl,
			authToken,
			syncInterval
		})
		// Initial sync
		await client.sync()
		console.error(`claude-memory-mcp: syncing with ${syncUrl}`)
	}
	else {
		// Local only mode
		client = createClient({
			url: `file:${localPath}`
		})
		console.error('claude-memory-mcp: local mode (no TURSO_DATABASE_URL)')
	}

	// Initialize schema - run as batch for atomicity
	const statements = SCHEMA.split(';')
		.map(s => s.trim())
		.filter(s => s.length > 0)
		.map(sql => ({ sql }))

	await client.batch(statements, 'write')
}

// Query that returns rows
export async function query<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T[]> {
	const result = await client.execute({ sql, args })
	return result.rows as T[]
}

// Execute that returns lastInsertRowid
export async function execute(sql: string, args: InValue[] = []): Promise<{ lastInsertRowid: number; rowsAffected: number }> {
	const result = await client.execute({ sql, args })
	return {
		lastInsertRowid: result.lastInsertRowid ? Number(result.lastInsertRowid) : 0,
		rowsAffected: result.rowsAffected
	}
}

// Batch execute multiple statements
export async function batch(statements: Array<{ sql: string; args?: InValue[] }>): Promise<void> {
	await client.batch(statements, 'write')
}

// Force sync with remote (for embedded replicas)
export async function sync(): Promise<void> {
	if ('sync' in client) {
		await client.sync()
	}
}

// Close database connection
export async function close(): Promise<void> {
	client.close()
}