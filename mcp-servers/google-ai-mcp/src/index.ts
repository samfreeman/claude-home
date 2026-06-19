#!/usr/bin/env node

import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { GoogleGenAI, ApiError } from '@google/genai'

import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn, execSync } from 'child_process'

const MODEL_ALIASES: Record<string, string> = {
	nb2: 'gemini-3.1-flash-image-preview',
	pro: 'gemini-3-pro-image-preview'
}

const DEFAULT_MODEL = 'nb2'

const apiKey = process.env.GEMINI_API_KEY ?? ''
const ai = new GoogleGenAI({ apiKey })

const VIDEO_CACHE_DIR = path.join(os.homedir(), '.claude', 'mcp-servers', 'google-ai-mcp', 'cache')
const TRANSCRIPT_CACHE_DIR = path.join(VIDEO_CACHE_DIR, 'transcripts')

// ─── Debug logging ───────────────────────────────────────────────────
// Instrumentation for diagnosing the transcription pipeline. Writes
// to /tmp/google-ai-stitch-debug.log. Silent no-op on I/O error.
const DEBUG_LOG_FILE = '/tmp/google-ai-stitch-debug.log'
function dlog(tag: string, msg: string, ctx?: Record<string, unknown>): void {
	try {
		const stamp = new Date().toISOString()
		const ctxStr = ctx ? ' ' + JSON.stringify(ctx) : ''
		fs.appendFileSync(DEBUG_LOG_FILE, `${stamp} [${tag}] ${msg}${ctxStr}\n`)
	}
	catch {}
}

// Fallback chunk window for videos that exceed Gemini's one-shot output limit.
// 30-min windows stay well under the ~2h transcript output ceiling.
const CHUNK_SECONDS = 1800

// A chunk returning fewer chars than this means we've advanced past the end of
// the video — used to terminate the chunked-fallback loop without knowing duration.
const MIN_CHUNK_CHARS = 40

// Safety cap on the chunked-fallback loop (30min × 48 = 24h) to bound a runaway.
const MAX_CHUNKS = 48

// Extraction model
// Ordered best-to-worst. transcribeWithGemini tries each in order on transient
// failures (503/UNAVAILABLE). Other errors (auth, quota, bad request) bail immediately.
const VIDEO_MODELS = [
	'gemini-2.5-pro',
	'gemini-2.5-flash',
	'gemini-flash-latest',
	'gemini-2.5-flash-lite'
]

// Fixed extraction prompt — keeps Gemini's job minimal and fast
const EXTRACTION_PROMPT = [
	'Transcribe this video completely. Include:',
	'1. All spoken words (verbatim transcript)',
	'2. Descriptions of any on-screen text, slides, diagrams, or code shown',
	'3. Timestamps at natural section breaks (e.g. [0:00], [2:15])',
	'4. Speaker changes if multiple speakers',
	'Output raw data only. No analysis, no summary, no commentary.'
].join('\n')

// ─── Manifest ───────────────────────────────────────────────────────────────
//
// Each transcribed video gets a manifest: cache/transcripts/{videoId}_manifest.json
// It records the video's metadata (title, channel, source model, estimated
// duration) and a single ok segment spanning the whole video. The transcript
// itself lives in {videoId}.txt.

interface SegmentInfo {
	index: number
	start: number      // seconds from video start
	end: number        // seconds from video start
	status: 'ok' | 'failed'
}

interface VideoManifest {
	videoId: string
	duration: number      // total video duration in seconds (estimated from transcript)
	segments: SegmentInfo[]
	source?: string       // e.g. 'gemini:gemini-2.5-pro' — set on first successful transcription
	title?: string        // video title (copied from _meta.json)
	channel?: string      // channel / author (copied from _meta.json)
	uploadDate?: string   // 'YYYYMMDD' (copied from _meta.json)
	url?: string          // canonical URL (copied from _meta.json)
}

function getManifestPath(videoId: string): string {
	return path.join(TRANSCRIPT_CACHE_DIR, `${videoId}_manifest.json`)
}

function loadManifest(videoId: string): VideoManifest | null {
	const p = getManifestPath(videoId)
	if (!fs.existsSync(p))
		return null
	return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function saveManifest(manifest: VideoManifest): void {
	fs.mkdirSync(TRANSCRIPT_CACHE_DIR, { recursive: true })
	fs.writeFileSync(getManifestPath(manifest.videoId), JSON.stringify(manifest, null, '\t'), 'utf-8')
}

interface VideoMeta {
	videoId?: string
	title?: string
	channel?: string
	uploadDate?: string   // 'YYYYMMDD'
	duration?: number     // seconds
	url?: string
	description?: string
}

function loadMeta(videoId: string): VideoMeta | null {
	const p = path.join(TRANSCRIPT_CACHE_DIR, `${videoId}_meta.json`)
	if (!fs.existsSync(p))
		return null
	try {
		return JSON.parse(fs.readFileSync(p, 'utf-8'))
	}
	catch {
		return null
	}
}

// 'YYYYMMDD' → 'YYYY-MM-DD'. Returns the input unchanged if it doesn't match.
function formatUploadDate(raw: string | undefined): string | null {
	if (!raw) return null
	const m = raw.match(/^(\d{4})(\d{2})(\d{2})$/)
	if (!m) return raw
	return `${m[1]}-${m[2]}-${m[3]}`
}

// Copy YouTube metadata fields from _meta.json into a manifest (in place, idempotent).
// Only sets fields that are missing on the manifest — existing values are preserved.
function enrichManifestFromMeta(manifest: VideoManifest): void {
	const meta = loadMeta(manifest.videoId)
	if (!meta) return
	if (!manifest.title && meta.title) manifest.title = meta.title
	if (!manifest.channel && meta.channel) manifest.channel = meta.channel
	if (!manifest.uploadDate && meta.uploadDate) manifest.uploadDate = meta.uploadDate
	if (!manifest.url && meta.url) manifest.url = meta.url
	if (!manifest.duration && meta.duration) manifest.duration = meta.duration
}

function loadAllManifests(): VideoManifest[] {
	if (!fs.existsSync(TRANSCRIPT_CACHE_DIR))
		return []
	return fs.readdirSync(TRANSCRIPT_CACHE_DIR)
		.filter(f => f.endsWith('_manifest.json'))
		.map(f => JSON.parse(fs.readFileSync(path.join(TRANSCRIPT_CACHE_DIR, f), 'utf-8')) as VideoManifest)
}

// ─── Transcript files ─────────────────────────────────────────────────────────

function formatHhmmss(seconds: number): string {
	const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
	const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
	const s = String(Math.round(seconds % 60)).padStart(2, '0')
	return `${h}${m}${s}`
}

// Get the path for the transcript file covering a contiguous run
function getStitchedPath(videoId: string, start: number, end: number, duration: number): string {
	const isFullVideo = start == 0 && end >= duration
	if (isFullVideo)
		return path.join(TRANSCRIPT_CACHE_DIR, `${videoId}.txt`)
	return path.join(TRANSCRIPT_CACHE_DIR, `${videoId}_${formatHhmmss(start)}-${formatHhmmss(end)}.txt`)
}

// Find contiguous runs of ok segments and return their boundaries
function findContiguousRuns(manifest: VideoManifest): { start: number, end: number, segIndices: number[] }[] {
	const runs: { start: number, end: number, segIndices: number[] }[] = []
	let currentRun: { start: number, end: number, segIndices: number[] } | null = null

	for (const seg of manifest.segments) {
		if (seg.status == 'ok') {
			if (!currentRun)
				currentRun = { start: seg.start, end: seg.end, segIndices: [seg.index] }
			else {
				currentRun.end = seg.end
				currentRun.segIndices.push(seg.index)
			}
		}
		else {
			if (currentRun) {
				runs.push(currentRun)
				currentRun = null
			}
		}
	}
	if (currentRun)
		runs.push(currentRun)

	return runs
}

// Check if a video's transcript is fully cached (all segments ok, transcript file exists)
function isTranscriptComplete(videoId: string, manifest: VideoManifest): boolean {
	const allOk = manifest.segments.every(s => s.status == 'ok')
	if (!allOk) return false
	const fullPath = path.join(TRANSCRIPT_CACHE_DIR, `${videoId}.txt`)
	return fs.existsSync(fullPath)
}

// Estimate a video's duration (seconds) from the largest [h:mm:ss] / [mm:ss]
// timestamp the model emitted. Best-effort — returns 0 if none are found.
function estimateDurationFromTranscript(text: string): number {
	const re = /\[(?:(\d+):)?(\d{1,2}):(\d{2})\]/g
	let max = 0
	let m: RegExpExecArray | null
	while ((m = re.exec(text)) != null) {
		const h = m[1] ? parseInt(m[1], 10) : 0
		const min = parseInt(m[2], 10)
		const s = parseInt(m[3], 10)
		const total = h * 3600 + min * 60 + s
		if (total > max) max = total
	}
	return max
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function resolveOutputDir(): string {
	const configured = process.env.NB_OUTPUT_DIR
	if (configured)
		return configured.replace(/^~/, os.homedir())
	return path.join(os.homedir(), 'images', 'nano-banana')
}

function openFile(filepath: string): void {
	if (process.platform == 'darwin')
		spawn('open', [filepath], { detached: true, stdio: 'ignore' }).unref()
	else if (process.env.WSL_DISTRO_NAME) {
		const winPath = execSync(`wslpath -w "${filepath}"`).toString().trim()
		spawn('explorer.exe', [winPath], { detached: true, stdio: 'ignore' }).unref()
	}
	else
		spawn('xdg-open', [filepath], { detached: true, stdio: 'ignore' }).unref()
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
		.slice(0, 40)
}

function formatTimestamp(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0')
	const date = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
	const time = `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
	return `${date}_${time}`
}

function formatMmSs(seconds: number): string {
	const m = Math.floor(seconds / 60)
	const s = Math.round(seconds % 60)
	return `${m}:${String(s).padStart(2, '0')}`
}

function getCachedTranscript(cacheKey: string): string | null {
	const cachePath = path.join(TRANSCRIPT_CACHE_DIR, `${cacheKey}.txt`)
	if (fs.existsSync(cachePath))
		return fs.readFileSync(cachePath, 'utf-8')
	return null
}

function saveCachedTranscript(cacheKey: string, text: string): void {
	fs.mkdirSync(TRANSCRIPT_CACHE_DIR, { recursive: true })
	const outPath = path.join(TRANSCRIPT_CACHE_DIR, `${cacheKey}.txt`)
	fs.writeFileSync(outPath, text, 'utf-8')
	dlog('save', 'wrote', { path: path.basename(outPath), bytes: text.length })
}

function getImageDimensions(buf: Buffer): { width: number, height: number } {
	if (buf[0] == 0xFF && buf[1] == 0xD8) {
		let i = 2
		while (i < buf.length - 8) {
			if (buf[i] != 0xFF)
				break
			const marker = buf[i + 1]
			if (marker == 0xC0 || marker == 0xC2) {
				return {
					height: buf.readUInt16BE(i + 5),
					width: buf.readUInt16BE(i + 7)
				}
			}
			i += 2 + buf.readUInt16BE(i + 2)
		}
	}
	if (buf[1] == 0x50 && buf[2] == 0x4E && buf[3] == 0x47) {
		return {
			width: buf.readUInt32BE(16),
			height: buf.readUInt32BE(20)
		}
	}
	return { width: 0, height: 0 }
}

function errorMessage(error: unknown): string {
	if (!(error instanceof Error))
		return 'Unknown error'
	const parts = [error.message]
	if ((error as NodeJS.ErrnoException).code)
		parts.push(`code=${( error as NodeJS.ErrnoException).code}`)
	const cause = (error as Error & { cause?: unknown }).cause
	if (cause instanceof Error)
		parts.push(`cause=${cause.message}`)
	else if (cause)
		parts.push(`cause=${String(cause)}`)
	return parts.join(' | ')
}

function detailedError(error: unknown): string {
	if (error instanceof ApiError)
		return `ApiError [${error.status}]: ${error.message}`

	if (!(error instanceof Error))
		return `Non-Error thrown: ${JSON.stringify(error)}`

	const parts = [
		`${error.constructor.name}: ${error.message}`
	]

	if ((error as NodeJS.ErrnoException).code)
		parts.push(`Code: ${(error as NodeJS.ErrnoException).code}`)

	const cause = (error as Error & { cause?: unknown }).cause
	if (cause instanceof Error)
		parts.push(`Cause: ${cause.constructor.name}: ${cause.message}`)
	else if (cause)
		parts.push(`Cause: ${String(cause)}`)

	return parts.join('\n')
}

function extractVideoId(url: string): string {
	if (/^[a-zA-Z0-9_-]{11}$/.test(url))
		return url
	try {
		const parsed = new URL(url)
		const v = parsed.searchParams.get('v')
		if (v) return v
	}
	catch {}
	return url
}

// True when an error is Gemini reporting transient unavailability (503/UNAVAILABLE).
// When every model in VIDEO_MODELS reports this, transcription stops — there is no
// yt-dlp captions fallback, so a down Gemini means /yt is down.
function isGeminiUnavailable(error: unknown): boolean {
	const msg = error instanceof Error ? error.message : String(error)
	return /UNAVAILABLE|503/i.test(msg)
}

// ─── Gemini API helpers ─────────────────────────────────────────────────────

// Transcribe a public YouTube URL via Gemini. Gemini fetches the video server-side
// (no local download), so a datacenter/WSL IP never touches YouTube directly.
// When startSeconds/endSeconds are given, the video is clipped server-side via the
// part's videoMetadata offsets — that's how the chunked fallback works. Returns the
// text, the model that produced it, and the finishReason ('MAX_TOKENS' means the
// output limit was hit and the transcript is truncated).
async function transcribeWithGemini(url: string, startSeconds?: number, endSeconds?: number): Promise<{ text: string, model: string, finishReason: string }> {
	const hasRange = startSeconds != undefined || endSeconds != undefined
	const start = startSeconds ?? 0
	const prompt = start > 0
		? `${EXTRACTION_PROMPT}\n\nNote: this is a segment starting at ${formatMmSs(start)} in the original video. Adjust timestamps accordingly.`
		: EXTRACTION_PROMPT

	const part: Record<string, unknown> = { fileData: { mimeType: 'video/*', fileUri: url } }
	if (hasRange) {
		const vm: Record<string, string> = { startOffset: `${start}s` }
		if (endSeconds != undefined)
			vm.endOffset = `${endSeconds}s`
		part.videoMetadata = vm
	}

	const contents: any = [{ parts: [part, { text: prompt }] }]

	let lastError: unknown
	for (const model of VIDEO_MODELS) {
		try {
			const stream = await ai.models.generateContentStream({
				model,
				contents,
				config: {
					httpOptions: { timeout: 300_000 }
				}
			})

			const chunks: string[] = []
			let finishReason = ''
			for await (const chunk of stream) {
				const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text
				if (text)
					chunks.push(text)
				const fr = chunk.candidates?.[0]?.finishReason
				if (fr)
					finishReason = String(fr)
			}

			return { text: chunks.join('') || 'No response', model, finishReason }
		}
		catch (err) {
			lastError = err
			const msg = err instanceof Error ? err.message : String(err)
			// Only fall through on UNAVAILABLE/503. Other errors (auth, quota, bad request) bail immediately.
			if (!/UNAVAILABLE|503/i.test(msg)) throw err
			dlog('transcribe', 'model-unavailable', { model, msg: msg.slice(0, 200) })
		}
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

// Fallback for videos that exceed Gemini's one-shot output limit. Transcribes the
// video in fixed-length windows via Gemini's server-side range clipping (videoMetadata
// offsets on the YouTube URL — no download). Advances window by window until one comes
// back empty, which means we've passed the end of the video, so no duration is needed.
async function chunkedTranscribe(
	videoId: string,
	url: string,
	sendProgress: (progress: number, total: number | undefined, message: string) => Promise<void>
): Promise<string> {
	const parts: string[] = []
	let start = 0
	let chunkNum = 0

	while (chunkNum < MAX_CHUNKS) {
		const end = start + CHUNK_SECONDS
		await sendProgress(chunkNum, undefined, `Chunk ${chunkNum + 1} [${formatMmSs(start)}-${formatMmSs(end)}]`)
		const { text } = await transcribeWithGemini(url, start, end)
		dlog('chunk', 'done', { videoId, chunkNum, start, end, chars: text.length })

		// An empty/near-empty window means we've advanced past the end of the video.
		if (text.trim().length < MIN_CHUNK_CHARS)
			break

		parts.push(text)
		start = end
		chunkNum++
	}

	return parts.join('\n\n')
}

// ─── Image generation ───────────────────────────────────────────────────────

const server = new McpServer({
	name: 'google-ai-mcp',
	version: '1.0.0'
})

server.registerTool(
	'generate_image',
	{
		description: 'Generate images using the Nano Banana (Gemini) image generation API',
		inputSchema: {
			prompt: z.string().describe('Text description of the image to generate'),
			resolution: z.enum(['1K', '2K', '4K']).optional().default('2K').describe(
				'Output resolution (default: 2K)'),
			aspectRatio: z.enum([
				'1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'
			]).optional().default('16:9').describe(
				'Aspect ratio (default: 16:9)'),
			count: z.number().int().min(1).max(4).optional().default(1).describe(
				'Number of images to generate, 1-4 (default: 1)'),
			model: z.enum(['nb2', 'pro']).optional().default(DEFAULT_MODEL).describe(
				'Model alias: nb2 (gemini-3.1-flash-image-preview) or pro (gemini-3-pro-image-preview). Default: nb2'),
		}
	},
	async ({ prompt, resolution, aspectRatio, count, model }) => {
		try {
			if (!apiKey)
				throw new Error('GEMINI_API_KEY environment variable is required')

			const resolvedModel = MODEL_ALIASES[model]

			const saveDir = resolveOutputDir()
			fs.mkdirSync(saveDir, { recursive: true })

			const ts = formatTimestamp(new Date())
			const slug = slugify(prompt)
			const savedPaths: string[] = []

			for (let i = 0; i < count; i++) {
				const response = await ai.models.generateContent({
					model: resolvedModel,
					contents: prompt,
					config: {
						responseModalities: ['IMAGE'],
						imageConfig: {
							aspectRatio,
							imageSize: resolution
						}
					}
				})
				const parts = response.candidates?.[0]?.content?.parts ?? []
				for (const part of parts) {
					if (!part.inlineData?.mimeType?.startsWith('image/'))
						continue
					const buf = Buffer.from(part.inlineData.data!, 'base64')
					const { width, height } = getImageDimensions(buf)
					const ext = part.inlineData.mimeType!.split('/')[1]
					const index = savedPaths.length + 1
					const filename = `${ts}-${width}x${height}-${resolution}-${slug}_${index}.${ext}`
					const filepath = path.join(saveDir, filename)
					fs.writeFileSync(filepath, buf)
					savedPaths.push(filepath)
					openFile(filepath)
				}
			}

			const text = savedPaths.length > 0
				? `Generated ${savedPaths.length} image(s):\n${savedPaths.join('\n')}`
				: 'No images were generated'

			return {
				content: [{ type: 'text' as const, text }]
			}
		}
		catch (error) {
			return {
				content: [{ type: 'text' as const, text: `Error: ${errorMessage(error)}` }],
				isError: true
			}
		}
	}
)

// ─── Video tools ────────────────────────────────────────────────────────────
//
// 4-tool API:
//   1. get_video_info     → lightweight metadata via YouTube oEmbed            ~1s
//   2. transcribe_video   → Gemini transcribes the YouTube URL directly
//                           (server-side fetch — no download, no bot check).
//                           Falls back to Gemini server-side range chunking
//                           only when the one-shot output limit is hit.
//   3. delete_transcript  → clears cached transcript data for a video
//   4. list_transcripts   → shows all cached videos and their transcript files
//
// All transcription goes through Gemini fetching the public YouTube URL itself.
// There is no yt-dlp / download path: a datacenter/WSL IP that YouTube would
// challenge never touches YouTube directly. If every Gemini model is UNAVAILABLE,
// transcription stops and reports it — there is no captions fallback.

server.registerTool(
	'get_video_info',
	{
		description: [
			'Fetches YouTube video metadata (title, channel) via the public oEmbed endpoint.',
			'No download, no yt-dlp — works from any IP. Takes ~1 second.',
			'Optional: call before transcribe_video to capture the title for provenance.',
			'Transcription always uses the direct-URL strategy.'
		].join(' '),
		inputSchema: {
			url: z.string().describe('YouTube video URL or video ID')
		}
	},
	async ({ url }) => {
		try {
			const videoId = extractVideoId(url)
			const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
			const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`

			let title = 'Unknown'
			let channel = 'Unknown'
			try {
				const resp = await fetch(oembedUrl)
				if (!resp.ok)
					throw new Error(`oEmbed HTTP ${resp.status}`)
				const data = await resp.json() as { title?: string, author_name?: string }
				title = data.title ?? 'Unknown'
				channel = data.author_name ?? 'Unknown'
			}
			catch (err) {
				// oEmbed fails for private / age-restricted / region-locked videos. Metadata
				// is best-effort — transcription via the direct URL may still work, so we
				// record what we have and don't hard-fail here.
				dlog('get_video_info', 'oembed-failed', { videoId, msg: err instanceof Error ? err.message : String(err) })
			}

			// Persist metadata for kwiki provenance + list_transcripts
			const meta = {
				videoId,
				title,
				channel,
				url: watchUrl,
				fetchedAt: new Date().toISOString()
			}
			fs.mkdirSync(TRANSCRIPT_CACHE_DIR, { recursive: true })
			fs.writeFileSync(
				path.join(TRANSCRIPT_CACHE_DIR, `${videoId}_meta.json`),
				JSON.stringify(meta, null, '\t')
			)

			const manifest = loadManifest(videoId)
			const info = [
				`Title: ${title}`,
				`Channel: ${channel}`,
				`Video ID: ${videoId}`,
				'Strategy: direct (Gemini fetches the YouTube URL server-side)'
			]

			if (manifest)
				info.push(isTranscriptComplete(videoId, manifest) ? 'Transcript: cached — complete' : 'Transcript: cached (partial)')
			else {
				const standalone = getCachedTranscript(videoId)
				info.push(standalone ? 'Transcript: cached' : 'Transcript: none')
			}

			info.push('Next: call transcribe_video with the YouTube URL')

			return { content: [{ type: 'text' as const, text: info.join('\n') }] }
		}
		catch (error) {
			return {
				content: [{ type: 'text' as const, text: `Error: ${detailedError(error)}` }],
				isError: true
			}
		}
	}
)

server.registerTool(
	'transcribe_video',
	{
		description: [
			'Transcribes a YouTube video via Gemini and returns the transcript.',
			'Gemini fetches the public URL server-side — no download, so a datacenter/WSL IP',
			'never hits YouTube\'s bot check. Transcribes in one shot; if the output limit is',
			'hit on a very long video, automatically falls back to Gemini server-side range',
			'chunking (no download) and stitches the windows.',
			'Optional startSeconds/endSeconds transcribe a specific range (clipped server-side).',
			'Uses cached transcripts when available.',
			'If every Gemini model is unavailable, transcription stops and reports it.'
		].join(' '),
		inputSchema: {
			url: z.string().describe('YouTube video URL or video ID'),
			startSeconds: z.number().int().min(0).optional().describe('Start of range to transcribe (seconds). Omit for start of video.'),
			endSeconds: z.number().int().min(1).optional().describe('End of range to transcribe (seconds). Omit for end of video.')
		}
	},
	async ({ url, startSeconds, endSeconds }, extra) => {
		// Out-of-band progress reporting. If the client sent a progressToken in
		// _meta, each notification resets its response timeout AND gives it live
		// feedback to render. Without a token we silently no-op.
		const progressToken = extra?._meta?.progressToken as string | number | undefined
		const sendProgress = async (progress: number, total: number | undefined, message: string) => {
			if (progressToken == undefined) return
			try {
				await extra.sendNotification({
					method: 'notifications/progress',
					params: { progressToken, progress, total, message }
				})
			}
			catch {}
		}

		try {
			if (!apiKey)
				throw new Error('GEMINI_API_KEY environment variable is required')

			const videoId = extractVideoId(url)
			const watchUrl = `https://www.youtube.com/watch?v=${videoId}`

			// ── Explicit range request: single server-side clipped call ──
			if (startSeconds != undefined || endSeconds != undefined) {
				const cacheKey = `${videoId}_${startSeconds ?? 0}-${endSeconds ?? 'end'}`
				const cached = getCachedTranscript(cacheKey)
				if (cached)
					return { content: [{ type: 'text' as const, text: cached }] }

				const label = `[${formatMmSs(startSeconds ?? 0)}-${endSeconds != undefined ? formatMmSs(endSeconds) : 'end'}]`
				await sendProgress(0, 1, `Transcribing ${videoId} ${label}`)

				const { text } = await transcribeWithGemini(watchUrl, startSeconds, endSeconds)
				saveCachedTranscript(cacheKey, text)

				await sendProgress(1, 1, `Transcribed ${videoId} ${label} (${text.length} chars)`)
				return { content: [{ type: 'text' as const, text }] }
			}

			// ── Full video: cache hit ──
			const cached = getCachedTranscript(videoId)
			if (cached)
				return { content: [{ type: 'text' as const, text: cached }] }

			// ── Full video: one-shot direct-URL transcription ──
			await sendProgress(0, 1, `Transcribing ${videoId} via direct YouTube URL`)
			const first = await transcribeWithGemini(watchUrl)

			let fullText = first.text
			const model = first.model

			// Output limit hit → fall back to Gemini server-side range chunking (no download).
			// The one-shot output is discarded and the video is re-transcribed in clean
			// windows so chunk boundaries line up instead of inheriting a truncated tail.
			if (first.finishReason == 'MAX_TOKENS') {
				await sendProgress(0, undefined, 'Output limit hit — switching to chunked transcription via Gemini ranges')
				dlog('transcribe', 'truncated-one-shot', { videoId, oneShotChars: first.text.length })
				fullText = await chunkedTranscribe(videoId, watchUrl, sendProgress)
			}

			saveCachedTranscript(videoId, fullText)

			// Manifest: one ok segment spanning the (estimated) whole video, for
			// list_transcripts + kwiki provenance. Duration is estimated from the
			// transcript's timestamps since there's no yt-dlp metadata source.
			const estDuration = estimateDurationFromTranscript(fullText)
			let manifest = loadManifest(videoId)
			if (!manifest)
				manifest = { videoId, duration: estDuration, segments: [{ index: 0, start: 0, end: estDuration, status: 'ok' }] }
			else {
				manifest.duration = estDuration
				manifest.segments = [{ index: 0, start: 0, end: estDuration, status: 'ok' }]
			}
			manifest.source = `gemini:${model}`
			enrichManifestFromMeta(manifest)
			saveManifest(manifest)

			await sendProgress(1, 1, `Transcribed ${videoId} (${fullText.length} chars)`)
			return { content: [{ type: 'text' as const, text: fullText }] }
		}
		catch (error) {
			// Gemini down = /yt down. Say so plainly and stop — no captions fallback.
			if (isGeminiUnavailable(error))
				return {
					content: [{ type: 'text' as const, text: 'Gemini is currently unavailable — every model returned UNAVAILABLE/503. Transcription cannot proceed right now; try again later.' }],
					isError: true
				}
			return {
				content: [{ type: 'text' as const, text: `Error: ${detailedError(error)}` }],
				isError: true
			}
		}
	}
)

server.registerTool(
	'delete_transcript',
	{
		description: [
			'Deletes cached transcript data for a video so the next transcribe_video call redoes the work.',
			'Removes the transcript files and manifest. Keeps _meta.json unless includeMeta is true.',
			'Use this when you want to force re-transcription (e.g. after changing prompts or testing).'
		].join(' '),
		inputSchema: {
			url: z.string().describe('YouTube video URL or video ID'),
			includeMeta: z.boolean().optional().describe('Also delete the cached metadata (_meta.json). Default: false.')
		}
	},
	async ({ url, includeMeta }) => {
		try {
			const videoId = extractVideoId(url)
			const removed: string[] = []

			const tryRemove = (p: string) => {
				if (!fs.existsSync(p)) return
				const stat = fs.statSync(p)
				if (stat.isDirectory())
					fs.rmSync(p, { recursive: true, force: true })
				else
					fs.unlinkSync(p)
				removed.push(path.basename(p))
			}

			// Transcript files for this video: {id}.txt, {id}_*.txt, {id}_manifest.json
			if (fs.existsSync(TRANSCRIPT_CACHE_DIR)) {
				for (const f of fs.readdirSync(TRANSCRIPT_CACHE_DIR)) {
					if (!f.startsWith(videoId)) continue
					if (f == `${videoId}_meta.json` && !includeMeta) continue
					tryRemove(path.join(TRANSCRIPT_CACHE_DIR, f))
				}
			}

			if (removed.length == 0)
				return { content: [{ type: 'text' as const, text: `Nothing to delete for ${videoId}` }] }

			return { content: [{ type: 'text' as const, text: `Deleted ${removed.length} item(s) for ${videoId}:\n${removed.map(r => `  ${r}`).join('\n')}` }] }
		}
		catch (error) {
			return {
				content: [{ type: 'text' as const, text: `Error: ${detailedError(error)}` }],
				isError: true
			}
		}
	}
)

server.registerTool(
	'list_transcripts',
	{
		description: [
			'Lists all cached videos and their transcription status.',
			'Shows each video ID, title, channel, and transcript file.',
			'Use this to see what data is available before requesting a transcription.'
		].join(' '),
		inputSchema: {}
	},
	async () => {
		try {
			const lines: string[] = []

			// Every transcribed video has a manifest. Single loop, one entry per manifest.
			const manifests = loadAllManifests()
			for (const manifest of manifests) {
				const complete = isTranscriptComplete(manifest.videoId, manifest)

				// Fall back to reading _meta.json on the fly for any field not yet on
				// the manifest — backward compat for manifests written before metadata
				// enrichment landed.
				const title = manifest.title ?? loadMeta(manifest.videoId)?.title
				const channel = manifest.channel ?? loadMeta(manifest.videoId)?.channel
				const uploadDate = manifest.uploadDate ?? loadMeta(manifest.videoId)?.uploadDate

				// Line 1: Title (or video id fallback)
				lines.push(title ?? manifest.videoId)

				// Line 2: channel · date · length · videoId
				const parts2: string[] = []
				if (channel) parts2.push(channel)
				const dateStr = formatUploadDate(uploadDate)
				if (dateStr) parts2.push(dateStr)
				if (manifest.duration > 0) parts2.push(`${Math.round(manifest.duration / 60)}min`)
				parts2.push(manifest.videoId)
				lines.push(`  ${parts2.join(' · ')}`)

				// Line 3: source · status
				const parts3: string[] = []
				if (manifest.source) parts3.push(manifest.source)
				parts3.push(complete ? 'complete' : 'partial')
				lines.push(`  ${parts3.join(' · ')}`)

				// Transcript files (indented, with sizes)
				const runs = findContiguousRuns(manifest)
				for (const run of runs) {
					const p = getStitchedPath(manifest.videoId, run.start, run.end, manifest.duration)
					if (fs.existsSync(p)) {
						const size = Math.round(fs.statSync(p).size / 1024)
						const name = path.basename(p)
						lines.push(`  └─ ${name} (${size}KB)`)
					}
				}

				lines.push('')
			}

			if (lines.length == 0)
				return { content: [{ type: 'text' as const, text: 'No cached transcripts.' }] }

			return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
		}
		catch (error) {
			return {
				content: [{ type: 'text' as const, text: `Error: ${detailedError(error)}` }],
				isError: true
			}
		}
	}
)

async function main() {
	const transport = new StdioServerTransport()
	await server.connect(transport)
}

main().catch(console.error)
