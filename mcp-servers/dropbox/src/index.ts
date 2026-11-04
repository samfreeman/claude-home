import { OAuthProvider } from '@cloudflare/workers-oauth-provider'
import { authHandler } from './auth'
import type { Env } from './env'
import { mcpApiHandler } from './mcp'

let provider: OAuthProvider<Env> | undefined
let providerUrl: string | undefined

function getProvider(env: Env) {
	if (provider == null || providerUrl != env.PUBLIC_URL) {
		providerUrl = env.PUBLIC_URL
		provider = new OAuthProvider<Env>({
			apiRoute: '/mcp',
			apiHandler: mcpApiHandler as never,
			defaultHandler: authHandler as never,
			authorizeEndpoint: '/authorize',
			tokenEndpoint: '/token',
			clientRegistrationEndpoint: '/register',
			clientIdMetadataDocumentEnabled: true,
			scopesSupported: ['dropbox'],
			refreshTokenTTL: undefined,
			clientRegistrationTTL: undefined,
			resourceMetadata: {
				resource: new URL('/mcp', env.PUBLIC_URL).toString(),
				resource_name: 'Dropbox'
			}
		})
	}
	return provider
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		if (!env.PUBLIC_URL)
			return new Response('PUBLIC_URL is not configured', { status: 500 })
		return getProvider(env).fetch(request, env, ctx)
	}
} satisfies ExportedHandler<Env>
