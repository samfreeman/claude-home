import { describe, expect, it } from 'vitest'
import { createFileRequest, getFileRequest, listFileRequests } from '../src/tools/file-requests'
import { createSharedLink, getSharedLinkMetadata, listSharedLinks } from '../src/tools/sharing'
import { body, setup } from './helpers'

describe('create_shared_link', () => {
	it('creates a private view-only link and invites viewers to a file', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'a')
		const result = body(await createSharedLink(ctx, { path_or_file_id: '/Claude/a.md', emails: ['x@example.com'] }))
		expect(result).toMatchObject({ created: true, audience: 'no_one', access_level: 'view', content_type: 'file', path_display: '/Claude/a.md' })
		expect(result.shared_with).toEqual(['x@example.com'])
	})

	it('reuses an existing link unchanged and warns when settings differ', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'a')
		await createSharedLink(ctx, { path_or_file_id: '/Claude/a.md' })
		const again = body(await createSharedLink(ctx, { path_or_file_id: '/Claude/a.md', password: 'pw', emails: ['x@example.com'] }))
		expect(again.created).toBe(false)
		expect(again.warning).toMatch(/password/)
		expect(again.shared_with).toEqual([])
	})

	it('refuses public links, editor links, and paths outside the scope', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'a')
		await expect(createSharedLink(ctx, { path_or_file_id: '/Claude/a.md', audience: 'public' })).rejects.toThrow(/INVALID_AUDIENCE/)
		await expect(createSharedLink(ctx, { path_or_file_id: '/Claude/a.md', access_level: 'edit' })).rejects.toThrow(/INVALID_ACCESS_LEVEL/)
		await expect(createSharedLink(ctx, { path_or_file_id: '/Private/a.md' })).rejects.toThrow(/outside/)
	})

	it('reports folder invites as share errors instead of attempting them', async () => {
		const { ctx } = setup()
		const result = body(await createSharedLink(ctx, { path_or_file_id: '/Claude', emails: ['x@example.com'] }))
		expect(result.share_errors[0]).toMatch(/folder/)
	})
})

describe('list_shared_links', () => {
	it('lists only links under the scope', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'a')
		await createSharedLink(ctx, { path_or_file_id: '/Claude/a.md' })
		fake.links.set('/private/x', { '.tag': 'file', url: 'https://www.dropbox.com/scl/fi/private', name: 'x', path_lower: '/private/x' })
		const all = body(await listSharedLinks(ctx, {}))
		expect(all.links.map((l: { path_lower: string }) => l.path_lower)).toEqual(['/claude/a.md'])
		const one = body(await listSharedLinks(ctx, { path: '/Claude/a.md' }))
		expect(one.links).toHaveLength(1)
	})
})

describe('get_shared_link_metadata', () => {
	it('describes a link to something in the scope and refuses others', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'a')
		const { url } = body(await createSharedLink(ctx, { path_or_file_id: '/Claude/a.md' }))
		const result = body(await getSharedLinkMetadata(ctx, { url }))
		expect(result.link).toMatchObject({ link_type: 'file', name: 'a.md', audience: 'no_one' })
		fake.links.set('/private/x', { '.tag': 'file', url: 'https://www.dropbox.com/scl/fi/private', name: 'x', path_lower: '/private/x' })
		await expect(getSharedLinkMetadata(ctx, { url: 'https://www.dropbox.com/scl/fi/private' })).rejects.toThrow(/outside/)
		await expect(getSharedLinkMetadata(ctx, {})).rejects.toThrow(/MISSING_URL/)
	})
})

describe('file requests', () => {
	it('creates, gets and lists file requests under the scope', async () => {
		const { fake, ctx } = setup()
		const created = body(await createFileRequest(ctx, {
			title: 'Uploads',
			destination: '/Claude/Inbox',
			deadline: '2026-12-01T17:00:00.000Z',
			deadline_allow_late_uploads: 'one_day'
		}))
		expect(created.file_request).toMatchObject({ title: 'Uploads', destination: '/Claude/Inbox', is_open: true, deadline: '2026-12-01T17:00:00Z', deadline_allow_late_uploads: 'one_day' })
		const fetched = body(await getFileRequest(ctx, { id: created.file_request.id }))
		expect(fetched.file_request.id).toBe(created.file_request.id)
		fake.fileRequests.set('other', { id: 'other', url: 'u', title: 'Elsewhere', destination: '/Private/In', created: '', is_open: true, file_count: 0 })
		const listed = body(await listFileRequests(ctx, {}))
		expect(listed.file_requests.map((r: { title: string }) => r.title)).toEqual(['Uploads'])
		await expect(getFileRequest(ctx, { id: 'other' })).rejects.toThrow(/outside/)
	})

	it('refuses destinations outside the scope and late uploads without a deadline', async () => {
		const { ctx } = setup()
		await expect(createFileRequest(ctx, { title: 'x', destination: '/Private/In' })).rejects.toThrow(/outside/)
		await expect(createFileRequest(ctx, { title: 'x', destination: '/Claude/In', deadline_allow_late_uploads: 'always' })).rejects.toThrow(/only valid with a deadline/)
	})
})
