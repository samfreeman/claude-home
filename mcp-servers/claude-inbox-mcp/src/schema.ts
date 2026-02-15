export const SCHEMA = `
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

	CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox(status);
	CREATE INDEX IF NOT EXISTS idx_inbox_target ON inbox(target);
`
