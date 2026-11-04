import { describe, expect, it } from 'vitest'
import {
	createFile,
	createFolder,
	downloadLink,
	fetchFile,
	filePreview,
	getFileMetadata,
	listFolder,
	search,
	whoAmI
} from '../src/tools/files'
import { accountId } from './fake-dropbox'
import { block, body, setup } from './helpers'

describe('who_am_i', () => {
	it('returns the account, its namespaces and the scope root', async () => {
		const { ctx } = setup()
		const me = body(await whoAmI(ctx))
		expect(me).toMatchObject({ account_id: accountId, display_name: 'Test User', root_namespace_id: '100', scope_root: '/Claude' })
	})
})

describe('list_folder', () => {
	it('lists recursively by default, with rev on files, and paginates with a cursor', async () => {
		const { fake, ctx } = setup()
		fake.addFolder('/Claude/sub')
		await fake.addFile('/Claude/a.md', 'a')
		await fake.addFile('/Claude/sub/b.md', 'b')
		const first = body(await listFolder(ctx, { path: '/Claude', max_results: 2 }))
		expect(first.has_more).toBe(true)
		const second = body(await listFolder(ctx, { cursor: first.cursor }))
		const all = [...first.entries, ...second.entries]
		expect(all.map((e: { path_display: string }) => e.path_display).sort()).toEqual(['/Claude/a.md', '/Claude/sub', '/Claude/sub/b.md'])
		const file = all.find((e: { name: string }) => e.name == 'a.md')
		expect(file.file.rev).toBe(fake.file('/Claude/a.md')!.rev)
		expect(file.path).toBe('ns:100//Claude/a.md')
	})

	it('lists immediate children only with recursive=false, and filters object types', async () => {
		const { fake, ctx } = setup()
		fake.addFolder('/Claude/sub')
		await fake.addFile('/Claude/a.md', 'a')
		await fake.addFile('/Claude/sub/b.md', 'b')
		const children = body(await listFolder(ctx, { path: '/Claude', recursive: false }))
		expect(children.entries.map((e: { name: string }) => e.name).sort()).toEqual(['a.md', 'sub'])
		const folders = body(await listFolder(ctx, { path: '/Claude', object_types: ['folder'] }))
		expect(folders.entries.map((e: { name: string }) => e.name)).toEqual(['sub'])
	})

	it('refuses the Dropbox root and folders outside the scope', async () => {
		const { ctx } = setup()
		await expect(listFolder(ctx, { path: '' })).rejects.toThrow(/outside \/Claude/)
		await expect(listFolder(ctx, { path: '/Private' })).rejects.toThrow(/outside \/Claude/)
	})

	it('refuses a cursor combined with other options', async () => {
		const { ctx } = setup()
		await expect(listFolder(ctx, { cursor: 'x', path: '/Claude' })).rejects.toThrow(/cursor alone/)
	})
})

describe('search', () => {
	it('searches only within the scope and returns files unless folders are asked for', async () => {
		const { fake, ctx } = setup()
		fake.addFolder('/Claude/plans')
		await fake.addFile('/Claude/plans/plan.md', 'x')
		await fake.addFile('/Private/plan.md', 'x')
		const files = body(await search(ctx, { query: 'plan' }))
		expect(files.results.map((r: { path_display: string }) => r.path_display)).toEqual(['/Claude/plans/plan.md'])
		expect(files.results[0]).toMatchObject({ match_type: 'FILENAME', object_type: 'file', rank: 1 })
		const withFolders = body(await search(ctx, { query: 'plan', include_folders: true }))
		expect(withFolders.results).toHaveLength(2)
		await expect(search(ctx, { query: 'plan', path: '/Private' })).rejects.toThrow(/outside/)
	})

	it('requires a query for a new search', async () => {
		const { ctx } = setup()
		await expect(search(ctx, {})).rejects.toThrow(/query is required/)
	})
})

describe('fetch', () => {
	it('returns text byte for byte, with rev and content_hash in the header', async () => {
		const { fake, ctx } = setup()
		const xml = '<?xml version="1.0"?>\n<root a="1">&lt;not a tag&gt; <child/></root>\n'
		await fake.addFile('/Claude/data.xml', xml)
		const result = await fetchFile(ctx, { id: '/Claude/data.xml' })
		const header = body(result)
		expect(block(result, 1)).toBe(xml)
		expect(header.encoding).toBe('utf-8')
		expect(header.metadata.rev).toBe(fake.file('/Claude/data.xml')!.rev)
		expect(header.metadata.content_hash).toBe(fake.file('/Claude/data.xml')!.hash)
	})

	it('returns binary content as base64', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.bin', new Uint8Array([0, 255, 1]))
		const result = await fetchFile(ctx, { id: '/Claude/a.bin' })
		expect(body(result).encoding).toBe('base64')
		expect(block(result, 1)).toBe('AP8B')
	})

	it('returns a verbatim line range', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'one\r\ntwo\r\nthree')
		const result = await fetchFile(ctx, { id: '/Claude/a.md', start_line: 2, end_line: 3 })
		expect(block(result, 1)).toBe('two\r\nthree')
		expect(body(result).lines).toEqual({ start: 2, end: 3, total: 3 })
	})

	it('reads by file id and by ns path', async () => {
		const { fake, ctx } = setup()
		const entry = await fake.addFile('/Claude/a.md', 'hi')
		expect(block(await fetchFile(ctx, { id: entry.id }), 1)).toBe('hi')
		expect(block(await fetchFile(ctx, { id: 'ns:100//Claude/a.md' }), 1)).toBe('hi')
	})

	it('refuses folders, files over the read limit, and files outside the scope', async () => {
		const { fake, ctx } = setup({ maxReadBytes: 4 })
		await fake.addFile('/Claude/big.txt', '12345')
		const outside = await fake.addFile('/Private/secret.txt', 'no')
		await expect(fetchFile(ctx, { id: '/Claude' })).rejects.toThrow(/folder/)
		await expect(fetchFile(ctx, { id: '/Claude/big.txt' })).rejects.toThrow(/read limit/)
		await expect(fetchFile(ctx, { id: '/Private/secret.txt' })).rejects.toThrow(/outside/)
		await expect(fetchFile(ctx, { id: outside.id })).rejects.toThrow(/outside/)
	})
})

describe('get_file_metadata', () => {
	it('returns file metadata with rev and content_hash', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'hello')
		const result = body(await getFileMetadata(ctx, { path_or_file_id: '/Claude/a.md' }))
		expect(result.metadata_type).toBe('file')
		expect(result.file).toMatchObject({ name: 'a.md', size: 5, ext: 'md', rev: fake.file('/Claude/a.md')!.rev })
	})

	it('returns folder metadata', async () => {
		const { ctx } = setup()
		const result = body(await getFileMetadata(ctx, { path_or_file_id: '/Claude' }))
		expect(result.metadata_type).toBe('folder')
		expect(result.folder.path_display).toBe('/Claude')
	})
})

describe('file_preview', () => {
	it('returns links, a private share link, and a thumbnail image for images', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/photo.png', new Uint8Array([1, 2, 3]))
		await fake.addFile('/Claude/notes.md', 'x')
		const result = await filePreview(ctx, { file_paths: ['/Claude/photo.png', '/Claude/notes.md', '/Private/x'] })
		const { results } = body(result)
		expect(results[0]).toMatchObject({ file_name: 'photo.png', file_type: 'png' })
		expect(results[0].copy_link_url).toContain('dropbox.com/scl')
		expect(results[1]).toMatchObject({ file_name: 'notes.md', file_type: 'md' })
		expect(results[2].message).toMatch(/Preview failed: .*outside/)
		expect(result.content[1]).toMatchObject({ type: 'image', mimeType: 'image/jpeg' })
		expect(fake.links.get('/claude/photo.png')!.link_permissions!.effective_audience!['.tag']).toBe('no_one')
	})
})

describe('download_link', () => {
	it('returns temporary links for every entry', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.pdf', 'pdf')
		const result = body(await downloadLink(ctx, { entries: ['/Claude/a.pdf'], expiration_in_sec: 60 }))
		expect(result.entries[0]).toMatchObject({ name: 'a.pdf', expiration_in_sec: 14400 })
		expect(result.note).toMatch(/expiration_in_sec=60 was not applied/)
	})

	it('fails the whole call if any entry is outside the scope', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.pdf', 'pdf')
		await expect(downloadLink(ctx, { entries: ['/Claude/a.pdf', '/Private/b.pdf'] })).rejects.toThrow(/outside/)
		expect(fake.calls).not.toContain('files/get_temporary_link')
	})
})

describe('create_file', () => {
	it('creates a file and verifies the stored content_hash', async () => {
		const { fake, ctx } = setup()
		const result = body(await createFile(ctx, { path: '/Claude/new.md', content: '# Hi <there>\n' }))
		expect(result.verified).toBe(true)
		expect(result.rev).toBe(fake.file('/Claude/new.md')!.rev)
		expect(fake.text('/Claude/new.md')).toBe('# Hi <there>\n')
	})

	it('fails without writing when the file exists', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/new.md', 'original')
		await expect(createFile(ctx, { path: '/Claude/new.md', content: 'x' })).rejects.toThrow(/ALREADY_EXISTS/)
		expect(fake.text('/Claude/new.md')).toBe('original')
	})

	it('fails when the parent folder is missing', async () => {
		const { ctx } = setup()
		await expect(createFile(ctx, { path: '/Claude/missing/new.md', content: 'x' })).rejects.toThrow(/PARENT_NOT_FOUND/)
	})

	it('refuses paths outside the scope', async () => {
		const { fake, ctx } = setup()
		await expect(createFile(ctx, { path: '/Private/x.md', content: 'x' })).rejects.toThrow(/outside/)
		expect(fake.file('/Private/x.md')).toBeUndefined()
	})
})

describe('create_folder', () => {
	it('creates a folder', async () => {
		const { fake, ctx } = setup()
		const result = body(await createFolder(ctx, { path: '/Claude/new' }))
		expect(result.folder).toMatchObject({ name: 'new', object_type: 'folder', path_display: '/Claude/new' })
		expect(fake.file('/Claude/new')!.tag).toBe('folder')
	})

	it('fails when it already exists or the parent is missing', async () => {
		const { ctx } = setup()
		await createFolder(ctx, { path: '/Claude/new' })
		await expect(createFolder(ctx, { path: '/Claude/new' })).rejects.toThrow(/ALREADY_EXISTS/)
		await expect(createFolder(ctx, { path: '/Claude/a/b' })).rejects.toThrow(/PARENT_NOT_FOUND/)
	})
})
