import { describe, expect, it } from 'vitest'
import { accountRefusal, escapeHtml, redirectAllowed } from '../src/auth-policy'
import { authorizeUrl } from '../src/dropbox/oauth'
import { accessTokenSource, cacheAccessToken } from '../src/dropbox/token'
import { memoryStore } from '../src/store'

describe('redirectAllowed', () => {
	it('allows only https redirects to the listed hosts', () => {
		const hosts = 'claude.ai,claude.com'
		expect(redirectAllowed('https://claude.ai/api/mcp/auth_callback', hosts)).toBe(true)
		expect(redirectAllowed('https://claude.com/api/mcp/auth_callback', hosts)).toBe(true)
		expect(redirectAllowed('http://claude.ai/api/mcp/auth_callback', hosts)).toBe(false)
		expect(redirectAllowed('https://claude.ai.evil.com/cb', hosts)).toBe(false)
		expect(redirectAllowed('https://evil.com/cb', hosts)).toBe(false)
		expect(redirectAllowed('not a url', hosts)).toBe(false)
	})
})

describe('accountRefusal', () => {
	it('admits only the configured account and fails closed when none is configured', () => {
		expect(accountRefusal('dbid:me', 'dbid:me')).toBeUndefined()
		expect(accountRefusal('dbid:other', 'dbid:me')).toMatch(/isn't allowed/)
		expect(accountRefusal('dbid:me', undefined)).toMatch(/set ALLOWED_ACCOUNT_ID to dbid:me/)
	})
})

describe('escapeHtml', () => {
	it('escapes markup', () => {
		expect(escapeHtml('<a href="x">&\'</a>')).toBe('&#60;a href=&#34;x&#34;&#62;&#38;&#39;&#60;/a&#62;')
	})
})

describe('authorizeUrl', () => {
	it('asks Dropbox for offline access and forces the consent screen', () => {
		const url = new URL(authorizeUrl({ appKey: 'key', appSecret: 's' }, 'https://x.example/callback', 'st'))
		expect(url.searchParams.get('token_access_type')).toBe('offline')
		expect(url.searchParams.get('force_reapprove')).toBe('true')
		expect(url.searchParams.get('state')).toBe('st')
	})
})

describe('accessTokenSource', () => {
	const app = { appKey: 'key', appSecret: 'secret' }

	it('uses a cached access token while it is fresh', async () => {
		const store = memoryStore()
		await cacheAccessToken(store, 'dbid:me', 'cached', 14400)
		const fetchFn = async () => {
			throw new Error('should not refresh')
		}
		const token = accessTokenSource(store, fetchFn, app, { accountId: 'dbid:me', refreshToken: 'r' })
		expect(await token()).toBe('cached')
	})

	it('refreshes with the refresh token when nothing is cached, once per request', async () => {
		const store = memoryStore()
		const bodies: string[] = []
		const fetchFn = async (_: string, init?: RequestInit) => {
			bodies.push(String(init?.body))
			return Response.json({ access_token: 'fresh', expires_in: 14400 })
		}
		const token = accessTokenSource(store, fetchFn, app, { accountId: 'dbid:me', refreshToken: 'refresh-me' })
		expect(await token()).toBe('fresh')
		expect(await token()).toBe('fresh')
		expect(bodies).toHaveLength(1)
		expect(bodies[0]).toContain('grant_type=refresh_token')
		expect(bodies[0]).toContain('refresh_token=refresh-me')
		expect(await store.get('dropbox-access:dbid:me')).toContain('fresh')
	})

	it('fails plainly when Dropbox refuses the refresh', async () => {
		const fetchFn = async () =>
			new Response('{"error":"invalid_grant"}', { status: 400 })
		const token = accessTokenSource(memoryStore(), fetchFn, app, { accountId: 'dbid:me', refreshToken: 'bad' })
		await expect(token()).rejects.toThrow(/invalid_grant/)
	})
})
