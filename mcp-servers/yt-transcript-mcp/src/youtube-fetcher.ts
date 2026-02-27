export interface TranscriptSegment {
	text: string
	startMs: string
	endMs: string
}

export interface TranscriptResult {
	title: string
	author: string
	videoId: string
	segments: TranscriptSegment[]
}

function extractVideoId(input: string): string | null {
	if (/^[a-zA-Z0-9_-]{11}$/.test(input))
		return input

	try {
		const url = new URL(input)
		if (url.searchParams.has('v'))
			return url.searchParams.get('v')
		if (url.hostname == 'youtu.be')
			return url.pathname.slice(1).split('/')[0] || null
		const pathMatch = url.pathname.match(/^\/(shorts|embed)\/([a-zA-Z0-9_-]{11})/)
		if (pathMatch)
			return pathMatch[2]
	}
	catch {}

	return null
}

// Protobuf encoding helpers
function varint(value: number): number[] {
	const bytes: number[] = []
	while (value > 0x7f) { bytes.push((value & 0x7f) | 0x80); value >>>= 7 }
	bytes.push(value & 0x7f)
	return bytes
}

function pbString(field: number, value: string): number[] {
	const enc = Buffer.from(value, 'utf-8')
	return [...varint((field << 3) | 2), ...varint(enc.length), ...enc]
}

function pbVarint(field: number, value: number): number[] {
	return [...varint((field << 3) | 0), ...varint(value)]
}

function buildParams(videoId: string, lang: string): string {
	const inner = [...pbString(1, 'asr'), ...pbString(2, lang), ...pbString(3, '')]
	const innerEncoded = encodeURIComponent(Buffer.from(inner).toString('base64'))
	const outer = [
		...pbString(1, videoId),
		...pbString(2, innerEncoded),
		...pbVarint(3, 1),
		...pbString(5, 'engagement-panel-searchable-transcript-search-panel'),
		...pbVarint(6, 1), ...pbVarint(7, 1), ...pbVarint(8, 1)
	]
	return Buffer.from(outer).toString('base64')
}

function formatTimestamp(ms: string): string {
	const total = Math.floor(parseInt(ms, 10) / 1000)
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	if (h > 0)
		return `[${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}]`
	return `[${m}:${s.toString().padStart(2, '0')}]`
}

function parseSegments(data: Record<string, unknown>): TranscriptSegment[] {
	try {
		const actions = data.actions as Record<string, unknown>[]
		const cmd = actions[0].elementsCommand as Record<string, unknown>
		const entity = cmd.transformEntityCommand as Record<string, unknown>
		const args = entity.arguments as Record<string, unknown>
		const txArgs = args.transformTranscriptSegmentListArguments as Record<string, unknown>
		const segments = (txArgs.overwrite as Record<string, unknown>).initialSegments as Record<string, unknown>[]

		return segments
			.filter(seg => seg.transcriptSegmentRenderer)
			.map(seg => {
				const tsr = seg.transcriptSegmentRenderer as Record<string, unknown>
				const snippet = tsr.snippet as Record<string, unknown>
				const attr = snippet.elementsAttributedString as Record<string, unknown>
				return {
					text: (attr.content as string).trim(),
					startMs: tsr.startMs as string,
					endMs: tsr.endMs as string
				}
			})
			.filter(s => s.text.length > 0)
	}
	catch {
		return []
	}
}

async function callTranscriptApi(videoId: string, lang: string, visitorData: string): Promise<TranscriptSegment[]> {
	const resp = await fetch('https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': 'com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip',
			'Origin': 'https://www.youtube.com'
		},
		body: JSON.stringify({
			context: {
				client: { hl: lang, gl: 'US', clientName: 'ANDROID', clientVersion: '19.29.37', androidSdkVersion: 30, visitorData }
			},
			params: buildParams(videoId, lang)
		})
	})

	const data = await resp.json() as Record<string, unknown>
	return parseSegments(data)
}

export async function fetchTranscript(input: string, lang: string = 'en'): Promise<TranscriptResult> {
	const videoId = extractVideoId(input)
	if (!videoId)
		throw new Error(`Could not extract video ID from: ${input}`)

	const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Accept-Language': 'en-US,en;q=0.9'
		}
	})
	const html = await pageResp.text()

	const title = html.match(/<title>(.*?)<\/title>/)?.[1]?.replace(' - YouTube', '').trim() ?? 'Unknown'
	const author = html.match(/"ownerChannelName":"(.*?)"/)?.[1] ?? 'Unknown'
	const visitorData = html.match(/"visitorData":"(.*?)"/)?.[1] ?? ''

	let segments = await callTranscriptApi(videoId, lang, visitorData)

	if (segments.length == 0 && lang != 'en')
		segments = await callTranscriptApi(videoId, 'en', visitorData)

	if (segments.length == 0)
		throw new Error(`No transcript available for video ${videoId}`)

	return { title, author, videoId, segments }
}

export function formatTranscript(result: TranscriptResult, includeTimestamps: boolean): string {
	return result.segments
		.map(seg => includeTimestamps ? `${formatTimestamp(seg.startMs)} ${seg.text}` : seg.text)
		.join('\n')
}
