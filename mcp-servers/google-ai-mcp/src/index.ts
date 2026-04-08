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
//
// Transcript files are stitched contiguous runs of ok segments:
//   - Full video complete:  {videoId}.txt
//   - Partial (gap):        {videoId}_HHMMSS-HHMMSS.txt  (one per contiguous run)

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

// ─── Stitched transcript files ──────────────────────────────────────────────

function formatHhmmss(seconds: number): string {
	const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
	const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
	const s = String(Math.round(seconds % 60)).padStart(2, '0')
	return `${h}${m}${s}`
}

// Get the path for a stitched transcript file covering a contiguous run
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

// Stitch segment transcripts into contiguous run files.
// Called after each successful segment transcription.
// Reads individual _segN.txt files, writes stitched files, removes segment files.
function stitchTranscript(videoId: string, manifest: VideoManifest): void {
	const runs = findContiguousRuns(manifest)

	// Remove any old stitched files for this video before writing new ones
	if (fs.existsSync(TRANSCRIPT_CACHE_DIR)) {
		const files = fs.readdirSync(TRANSCRIPT_CACHE_DIR)
		for (const f of files) {
			if (!f.endsWith('.txt')) continue
			if (!f.startsWith(videoId)) continue
			// Skip segment files — we'll clean those up after stitching
			if (f.match(/_seg\d+\.txt$/)) continue
			fs.unlinkSync(path.join(TRANSCRIPT_CACHE_DIR, f))
		}
	}

	for (const run of runs) {
		const parts: string[] = []
		for (const segIdx of run.segIndices) {
			const segPath = path.join(TRANSCRIPT_CACHE_DIR, `${videoId}_seg${segIdx}.txt`)
			if (fs.existsSync(segPath))
				parts.push(fs.readFileSync(segPath, 'utf-8'))
		}

		if (parts.length > 0) {
			const stitchedPath = getStitchedPath(videoId, run.start, run.end, manifest.duration)
			fs.writeFileSync(stitchedPath, parts.join('\n\n'), 'utf-8')
		}
	}

	// Clean up individual segment files now that they're stitched
	if (fs.existsSync(TRANSCRIPT_CACHE_DIR)) {
		const files = fs.readdirSync(TRANSCRIPT_CACHE_DIR)
		for (const f of files) {
			if (f.startsWith(videoId) && f.match(/_seg\d+\.txt$/))
				fs.unlinkSync(path.join(TRANSCRIPT_CACHE_DIR, f))
		}
	}
}

// Get the full transcript for a video by reading all stitched files in order
function getFullTranscript(videoId: string, manifest: VideoManifest): string | null {
	const runs = findContiguousRuns(manifest)
	if (runs.length == 0)
		return null

	const parts: string[] = []
	for (const run of runs) {
		const p = getStitchedPath(videoId, run.start, run.end, manifest.duration)
		if (fs.existsSync(p))
			parts.push(fs.readFileSync(p, 'utf-8'))
	}

	return parts.length > 0 ? parts.join('\n\n') : null
}

// Check if a video's transcript is fully cached (all segments ok, stitched file exists)
function isTranscriptComplete(videoId: string, manifest: VideoManifest): boolean {
	const allOk = manifest.segments.every(s => s.status == 'ok')
	if (!allOk) return false
	const fullPath = path.join(TRANSCRIPT_CACHE_DIR, `${videoId}.txt`)
	return fs.existsSync(fullPath)
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
//   1. Checks if a stitched transcript already exists (full cache hit)
//   2. For any gaps: splits from cached video, uploads, transcribes
//   3. Quality-gates each segment — retries once if too thin, marks failed if still bad
//   4. On first uncached segment, runs a 1-min canary to fail fast
//   5. After each successful segment, stitches contiguous runs into files
//   6. Returns the assembled transcript or reports what failed
//
// Stitching happens on write: each successful segment triggers a re-stitch of
// contiguous runs. The final transcript is read from the stitched files.

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
	videoPath: string,
	manifest: VideoManifest
): Promise<{ text: string, ok: boolean }> {
	const segmentDir = path.join(VIDEO_CACHE_DIR, videoId)
	fs.mkdirSync(segmentDir, { recursive: true })

	const segPath = path.join(segmentDir, `seg_${String(segIndex).padStart(3, '0')}.mp4`)
	const durationMinutes = (seg.end - seg.start) / 60

	for (let attempt = 0; attempt <= MAX_TRANSCRIPT_RETRIES; attempt++) {
		cutSegment(videoPath, seg.start, seg.end - seg.start, segPath)
		const uri = await uploadAndWaitForFile(segPath, SEGMENT_UPLOAD_TIMEOUT_MS)
		const text = await transcribeWithGemini('video/mp4', uri, seg.start)

		const charsPerMin = text.length / durationMinutes
		if (charsPerMin >= MIN_CHARS_PER_MINUTE) {
			// Save segment file temporarily, then stitch
			saveCachedTranscript(`${videoId}_seg${segIndex}`, text)
			seg.status = 'ok'
			saveManifest(manifest)
			stitchTranscript(videoId, manifest)
			// Clean up segment video file
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
//   4. list_transcripts   → shows all cached videos and their transcript files
//
// Short videos (≤10min): get_video_info → transcribe_video (YouTube URL directly)
// Long videos (>10min):  get_video_info → download_video → transcribe_video
//
// Long videos are split into segments: a 1-min canary first, then 2-min segments.
// The canary provides fail-fast behavior — if the first minute can't be transcribed,
// we stop immediately instead of making the user wait. On retry, a new canary is
// inserted at the first uncached segment to re-test before committing.
//
// Transcripts are stitched on write: after each segment succeeds, contiguous runs
// of ok segments are merged into single files. A fully complete video becomes
// {videoId}.txt. A video with gaps becomes multiple {videoId}_HHMMSS-HHMMSS.txt.

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

			const info = [
				`Title: ${title}`,
				`Duration: ${durationMin}min (${duration}s)`,
				`Video ID: ${videoId}`,
				`Strategy: ${strategy}`,
				hasVideo ? 'Video cache: downloaded' : 'Video cache: not cached'
			]

			if (manifest) {
				const okSegs = manifest.segments.filter(s => s.status == 'ok').length
				const failedSegs = manifest.segments.filter(s => s.status == 'failed').length
				const total = manifest.segments.length
				let cacheStatus = `Transcript: ${okSegs}/${total} segments ok`
				if (failedSegs > 0)
					cacheStatus += ` (${failedSegs} failed)`
				if (isTranscriptComplete(videoId, manifest))
					cacheStatus += ' — complete'
				info.push(cacheStatus)
			}
			else {
				// Check for standalone transcript (short video)
				const standalone = getCachedTranscript(videoId)
				info.push(standalone ? 'Transcript: cached (standalone)' : 'Transcript: none')
			}

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
			'transcribes, quality-validates, retries failures, and stitches into cache files automatically.',
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

			// Check for full cache hit via stitched file
			if (!startSeconds && !endSeconds && isTranscriptComplete(videoId, manifest)) {
				const text = fs.readFileSync(path.join(TRANSCRIPT_CACHE_DIR, `${videoId}.txt`), 'utf-8')
				return { content: [{ type: 'text' as const, text }] }
			}

			// Find segments that overlap the requested range and need work
			const neededSegments = manifest.segments.filter(
				s => s.end > rangeStart && s.start < rangeEnd
			)

			if (neededSegments.length == 0)
				throw new Error(`No segments cover range ${rangeStart}-${rangeEnd}s (video is ${Math.round(duration)}s)`)

			// Find which segments actually need transcription (not already in a stitched file)
			const uncachedSegments = neededSegments.filter(seg => {
				const segKey = `${videoId}_seg${seg.index}`
				// Check if individual segment file exists (shouldn't after stitch, but just in case)
				if (getCachedTranscript(segKey)) return false
				// Check if this segment is covered by a stitched file
				const runs = findContiguousRuns(manifest!)
				for (const run of runs) {
					if (seg.start >= run.start && seg.end <= run.end) {
						const p = getStitchedPath(videoId, run.start, run.end, manifest!.duration)
						if (fs.existsSync(p)) return false
					}
				}
				return true
			})

			// All segments already cached in stitched files — just return the transcript
			if (uncachedSegments.length == 0) {
				const text = getFullTranscript(videoId, manifest)
				if (text)
					return { content: [{ type: 'text' as const, text }] }
			}

			// Process uncached segments
			const failures: string[] = []
			let canaryDone = false

			for (const seg of uncachedSegments) {
				// First uncached segment — insert canary if needed
				if (!canaryDone) {
					canaryDone = true

					const manifestIdx = manifest.segments.findIndex(s => s.index == seg.index)
					if (manifestIdx >= 0 && (seg.end - seg.start) > CANARY_SECONDS) {
						insertCanary(manifest, manifestIdx)
						saveManifest(manifest)

						// Process canary
						const canarySeg = manifest.segments[manifestIdx]

						try {
							const result = await uploadAndTranscribeSegment(videoId, canarySeg.index, canarySeg, videoPath, manifest)
							if (!result.ok) {
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

						// Re-query uncached segments since manifest changed
						const remaining = manifest.segments.filter(s => {
							if (s.start < rangeStart || s.end > rangeEnd) return false
							if (s.index == canarySeg.index) return false // already done
							const runs = findContiguousRuns(manifest!)
							for (const run of runs) {
								if (s.start >= run.start && s.end <= run.end) {
									const p = getStitchedPath(videoId, run.start, run.end, manifest!.duration)
									if (fs.existsSync(p)) return false
								}
							}
							return true
						})

						for (const remSeg of remaining) {
							if (remSeg.status == 'failed')
								remSeg.status = 'ok'

							try {
								const result = await uploadAndTranscribeSegment(videoId, remSeg.index, remSeg, videoPath, manifest)
								if (!result.ok) {
									remSeg.status = 'failed'
									saveManifest(manifest)
									failures.push(`Segment ${remSeg.index + 1} [${formatMmSs(remSeg.start)}-${formatMmSs(remSeg.end)}]: transcript too short`)
								}
							}
							catch (err) {
								remSeg.status = 'failed'
								saveManifest(manifest)
								failures.push(`Segment ${remSeg.index + 1} [${formatMmSs(remSeg.start)}-${formatMmSs(remSeg.end)}]: ${err instanceof Error ? err.message : String(err)}`)
							}
						}

						// Done — break out of the loop (canary path processes everything)
						break
					}
				}

				// Normal segment processing (no canary needed)
				if (seg.status == 'failed')
					seg.status = 'ok'

				try {
					const result = await uploadAndTranscribeSegment(videoId, seg.index, seg, videoPath, manifest)
					if (!result.ok) {
						seg.status = 'failed'
						saveManifest(manifest)
						failures.push(`Segment ${seg.index + 1} [${formatMmSs(seg.start)}-${formatMmSs(seg.end)}]: transcript too short`)
					}
				}
				catch (err) {
					seg.status = 'failed'
					saveManifest(manifest)
					failures.push(`Segment ${seg.index + 1} [${formatMmSs(seg.start)}-${formatMmSs(seg.end)}]: ${err instanceof Error ? err.message : String(err)}`)
				}
			}

			cleanVideoCache()

			// Read the final transcript from stitched files
			const finalText = getFullTranscript(videoId, manifest)

			if (failures.length > 0) {
				const partial = finalText
					? `\n\nPartial transcript (from cached segments):\n${finalText}`
					: ''
				return {
					content: [{ type: 'text' as const, text: `Transcription incomplete — ${failures.length} segment(s) failed:\n${failures.join('\n')}${partial}` }],
					isError: true
				}
			}

			if (!finalText)
				throw new Error('No transcript available after processing')

			return { content: [{ type: 'text' as const, text: finalText }] }
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
			'Shows each video ID, duration, segment progress, and transcript files.',
			'Use this to see what data is available before requesting a transcription.'
		].join(' '),
		inputSchema: {}
	},
	async () => {
		try {
			const lines: string[] = []

			// Videos with manifests
			const manifests = loadAllManifests()
			if (manifests.length > 0) {
				for (const manifest of manifests) {
					const videoPath = path.join(VIDEO_CACHE_DIR, `${manifest.videoId}.mp4`)
					const hasVideo = fs.existsSync(videoPath)
					const videoSize = hasVideo ? Math.round(fs.statSync(videoPath).size / 1024 / 1024) : 0

					const okSegs = manifest.segments.filter(s => s.status == 'ok').length
					const failedSegs = manifest.segments.filter(s => s.status == 'failed').length
					const total = manifest.segments.length
					const complete = isTranscriptComplete(manifest.videoId, manifest)

					lines.push(`${manifest.videoId} (${Math.round(manifest.duration / 60)}min, ${okSegs}/${total} segments ok${failedSegs > 0 ? `, ${failedSegs} failed` : ''}${complete ? ' — complete' : ''})`)

					if (hasVideo)
						lines.push(`  Video: cached (${videoSize}MB)`)

					// List stitched transcript files
					const runs = findContiguousRuns(manifest)
					for (const run of runs) {
						const p = getStitchedPath(manifest.videoId, run.start, run.end, manifest.duration)
						if (fs.existsSync(p)) {
							const size = Math.round(fs.statSync(p).size / 1024)
							const name = path.basename(p)
							lines.push(`  ${name} (${size}KB)`)
						}
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
