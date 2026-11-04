import { createMcpHandler } from '@modelcontextprotocol/server'
import { aiConverter } from './convert'
import { DropboxClient, type FetchFn } from './dropbox/client'
import { accessTokenSource } from './dropbox/token'
import { defaultScopeRoot, maxReadBytes, maxRequestBodyBytes, maxWriteBytes, type Env, type Props } from './env'
import { makeScope } from './scope'
import { buildServer } from './server'
import { kvStore } from './store'

const workerFetch: FetchFn = (input, init) =>
	fetch(input, init)

export const mcpApiHandler = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const props = (ctx as unknown as { props: Props }).props
		const getToken = accessTokenSource(
			kvStore(env.OAUTH_KV),
			workerFetch,
			{ appKey: env.DROPBOX_APP_KEY, appSecret: env.DROPBOX_APP_SECRET },
			props)
		const toolContext = {
			dropbox: new DropboxClient(workerFetch, getToken),
			scope: makeScope(env.SCOPE_ROOT || defaultScopeRoot, props.rootNamespaceId),
			maxReadBytes,
			maxWriteBytes,
			convert: env.AI == undefined ? undefined : aiConverter(env.AI)
		}
		const handler = createMcpHandler(() => buildServer(toolContext), { maxRequestBodySize: maxRequestBodyBytes })
		return handler.fetch(request)
	}
}
