#!/usr/bin/env node

import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { GoogleGenAI, ApiError, FileState } from '@google/genai'

import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn, execSync, execFileSync } from 'child_process'

const MODEL_ALIASES: Record<string, string> = {
	nb2: 'gemini-3.1-flash-image-preview',
	pro: 'gemini-3-pro-image-preview'
}

const DEFAULT_MODEL = 'nb2'

const apiKey = process.env.GEMINI_API_KEY ?? ''
const ai = new GoogleGenAI({ apiKey })

const VIDEO_CACHE_DIR = path.join(os.homedir(), '.claude', 'mcp-servers', 'google-ai-mcp', 'cache')
const TRANSCRIPT_CACHE_DIR = path.join(VIDEO_CACHE_DIR, 'transcripts')

// Max video cache size in bytes — videos beyond this get evicted oldest-first
const VIDEO_CACHE_MAX_BYTES = 500 * 1024 * 1024

// Prefer /usr/local/bin/yt-dlp (manually updated) over apt version which goes stale
const YT_DLP = fs.existsSync('/usr/local/bin/yt-dlp') ? '/usr/local/bin/yt-dlp' : 'yt-dlp'

// Videos ≤10min: single direct Gemini call via YouTube URL (no download needed)
// Videos >10min: download, split into segments, upload each to Gemini
const DIRECT_URL_MAX_SECONDS = 600
const SEGMENT_SECONDS = 120   // 2-min default segments
const CANARY_SECONDS = 60     // 1-min fail-fast probe before committing to full segments

// Per-segment upload timeout — 2-min segment is ~2MB, well within this
const SEGMENT_UPLOAD_TIMEOUT_MS = 180_000

// Transcript quality gate: minimum chars per minute of video to accept a transcript.
// Healthy transcripts produce 600-1900 chars/min. Below this threshold the transcript
// is incomplete — retry, and if still bad, report failure for that segment.
const MIN_CHARS_PER_MINUTE = 200

// Max retries for a single segment transcription that fails quality gate
const MAX_TRANSCRIPT_RETRIES = 1

// Extraction model
const VIDEO_MODEL = 'gemini-2.5-flash'

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
// Each video gets a manifest: cache/transcripts/{videoId}_manifest.json
// The manifest records segment boundaries so we know what time ranges are
// covered by cached transcripts and what still needs work.

interface SegmentInfo {
	index: number
	start: number      // seconds from video start
	end: number        // seconds from video start
	status: 'ok' | 'failed'
}

interface VideoManifest {
	videoId: string
	duration: number   // total video duration in seconds
	segments: SegmentInfo[]
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

function loadAllManifests(): VideoManifest[] {
	if (!fs.existsSync(TRANSCRIPT_CACHE_DIR))
		return []
	return fs.readdirSync(TRANSCRIPT_CACHE_DIR)
		.filter(f => f.endsWith('_manifest.json'))
		.map(f => JSON.parse(fs.readFileSync(path.join(TRANSCRIPT_CACHE_DIR, f), 'utf-8')) as VideoManifest)
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
	fs.writeFileSync(path.join(TRANSCRIPT_CACHE_DIR, `${cacheKey}.txt`), text, 'utf-8')
}

function cleanVideoCache(): void {
	if (!fs.existsSync(VIDEO_CACHE_DIR))
		return

	const entries = fs.readdirSync(VIDEO_CACHE_DIR, { withFileTypes: true })

	const videoFiles: { path: string, size: number, mtime: number }[] = []

	for (const entry of entries) {
		if (entry.name == 'transcripts')
			continue

		const fullPath = path.join(VIDEO_CACHE_DIR, entry.name)

		if (entry.isDirectory()) {
			const dirFiles = fs.readdirSync(fullPath)
			let dirSize = 0
			for (const f of dirFiles)
				dirSize += fs.statSync(path.join(fullPath, f)).size
			const stat = fs.statSync(fullPath)
			videoFiles.push({ path: fullPath, size: dirSize, mtime: stat.mtimeMs })
		}
		else if (entry.name.endsWith('.mp4')) {
			const stat = fs.statSync(fullPath)
			videoFiles.push({ path: fullPath, size: stat.size, mtime: stat.mtimeMs })
		}
	}

	// Size-based eviction only — evict oldest videos when over 500MB.
	// We no longer auto-delete videos that have transcripts, because partial
	// transcription means the video may still be needed for retrying failed segments.
	let totalSize = videoFiles.reduce((sum, vf) => sum + vf.size, 0)
	if (totalSize <= VIDEO_CACHE_MAX_BYTES)
		return

	videoFiles.sort((a, b) => a.mtime - b.mtime)
	for (const vf of videoFiles) {
		if (totalSize <= VIDEO_CACHE_MAX_BYTES)
			break
		if (fs.statSync(vf.path).isDirectory())
			fs.rmSync(vf.path, { recursive: true })
		else
			fs.unlinkSync(vf.path)
		totalSize -= vf.size
	}
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

// ─── Gemini API helpers ─────────────────────────────────────────────────────

async function uploadAndWaitForFile(filePath: string, timeoutMs: number = 300_000): Promise<string> {
	let file = await ai.files.upload({
		file: filePath,
		config: { mimeType: 'video/mp4' }
	})

	const deadline = Date.now() + timeoutMs

	while (file.state == FileState.PROCESSING) {
		if (Date.now() > deadline)
			throw new Error(`Upload processing exceeded ${Math.round(timeoutMs / 1000)}s timeout`)
		await new Promise(r => setTimeout(r, 3000))
		file = await ai.files.get({ name: file.name! })
	}

	if (file.state == FileState.FAILED)
		throw new Error(`Gemini file processing failed: ${JSON.stringify(file.error)}`)

	if (!file.uri)
		throw new Error('Gemini file has no URI after processing')

	return file.uri
}

async function transcribeWithGemini(mimeType: string, fileUri: string, offsetSeconds: number): Promise<string> {
	const prompt = offsetSeconds > 0
		? `${EXTRACTION_PROMPT}\n\nNote: this is a segment starting at ${Math.floor(offsetSeconds / 60)}:${String(offsetSeconds % 60).padStart(2, '0')} in the original video. Adjust timestamps accordingly.`
		: EXTRACTION_PROMPT

	const stream = await ai.models.generateContentStream({
		model: VIDEO_MODEL,
		contents: [
			{
				parts: [
					{ fileData: { mimeType, fileUri } },
					{ text: prompt }
				]
			}
		],
		config: {
			httpOptions: { timeout: 300_000 }
		}
	})

	const chunks: string[] = []
	for await (const chunk of stream) {
		const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text
		if (text)
			chunks.push(text)
	}

	return chunks.join('') || 'No response'
}

// ─── Video pipeline internals ───────────────────────────────────────────────
//
// transcribe_video is the single orchestrating tool. Internally it:
//   1. Checks what segment transcripts are already cached (via manifest)
//   2. For any gaps in the requested range: splits from cached video, uploads, transcribes
//   3. Quality-gates each segment — retries once if too thin, marks failed if still bad
//   4. On first uncached segment, runs a 1-min canary to fail fast
//   5. Stitches all segment transcripts covering the requested range
//   6. Returns the assembled transcript or reports what failed
//
// The caller just asks for a video (or range) and gets a transcript back.
// Internally we do as little work as possible — use cached transcripts first,
// use cached video for retries, only download/upload what's missing.

function getVideoDuration(filePath: string): number {
	const durationStr = execFileSync('ffprobe', [
		'-v', 'error',
		'-show_entries', 'format=duration',
		'-of', 'default=noprint_wrappers=1:nokey=1',
		filePath
	], { timeout: 10_000 }).toString().trim()
	return parseFloat(durationStr) || 0
}

function cutSegment(sourcePath: string, start: number, duration: number, outputPath: string): void {
	execFileSync('ffmpeg', [
		'-ss', String(start),
		'-i', sourcePath,
		'-t', String(duration),
		'-c', 'copy',
		'-y',
		outputPath
	], { timeout: 30_000 })
}

async function uploadAndTranscribeSegment(
	videoId: string,
	segIndex: number,
	seg: SegmentInfo,
	videoPath: string
): Promise<{ text: string, ok: boolean }> {
	const segmentDir = path.join(VIDEO_CACHE_DIR, videoId)
	fs.mkdirSync(segmentDir, { recursive: true })

	const segPath = path.join(segmentDir, `seg_${String(segIndex).padStart(3, '0')}.mp4`)
	const cacheKey = `${videoId}_seg${segIndex}`
	const durationMinutes = (seg.end - seg.start) / 60

	for (let attempt = 0; attempt <= MAX_TRANSCRIPT_RETRIES; attempt++) {
		cutSegment(videoPath, seg.start, seg.end - seg.start, segPath)
		const uri = await uploadAndWaitForFile(segPath, SEGMENT_UPLOAD_TIMEOUT_MS)
		const text = await transcribeWithGemini('video/mp4', uri, seg.start)

		const charsPerMin = text.length / durationMinutes
		if (charsPerMin >= MIN_CHARS_PER_MINUTE) {
			saveCachedTranscript(cacheKey, text)
			// Clean up segment file after successful transcription
			if (fs.existsSync(segPath))
				fs.unlinkSync(segPath)
			return { text, ok: true }
		}

		// Quality gate failed — retry or give up
		if (attempt < MAX_TRANSCRIPT_RETRIES)
			continue

		// Final attempt still bad — don't cache, keep video for future retry
		return { text, ok: false }
	}

	// Unreachable, but TypeScript needs it
	return { text: '', ok: false }
}

// planSegments: first segment is a 1-min canary, rest are 2-min segments.
// Segments are just time ranges — any length, all stitched together on delivery.
function planSegments(startSeconds: number, endSeconds: number): SegmentInfo[] {
	const segments: SegmentInfo[] = []
	let position = startSeconds
	let index = 0
	let isFirst = true

	while (position < endSeconds) {
		const remaining = endSeconds - position
		const targetDuration = isFirst ? CANARY_SECONDS : SEGMENT_SECONDS
		const chunkDuration = Math.min(targetDuration, remaining)
		segments.push({
			index,
			start: Math.round(position),
			end: Math.round(position + chunkDuration),
			status: 'ok'
		})
		position += chunkDuration
		index++
		isFirst = false
	}

	return segments
}

// insertCanary: when we hit the first uncached segment on retry, split it so
// the first piece is a 1-min canary. Reshapes the manifest from that point.
function insertCanary(manifest: VideoManifest, segIndex: number): void {
	const seg = manifest.segments[segIndex]
	const segDuration = seg.end - seg.start

	// Only split if the segment is longer than the canary
	if (segDuration <= CANARY_SECONDS)
		return

	const canary: SegmentInfo = {
		index: seg.index,
		start: seg.start,
		end: seg.start + CANARY_SECONDS,
		status: 'ok'
	}

	// Shrink the original segment to start after the canary
	seg.start = canary.end

	// Insert canary before the shrunken segment
	manifest.segments.splice(segIndex, 0, canary)

	// Re-index all segments from the insertion point
	for (let i = segIndex; i < manifest.segments.length; i++)
		manifest.segments[i].index = i
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
//   1. get_video_info     → lightweight metadata check                         ~2s
//   2. download_video     → download + compress (separate because it's slow)   ~2-4min
//   3. transcribe_video   → orchestrates segmenting, uploading, transcribing,
//                           quality-gates, retries, caching, and stitching
//   4. list_transcripts   → shows all cached videos and their segment coverage
//
// Short videos (≤10min): get_video_info → transcribe_video (YouTube URL directly)
// Long videos (>10min):  get_video_info → download_video → transcribe_video
//
// Long videos are split into segments: a 1-min canary first, then 2-min segments.
// The canary provides fail-fast behavior — if the first minute can't be transcribed,
// we stop immediately instead of making the user wait. On retry, a new canary is
// inserted at the first uncached segment to re-test before committing.

server.registerTool(
	'get_video_info',
	{
		description: [
			'Fetches YouTube video metadata without downloading.',
			'Returns duration, title, and the recommended strategy (direct or download+transcribe).',
			'ALWAYS call this first before transcribe_video to determine the right approach.',
			'Takes ~2 seconds.'
		].join(' '),
		inputSchema: {
			url: z.string().describe('YouTube video URL or video ID')
		}
	},
	async ({ url }) => {
		try {
			cleanVideoCache()

			const videoId = extractVideoId(url)
			const output = execFileSync(YT_DLP, [
				'--print', '%(duration)s\n%(title)s',
				'--no-download',
				`https://www.youtube.com/watch?v=${videoId}`
			], { timeout: 30_000 }).toString().trim()

			const lines = output.split('\n')
			const duration = parseInt(lines[0], 10) || 0
			const title = lines.slice(1).join('\n').trim() || 'Unknown'
			const durationMin = Math.round(duration / 60)
			const strategy = duration <= DIRECT_URL_MAX_SECONDS ? 'direct' : 'download'

			const videoPath = path.join(VIDEO_CACHE_DIR, `${videoId}.mp4`)
			const hasVideo = fs.existsSync(videoPath)
			const manifest = loadManifest(videoId)
			const cachedSegments = manifest
				? manifest.segments.filter(s => getCachedTranscript(`${videoId}_seg${s.index}`) != null).length
				: 0
			const failedSegments = manifest
				? manifest.segments.filter(s => s.status == 'failed').length
				: 0
			const totalSegments = manifest ? manifest.segments.length : 0

			const info = [
				`Title: ${title}`,
				`Duration: ${durationMin}min (${duration}s)`,
				`Video ID: ${videoId}`,
				`Strategy: ${strategy}`,
				hasVideo ? 'Video cache: downloaded' : 'Video cache: not cached'
			]

			if (manifest) {
				let cacheStatus = `Transcript cache: ${cachedSegments}/${totalSegments} segments`
				if (failedSegments > 0)
					cacheStatus += ` (${failedSegments} failed)`
				info.push(cacheStatus)
			}
			else
				info.push('Transcript cache: none')

			if (strategy == 'direct')
				info.push('Next: call transcribe_video with the YouTube URL directly')
			else if (hasVideo)
				info.push('Next: call transcribe_video (video already downloaded)')
			else
				info.push('Next: call download_video, then transcribe_video')

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
	'download_video',
	{
		description: [
			'Downloads a YouTube video and compresses it for transcription.',
			'Only needed when get_video_info returns strategy "download".',
			'Skips download if a cached compressed version exists.',
			'Takes ~2-4 minutes for full videos.'
		].join(' '),
		inputSchema: {
			url: z.string().describe('YouTube video URL or video ID')
		}
	},
	async ({ url }) => {
		try {
			const videoId = extractVideoId(url)
			fs.mkdirSync(VIDEO_CACHE_DIR, { recursive: true })

			const compressedPath = path.join(VIDEO_CACHE_DIR, `${videoId}.mp4`)

			if (fs.existsSync(compressedPath)) {
				const sizeMB = Math.round(fs.statSync(compressedPath).size / 1024 / 1024)
				return { content: [{ type: 'text' as const, text: `Cached: ${compressedPath} (${sizeMB}MB)\nNext: call transcribe_video` }] }
			}

			const rawPath = path.join(VIDEO_CACHE_DIR, `${videoId}_raw.mp4`)

			execFileSync(YT_DLP, [
				'-f', 'worst[ext=mp4]/worst',
				'--no-playlist',
				'-o', rawPath,
				`https://www.youtube.com/watch?v=${videoId}`
			], { timeout: 300_000 })

			const rawSize = Math.round(fs.statSync(rawPath).size / 1024 / 1024)

			execFileSync('ffmpeg', [
				'-i', rawPath,
				'-vf', 'scale=256:-2',
				'-b:v', '100k',
				'-b:a', '32k',
				'-ar', '22050',
				'-y',
				compressedPath
			], { timeout: 300_000 })

			fs.unlinkSync(rawPath)

			const compressedSize = Math.round(fs.statSync(compressedPath).size / 1024 / 1024)
			return { content: [{ type: 'text' as const, text: `Downloaded (${rawSize}MB) → compressed to ${compressedSize}MB\nSaved: ${compressedPath}\nNext: call transcribe_video` }] }
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
			'Transcribes a video and returns the assembled transcript.',
			'For short videos (≤10min): pass the YouTube URL directly — transcribes via Gemini in one shot.',
			'For long videos: requires download_video first. Splits into segments, uploads,',
			'transcribes, quality-validates, retries failures, caches, and stitches automatically.',
			'Uses a 1-min canary on the first uncached segment to fail fast before committing.',
			'Supports optional startSeconds/endSeconds to transcribe a specific range.',
			'Uses cached transcripts when available — only does work for missing/failed segments.',
			'ALWAYS call get_video_info first to determine the right approach.',
			'Returns the full assembled transcript or an error explaining what failed.'
		].join(' '),
		inputSchema: {
			url: z.string().describe('YouTube video URL or video ID'),
			startSeconds: z.number().int().min(0).optional().describe('Start of range to transcribe (seconds). Omit for start of video.'),
			endSeconds: z.number().int().min(1).optional().describe('End of range to transcribe (seconds). Omit for end of video.')
		}
	},
	async ({ url, startSeconds, endSeconds }) => {
		try {
			if (!apiKey)
				throw new Error('GEMINI_API_KEY environment variable is required')

			const videoId = extractVideoId(url)
			const videoPath = path.join(VIDEO_CACHE_DIR, `${videoId}.mp4`)

			// ── Short video: direct YouTube URL transcription ──────────
			const isShortOrDirect = !fs.existsSync(videoPath)
			if (isShortOrDirect) {
				const cacheKey = startSeconds || endSeconds
					? `${videoId}_${startSeconds ?? 0}-${endSeconds ?? 'end'}`
					: videoId

				const cached = getCachedTranscript(cacheKey)
				if (cached)
					return { content: [{ type: 'text' as const, text: cached }] }

				const text = await transcribeWithGemini(
					'video/*',
					`https://www.youtube.com/watch?v=${videoId}`,
					startSeconds ?? 0
				)

				saveCachedTranscript(cacheKey, text)
				return { content: [{ type: 'text' as const, text }] }
			}

			// ── Long video: segmented pipeline ────────────────────────
			const duration = getVideoDuration(videoPath)
			const rangeStart = startSeconds ?? 0
			const rangeEnd = endSeconds ?? Math.round(duration)

			// Load or create manifest
			let manifest = loadManifest(videoId)
			if (!manifest) {
				manifest = {
					videoId,
					duration,
					segments: planSegments(0, Math.round(duration))
				}
				saveManifest(manifest)
			}

			// Find segments that overlap the requested range
			const neededSegments = manifest.segments.filter(
				s => s.end > rangeStart && s.start < rangeEnd
			)

			if (neededSegments.length == 0)
				throw new Error(`No segments cover range ${rangeStart}-${rangeEnd}s (video is ${Math.round(duration)}s)`)

			// Process each needed segment: use cache, or upload+transcribe
			const transcriptParts: string[] = []
			const failures: string[] = []
			let canaryDone = false

			for (let i = 0; i < neededSegments.length; i++) {
				const seg = neededSegments[i]
				const cacheKey = `${videoId}_seg${seg.index}`

				// Check cache first
				const cached = getCachedTranscript(cacheKey)
				if (cached) {
					transcriptParts.push(cached)
					continue
				}

				// First uncached segment — insert canary if needed
				if (!canaryDone) {
					canaryDone = true

					// Find the position of this segment in the full manifest
					const manifestIdx = manifest.segments.findIndex(s => s.index == seg.index)
					if (manifestIdx >= 0 && (seg.end - seg.start) > CANARY_SECONDS) {
						// Split: insert canary, shrink original
						insertCanary(manifest, manifestIdx)
						saveManifest(manifest)

						// Re-query needed segments since manifest changed
						const updatedNeeded = manifest.segments.filter(
							s => s.end > rangeStart && s.start < rangeEnd
						)

						// Restart the loop with updated segments
						// Process canary (the newly inserted segment at manifestIdx)
						const canarySeg = manifest.segments[manifestIdx]
						const canaryKey = `${videoId}_seg${canarySeg.index}`

						try {
							const result = await uploadAndTranscribeSegment(videoId, canarySeg.index, canarySeg, videoPath)
							if (result.ok) {
								transcriptParts.push(result.text)
							}
							else {
								canarySeg.status = 'failed'
								saveManifest(manifest)
								return {
									content: [{ type: 'text' as const, text: `Canary failed — transcription not viable at [${formatMmSs(canarySeg.start)}-${formatMmSs(canarySeg.end)}]: ${result.text.length} chars for 1min (${Math.round(result.text.length / (CANARY_SECONDS / 60))} chars/min, need ${MIN_CHARS_PER_MINUTE})` }],
									isError: true
								}
							}
						}
						catch (err) {
							canarySeg.status = 'failed'
							saveManifest(manifest)
							return {
								content: [{ type: 'text' as const, text: `Canary failed at [${formatMmSs(canarySeg.start)}-${formatMmSs(canarySeg.end)}]: ${err instanceof Error ? err.message : String(err)}` }],
								isError: true
							}
						}

						saveManifest(manifest)

						// Continue with the remaining needed segments (skip canary, already processed)
						const remainingNeeded = updatedNeeded.filter(s => s.start >= canarySeg.end)
						for (const remSeg of remainingNeeded) {
							const remKey = `${videoId}_seg${remSeg.index}`
							const remCached = getCachedTranscript(remKey)
							if (remCached) {
								transcriptParts.push(remCached)
								continue
							}

							if (remSeg.status == 'failed')
								remSeg.status = 'ok'

							try {
								const result = await uploadAndTranscribeSegment(videoId, remSeg.index, remSeg, videoPath)
								if (result.ok) {
									transcriptParts.push(result.text)
								}
								else {
									remSeg.status = 'failed'
									failures.push(`Segment ${remSeg.index + 1} [${formatMmSs(remSeg.start)}-${formatMmSs(remSeg.end)}]: transcript too short (${result.text.length} chars for ${Math.round((remSeg.end - remSeg.start) / 60)}min)`)
								}
							}
							catch (err) {
								remSeg.status = 'failed'
								failures.push(`Segment ${remSeg.index + 1} [${formatMmSs(remSeg.start)}-${formatMmSs(remSeg.end)}]: ${err instanceof Error ? err.message : String(err)}`)
							}

							saveManifest(manifest)
						}

						// Done — break out of the original loop
						break
					}
				}

				// Normal segment processing (no canary needed — segment is small enough, or canary path not taken)
				if (seg.status == 'failed')
					seg.status = 'ok'

				try {
					const result = await uploadAndTranscribeSegment(videoId, seg.index, seg, videoPath)
					if (result.ok) {
						transcriptParts.push(result.text)
					}
					else {
						seg.status = 'failed'
						failures.push(`Segment ${seg.index + 1} [${formatMmSs(seg.start)}-${formatMmSs(seg.end)}]: transcript too short (${result.text.length} chars for ${Math.round((seg.end - seg.start) / 60)}min)`)
					}
				}
				catch (err) {
					seg.status = 'failed'
					failures.push(`Segment ${seg.index + 1} [${formatMmSs(seg.start)}-${formatMmSs(seg.end)}]: ${err instanceof Error ? err.message : String(err)}`)
				}

				saveManifest(manifest)
			}

			cleanVideoCache()

			// All or nothing: if any segment failed, report failure
			if (failures.length > 0) {
				const partial = transcriptParts.length > 0
					? `\n\nPartial transcript (${transcriptParts.length} segments succeeded):\n${transcriptParts.join('\n\n')}`
					: ''
				return {
					content: [{ type: 'text' as const, text: `Transcription incomplete — ${failures.length} segment(s) failed:\n${failures.join('\n')}${partial}` }],
					isError: true
				}
			}

			return { content: [{ type: 'text' as const, text: transcriptParts.join('\n\n') }] }
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
			'Shows each video ID, total duration, segment count, and per-segment coverage.',
			'Segments show their time range, status (cached/failed/pending), and size.',
			'Also lists any standalone (non-segmented) cached transcripts.',
			'Use this to see what data is available before requesting a transcription.'
		].join(' '),
		inputSchema: {}
	},
	async () => {
		try {
			const lines: string[] = []

			// Segmented videos (have manifests)
			const manifests = loadAllManifests()
			if (manifests.length > 0) {
				for (const manifest of manifests) {
					const videoPath = path.join(VIDEO_CACHE_DIR, `${manifest.videoId}.mp4`)
					const hasVideo = fs.existsSync(videoPath)
					const videoSize = hasVideo ? Math.round(fs.statSync(videoPath).size / 1024 / 1024) : 0

					lines.push(`${manifest.videoId} (${Math.round(manifest.duration / 60)}min, ${manifest.segments.length} segments)`)
					if (hasVideo)
						lines.push(`  Video: cached (${videoSize}MB)`)
					else
						lines.push('  Video: not cached')

					for (const seg of manifest.segments) {
						const cacheKey = `${manifest.videoId}_seg${seg.index}`
						const transcript = getCachedTranscript(cacheKey)
						const range = `${formatMmSs(seg.start)}-${formatMmSs(seg.end)}`
						const segDuration = seg.end - seg.start

						if (transcript) {
							const kb = Math.round(transcript.length / 1024)
							const charsPerMin = Math.round(transcript.length / (segDuration / 60))
							lines.push(`  seg${seg.index} [${range}] ${segDuration}s: cached (${kb}KB, ${charsPerMin} chars/min)`)
						}
						else if (seg.status == 'failed')
							lines.push(`  seg${seg.index} [${range}] ${segDuration}s: FAILED`)
						else
							lines.push(`  seg${seg.index} [${range}] ${segDuration}s: pending`)
					}

					lines.push('')
				}
			}

			// Standalone transcripts (no manifest — direct/short video transcriptions)
			if (fs.existsSync(TRANSCRIPT_CACHE_DIR)) {
				const allFiles = fs.readdirSync(TRANSCRIPT_CACHE_DIR)
				const manifestVideoIds = new Set(manifests.map(m => m.videoId))
				const standaloneFiles = allFiles.filter(f => {
					if (!f.endsWith('.txt')) return false
					for (const id of manifestVideoIds)
						if (f.startsWith(id)) return false
					return true
				})

				if (standaloneFiles.length > 0) {
					if (lines.length > 0)
						lines.push('───')
					lines.push('Standalone transcripts:')
					for (const f of standaloneFiles) {
						const fullPath = path.join(TRANSCRIPT_CACHE_DIR, f)
						const size = Math.round(fs.statSync(fullPath).size / 1024)
						const name = f.replace('.txt', '')
						lines.push(`  ${name} (${size}KB)`)
					}
				}
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
