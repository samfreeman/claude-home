import type { DbxBatchEntry, DbxBatchStatus } from '../dropbox/types'
import { describeEntry, json, resolve, tagPath, ToolError, type ToolContext } from './context'

type JobKind = 'copy' | 'move' | 'delete'

const launchEndpoints: Record<JobKind, string> = {
	copy: 'files/copy_batch_v2',
	move: 'files/move_batch_v2',
	delete: 'files/delete_batch'
}

const checkEndpoints: Record<JobKind, string> = {
	copy: 'files/copy_batch/check_v2',
	move: 'files/move_batch/check_v2',
	delete: 'files/delete_batch/check'
}

const pollAfterMs = 1000

function errorCode(failure: unknown) {
	return tagPath(failure).replace(/^relocation_error\//, '')
}

function completed(ctx: ToolContext, kind: JobKind, entries: DbxBatchEntry[]) {
	return {
		status: 'completed',
		result_type: kind,
		[`${kind}_result`]: {
			entries: entries.map((entry, index) => {
				if (entry['.tag'] != 'success') {
					const code = errorCode(entry.failure)
					return { entry_index: index, entry_status: 'failed', failure: { error_code: code, message: `Dropbox reported ${code}` } }
				}
				const metadata = entry.success ?? entry.metadata
				return { entry_index: index, entry_status: 'success', object: metadata == null ? undefined : describeEntry(ctx.scope, metadata) }
			})
		}
	}
}

function launched(ctx: ToolContext, kind: JobKind, status: DbxBatchStatus) {
	if (status['.tag'] == 'async_job_id')
		return json({ status: 'in_progress', operation_id: `${kind}:${status.async_job_id}`, recommended_poll_after_ms: pollAfterMs })
	if (status['.tag'] == 'complete')
		return json(completed(ctx, kind, status.entries))
	throw new ToolError(`Dropbox returned an unexpected ${kind} result: ${tagPath(status)}`)
}

function checkCount(entries: unknown[]) {
	if (entries.length == 0)
		throw new ToolError('INVALID_REQUEST: entries is empty')
	if (entries.length > 1000)
		throw new ToolError('TOO_MANY_ENTRIES: at most 1000 entries per call')
}

export interface RelocateArgs {
	entries: { source_path: string, destination_path: string }[]
	autorename?: boolean
}

// Every path is resolved and scope-checked before anything is sent, so one bad entry means nothing happens.
export async function relocate(ctx: ToolContext, kind: 'copy' | 'move', args: RelocateArgs) {
	checkCount(args.entries)
	const entries = []
	for (const entry of args.entries)
		entries.push({
			from_path: await resolve(ctx, entry.source_path, { forbidRoot: kind == 'move' }),
			to_path: await resolve(ctx, entry.destination_path, { forbidRoot: true })
		})
	const status = await ctx.dropbox.rpc<DbxBatchStatus>(launchEndpoints[kind], { entries, autorename: args.autorename ?? false })
	return launched(ctx, kind, status)
}

export async function deleteEntries(ctx: ToolContext, args: { entries: { source_path: string }[] }) {
	checkCount(args.entries)
	const entries = []
	for (const entry of args.entries)
		entries.push({ path: await resolve(ctx, entry.source_path, { forbidRoot: true }) })
	const status = await ctx.dropbox.rpc<DbxBatchStatus>(launchEndpoints.delete, { entries })
	return launched(ctx, 'delete', status)
}

const defaultSleep = (ms: number) =>
	new Promise<void>(done => setTimeout(done, ms))

export async function checkJobStatus(
	ctx: ToolContext,
	args: { operation_id: string, wait_ms?: number },
	sleep = defaultSleep) {
	const wait = args.wait_ms ?? 0
	if (wait < 0 || wait > 30000)
		throw new ToolError('INVALID_WAIT_MS: wait_ms must be between 0 and 30000')
	const separator = args.operation_id.indexOf(':')
	const kind = args.operation_id.slice(0, separator) as JobKind
	if (separator < 1 || !(kind in checkEndpoints))
		throw new ToolError(`Unrecognized operation_id: ${args.operation_id}`)
	const jobId = args.operation_id.slice(separator + 1)
	const started = Date.now()
	for (;;) {
		const status = await ctx.dropbox.rpc<DbxBatchStatus>(checkEndpoints[kind], { async_job_id: jobId })
		if (status['.tag'] == 'complete')
			return json(completed(ctx, kind, status.entries))
		if (status['.tag'] == 'failed')
			throw new ToolError(`The ${kind} job failed: ${tagPath(status.failed)}`)
		if (status['.tag'] != 'in_progress')
			throw new ToolError(`Dropbox returned an unexpected job status: ${tagPath(status)}`)
		const remaining = wait - (Date.now() - started)
		if (remaining <= 0)
			return json({ status: 'in_progress', operation_id: args.operation_id, recommended_poll_after_ms: pollAfterMs })
		await sleep(Math.min(pollAfterMs, remaining))
	}
}
