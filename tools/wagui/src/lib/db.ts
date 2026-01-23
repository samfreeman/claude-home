import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { WagMessage, StoredMessage, WagMode, WagRole, MessageType } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')

function ensureDataDir(): void {
	if (!fs.existsSync(DATA_DIR))
		fs.mkdirSync(DATA_DIR, { recursive: true })
}

function getDbPath(app: string): string {
	ensureDataDir()
	return path.join(DATA_DIR, `${app}.db`)
}

function initDb(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id TEXT PRIMARY KEY,
			timestamp INTEGER NOT NULL,
			mode TEXT,
			app TEXT NOT NULL,
			branch TEXT NOT NULL,
			context TEXT,
			role TEXT NOT NULL,
			type TEXT NOT NULL,
			content TEXT NOT NULL,
			metadata TEXT
		)
	`)
	db.exec(`
		CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
	`)
	db.exec(`
		CREATE INDEX IF NOT EXISTS idx_messages_app_branch ON messages(app, branch)
	`)
}

const dbCache: Map<string, Database.Database> = new Map()

export function getDb(app: string): Database.Database {
	let db = dbCache.get(app)
	if (!db) {
		db = new Database(getDbPath(app))
		initDb(db)
		dbCache.set(app, db)
	}
	return db
}

export function saveMessage(message: WagMessage): void {
	const db = getDb(message.header.app)
	const stmt = db.prepare(`
		INSERT OR REPLACE INTO messages (id, timestamp, mode, app, branch, context, role, type, content, metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	stmt.run(
		message.id,
		message.timestamp,
		message.header.mode,
		message.header.app,
		message.header.branch,
		message.header.context,
		message.role,
		message.type,
		message.content,
		message.metadata ? JSON.stringify(message.metadata) : null
	)
}

export function getMessages(app: string, branch?: string, limit = 100): WagMessage[] {
	const db = getDb(app)
	const query = branch
		? 'SELECT * FROM messages WHERE app = ? AND branch = ? ORDER BY timestamp ASC LIMIT ?'
		: 'SELECT * FROM messages WHERE app = ? ORDER BY timestamp ASC LIMIT ?'
	const params = branch ? [app, branch, limit] : [app, limit]
	const rows = db.prepare(query).all(...params) as StoredMessage[]

	return rows.map(row =>
		({
			id: row.id,
			timestamp: row.timestamp,
			header: {
				mode: row.mode as WagMode,
				app: row.app,
				branch: row.branch,
				context: row.context
			},
			role: row.role as WagRole,
			type: row.type as MessageType,
			content: row.content,
			metadata: row.metadata ? JSON.parse(row.metadata) : undefined
		}))
}

export function clearMessages(app: string, branch?: string): void {
	const db = getDb(app)
	if (branch) {
		db.prepare('DELETE FROM messages WHERE app = ? AND branch = ?').run(app, branch)
	}
	else {
		db.prepare('DELETE FROM messages WHERE app = ?').run(app)
	}
}

export function closeAll(): void {
	for (const db of dbCache.values()) {
		db.close()
	}
	dbCache.clear()
}
