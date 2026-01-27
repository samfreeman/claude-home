import { query, execute, batch, now } from '../db.js'
import type {
	ToolResult,
	RelayCreateArgs,
	RelayReadArgs,
	RelayListArgs,
	RelayUpdateArgs,
	RelayDeleteArgs,
	ContextAddArgs,
	TaskAddArgs,
	TaskUpdateArgs,
	Relay,
	RelayContext,
	RelayTask
} from '../types.js'

function text(t: string): ToolResult {
	return { content: [{ type: 'text', text: t }] }
}

export async function handleRelayCreate(args: RelayCreateArgs): Promise<ToolResult> {
	const timestamp = now()

	const result = await execute(
		'INSERT INTO relays (title, spec, created, updated) VALUES (?, ?, ?, ?)',
		[args.title, args.spec || null, timestamp, timestamp]
	)

	return text(JSON.stringify({ id: result.lastInsertRowid, title: args.title }, null, 2))
}

export async function handleRelayRead(args: RelayReadArgs): Promise<ToolResult> {
	const [relay] = await query<Relay>('SELECT * FROM relays WHERE id = ?', [args.id])

	if (!relay) {
		return text(`Relay ${args.id} not found`)
	}

	const context = await query<RelayContext>(
		'SELECT * FROM relay_context WHERE relay_id = ? ORDER BY added',
		[args.id]
	)

	const tasks = await query<RelayTask>(
		'SELECT * FROM relay_tasks WHERE relay_id = ? ORDER BY created',
		[args.id]
	)

	return text(JSON.stringify({ relay, context, tasks }, null, 2))
}

export async function handleRelayList(args: RelayListArgs): Promise<ToolResult> {
	const relays = await query<Relay>(
		'SELECT * FROM relays WHERE status = ? OR ? IS NULL ORDER BY updated DESC',
		[args.status || null, args.status || null]
	)

	if (relays.length == 0) {
		return text('No relays.')
	}

	return text(JSON.stringify(relays, null, 2))
}

export async function handleRelayUpdate(args: RelayUpdateArgs): Promise<ToolResult> {
	const timestamp = now()

	const [existing] = await query('SELECT id FROM relays WHERE id = ?', [args.id])
	if (!existing) {
		return text(`Relay ${args.id} not found`)
	}

	await execute(
		'UPDATE relays SET status = COALESCE(?, status), spec = COALESCE(?, spec), updated = ? WHERE id = ?',
		[args.status || null, args.spec || null, timestamp, args.id]
	)

	const [updated] = await query<Relay>('SELECT * FROM relays WHERE id = ?', [args.id])

	return text(JSON.stringify(updated, null, 2))
}

export async function handleRelayDelete(args: RelayDeleteArgs): Promise<ToolResult> {
	// Delete context and tasks first (cascade), then the relay
	await batch([
		{ sql: 'DELETE FROM relay_context WHERE relay_id = ?', args: [args.id] },
		{ sql: 'DELETE FROM relay_tasks WHERE relay_id = ?', args: [args.id] },
		{ sql: 'DELETE FROM relays WHERE id = ?', args: [args.id] }
	])

	return text(`Relay ${args.id} deleted`)
}

export async function handleContextAdd(args: ContextAddArgs): Promise<ToolResult> {
	const timestamp = now()

	const result = await execute(
		'INSERT INTO relay_context (relay_id, type, content, added) VALUES (?, ?, ?, ?)',
		[args.relay_id, args.type, args.content, timestamp]
	)

	return text(JSON.stringify({ id: result.lastInsertRowid, type: args.type }, null, 2))
}

export async function handleTaskAdd(args: TaskAddArgs): Promise<ToolResult> {
	const timestamp = now()

	const result = await execute(
		'INSERT INTO relay_tasks (relay_id, description, assigned_to, created) VALUES (?, ?, ?, ?)',
		[args.relay_id, args.description, args.assigned_to || null, timestamp]
	)

	return text(JSON.stringify({ id: result.lastInsertRowid, description: args.description }, null, 2))
}

export async function handleTaskUpdate(args: TaskUpdateArgs): Promise<ToolResult> {
	const [existing] = await query('SELECT id FROM relay_tasks WHERE id = ?', [args.id])
	if (!existing) {
		return text(`Task ${args.id} not found`)
	}

	await execute(
		'UPDATE relay_tasks SET status = COALESCE(?, status), description = COALESCE(?, description) WHERE id = ?',
		[args.status || null, args.description || null, args.id]
	)

	return text(`Task ${args.id} updated`)
}