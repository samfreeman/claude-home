export class ScopeError extends Error {}

export interface Scope {
	root: string
	rootLower: string
	rootNamespaceId: string
}

export type IdLookup = (id: string) => Promise<string>

function normalizeFq(path: string) {
	if (path.includes('\\'))
		throw new ScopeError(`Dropbox paths can't contain a backslash: ${path}`)
	const trimmed = path.length > 1 && path.endsWith('/')
		? path.slice(0, -1)
		: path
	if (trimmed != '/' && trimmed.split('/').slice(1).some(s => s == '' || s == '.' || s == '..'))
		throw new ScopeError(`Path has an empty, "." or ".." segment: ${path}`)
	return trimmed
}

export function makeScope(root: string, rootNamespaceId: string): Scope {
	const normalized = normalizeFq(root.normalize('NFC'))
	if (!normalized.startsWith('/') || normalized == '/')
		throw new ScopeError(`Scope root must be a folder below the Dropbox root: ${root}`)
	return { root: normalized, rootLower: normalized.toLowerCase(), rootNamespaceId }
}

export function inScope(scope: Scope, path: string) {
	const lower = path.normalize('NFC').toLowerCase()
	return lower == scope.rootLower || lower.startsWith(scope.rootLower + '/')
}

export const isScopeRoot = (scope: Scope, path: string) =>
	path.normalize('NFC').toLowerCase() == scope.rootLower

async function toFq(scope: Scope, input: string, lookupId: IdLookup) {
	const value = input.normalize('NFC')
	if (value == '' || value.startsWith('/'))
		return normalizeFq(value || '/')
	const ns = /^ns:(\d+)\/\/(.*)$/s.exec(value)
	if (ns != null) {
		if (ns[1] != scope.rootNamespaceId)
			throw new ScopeError(`Namespace ${ns[1]} isn't your root namespace; this server only reaches ${scope.root}.`)
		return normalizeFq('/' + ns[2])
	}
	const id = /^(id:[A-Za-z0-9_-]+)(\/.*)?$/s.exec(value)
	if (id != null) {
		const base = await lookupId(id[1])
		return normalizeFq(id[2] == null ? base : base + id[2])
	}
	throw new ScopeError(`Not a Dropbox path, ns path, or file id: ${input}`)
}

export async function resolvePath(
	scope: Scope,
	input: string,
	lookupId: IdLookup,
	options?: { forbidRoot?: boolean }) {
	const path = await toFq(scope, input, lookupId)
	if (!inScope(scope, path))
		throw new ScopeError(`${input} is outside ${scope.root}. This server only reaches ${scope.root} and what's inside it.`)
	if (options?.forbidRoot && isScopeRoot(scope, path))
		throw new ScopeError(`Refusing to change ${scope.root} itself; name something inside it.`)
	return path
}

export const nsPath = (scope: Scope, pathDisplay: string) =>
	`ns:${scope.rootNamespaceId}/${pathDisplay}`

export function parentPath(path: string) {
	const index = path.lastIndexOf('/')
	return index <= 0
		? '/'
		: path.slice(0, index)
}
