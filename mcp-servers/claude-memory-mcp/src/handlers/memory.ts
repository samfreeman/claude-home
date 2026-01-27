import { query, execute, now } from '../db.js'
import type { ToolResult, MemoryReadArgs, MemoryWriteArgs, MemorySearchArgs, MemoryDeleteArgs } from '../types.js'

function text(t: string): ToolResult {
	return { content: [{ type: 'text', text: t }] }
}

export async function handleMemoryRead(args: MemoryReadArgs): Promise<ToolResult> {
	const { category, key } = args

	if (category == 'all') {
		const lines: string[] = []

		const cats = await query<{ category: string; count: number }>(
			'SELECT category, COUNT(*) as count FROM facts GROUP BY category'
		)
		for (const c of cats) {
			lines.push(`facts/${c.category}: ${c.count}`)
		}

		const [hwCount] = await query<{ count: number }>('SELECT COUNT(*) as count FROM hardware')
		lines.push(`hardware: ${hwCount?.count ?? 0}`)

		const [projCount] = await query<{ count: number }>('SELECT COUNT(*) as count FROM projects')
		lines.push(`projects: ${projCount?.count ?? 0}`)

		const [inboxCount] = await query<{ count: number }>("SELECT COUNT(*) as count FROM inbox WHERE status = 'pending'")
		lines.push(`inbox (pending): ${inboxCount?.count ?? 0}`)

		const [relayCount] = await query<{ count: number }>("SELECT COUNT(*) as count FROM relays WHERE status = 'active'")
		lines.push(`relays (active): ${relayCount?.count ?? 0}`)

		return text(lines.join('\n') || 'Memory is empty.')
	}

	if (category == 'hardware') {
		if (key) {
			const [row] = await query('SELECT * FROM hardware WHERE name = ?', [key])
			return text(row ? JSON.stringify(row, null, 2) : `Hardware '${key}' not found.`)
		}
		const rows = await query<{ name: string; purpose: string; location: string }>(
			'SELECT name, purpose, location FROM hardware'
		)
		const t = rows.map((r) => `${r.name}: ${r.purpose} (${r.location})`).join('\n')
		return text(t || 'No hardware entries.')
	}

	if (category == 'project') {
		if (key) {
			const [row] = await query('SELECT * FROM projects WHERE name = ?', [key])
			return text(row ? JSON.stringify(row, null, 2) : `Project '${key}' not found.`)
		}
		const rows = await query<{ name: string; status: string; notes: string }>(
			'SELECT name, status, notes FROM projects'
		)
		const t = rows.map((r) => `${r.name} [${r.status}]: ${r.notes || ''}`).join('\n')
		return text(t || 'No projects.')
	}

	// Fact category
	if (key) {
		const [row] = await query<{ value: string }>(
			'SELECT value FROM facts WHERE category = ? AND key = ?',
			[category, key]
		)
		return text(row ? row.value : `No fact: ${category}/${key}`)
	}

	const rows = await query<{ key: string; value: string }>(
		'SELECT key, value FROM facts WHERE category = ?',
		[category]
	)
	const t = rows.map((r) => `${r.key}: ${r.value}`).join('\n')
	return text(t || `No facts in '${category}'.`)
}

export async function handleMemoryWrite(args: MemoryWriteArgs): Promise<ToolResult> {
	const { type, category, key, value, purpose, location, status } = args
	const timestamp = now()

	if (type == 'hardware') {
		await execute(
			`INSERT INTO hardware (name, specs, purpose, location, added) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(name) DO UPDATE SET specs = excluded.specs, purpose = excluded.purpose, location = excluded.location`,
			[key, value, purpose || '', location || '', timestamp]
		)
		return text(`Saved hardware: ${key}`)
	}

	if (type == 'project') {
		await execute(
			`INSERT INTO projects (name, status, notes, added, updated) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(name) DO UPDATE SET status = excluded.status, notes = excluded.notes, updated = ?`,
			[key, status || 'active', value, timestamp, timestamp, timestamp]
		)
		return text(`Saved project: ${key}`)
	}

	// Fact
	if (!category) {
		return text('Facts require a category.')
	}

	await execute(
		`INSERT INTO facts (category, key, value, added, updated) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(category, key) DO UPDATE SET value = excluded.value, updated = ?`,
		[category, key, value, timestamp, timestamp, timestamp]
	)
	return text(`Saved fact: ${category}/${key}`)
}

export async function handleMemorySearch(args: MemorySearchArgs): Promise<ToolResult> {
	// Split query into words, filter out short/common words
	const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'about', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'it', 'its', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'they', 'them', 'their', 'theirs', 'themselves'])

	const words = args.query
		.toLowerCase()
		.split(/\s+/)
		.filter(w => w.length >= 2 && !stopWords.has(w))

	// If no valid words after filtering, try the whole query
	if (words.length == 0) {
		words.push(args.query.toLowerCase())
	}

	// Use Maps to deduplicate by unique key
	const factResults = new Map<string, { category: string; key: string; value: string }>()
	const hwResults = new Map<string, { name: string; specs: string; purpose: string; location: string }>()
	const projResults = new Map<string, { name: string; status: string; notes: string }>()

	// Search for each word
	for (const word of words) {
		const search = `%${word}%`

		const facts = await query<{ category: string; key: string; value: string }>(
			'SELECT category, key, value FROM facts WHERE key LIKE ? OR value LIKE ?',
			[search, search]
		)
		for (const r of facts) {
			factResults.set(`${r.category}/${r.key}`, r)
		}

		const hw = await query<{ name: string; specs: string; purpose: string; location: string }>(
			'SELECT name, specs, purpose, location FROM hardware WHERE name LIKE ? OR specs LIKE ? OR purpose LIKE ?',
			[search, search, search]
		)
		for (const r of hw) {
			hwResults.set(r.name, r)
		}

		const proj = await query<{ name: string; status: string; notes: string }>(
			'SELECT name, status, notes FROM projects WHERE name LIKE ? OR notes LIKE ?',
			[search, search]
		)
		for (const r of proj) {
			projResults.set(r.name, r)
		}
	}

	// Build results
	const results: string[] = []

	for (const r of factResults.values()) {
		results.push(`[fact] ${r.category}/${r.key}: ${r.value}`)
	}

	for (const r of hwResults.values()) {
		results.push(`[hardware] ${r.name}: ${r.purpose} (${r.location})`)
	}

	for (const r of projResults.values()) {
		results.push(`[project] ${r.name} [${r.status}]`)
	}

	return text(results.join('\n') || `No results for '${args.query}'.`)
}

export async function handleMemoryDelete(args: MemoryDeleteArgs): Promise<ToolResult> {
	const { type, category, key } = args

	if (type == 'hardware') {
		await execute('DELETE FROM hardware WHERE name = ?', [key])
	}
	else if (type == 'project') {
		await execute('DELETE FROM projects WHERE name = ?', [key])
	}
	else {
		if (!category) return text('Facts require a category.')
		await execute('DELETE FROM facts WHERE category = ? AND key = ?', [category, key])
	}

	return text(`Deleted: ${type}/${category || ''}/${key}`)
}