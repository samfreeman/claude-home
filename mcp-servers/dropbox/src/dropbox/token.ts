import type { FetchFn } from './client'
import { refreshAccessToken, type DropboxApp } from './oauth'
import type { Store } from '../store'

const marginSeconds = 300

const cacheKey = (accountId: string) =>
	`dropbox-access:${accountId}`

export async function cacheAccessToken(store: Store, accountId: string, accessToken: string, expiresIn: number) {
	const ttl = expiresIn - marginSeconds
	if (ttl < 60)
		return
	const expiresAt = Date.now() + ttl * 1000
	await store.put(cacheKey(accountId), JSON.stringify({ accessToken, expiresAt }), ttl)
}

export function accessTokenSource(
	store: Store,
	fetchFn: FetchFn,
	app: DropboxApp,
	account: { accountId: string, refreshToken: string }) {
	let pending: Promise<string> | undefined

	async function load() {
		const cached = await store.get(cacheKey(account.accountId))
		if (cached != null) {
			const { accessToken, expiresAt } = JSON.parse(cached) as { accessToken: string, expiresAt: number }
			if (expiresAt > Date.now())
				return accessToken
		}
		const fresh = await refreshAccessToken(fetchFn, app, account.refreshToken)
		await cacheAccessToken(store, account.accountId, fresh.accessToken, fresh.expiresIn)
		return fresh.accessToken
	}

	return () =>
		pending ??= load()
}
