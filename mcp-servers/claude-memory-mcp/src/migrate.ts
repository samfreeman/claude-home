import type Database from 'better-sqlite3'

interface Migration {
	name: string
	up: (db: Database.Database) => void
}

const migrations: Migration[] = []

export function runMigrations(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS _migrations (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			applied_at TEXT NOT NULL
		)
	`)

	const applied = db.prepare('SELECT name FROM _migrations').all() as { name: string }[]
	const appliedNames = new Set(applied.map(r => r.name))

	for (const migration of migrations) {
		if (appliedNames.has(migration.name))
			continue

		migration.up(db)
		db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
			migration.name,
			new Date().toISOString()
		)
	}
}
