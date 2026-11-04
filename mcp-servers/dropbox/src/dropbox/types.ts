export type Tagged<T extends string = string> = { '.tag': T }

export interface DbxMetadata {
	'.tag': 'file' | 'folder' | 'deleted'
	name: string
	id?: string
	path_lower?: string
	path_display?: string
	rev?: string
	size?: number
	content_hash?: string
	server_modified?: string
	client_modified?: string
	is_downloadable?: boolean
	sharing_info?: unknown
	has_explicit_shared_members?: boolean
}

export interface DbxAccount {
	account_id: string
	name: { display_name: string }
	email: string
	country?: string
	locale: string
	team?: { id: string, name: string }
	root_info: { root_namespace_id: string, home_namespace_id: string }
}

export interface DbxListFolderResult {
	entries: DbxMetadata[]
	cursor: string
	has_more: boolean
}

export interface DbxSearchResult {
	matches: {
		match_type?: Tagged
		metadata: { '.tag': 'metadata', metadata: DbxMetadata }
	}[]
	cursor?: string
	has_more: boolean
}

export interface DbxSharedLink {
	'.tag': string
	url: string
	name: string
	id?: string
	path_lower?: string
	expires?: string
	link_permissions?: {
		effective_audience?: Tagged
		resolved_visibility?: Tagged
		link_access_level?: Tagged
		require_password?: boolean
		allow_download?: boolean
	}
}

export interface DbxFileRequest {
	id: string
	url: string
	title: string
	created: string
	is_open: boolean
	file_count: number
	destination?: string
	deadline?: { deadline: string, allow_late_uploads?: Tagged }
	description?: string
	video_project_id?: string
}

export type DbxBatchEntry =
	| { '.tag': 'success', success?: DbxMetadata, metadata?: DbxMetadata }
	| { '.tag': 'failure', failure: unknown }

export type DbxBatchStatus =
	| { '.tag': 'async_job_id', async_job_id: string }
	| { '.tag': 'in_progress' }
	| { '.tag': 'complete', entries: DbxBatchEntry[] }
	| { '.tag': 'failed', failed: unknown }
	| { '.tag': 'other' }
