import { query, execute, now } from '../db.js'
import type { ToolResult, InboxSendArgs, InboxListArgs, InboxReadArgs, InboxUpdateArgs, InboxDeleteArgs, InboxItem } from '../types.js'

function text(t: string): ToolResult {
	return { content: [{ type: 'text', text: t }] }
}

export async function handleInboxSend(args: InboxSendArgs): Promise<ToolResult> {
	const { source, target, title, content } = args
	const timestamp = now()

	const result = await execute(
		`INSERT INTO inbox (source, target, title, content, status, created, updated)
		 VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
		[source, target, title, content || null, timestamp, timestamp]
	)

	return text(JSON.stringify({ id: result.lastInsertRowid, title, from: source, to: target }, null, 2))
}

export async function handleInboxList(args: InboxListArgs): Promise<ToolResult> {
	const { target, status } = args

	const rows = await query<{ id: number; source: string; target: string; title: string; status: string; created: string }>(
		`SELECT id, source, target, title, status, created FROM inbox
		 WHERE (target = ? OR target = 'any' OR ? IS NULL)
		 AND (status = ? OR ? IS NULL)
		 ORDER BY created DESC`,
		[target || null, target || null, status || null, status || null]
	)

	if (rows.length == 0) {
		return text('Inbox is empty.')
	}

	const t = rows.map((r) =>
		`[${r.id}] ${r.title} (${r.source}→${r.target}) [${r.status}] ${r.created}`
	).join('\n')

	return text(t)
}

export async function handleInboxRead(args: InboxReadArgs): Promise<ToolResult> {
	const [row] = await query<InboxItem>('SELECT * FROM inbox WHERE id = ?', [args.id])

	if (!row) {
		return text(`Inbox item ${args.id} not found.`)
	}

	return text(JSON.stringify(row, null, 2))
}

export async function handleInboxUpdate(args: InboxUpdateArgs): Promise<ToolResult> {
	const { id, status } = args
	const timestamp = now()

	const [existing] = await query('SELECT id FROM inbox WHERE id = ?', [id])
	if (!existing) {
		return text(`Inbox item ${id} not found.`)
	}

	await execute('UPDATE inbox SET status = ?, updated = ? WHERE id = ?', [status, timestamp, id])

	return text(`Inbox item ${id} marked as '${status}'.`)
}

export async function handleInboxDelete(args: InboxDeleteArgs): Promise<ToolResult> {
	const [existing] = await query('SELECT id FROM inbox WHERE id = ?', [args.id])
	if (!existing) {
		return text(`Inbox item ${args.id} not found.`)
	}

	await execute('DELETE FROM inbox WHERE id = ?', [args.id])

	return text(`Inbox item ${args.id} deleted.`)
}