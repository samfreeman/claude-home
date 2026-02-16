export const SCHEMA = `
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
		added TEXT NOT NULL,
		updated TEXT
	);

	CREATE TABLE IF NOT EXISTS projects (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		status TEXT DEFAULT 'active',
		notes TEXT,
		added TEXT NOT NULL,
		updated TEXT NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
	CREATE INDEX IF NOT EXISTS idx_facts_key ON facts(key);
`
