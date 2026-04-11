import Database from 'better-sqlite3'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { SCHEMA } from './schema.js'

let db: Database.Database

export function now(): string {
	return new Date().toISOString()
}

export function initDb(dbPath?: string): void {
	const localPath = dbPath || join(homedir(), '.claude', 'mcp-servers', 'claude-inbox-mcp', 'data', 'inbox.db')

	const dbDir = dirname(localPath)
	if (!existsSync(dbDir))
		mkdirSync(dbDir, { recursive: true })

	db = new Database(localPath)
	db.pragma('journal_mode = WAL')
	db.pragma('foreign_keys = ON')

	// Run schema — split on semicolons and execute each statement
	const statements = SCHEMA.split(';')
		.map(s => s.trim())
		.filter(s => s.length > 0)

	for (const sql of statements)
		db.exec(sql)
}

export function query<T = Record<string, unknown>>(sql: string, args: unknown[] = []): T[] {
	return db.prepare(sql).all(...args) as T[]
}

export function execute(sql: string, args: unknown[] = []): { lastInsertRowid: number; changes: number } {
	const result = db.prepare(sql).run(...args)
	return {
		lastInsertRowid: Number(result.lastInsertRowid),
		changes: result.changes
	}
}

export function pruneAndRenumber(maxItems = 100): void {
	const [{ cnt }] = db.prepare('SELECT COUNT(*) as cnt FROM inbox').all() as [{ cnt: number }]
	if (cnt <= maxItems) return

	// Delete oldest rows beyond the limit
	db.exec(`
		DELETE FROM inbox WHERE id NOT IN (
			SELECT id FROM inbox ORDER BY created DESC LIMIT ${maxItems}
		)
	`)

	// Renumber remaining rows starting from 1
	const rows = db.prepare('SELECT id FROM inbox ORDER BY created ASC').all() as { id: number }[]
	for (let i = 0; i < rows.length; i++)
		db.prepare('UPDATE inbox SET id = ? WHERE id = ?').run(-(i + 1), rows[i].id)
	for (let i = 0; i < rows.length; i++)
		db.prepare('UPDATE inbox SET id = ? WHERE id = ?').run(i + 1, -(i + 1))

	// Reset SQLite autoincrement sequence if it exists
	const hasSeq = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'").get()
	if (hasSeq)
		db.exec(`DELETE FROM sqlite_sequence WHERE name = 'inbox'`)
}

export function close(): void {
	db.close()
}