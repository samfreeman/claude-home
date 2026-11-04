import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider'

export interface Env {
	OAUTH_KV: KVNamespace
	OAUTH_PROVIDER: OAuthHelpers
	DROPBOX_APP_KEY: string
	DROPBOX_APP_SECRET: string
	PUBLIC_URL: string
	ALLOWED_ACCOUNT_ID?: string
	ALLOWED_REDIRECT_HOSTS?: string
	SCOPE_ROOT?: string
}

export interface Props {
	accountId: string
	refreshToken: string
	rootNamespaceId: string
}

export const defaultScopeRoot = '/Claude'
export const defaultRedirectHosts = 'claude.ai,claude.com'
export const maxReadBytes = 5 * 1024 * 1024
export const maxWriteBytes = 5 * 1024 * 1024
export const maxRequestBodyBytes = 8 * 1024 * 1024
