#!/usr/bin/env node

import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { GoogleGenAI, ApiError, FileState } from '@google/genai'
import { findProjectRoot } from '@mcp-local/shared'
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

// Videos shorter than this use the direct YouTube URL approach (faster, no download)
// Videos longer than this get downloaded, split into segments, and uploaded via Files API
const DIRECT_URL_MAX_SECONDS = 1200

// Exponential probing: start at 60s, double on success, back off on failure
const INITIAL_SEGMENT_SECONDS = 60

// Per-segment upload timeout — if upload + processing exceeds this, the segment is too big
const SEGMENT_UPLOAD_TIMEOUT_MS = 180_000

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

function resolveOutputDir(cwd?: string): string {
	if (cwd) {
		const projectRoot = findProjectRoot(cwd)
		if (projectRoot)
			return path.join(projectRoot, 'images/nano-banana')
	}
	const configured = process.env.NB_OUTPUT_DIR
	if (configured)
		return configured.replace(/^~/, os.homedir())
	return path.join(os.homedir(), '.claude', 'images', 'nano-banana')
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

function formatSecondsAsHMS(seconds: number): string {
	const h = Math.floor(seconds / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	const s = seconds % 60
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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

function hasTranscriptForVideo(videoId: string): boolean {
	if (!fs.existsSync(TRANSCRIPT_CACHE_DIR))
		return false
	return fs.readdirSync(TRANSCRIPT_CACHE_DIR).some(f => f.startsWith(videoId) && f.endsWith('.txt'))
}

function cleanVideoCache(): void {
	if (!fs.existsSync(VIDEO_CACHE_DIR))
		return

	const entries = fs.readdirSync(VIDEO_CACHE_DIR, { withFileTypes: true })

	// Collect all video files and segment directories
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

	// Phase 1: delete any video files that have cached transcripts
	const remaining: typeof videoFiles = []
	for (const vf of videoFiles) {
		const id = path.basename(vf.path).replace('.mp4', '')
		if (hasTranscriptForVideo(id)) {
			if (fs.statSync(vf.path).isDirectory())
				fs.rmSync(vf.path, { recursive: true })
			else
				fs.unlinkSync(vf.path)
		}
		else
			remaining.push(vf)
	}

	// Phase 2: if still over limit, evict oldest first
	let totalSize = remaining.reduce((sum, vf) => sum + vf.size, 0)
	if (totalSize <= VIDEO_CACHE_MAX_BYTES)
		return

	remaining.sort((a, b) => a.mtime - b.mtime)
	for (const vf of remaining) {
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
			cwd: z.string().optional().describe(
				'Caller\'s working directory — used to locate the project root. Pass this when calling from CC.')
		}
	},
	async ({ prompt, resolution, aspectRatio, count, model, cwd }) => {
		try {
			if (!apiKey)
				throw new Error('GEMINI_API_KEY environment variable is required')

			const resolvedModel = MODEL_ALIASES[model]

			const saveDir = resolveOutputDir(cwd)
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
// Workflow for extracting data from YouTube videos:
//
//   1. get_video_info    → fetch metadata (duration, title, strategy)        ~2s
//   2. download_video    → download + compress (only for long videos)        ~2-4min
//   3. upload_video      → exponential-probe segments, upload to Gemini      ~1-4min
//   4. transcribe_video  → transcribe (direct URL or segment URIs)           ~30-60s per segment
//
// Short videos (≤20min): step 1 → step 4 (pass YouTube URL directly)
// Long videos (>20min):  step 1 → 2 → 3 → 4 (download, probe+upload, transcribe segments)
// Timeframe: pass startSeconds/endSeconds to download_video to extract a section
// Transcript caching: transcripts are cached in cache/transcripts/ to avoid re-transcribing
// Video cache cleanup: runs in get_video_info and after transcription —
//   deletes transcribed videos immediately, evicts oldest if over 500MB
//
// Upload probing: upload_video uses exponential segment sizing — starts at 60s,
// doubles on success (60→120→240→...), backs off to last successful size on failure.
// Self-tunes to the caller's timeout constraints without hardcoding assumptions.

server.registerTool(
	'get_video_info',
	{
		description: [
			'Step 1 of the video workflow. Fetches YouTube video metadata without downloading.',
			'Returns duration, title, and the recommended strategy (direct or upload).',
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
			const strategy = duration <= DIRECT_URL_MAX_SECONDS ? 'direct' : 'upload'

			const cached = fs.existsSync(VIDEO_CACHE_DIR)
				&& fs.readdirSync(VIDEO_CACHE_DIR).some(f => f == `${videoId}.mp4`)

			const info = [
				`Title: ${title}`,
				`Duration: ${durationMin}min (${duration}s)`,
				`Video ID: ${videoId}`,
				`Strategy: ${strategy}`,
				cached ? 'Cache: compressed video already downloaded' : 'Cache: not cached'
			]

			if (strategy == 'direct')
				info.push('Next step: call transcribe_video with the YouTube URL directly')
			else {
				info.push('Upload uses exponential probing (starts 60s, doubles on success)')
				info.push('Next step: call download_video (with optional startSeconds/endSeconds to extract a section), then upload_video, then transcribe_video for each segment')
			}

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
			'Step 2 of the video workflow (long videos only).',
			'Downloads a YouTube video and compresses it for upload to Gemini.',
			'Only needed when get_video_info returns strategy "upload".',
			'Supports optional startSeconds/endSeconds to download only a section of the video.',
			'Skips download if a cached compressed version exists.',
			'Takes ~2-4 minutes for full videos, much faster for short sections.'
		].join(' '),
		inputSchema: {
			url: z.string().describe('YouTube video URL or video ID'),
			startSeconds: z.number().int().min(0).optional().describe('Start time in seconds for partial download (e.g. 2700 for 45:00). Omit for full video.'),
			endSeconds: z.number().int().min(1).optional().describe('End time in seconds for partial download (e.g. 3600 for 1:00:00). Omit for full video.')
		}
	},
	async ({ url, startSeconds, endSeconds }) => {
		try {
			const videoId = extractVideoId(url)
			fs.mkdirSync(VIDEO_CACHE_DIR, { recursive: true })

			const hasTimeframe = startSeconds != undefined || endSeconds != undefined
			const cacheKey = hasTimeframe
				? `${videoId}_${startSeconds ?? 0}-${endSeconds ?? 'end'}`
				: videoId
			const compressedPath = path.join(VIDEO_CACHE_DIR, `${cacheKey}.mp4`)

			if (fs.existsSync(compressedPath)) {
				const sizeMB = Math.round(fs.statSync(compressedPath).size / 1024 / 1024)
				return { content: [{ type: 'text' as const, text: `Cached: ${compressedPath} (${sizeMB}MB)\nNext step: call upload_video with url="${cacheKey}"` }] }
			}

			const rawPath = path.join(VIDEO_CACHE_DIR, `${cacheKey}_raw.mp4`)

			const ytdlpArgs = [
				'-f', 'worst[ext=mp4]/worst',
				'--no-playlist',
				'-o', rawPath
			]

			if (hasTimeframe) {
				const start = formatSecondsAsHMS(startSeconds ?? 0)
				const end = endSeconds != undefined ? formatSecondsAsHMS(endSeconds) : 'inf'
				ytdlpArgs.push('--download-sections', `*${start}-${end}`)
				ytdlpArgs.push('--force-keyframes-at-cuts')
			}

			ytdlpArgs.push(`https://www.youtube.com/watch?v=${videoId}`)

			execFileSync(YT_DLP, ytdlpArgs, { timeout: 300_000 })

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
			const timeframeNote = hasTimeframe
				? ` (section ${formatSecondsAsHMS(startSeconds ?? 0)} → ${endSeconds != undefined ? formatSecondsAsHMS(endSeconds) : 'end'})`
				: ''
			return { content: [{ type: 'text' as const, text: `Downloaded${timeframeNote} (${rawSize}MB) → compressed to ${compressedSize}MB\nSaved: ${compressedPath}\nNext step: call upload_video with url="${cacheKey}"` }] }
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
	'upload_video',
	{
		description: [
			'Step 3 of the video workflow (long videos only).',
			'Uploads a downloaded video to Gemini Files API using exponential segment probing.',
			'Starts with 60s segments, doubles on success (60→120→240→...), backs off on failure.',
			'Self-tunes to the caller\'s timeout constraints — works from CD, CC, or anywhere else.',
			'Call download_video first. Returns Gemini file URIs and cache keys for each segment.',
			'Call transcribe_video once for each segment URI, passing the cacheKey to enable transcript caching.'
		].join(' '),
		inputSchema: {
			url: z.string().describe('YouTube video URL or video ID (must have been downloaded first)')
		}
	},
	async ({ url }) => {
		try {
			const videoId = extractVideoId(url)
			const filePath = path.join(VIDEO_CACHE_DIR, `${videoId}.mp4`)

			if (!fs.existsSync(filePath))
				throw new Error(`No cached video found for ${videoId}. Call download_video first.`)

			// Get duration of compressed file
			const durationStr = execFileSync('ffprobe', [
				'-v', 'error',
				'-show_entries', 'format=duration',
				'-of', 'default=noprint_wrappers=1:nokey=1',
				filePath
			], { timeout: 10_000 }).toString().trim()
			const duration = parseFloat(durationStr) || 0

			// If short enough for a single upload, skip segmenting
			if (duration <= INITIAL_SEGMENT_SECONDS + 30) {
				const uri = await uploadAndWaitForFile(filePath, SEGMENT_UPLOAD_TIMEOUT_MS)
				const sizeMB = Math.round(fs.statSync(filePath).size / 1024 / 1024)
				const cacheKey = `${videoId}_seg0`
				return { content: [{ type: 'text' as const, text: `Uploaded ${sizeMB}MB (1 segment)\nSegment 1 [0:00]: ${uri} (cacheKey: ${cacheKey})\n\nCall transcribe_video once with this URI and cacheKey.` }] }
			}

			// Exponential probing: start small, double on success, back off on failure
			const segmentDir = path.join(VIDEO_CACHE_DIR, videoId)
			fs.mkdirSync(segmentDir, { recursive: true })

			let segmentSeconds = INITIAL_SEGMENT_SECONDS
			let lastSuccessSize = 0
			let position = 0
			let segIndex = 0
			let consecutiveFailures = 0
			const results: string[] = []

			while (position < duration) {
				const remaining = duration - position
				const chunkDuration = Math.min(segmentSeconds, remaining)

				// Cut this segment from the source video
				const segPath = path.join(segmentDir, `seg_${String(segIndex).padStart(3, '0')}.mp4`)
				execFileSync('ffmpeg', [
					'-ss', String(position),
					'-i', filePath,
					'-t', String(chunkDuration),
					'-c', 'copy',
					'-y',
					segPath
				], { timeout: 30_000 })

				try {
					const uri = await uploadAndWaitForFile(segPath, SEGMENT_UPLOAD_TIMEOUT_MS)
					const cacheKey = `${videoId}_seg${segIndex}`
					const offsetMin = Math.floor(position / 60)
					const offsetSec = Math.round(position % 60)
					results.push(`Segment ${segIndex + 1} [${offsetMin}:${String(offsetSec).padStart(2, '0')}]: ${uri} (cacheKey: ${cacheKey})`)

					lastSuccessSize = segmentSeconds
					position += chunkDuration
					segIndex++
					consecutiveFailures = 0

					// Double for next segment if this wasn't a tail chunk
					if (chunkDuration == segmentSeconds)
						segmentSeconds *= 2
				}
				catch (err) {
					// Clean up the failed segment file
					if (fs.existsSync(segPath))
						fs.unlinkSync(segPath)

					consecutiveFailures++

					if (lastSuccessSize == 0)
						throw new Error(`Failed to upload a ${INITIAL_SEGMENT_SECONDS}s segment — cannot proceed`)

					if (consecutiveFailures >= 2)
						throw new Error(`Upload failed twice at ${segmentSeconds}s segments after backoff — cannot proceed`)

					// Back off to last successful size for all remaining segments
					segmentSeconds = lastSuccessSize
				}
			}

			const output = [
				`Uploaded ${results.length} segments (probed to ${lastSuccessSize}s max segment size)`,
				'',
				...results,
				'',
				'Call transcribe_video once for EACH segment URI above, in order.',
				'Pass the segment URI as the url parameter and the cacheKey to enable transcript caching.'
			]

			return { content: [{ type: 'text' as const, text: output.join('\n') }] }
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
			'Step 4 (final step) of the video workflow.',
			'Extracts raw transcript and visual data from a video using Gemini.',
			'Returns verbatim transcript with timestamps and on-screen text descriptions.',
			'Gemini does extraction only — Claude should do all analysis and summarization.',
			'For short videos (≤20min): pass the YouTube URL directly.',
			'For long videos: call once per segment URI returned by upload_video.',
			'Pass cacheKey from upload_video to enable transcript caching (skips Gemini on repeat calls).',
			'IMPORTANT: Always call get_video_info first to determine the right approach.',
			'Takes ~30-60 seconds per call (instant if cached).'
		].join(' '),
		inputSchema: {
			url: z.string().describe('YouTube video URL, video ID, or a single Gemini file URI from upload_video'),
			offsetSeconds: z.number().optional().default(0).describe('Start offset in seconds for this segment (used to adjust timestamps). Default 0.'),
			cacheKey: z.string().optional().describe('Cache key from upload_video (e.g. "5L3dm7KBCmY_seg0"). When provided, transcript is cached and reused on repeat calls.')
		}
	},
	async ({ url, offsetSeconds, cacheKey }) => {
		try {
			if (!apiKey)
				throw new Error('GEMINI_API_KEY environment variable is required')

			// Derive cache key for direct YouTube URL calls
			const effectiveCacheKey = cacheKey
				?? (!url.startsWith('https://generativelanguage.googleapis.com/') ? extractVideoId(url) : undefined)

			// Check transcript cache
			if (effectiveCacheKey) {
				const cached = getCachedTranscript(effectiveCacheKey)
				if (cached)
					return { content: [{ type: 'text' as const, text: `[cached transcript]\n${cached}` }] }
			}

			const isFileUri = url.startsWith('https://generativelanguage.googleapis.com/')

			let mimeType: string
			let fileUri: string
			if (isFileUri) {
				mimeType = 'video/mp4'
				fileUri = url
			}
			else {
				const videoId = extractVideoId(url)
				mimeType = 'video/*'
				fileUri = `https://www.youtube.com/watch?v=${videoId}`
			}

			const text = await transcribeWithGemini(mimeType, fileUri, offsetSeconds)

			// Save to transcript cache, then clean up video files
			if (effectiveCacheKey) {
				saveCachedTranscript(effectiveCacheKey, text)
				cleanVideoCache()
			}

			return { content: [{ type: 'text' as const, text }] }
		}
		catch (error) {
			const detail = detailedError(error)
			return {
				content: [{ type: 'text' as const, text: detail }],
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
