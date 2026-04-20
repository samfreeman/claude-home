import fs from 'fs'

export function ok(text: string) {
	return { content: [{ type: 'text' as const, text }] }
}

export function err(e: unknown) {
	const msg = e instanceof Error ? e.message : String(e)
	return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
}

export function requireExists(p: string, kind?: 'file' | 'dir'): fs.Stats {
	let st: fs.Stats
	try {
		st = fs.statSync(p)
	}
	catch (e: any) {
		if (e && e.code == 'ENOENT')
			throw new Error(`Not found: ${p}`)
		throw e
	}
	if (kind == 'file' && !st.isFile())
		throw new Error(`Not a file: ${p}`)
	if (kind == 'dir' && !st.isDirectory())
		throw new Error(`Not a directory: ${p}`)
	return st
}

export const MIME_MAP: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.bmp': 'image/bmp',
	'.ico': 'image/x-icon',
	'.pdf': 'application/pdf',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm'
}
