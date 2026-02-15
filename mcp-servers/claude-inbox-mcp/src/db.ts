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

export function close(): void {
	db.close()
}