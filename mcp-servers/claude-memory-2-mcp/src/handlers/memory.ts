import { query, execute, now } from '../db.js'
import type { ToolResult, MemoryReadArgs, MemoryWriteArgs, MemorySearchArgs, MemoryDeleteArgs } from '../types.js'

function text(t: string): ToolResult {
	return { content: [{ type: 'text', text: t }] }
}

export function handleMemoryRead(args: MemoryReadArgs): ToolResult {
	const { category, key } = args

	if (category == 'all') {
		const lines: string[] = []

		const cats = query<{ category: string; count: number }>(
			'SELECT category, COUNT(*) as count FROM facts GROUP BY category'
		)
		for (const c of cats)
			lines.push(`facts/${c.category}: ${c.count}`)

		const [hwCount] = query<{ count: number }>('SELECT COUNT(*) as count FROM hardware')
		lines.push(`hardware: ${hwCount?.count ?? 0}`)

		const [projCount] = query<{ count: number }>('SELECT COUNT(*) as count FROM projects')
		lines.push(`projects: ${projCount?.count ?? 0}`)

		return text(lines.join('\n') || 'Memory is empty.')
	}

	if (category == 'hardware') {
		if (key) {
			const [row] = query('SELECT * FROM hardware WHERE name = ?', [key])
			return text(row ? JSON.stringify(row, null, 2) : `Hardware '${key}' not found.`)
		}
		const rows = query<{ name: string; purpose: string; location: string }>(
			'SELECT name, purpose, location FROM hardware'
		)
		const t = rows.map((r) => `${r.name}: ${r.purpose} (${r.location})`).join('\n')
		return text(t || 'No hardware entries.')
	}

	if (category == 'project') {
		if (key) {
			const [row] = query('SELECT * FROM projects WHERE name = ?', [key])
			return text(row ? JSON.stringify(row, null, 2) : `Project '${key}' not found.`)
		}
		const rows = query<{ name: string; status: string; notes: string }>(
			'SELECT name, status, notes FROM projects'
		)
		const t = rows.map((r) => `${r.name} [${r.status}]: ${r.notes || ''}`).join('\n')
		return text(t || 'No projects.')
	}

	// Fact category
	if (key) {
		const [row] = query<{ value: string }>(
			'SELECT value FROM facts WHERE category = ? AND key = ?',
			[category, key]
		)
		return text(row ? row.value : `No fact: ${category}/${key}`)
	}

	const rows = query<{ key: string; value: string }>(
		'SELECT key, value FROM facts WHERE category = ?',
		[category]
	)
	const t = rows.map((r) => `${r.key}: ${r.value}`).join('\n')
	return text(t || `No facts in '${category}'.`)
}

export function handleMemoryWrite(args: MemoryWriteArgs): ToolResult {
	const { type, category, key, value, purpose, location, status } = args
	const timestamp = now()

	if (type == 'hardware') {
		execute(
			`INSERT INTO hardware (name, specs, purpose, location, added, updated) VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(name) DO UPDATE SET specs = excluded.specs, purpose = excluded.purpose, location = excluded.location, updated = ?`,
			[key, value, purpose || '', location || '', timestamp, timestamp, timestamp]
		)
		return text(`Saved hardware: ${key}`)
	}

	if (type == 'project') {
		execute(
			`INSERT INTO projects (name, status, notes, added, updated) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(name) DO UPDATE SET status = excluded.status, notes = excluded.notes, updated = ?`,
			[key, status || 'active', value, timestamp, timestamp, timestamp]
		)
		return text(`Saved project: ${key}`)
	}

	// Fact
	if (!category)
		return text('Facts require a category.')

	execute(
		`INSERT INTO facts (category, key, value, added, updated) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(category, key) DO UPDATE SET value = excluded.value, updated = ?`,
		[category, key, value, timestamp, timestamp, timestamp]
	)
	return text(`Saved fact: ${category}/${key}`)
}

export function handleMemorySearch(args: MemorySearchArgs): ToolResult {
	const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'about', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'it', 'its', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'they', 'them', 'their', 'theirs', 'themselves'])

	const words = args.query
		.toLowerCase()
		.split(/\s+/)
		.filter(w => w.length >= 2 && !stopWords.has(w))

	if (words.length == 0)
		words.push(args.query.toLowerCase())

	const factResults = new Map<string, { category: string; key: string; value: string }>()
	const hwResults = new Map<string, { name: string; specs: string; purpose: string; location: string }>()
	const projResults = new Map<string, { name: string; status: string; notes: string }>()

	for (const word of words) {
		const search = `%${word}%`

		const facts = query<{ category: string; key: string; value: string }>(
			'SELECT category, key, value FROM facts WHERE key LIKE ? OR value LIKE ?',
			[search, search]
		)
		for (const r of facts)
			factResults.set(`${r.category}/${r.key}`, r)

		const hw = query<{ name: string; specs: string; purpose: string; location: string }>(
			'SELECT name, specs, purpose, location FROM hardware WHERE name LIKE ? OR specs LIKE ? OR purpose LIKE ?',
			[search, search, search]
		)
		for (const r of hw)
			hwResults.set(r.name, r)

		const proj = query<{ name: string; status: string; notes: string }>(
			'SELECT name, status, notes FROM projects WHERE name LIKE ? OR notes LIKE ?',
			[search, search]
		)
		for (const r of proj)
			projResults.set(r.name, r)
	}

	const results: string[] = []

	for (const r of factResults.values())
		results.push(`[fact] ${r.category}/${r.key}: ${r.value}`)

	for (const r of hwResults.values())
		results.push(`[hardware] ${r.name}: ${r.purpose} (${r.location})`)

	for (const r of projResults.values())
		results.push(`[project] ${r.name} [${r.status}]`)

	return text(results.join('\n') || `No results for '${args.query}'.`)
}

export function handleMemoryDelete(args: MemoryDeleteArgs): ToolResult {
	const { type, category, key } = args

	if (type == 'hardware')
		execute('DELETE FROM hardware WHERE name = ?', [key])
	else if (type == 'project')
		execute('DELETE FROM projects WHERE name = ?', [key])
	else {
		if (!category) return text('Facts require a category.')
		execute('DELETE FROM facts WHERE category = ? AND key = ?', [category, key])
	}

	return text(`Deleted: ${type}/${category || ''}/${key}`)
}

export function handleMemoryExport(): ToolResult {
	return text('memory_export is not yet implemented.')
}

export function handleMemoryImport(): ToolResult {
	return text('memory_import is not yet implemented.')
}
