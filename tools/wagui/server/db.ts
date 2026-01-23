import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

export type WagMode = 'DOCS' | 'ADR' | 'DEV' | null
export type WagRole = 'user' | 'pm' | 'architect' | 'dev'
export type MessageType = 'chat' | 'proposal' | 'review' | 'diff' | 'decision' | 'system' | 'context'

export interface WagHeader {
	mode: WagMode
	app: string
	branch: string
	context: string
}

export interface WagMessage {
	id: string
	timestamp: number
	header: WagHeader
	role: WagRole
	type: MessageType
	content: string
	metadata?: {
		file?: string
		task?: number
		pbi?: string
		approved?: boolean
	}
}

export interface App {
	name: string
	appRoot: string
	repoRoot: string | null
	lastUsed: number
}

interface StoredMessage {
	id: string
	timestamp: number
	mode: string | null
	app: string
	branch: string
	context: string
	role: string
	type: string
	content: string
	metadata: string | null
}

interface StoredApp {
	name: string
	app_root: string
	repo_root: string | null
	last_used: number
}

let db: Database.Database | null = null

export function initDb(dbPath?: string): Database.Database {
	if (db)
		return db

	if (dbPath == ':memory:')
		db = new Database(':memory:')
	else {
		const dataDir = path.join(process.cwd(), 'data')
		if (!fs.existsSync(dataDir))
			fs.mkdirSync(dataDir, { recursive: true })
		db = new Database(dbPath || path.join(dataDir, 'wagui.db'))
	}

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
	db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`)

	db.exec(`
		CREATE TABLE IF NOT EXISTS apps (
			name TEXT PRIMARY KEY,
			app_root TEXT NOT NULL,
			repo_root TEXT,
			last_used INTEGER NOT NULL
		)
	`)

	return db
}

export function getDb(): Database.Database {
	if (!db)
		throw new Error('Database not initialized. Call initDb() first.')
	return db
}

export function saveMessage(message: WagMessage): void {
	const database = getDb()
	const stmt = database.prepare(`
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
		message.metadata ? JSON.stringify(message.metadata) : null)
}

export function getMessages(limit = 100): WagMessage[] {
	const database = getDb()
	const rows = database.prepare(
		'SELECT * FROM messages ORDER BY timestamp ASC LIMIT ?'
	).all(limit) as StoredMessage[]

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

export function clearMessages(): void {
	const database = getDb()
	database.prepare('DELETE FROM messages').run()
}

export function closeDb(): void {
	if (db) {
		db.close()
		db = null
	}
}

export function resetDb(): void {
	closeDb()
}

export function upsertApp(name: string, appRoot: string, repoRoot?: string): void {
	const database = getDb()
	const stmt = database.prepare(`
		INSERT INTO apps (name, app_root, repo_root, last_used)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET
			app_root = excluded.app_root,
			repo_root = excluded.repo_root,
			last_used = excluded.last_used
	`)
	stmt.run(name, appRoot, repoRoot || null, Date.now())
}

export function getApps(): App[] {
	const database = getDb()
	const rows = database.prepare(
		'SELECT * FROM apps ORDER BY last_used DESC'
	).all() as StoredApp[]

	return rows.map(row => ({
		name: row.name,
		appRoot: row.app_root,
		repoRoot: row.repo_root,
		lastUsed: row.last_used
	}))
}

export function getApp(name: string): App | null {
	const database = getDb()
	const row = database.prepare(
		'SELECT * FROM apps WHERE name = ?'
	).get(name) as StoredApp | undefined

	if (!row) return null

	return {
		name: row.name,
		appRoot: row.app_root,
		repoRoot: row.repo_root,
		lastUsed: row.last_used
	}
}
