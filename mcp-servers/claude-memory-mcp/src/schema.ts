// SQL statements to initialize the database schema
export const SCHEMA = `
	-- Memory tables
	CREATE TABLE IF NOT EXISTS facts (
		id INTEGER PRIMARY KEY,
		category TEXT NOT NULL,
		key TEXT NOT NULL,
		value TEXT NOT NULL,
		added TEXT NOT NULL,
		updated TEXT NOT NULL,
		UNIQUE(category, key)
	);

	CREATE TABLE IF NOT EXISTS hardware (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		specs TEXT,
		purpose TEXT,
		location TEXT,
		added TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS projects (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		status TEXT DEFAULT 'active',
		notes TEXT,
		added TEXT NOT NULL,
		updated TEXT NOT NULL
	);

	-- Inbox table (simple messages)
	CREATE TABLE IF NOT EXISTS inbox (
		id INTEGER PRIMARY KEY,
		source TEXT NOT NULL,
		target TEXT NOT NULL,
		title TEXT NOT NULL,
		content TEXT,
		project TEXT,
		status TEXT DEFAULT 'pending',
		created TEXT NOT NULL,
		updated TEXT NOT NULL
	);

	-- Relay tables (structured work packages)
	CREATE TABLE IF NOT EXISTS relays (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		status TEXT DEFAULT 'active',
		spec TEXT,
		created TEXT NOT NULL,
		updated TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS relay_context (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		relay_id INTEGER NOT NULL,
		type TEXT NOT NULL,
		content TEXT NOT NULL,
		added TEXT NOT NULL,
		FOREIGN KEY (relay_id) REFERENCES relays(id)
	);

	CREATE TABLE IF NOT EXISTS relay_tasks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		relay_id INTEGER NOT NULL,
		description TEXT NOT NULL,
		status TEXT DEFAULT 'pending',
		assigned_to TEXT,
		created TEXT NOT NULL,
		FOREIGN KEY (relay_id) REFERENCES relays(id)
	);

	-- Indexes
	CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
	CREATE INDEX IF NOT EXISTS idx_facts_key ON facts(key);
	CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox(status);
	CREATE INDEX IF NOT EXISTS idx_inbox_target ON inbox(target);
	CREATE INDEX IF NOT EXISTS idx_relays_status ON relays(status);
`
