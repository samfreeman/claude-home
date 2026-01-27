#!/usr/bin/env npx tsx
/**
 * Migration script: Copy data from old SQLite (better-sqlite3) to Turso
 *
 * Usage:
 *   1. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars
 *   2. Run: npx tsx scripts/migrate.ts
 *
 * The script will:
 *   - Read from ~/.claude/memory.db (or MCP_MEMORY_DB)
 *   - Write to Turso cloud database
 *   - Verify row counts match
 */

import Database from 'better-sqlite3'
import { createClient, InValue } from '@libsql/client'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'
import { SCHEMA } from '../src/schema.js'

const OLD_DB_PATH = process.env.MCP_MEMORY_DB || join(homedir(), '.claude', 'memory.db')

async function migrate() {
	// Check for Turso credentials
	const syncUrl = process.env.TURSO_DATABASE_URL
	const authToken = process.env.TURSO_AUTH_TOKEN

	if (!syncUrl || !authToken) {
		console.error('Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set')
		process.exit(1)
	}

	// Check old database exists
	if (!existsSync(OLD_DB_PATH)) {
		console.error(`Error: Old database not found at ${OLD_DB_PATH}`)
		process.exit(1)
	}

	console.log(`Migrating from: ${OLD_DB_PATH}`)
	console.log(`Migrating to: ${syncUrl}`)
	console.log('')

	// Open old database
	const oldDb = new Database(OLD_DB_PATH, { readonly: true })

	// Connect to Turso
	const turso = createClient({ url: syncUrl, authToken })

	// Initialize schema on Turso
	console.log('Initializing schema on Turso...')
	const statements = SCHEMA.split(';')
		.map(s => s.trim())
		.filter(s => s.length > 0)
		.map(sql => ({ sql }))
	await turso.batch(statements, 'write')

	// Migrate each table
	const tables = [
		{ name: 'facts', columns: ['id', 'category', 'key', 'value', 'added', 'updated'] },
		{ name: 'hardware', columns: ['id', 'name', 'specs', 'purpose', 'location', 'added'] },
		{ name: 'projects', columns: ['id', 'name', 'status', 'notes', 'added', 'updated'] },
		{ name: 'inbox', columns: ['id', 'source', 'target', 'title', 'content', 'status', 'created', 'updated'] },
		{ name: 'relays', columns: ['id', 'title', 'status', 'spec', 'created', 'updated'] },
		{ name: 'relay_context', columns: ['id', 'relay_id', 'type', 'content', 'added'] },
		{ name: 'relay_tasks', columns: ['id', 'relay_id', 'description', 'status', 'assigned_to', 'created'] }
	]

	for (const table of tables) {
		console.log(`Migrating ${table.name}...`)

		// Read all rows from old database
		const rows = oldDb.prepare(`SELECT * FROM ${table.name}`).all() as Record<string, InValue>[]

		if (rows.length == 0) {
			console.log(`  - 0 rows (empty)`)
			continue
		}

		// Build insert statements
		const placeholders = table.columns.map(() => '?').join(', ')
		const insertSql = `INSERT OR REPLACE INTO ${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})`

		// Batch insert
		const insertStatements = rows.map(row => ({
			sql: insertSql,
			args: table.columns.map(col => row[col] ?? null)
		}))

		// Execute in chunks of 100 to avoid overwhelming Turso
		const chunkSize = 100
		for (let i = 0; i < insertStatements.length; i += chunkSize) {
			const chunk = insertStatements.slice(i, i + chunkSize)
			await turso.batch(chunk, 'write')
		}

		console.log(`  - ${rows.length} rows migrated`)
	}

	// Verify counts
	console.log('')
	console.log('Verifying row counts...')

	let allMatch = true
	for (const table of tables) {
		const oldCount = (oldDb.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number }).count
		const newResult = await turso.execute(`SELECT COUNT(*) as count FROM ${table.name}`)
		const newCount = Number(newResult.rows[0]['count'])

		const status = oldCount == newCount ? '✓' : '✗'
		console.log(`  ${status} ${table.name}: ${oldCount} → ${newCount}`)

		if (oldCount != newCount) {
			allMatch = false
		}
	}

	console.log('')
	if (allMatch) {
		console.log('Migration complete! All row counts match.')
		console.log('')
		console.log('Next steps:')
		console.log('  1. Backup your old database: mv ~/.claude/memory.db ~/.claude/memory.db.backup')
		console.log('  2. The new server will create a local replica at ~/.claude/memory.db')
		console.log('  3. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your environment')
	}
	else {
		console.error('Warning: Some row counts do not match. Please verify the migration.')
		process.exit(1)
	}

	oldDb.close()
	turso.close()
}

migrate().catch((err) => {
	console.error('Migration failed:', err)
	process.exit(1)
})