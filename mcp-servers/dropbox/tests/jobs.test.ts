import { describe, expect, it } from 'vitest'
import { checkJobStatus, deleteEntries, relocate } from '../src/tools/jobs'
import { body, setup } from './helpers'

describe('copy', () => {
	it('copies and reports each copy\'s rev and content_hash', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'a')
		const result = body(await relocate(ctx, 'copy', { entries: [{ source_path: '/Claude/a.md', destination_path: '/Claude/b.md' }] }))
		expect(result.status).toBe('completed')
		const entry = result.copy_result.entries[0]
		expect(entry.entry_status).toBe('success')
		expect(entry.object.file.rev).toBe(fake.file('/Claude/b.md')!.rev)
		expect(entry.object.file.content_hash).toBe(fake.file('/Claude/a.md')!.hash)
		expect(fake.text('/Claude/a.md')).toBe('a')
	})

	it('reports per-entry failures with flattened error codes', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'a')
		await fake.addFile('/Claude/b.md', 'b')
		const result = body(await relocate(ctx, 'copy', {
			entries: [
				{ source_path: '/Claude/a.md', destination_path: '/Claude/b.md' },
				{ source_path: '/Claude/none.md', destination_path: '/Claude/c.md' }
			]
		}))
		expect(result.copy_result.entries.map((e: { failure: { error_code: string } }) => e.failure.error_code))
			.toEqual(['to/conflict/file', 'from_lookup/not_found'])
	})

	it('refuses the whole batch if any path is outside the scope', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'a')
		await expect(relocate(ctx, 'copy', {
			entries: [
				{ source_path: '/Claude/a.md', destination_path: '/Claude/b.md' },
				{ source_path: '/Claude/a.md', destination_path: '/Private/b.md' }
			]
		})).rejects.toThrow(/outside/)
		expect(fake.calls).not.toContain('files/copy_batch_v2')
	})
})

describe('move', () => {
	it('moves a file', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'a')
		const result = body(await relocate(ctx, 'move', { entries: [{ source_path: '/Claude/a.md', destination_path: '/Claude/moved.md' }] }))
		expect(result.move_result.entries[0].object.path_display).toBe('/Claude/moved.md')
		expect(fake.file('/Claude/a.md')).toBeUndefined()
		expect(fake.text('/Claude/moved.md')).toBe('a')
	})

	it('refuses to move the scope root or move things out of it', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'a')
		await expect(relocate(ctx, 'move', { entries: [{ source_path: '/Claude', destination_path: '/Claude/x' }] })).rejects.toThrow(/itself/)
		await expect(relocate(ctx, 'move', { entries: [{ source_path: '/Claude/a.md', destination_path: '/Private/a.md' }] })).rejects.toThrow(/outside/)
		expect(fake.text('/Claude/a.md')).toBe('a')
	})
})

describe('delete', () => {
	it('deletes and reports metadata at deletion time', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'a')
		const result = body(await deleteEntries(ctx, { entries: [{ source_path: '/Claude/a.md' }] }))
		expect(result.delete_result.entries[0]).toMatchObject({ entry_status: 'success', object: { name: 'a.md' } })
		expect(fake.file('/Claude/a.md')).toBeUndefined()
	})

	it('refuses to delete the scope root or anything outside it', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Private/a.md', 'a')
		await expect(deleteEntries(ctx, { entries: [{ source_path: '/Claude' }] })).rejects.toThrow(/itself/)
		await expect(deleteEntries(ctx, { entries: [{ source_path: '/Private/a.md' }] })).rejects.toThrow(/outside/)
		expect(fake.file('/Private/a.md')).toBeDefined()
	})

	it('refuses an empty batch', async () => {
		const { ctx } = setup()
		await expect(deleteEntries(ctx, { entries: [] })).rejects.toThrow(/INVALID_REQUEST/)
	})
})

describe('check_job_status', () => {
	it('returns in_progress with an operation_id, then the completed per-entry results', async () => {
		const { fake, ctx } = setup()
		fake.asyncJobs = true
		fake.pendingChecks = 1
		await fake.addFile('/Claude/a.md', 'a')
		const launched = body(await relocate(ctx, 'move', { entries: [{ source_path: '/Claude/a.md', destination_path: '/Claude/b.md' }] }))
		expect(launched.status).toBe('in_progress')
		expect(launched.operation_id).toMatch(/^move:dbjid:/)
		const pending = body(await checkJobStatus(ctx, { operation_id: launched.operation_id }))
		expect(pending.status).toBe('in_progress')
		const done = body(await checkJobStatus(ctx, { operation_id: launched.operation_id }))
		expect(done).toMatchObject({ status: 'completed', result_type: 'move' })
		expect(done.move_result.entries[0].object.path_display).toBe('/Claude/b.md')
	})

	it('waits up to wait_ms for completion', async () => {
		const { fake, ctx } = setup()
		fake.asyncJobs = true
		fake.pendingChecks = 2
		await fake.addFile('/Claude/a.md', 'a')
		const launched = body(await deleteEntries(ctx, { entries: [{ source_path: '/Claude/a.md' }] }))
		const sleeps: number[] = []
		const done = body(await checkJobStatus(ctx, { operation_id: launched.operation_id, wait_ms: 5000 }, async ms => {
			sleeps.push(ms)
		}))
		expect(done.status).toBe('completed')
		expect(sleeps).toHaveLength(2)
	})

	it('rejects bad operation ids and wait_ms', async () => {
		const { ctx } = setup()
		await expect(checkJobStatus(ctx, { operation_id: 'nonsense' })).rejects.toThrow(/Unrecognized/)
		await expect(checkJobStatus(ctx, { operation_id: 'copy:x', wait_ms: 40000 })).rejects.toThrow(/INVALID_WAIT_MS/)
		await expect(checkJobStatus(ctx, { operation_id: 'copy:missing' })).rejects.toThrow(/invalid_async_job_id/)
	})
})
