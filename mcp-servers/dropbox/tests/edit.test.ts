import { describe, expect, it } from 'vitest'
import { contentHash } from '../src/dropbox/hash'
import { appendText, insertText, overwrite, strReplace } from '../src/tools/edit'
import { createFile, fetchFile } from '../src/tools/files'
import { block, body, setup } from './helpers'

const html = '﻿<!DOCTYPE html>\r\n<html lang="en">\r\n<head><meta charset="utf-8"><title>T &amp; U</title></head>\r\n'
	+ '<body>\n  <svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>\n  <p class="x">Line &lt;one&gt; — é ✓</p>\n'
	+ '  <!-- comment <b> -->\n  <script>if (a < b && c > d) {}</script>\n</body>\n</html>   \n'

async function revOf(ctx: ReturnType<typeof setup>['ctx'], path: string) {
	return body(await fetchFile(ctx, { id: path })).metadata.rev as string
}

describe('round trip', () => {
	it('writes HTML, reads it back exactly, then str_replace changes only the target text', async () => {
		const { fake, ctx } = setup()
		const created = body(await createFile(ctx, { path: '/Claude/page.html', content: html }))
		expect(created.verified).toBe(true)

		const read = await fetchFile(ctx, { id: '/Claude/page.html' })
		expect(block(read, 1)).toBe(html)
		expect(fake.file('/Claude/page.html')!.bytes).toEqual(new TextEncoder().encode(html))
		const rev = body(read).metadata.rev
		expect(rev).toBe(created.rev)

		const target = '<p class="x">Line &lt;one&gt; — é ✓</p>'
		const replacement = '<p class="y">Line <em>two</em> &gt; one</p>'
		const edited = body(await strReplace(ctx, { path: '/Claude/page.html', old_str: target, new_str: replacement, expected_rev: rev }))
		expect(edited.verified).toBe(true)
		expect(edited.previous_rev).toBe(rev)
		expect(edited.rev).not.toBe(rev)

		const after = await fetchFile(ctx, { id: '/Claude/page.html' })
		const expected = html.replace(target, replacement)
		expect(block(after, 1)).toBe(expected)
		expect(fake.file('/Claude/page.html')!.bytes).toEqual(new TextEncoder().encode(expected))
		expect(body(after).metadata.rev).toBe(edited.rev)
		expect(edited.content_hash).toBe(await contentHash(new TextEncoder().encode(expected)))
	})
})

describe('str_replace', () => {
	it('fails with the match count when old_str matches nothing, writing nothing', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.txt', 'alpha beta')
		const rev = await revOf(ctx, '/Claude/a.txt')
		await expect(strReplace(ctx, { path: '/Claude/a.txt', old_str: 'gamma', new_str: 'x', expected_rev: rev }))
			.rejects.toThrow(/matches 0 times/)
		expect(fake.text('/Claude/a.txt')).toBe('alpha beta')
		expect(fake.file('/Claude/a.txt')!.rev).toBe(rev)
	})

	it('fails with the match count when old_str matches more than once, writing nothing', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.txt', '<li>x</li><li>x</li><li>x</li>')
		const rev = await revOf(ctx, '/Claude/a.txt')
		await expect(strReplace(ctx, { path: '/Claude/a.txt', old_str: '<li>x</li>', new_str: '', expected_rev: rev }))
			.rejects.toThrow(/matches 3 times/)
		expect(fake.text('/Claude/a.txt')).toBe('<li>x</li><li>x</li><li>x</li>')
		expect(fake.calls).not.toContain('files/upload')
	})

	it('counts overlapping matches as more than one', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.txt', 'aaa')
		const rev = await revOf(ctx, '/Claude/a.txt')
		await expect(strReplace(ctx, { path: '/Claude/a.txt', old_str: 'aa', new_str: 'b', expected_rev: rev }))
			.rejects.toThrow(/matches 2 times/)
	})

	it('refuses an empty old_str', async () => {
		const { ctx } = setup()
		expect(() => strReplace(ctx, { path: '/Claude/a.txt', old_str: '', new_str: 'x', expected_rev: 'r' })).toThrow(/must not be empty/)
	})

	it('can replace with an empty string', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.txt', 'keep REMOVE keep')
		const rev = await revOf(ctx, '/Claude/a.txt')
		await strReplace(ctx, { path: '/Claude/a.txt', old_str: ' REMOVE', new_str: '', expected_rev: rev })
		expect(fake.text('/Claude/a.txt')).toBe('keep keep')
	})
})

describe('stale rev', () => {
	it('rejects an edit against a rev the file has moved past, leaving the newer content intact', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'v1 <b>')
		const oldRev = await revOf(ctx, '/Claude/a.md')
		await fake.addFile('/Claude/a.md', 'v2 <b>')
		const verbs = [
			() => strReplace(ctx, { path: '/Claude/a.md', old_str: '<b>', new_str: '<i>', expected_rev: oldRev }),
			() => appendText(ctx, { path: '/Claude/a.md', text: '!', expected_rev: oldRev }),
			() => insertText(ctx, { path: '/Claude/a.md', line: 1, text: '#\n', expected_rev: oldRev }),
			() => overwrite(ctx, { path: '/Claude/a.md', content: 'clobber', expected_rev: oldRev })
		]
		for (const verb of verbs)
			await expect(verb()).rejects.toThrow(/STALE_REV/)
		expect(fake.text('/Claude/a.md')).toBe('v2 <b>')
		expect(fake.calls).not.toContain('files/upload')
	})

	it('relies on Dropbox\'s rev-pinned update when the file changes between read and write', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'before <x>')
		const rev = await revOf(ctx, '/Claude/a.md')
		fake.beforeUpload = async path => {
			fake.beforeUpload = undefined
			await fake.addFile(path, 'someone else wrote this')
		}
		await expect(strReplace(ctx, { path: '/Claude/a.md', old_str: '<x>', new_str: '<y>', expected_rev: rev }))
			.rejects.toThrow(/STALE_REV: Dropbox rejected the write/)
		expect(fake.text('/Claude/a.md')).toBe('someone else wrote this')
	})

	it('requires expected_rev', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.md', 'x')
		await expect(appendText(ctx, { path: '/Claude/a.md', text: 'y', expected_rev: '' })).rejects.toThrow(/expected_rev is required/)
	})
})

describe('append', () => {
	it('adds text to the end exactly as given and returns the new rev', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/log.md', '# Log\r\n- one\r\n')
		const rev = await revOf(ctx, '/Claude/log.md')
		const result = body(await appendText(ctx, { path: '/Claude/log.md', text: '- two <tag>\r\n', expected_rev: rev }))
		expect(fake.text('/Claude/log.md')).toBe('# Log\r\n- one\r\n- two <tag>\r\n')
		expect(result.rev).toBe(fake.file('/Claude/log.md')!.rev)
		expect(result.verified).toBe(true)
	})
})

describe('insert', () => {
	it('inserts at the start of the given line', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/list.md', 'one\ntwo\nthree\n')
		const rev = await revOf(ctx, '/Claude/list.md')
		await insertText(ctx, { path: '/Claude/list.md', line: 2, text: 'one and a half\n', expected_rev: rev })
		expect(fake.text('/Claude/list.md')).toBe('one\none and a half\ntwo\nthree\n')
	})

	it('inserts after the last line when line is one past the end', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/list.md', 'one\ntwo\n')
		const rev = await revOf(ctx, '/Claude/list.md')
		await insertText(ctx, { path: '/Claude/list.md', line: 3, text: 'three\n', expected_rev: rev })
		expect(fake.text('/Claude/list.md')).toBe('one\ntwo\nthree\n')
	})

	it('fails plainly for a line outside the file, writing nothing', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/list.md', 'one\ntwo\n')
		const rev = await revOf(ctx, '/Claude/list.md')
		await expect(insertText(ctx, { path: '/Claude/list.md', line: 9, text: 'x\n', expected_rev: rev }))
			.rejects.toThrow(/between 1 and 3.*Nothing was written/)
		expect(fake.file('/Claude/list.md')!.rev).toBe(rev)
	})
})

describe('overwrite', () => {
	it('replaces the whole contents and returns the new rev', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.svg', '<svg/>')
		const rev = await revOf(ctx, '/Claude/a.svg')
		const result = body(await overwrite(ctx, { path: '/Claude/a.svg', content: '<svg><circle r="1"/></svg>', expected_rev: rev }))
		expect(fake.text('/Claude/a.svg')).toBe('<svg><circle r="1"/></svg>')
		expect(result.previous_rev).toBe(rev)
		expect(result.rev).toBe(fake.file('/Claude/a.svg')!.rev)
	})

	it('fails when the file doesn\'t exist', async () => {
		const { ctx } = setup()
		await expect(overwrite(ctx, { path: '/Claude/none.txt', content: 'x', expected_rev: 'r' })).rejects.toThrow(/not_found/)
	})
})

describe('edit refusals', () => {
	it('refuses to edit a file that is not UTF-8 text', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Claude/a.bin', new Uint8Array([0xff, 0x00, 0xfe]))
		const rev = fake.file('/Claude/a.bin')!.rev!
		await expect(appendText(ctx, { path: '/Claude/a.bin', text: 'x', expected_rev: rev })).rejects.toThrow(/isn't UTF-8 text/)
	})

	it('refuses to edit outside the scope root', async () => {
		const { fake, ctx } = setup()
		await fake.addFile('/Private/a.txt', 'secret')
		const rev = fake.file('/Private/a.txt')!.rev!
		await expect(appendText(ctx, { path: '/Private/a.txt', text: 'x', expected_rev: rev })).rejects.toThrow(/outside \/Claude/)
		expect(fake.calls).toEqual([])
	})

	it('refuses an edit that would exceed the write limit', async () => {
		const { fake, ctx } = setup({ maxWriteBytes: 10 })
		await fake.addFile('/Claude/a.txt', '12345')
		const rev = fake.file('/Claude/a.txt')!.rev!
		await expect(appendText(ctx, { path: '/Claude/a.txt', text: '678901', expected_rev: rev })).rejects.toThrow(/write limit/)
	})
})
