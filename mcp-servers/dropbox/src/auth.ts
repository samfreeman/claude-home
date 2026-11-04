import { accountRefusal, page, redirectAllowed } from './auth-policy'
import { DropboxClient, type FetchFn } from './dropbox/client'
import { authorizeUrl, exchangeCode, revokeToken, type DropboxApp } from './dropbox/oauth'
import { cacheAccessToken } from './dropbox/token'
import type { DbxAccount } from './dropbox/types'
import { defaultRedirectHosts, type Env, type Props } from './env'
import { kvStore } from './store'

const workerFetch: FetchFn = (input, init) =>
	fetch(input, init)

const app = (env: Env): DropboxApp => ({ appKey: env.DROPBOX_APP_KEY, appSecret: env.DROPBOX_APP_SECRET })

const callbackUrl = (env: Env) =>
	new URL('/callback', env.PUBLIC_URL).toString()

const message = (error: unknown) =>
	error instanceof Error ? error.message : String(error)

async function authorize(request: Request, env: Env) {
	let authRequest
	try {
		authRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request)
	}
	catch (error) {
		return page(400, 'Invalid authorization request', message(error))
	}
	if (!redirectAllowed(authRequest.redirectUri, env.ALLOWED_REDIRECT_HOSTS || defaultRedirectHosts))
		return page(403, 'Client not allowed', 'This server only completes sign-ins for Claude. The requesting client\'s redirect address isn\'t on its allowlist.')
	const { state, headers } = await env.OAUTH_PROVIDER.beginUpstream(authRequest)
	headers.set('Location', authorizeUrl(app(env), callbackUrl(env), state))
	return new Response(null, { status: 302, headers })
}

async function callback(request: Request, env: Env) {
	const url = new URL(request.url)
	const denied = url.searchParams.get('error')
	if (denied != null)
		return page(400, 'Dropbox sign-in didn\'t complete', url.searchParams.get('error_description') ?? denied)
	let resumed
	try {
		resumed = await env.OAUTH_PROVIDER.finishUpstream(request)
	}
	catch (error) {
		return page(400, 'Sign-in expired or was already used', `${message(error)}. Start again from Claude.`)
	}
	const code = url.searchParams.get('code')
	if (code == null)
		return page(400, 'Dropbox sign-in didn\'t complete', 'Dropbox returned no authorization code.')
	let grant
	try {
		grant = await exchangeCode(workerFetch, app(env), code, callbackUrl(env))
	}
	catch (error) {
		return page(502, 'Dropbox sign-in failed', message(error))
	}
	const refusal = accountRefusal(grant.accountId, env.ALLOWED_ACCOUNT_ID)
	if (refusal != null) {
		await revokeToken(workerFetch, grant.accessToken)
		return page(403, 'Account not allowed', refusal)
	}
	let account: DbxAccount
	try {
		account = await new DropboxClient(workerFetch, async () => grant.accessToken).rpc<DbxAccount>('users/get_current_account')
	}
	catch (error) {
		return page(502, 'Dropbox sign-in failed', message(error))
	}
	await cacheAccessToken(kvStore(env.OAUTH_KV), grant.accountId, grant.accessToken, grant.expiresIn)
	const props: Props = {
		accountId: grant.accountId,
		refreshToken: grant.refreshToken,
		rootNamespaceId: account.root_info.root_namespace_id
	}
	const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
		request: resumed.request,
		userId: encodeURIComponent(grant.accountId),
		metadata: { email: account.email },
		scope: resumed.request.scope,
		props
	})
	const headers = new Headers(resumed.headers)
	headers.set('Location', redirectTo)
	return new Response(null, { status: 302, headers })
}

export const authHandler = {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url)
		if (pathname == '/authorize')
			return authorize(request, env)
		if (pathname == '/callback')
			return callback(request, env)
		if (pathname == '/')
			return page(200, 'Dropbox MCP', 'A remote MCP server for Dropbox. Add /mcp on this host as a custom connector in Claude.')
		return new Response('Not found', { status: 404 })
	}
}
