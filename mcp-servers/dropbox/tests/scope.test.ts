import { describe, expect, it } from 'vitest'
import { inScope, makeScope, resolvePath, ScopeError } from '../src/scope'

const scope = makeScope('/Claude', '100')
const ids: Record<string, string> = { 'id:inside': '/claude/notes', 'id:outside': '/private' }
const lookup = async (id: string) =>
	ids[id]

describe('resolvePath', () => {
	it('accepts paths inside the scope root, case-insensitively', async () => {
		expect(await resolvePath(scope, '/Claude/a.md', lookup)).toBe('/Claude/a.md')
		expect(await resolvePath(scope, '/claude/A.md', lookup)).toBe('/claude/A.md')
		expect(await resolvePath(scope, '/Claude/', lookup)).toBe('/Claude')
	})

	it('refuses paths outside the scope root', async () => {
		for (const path of ['/Private/x', '/', '', '/ClaudeX/a', '/Claud'])
			await expect(resolvePath(scope, path, lookup)).rejects.toThrow(ScopeError)
	})

	it('refuses dot segments and empty segments that could escape the root', async () => {
		for (const path of ['/Claude/../Private', '/Claude/./a', '/Claude//a', '/Claude\\a'])
			await expect(resolvePath(scope, path, lookup)).rejects.toThrow(ScopeError)
	})

	it('maps root-namespace ns paths and refuses other namespaces', async () => {
		expect(await resolvePath(scope, 'ns:100//Claude/a.md', lookup)).toBe('/Claude/a.md')
		await expect(resolvePath(scope, 'ns:100//Private/a.md', lookup)).rejects.toThrow(/outside/)
		await expect(resolvePath(scope, 'ns:999//Claude/a.md', lookup)).rejects.toThrow(/Namespace 999/)
	})

	it('resolves file ids, with or without a child path, and checks where they land', async () => {
		expect(await resolvePath(scope, 'id:inside', lookup)).toBe('/claude/notes')
		expect(await resolvePath(scope, 'id:inside/child.md', lookup)).toBe('/claude/notes/child.md')
		await expect(resolvePath(scope, 'id:outside', lookup)).rejects.toThrow(/outside/)
	})

	it('refuses the scope root itself when asked to', async () => {
		await expect(resolvePath(scope, '/Claude', lookup, { forbidRoot: true })).rejects.toThrow(/itself/)
		expect(await resolvePath(scope, '/Claude/x', lookup, { forbidRoot: true })).toBe('/Claude/x')
	})

	it('rejects things that are not paths', async () => {
		await expect(resolvePath(scope, 'https://www.dropbox.com/s/x', lookup)).rejects.toThrow(/Not a Dropbox path/)
	})
})

describe('inScope', () => {
	it('matches the root and its descendants only', () => {
		expect(inScope(scope, '/claude')).toBe(true)
		expect(inScope(scope, '/CLAUDE/x/y')).toBe(true)
		expect(inScope(scope, '/claudex')).toBe(false)
	})
})

describe('makeScope', () => {
	it('refuses the Dropbox root as a scope', () => {
		expect(() => makeScope('/', '100')).toThrow(ScopeError)
	})
})
