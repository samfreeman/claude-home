import type { DbxFileRequest } from '../dropbox/types'
import { inScope } from '../scope'
import { dropboxTime, json, resolve, ToolError, type ToolContext } from './context'

const view = (r: DbxFileRequest) => ({
	id: r.id,
	url: r.url,
	title: r.title,
	destination: r.destination ?? '',
	created: r.created,
	deadline: r.deadline?.deadline ?? '',
	deadline_allow_late_uploads: r.deadline?.allow_late_uploads?.['.tag'] ?? '',
	is_open: r.is_open,
	file_count: r.file_count,
	description: r.description ?? '',
	video_project_id: r.video_project_id ?? ''
})

export interface CreateFileRequestArgs {
	title: string
	destination: string
	deadline?: string
	deadline_allow_late_uploads?: 'one_day' | 'two_days' | 'seven_days' | 'thirty_days' | 'always'
	closed?: boolean
	description?: string
	video_project_id?: string
}

export async function createFileRequest(ctx: ToolContext, args: CreateFileRequestArgs) {
	if (args.deadline_allow_late_uploads != null && args.deadline == null)
		throw new ToolError('deadline_allow_late_uploads is only valid with a deadline')
	const deadline = args.deadline == null ? undefined : dropboxTime(args.deadline, 'deadline')
	const destination = await resolve(ctx, args.destination, { forbidRoot: true })
	const request = await ctx.dropbox.rpc<DbxFileRequest>(
		'file_requests/create',
		{
			title: args.title,
			destination,
			deadline: deadline == null
				? undefined
				: { deadline, allow_late_uploads: args.deadline_allow_late_uploads },
			open: args.closed != true,
			description: args.description,
			video_project_id: args.video_project_id
		})
	return json({ file_request: view(request) })
}

export async function getFileRequest(ctx: ToolContext, args: { id: string }) {
	const request = await ctx.dropbox.rpc<DbxFileRequest>('file_requests/get', { id: args.id })
	if (request.destination == null || !inScope(ctx.scope, request.destination))
		throw new ToolError(`That file request's destination is outside ${ctx.scope.root} (or was removed), which this server can't reach.`)
	return json({ file_request: view(request) })
}

export async function listFileRequests(ctx: ToolContext, args: { limit?: number, cursor?: string }) {
	if (args.cursor != null && args.limit)
		throw new ToolError('Send cursor alone when paginating.')
	const page = args.cursor != null
		? await ctx.dropbox.rpc<{ file_requests: DbxFileRequest[], cursor: string, has_more: boolean }>('file_requests/list/continue', { cursor: args.cursor })
		: await ctx.dropbox.rpc<{ file_requests: DbxFileRequest[], cursor: string, has_more: boolean }>('file_requests/list_v2', { limit: args.limit || 300 })
	return json({
		file_requests: page.file_requests.filter(r => r.destination != null && inScope(ctx.scope, r.destination)).map(view),
		cursor: page.has_more ? page.cursor : '',
		has_more: page.has_more
	})
}
