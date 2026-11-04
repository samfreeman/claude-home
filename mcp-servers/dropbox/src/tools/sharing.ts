import { DropboxError } from '../dropbox/client'
import type { DbxMetadata, DbxSharedLink } from '../dropbox/types'
import { inScope, nsPath } from '../scope'
import { dropboxTime, errorMessage, json, resolve, tagPath, ToolError, type ToolContext } from './context'

async function existingLink(ctx: ToolContext, path: string, error: unknown) {
	if (!(error instanceof DropboxError) || !error.summary.startsWith('shared_link_already_exists'))
		return undefined
	const embedded = (error.error as { shared_link_already_exists?: { metadata?: DbxSharedLink } } | undefined)
		?.shared_link_already_exists?.metadata
	if (embedded != null)
		return embedded
	const listed = await ctx.dropbox.rpc<{ links: DbxSharedLink[] }>('sharing/list_shared_links', { path, direct_only: true })
	return listed.links[0]
}

export async function ensurePrivateLink(ctx: ToolContext, path: string) {
	try {
		const link = await ctx.dropbox.rpc<DbxSharedLink>(
			'sharing/create_shared_link_with_settings',
			{
				path,
				settings: { audience: 'no_one', access: 'viewer' }
			})
		return { link, created: true }
	}
	catch (error) {
		const link = await existingLink(ctx, path, error)
		if (link == null)
			throw error
		return { link, created: false }
	}
}

function linkView(link: DbxSharedLink) {
	const permissions = link.link_permissions ?? {}
	const level = permissions.link_access_level?.['.tag']
	return {
		url: link.url,
		link_type: link['.tag'] == 'file' || link['.tag'] == 'folder' ? link['.tag'] : 'other',
		name: link.name,
		path_lower: link.path_lower ?? '',
		audience: permissions.effective_audience?.['.tag'] ?? permissions.resolved_visibility?.['.tag'] ?? '',
		access_level: level == 'viewer' ? 'view' : level == 'editor' ? 'edit' : level ?? '',
		expires: link.expires ?? '',
		allow_download: permissions.allow_download ?? true,
		password_protected: permissions.require_password ?? permissions.resolved_visibility?.['.tag'] == 'password'
	}
}

export interface CreateSharedLinkArgs {
	path_or_file_id: string
	emails?: string[]
	audience?: string
	access_level?: string
	password?: string
	expires?: string
	allow_download?: { value: boolean } | null
}

export async function createSharedLink(ctx: ToolContext, args: CreateSharedLinkArgs) {
	if (args.audience && args.audience != 'no_one')
		throw new ToolError('INVALID_AUDIENCE: links from this tool are always audience "no_one"; make public or team links in the Dropbox web UI.')
	if (args.access_level && args.access_level != 'view')
		throw new ToolError('INVALID_ACCESS_LEVEL: links from this tool are always view-only.')
	const emails = (args.emails ?? []).filter(e => e != '')
	if (emails.length > 25)
		throw new ToolError('TOO_MANY_EMAILS: at most 25 emails')
	if (emails.some(e => /[\u0000-\u001f\u007f]/.test(e)))
		throw new ToolError('INVALID_EMAIL: an email contains control characters')
	const expires = args.expires ? dropboxTime(args.expires, 'expires') : undefined
	const path = await resolve(ctx, args.path_or_file_id)
	const target = await ctx.dropbox.rpc<DbxMetadata>('files/get_metadata', { path })
	let link: DbxSharedLink
	let created: boolean
	try {
		link = await ctx.dropbox.rpc<DbxSharedLink>(
			'sharing/create_shared_link_with_settings',
			{
				path,
				settings: {
					audience: 'no_one',
					access: 'viewer',
					require_password: args.password ? true : undefined,
					link_password: args.password || undefined,
					expires,
					allow_download: args.allow_download?.value
				}
			})
		created = true
	}
	catch (error) {
		const existing = await existingLink(ctx, path, error)
		if (existing == null)
			throw error
		link = existing
		created = false
	}
	const view = linkView(link)
	const differences = created
		? []
		: [
			args.password && !view.password_protected ? 'password' : '',
			args.allow_download != null && args.allow_download.value != view.allow_download ? 'allow_download' : '',
			expires != null && expires != view.expires ? 'expires' : ''
		].filter(d => d != '')
	const warning = differences.length == 0
		? undefined
		: `An existing link was returned unchanged; its ${differences.join(', ')} differ from what you asked for. Revoke it in the Dropbox web UI to change settings.`
	const response: Record<string, unknown> = {
		url: view.url,
		created,
		warning,
		audience: view.audience,
		access_level: view.access_level,
		password_protected: view.password_protected,
		expires: view.expires,
		allow_download: view.allow_download,
		content_type: target['.tag'],
		path: target.path_display == null ? undefined : nsPath(ctx.scope, target.path_display),
		path_display: target.path_display
	}
	if (emails.length > 0) {
		if (warning != null)
			Object.assign(response, { shared_with: [], share_errors: ['Member addition skipped because the existing link\'s settings differ.'] })
		else if (target['.tag'] == 'folder')
			Object.assign(response, {
				shared_with: [],
				share_errors: emails.map(e => `${e}: inviting people to a folder isn't supported by this server; invite them from the Dropbox web UI.`)
			})
		else
			Object.assign(response, await addFileMembers(ctx, path, emails))
	}
	return json(response)
}

async function addFileMembers(ctx: ToolContext, path: string, emails: string[]) {
	try {
		const results = await ctx.dropbox.rpc<{ member: { email?: string }, result: { '.tag': string } }[]>(
			'sharing/add_file_member',
			{
				file: path,
				members: emails.map(email => ({ '.tag': 'email', email })),
				access_level: 'viewer',
				quiet: false
			})
		return {
			shared_with: results.filter(r => r.result['.tag'] == 'success').map(r => r.member.email),
			share_errors: results.filter(r => r.result['.tag'] != 'success').map(r => `${r.member.email}: ${tagPath(r.result)}`)
		}
	}
	catch (error) {
		return { shared_with: [], share_errors: [`The link was created, but adding viewers failed: ${errorMessage(error)}`] }
	}
}

export async function listSharedLinks(ctx: ToolContext, args: { path?: string, cursor?: string }) {
	let page: { links: DbxSharedLink[], has_more: boolean, cursor?: string }
	if (args.cursor != null) {
		if (args.path != null)
			throw new ToolError('Send cursor alone when paginating.')
		page = await ctx.dropbox.rpc('sharing/list_shared_links', { cursor: args.cursor })
	}
	else if (args.path == null || args.path == '' || args.path == '/')
		page = await ctx.dropbox.rpc('sharing/list_shared_links', {})
	else
		page = await ctx.dropbox.rpc('sharing/list_shared_links', { path: await resolve(ctx, args.path), direct_only: true })
	return json({
		links: page.links.filter(l => l.path_lower != null && inScope(ctx.scope, l.path_lower)).map(linkView),
		has_more: page.has_more,
		cursor: page.has_more ? page.cursor ?? '' : ''
	})
}

export async function getSharedLinkMetadata(ctx: ToolContext, args: { url?: string }) {
	if (!args.url)
		throw new ToolError('MISSING_URL: url is required')
	const link = await ctx.dropbox.rpc<DbxSharedLink>('sharing/get_shared_link_metadata', { url: args.url })
	if (link.path_lower == null || !inScope(ctx.scope, link.path_lower))
		throw new ToolError(`That link points outside ${ctx.scope.root} (or outside your Dropbox), which this server can't reach.`)
	return json({ link: { ...linkView(link), id: link.id } })
}
