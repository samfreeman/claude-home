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
		source?: 'transcript' | 'wag'
	}
}

export interface App {
	name: string
	appRoot: string
	repoRoot: string | null
	lastUsed: number
}

export interface CopSession {
	id: string
	app: string
	pbi: string
	passed: boolean
	failures: string[]
	createdAt: number
	updatedAt: number
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

interface StoredTranscriptOffset {
	app: string
	file_path: string
	byte_offset: number
	updated_at: number
}

interface StoredCopSession {
	id: string
	app: string
	pbi: string
	passed: number
	failures: string | null
	created_at: number
	updated_at: number
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

	db.exec(`
		CREATE TABLE IF NOT EXISTS transcript_offsets (
			app TEXT PRIMARY KEY,
			file_path TEXT NOT NULL,
			byte_offset INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`)

	db.exec(`
		CREATE TABLE IF NOT EXISTS cop_sessions (
			id TEXT PRIMARY KEY,
			app TEXT NOT NULL,
			pbi TEXT NOT NULL,
			passed INTEGER NOT NULL DEFAULT 0,
			failures TEXT,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`)
	db.exec(`CREATE INDEX IF NOT EXISTS idx_cop_sessions_app_pbi ON cop_sessions(app, pbi)`)

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

export function getMessageById(id: string): WagMessage | null {
	const database = getDb()
	const row = database.prepare(
		'SELECT * FROM messages WHERE id = ?'
	).get(id) as StoredMessage | undefined

	if (!row) return null

	return {
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
	}
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

export function getTranscriptOffset(app: string): { filePath: string, byteOffset: number } | null {
	const database = getDb()
	const row = database.prepare(
		'SELECT * FROM transcript_offsets WHERE app = ?'
	).get(app) as StoredTranscriptOffset | undefined

	if (!row) return null

	return {
		filePath: row.file_path,
		byteOffset: row.byte_offset
	}
}

export function setTranscriptOffset(app: string, filePath: string, byteOffset: number): void {
	const database = getDb()
	const stmt = database.prepare(`
		INSERT INTO transcript_offsets (app, file_path, byte_offset, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(app) DO UPDATE SET
			file_path = excluded.file_path,
			byte_offset = excluded.byte_offset,
			updated_at = excluded.updated_at
	`)
	stmt.run(app, filePath, byteOffset, Date.now())
}

export function saveCopSession(session: CopSession): void {
	const database = getDb()
	const stmt = database.prepare(`
		INSERT INTO cop_sessions (id, app, pbi, passed, failures, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			passed = excluded.passed,
			failures = excluded.failures,
			updated_at = excluded.updated_at
	`)
	stmt.run(
		session.id,
		session.app,
		session.pbi,
		session.passed ? 1 : 0,
		session.failures.length > 0 ? JSON.stringify(session.failures) : null,
		session.createdAt,
		session.updatedAt)
}

export function getLatestCopSession(app: string, pbi: string): CopSession | null {
	const database = getDb()
	const row = database.prepare(
		'SELECT * FROM cop_sessions WHERE app = ? AND pbi = ? ORDER BY updated_at DESC LIMIT 1'
	).get(app, pbi) as StoredCopSession | undefined

	if (!row)
		return null

	return {
		id: row.id,
		app: row.app,
		pbi: row.pbi,
		passed: row.passed == 1,
		failures: row.failures ? JSON.parse(row.failures) : [],
		createdAt: row.created_at,
		updatedAt: row.updated_at
	}
}

export function clearCopSession(app: string, pbi: string): void {
	const database = getDb()
	database.prepare('DELETE FROM cop_sessions WHERE app = ? AND pbi = ?').run(app, pbi)
}
