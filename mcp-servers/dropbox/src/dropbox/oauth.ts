import { DropboxError, type FetchFn } from './client'

export interface DropboxApp {
	appKey: string
	appSecret: string
}

export interface CodeGrant {
	accessToken: string
	expiresIn: number
	refreshToken: string
	accountId: string
}

const tokenUrl = 'https://api.dropboxapi.com/oauth2/token'

export function authorizeUrl(app: DropboxApp, redirectUri: string, state: string) {
	const url = new URL('https://www.dropbox.com/oauth2/authorize')
	url.searchParams.set('client_id', app.appKey)
	url.searchParams.set('response_type', 'code')
	url.searchParams.set('redirect_uri', redirectUri)
	url.searchParams.set('state', state)
	url.searchParams.set('token_access_type', 'offline')
	url.searchParams.set('force_reapprove', 'true')
	return url.toString()
}

async function tokenRequest(fetchFn: FetchFn, params: Record<string, string>) {
	const response = await fetchFn(
		tokenUrl,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(params).toString()
		})
	const text = await response.text()
	if (!response.ok)
		throw new DropboxError('oauth2/token', response.status, text || response.statusText, undefined)
	return JSON.parse(text) as Record<string, unknown>
}

export async function exchangeCode(fetchFn: FetchFn, app: DropboxApp, code: string, redirectUri: string): Promise<CodeGrant> {
	const body = await tokenRequest(
		fetchFn,
		{
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri,
			client_id: app.appKey,
			client_secret: app.appSecret
		})
	if (typeof body.refresh_token != 'string')
		throw new Error('Dropbox returned no refresh token; the app must request offline access')
	return {
		accessToken: body.access_token as string,
		expiresIn: body.expires_in as number,
		refreshToken: body.refresh_token,
		accountId: body.account_id as string
	}
}

export async function refreshAccessToken(fetchFn: FetchFn, app: DropboxApp, refreshToken: string) {
	const body = await tokenRequest(
		fetchFn,
		{
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: app.appKey,
			client_secret: app.appSecret
		})
	return { accessToken: body.access_token as string, expiresIn: body.expires_in as number }
}

export async function revokeToken(fetchFn: FetchFn, accessToken: string) {
	await fetchFn(
		'https://api.dropboxapi.com/2/auth/token/revoke',
		{
			method: 'POST',
			headers: { Authorization: `Bearer ${accessToken}` }
		})
}
