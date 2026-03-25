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

function formatTimestamp(ms: string): string {
	const total = Math.floor(parseInt(ms, 10) / 1000)
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	if (h > 0)
		return `[${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}]`
	return `[${m}:${s.toString().padStart(2, '0')}]`
}

interface CaptionTrack {
	baseUrl: string
	languageCode: string
	kind?: string
}

async function fetchCaptionTrack(baseUrl: string, cookie?: string): Promise<TranscriptSegment[]> {
	const url = baseUrl + '&fmt=json3'
	const headers: Record<string, string> = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
	}
	if (cookie)
		headers['Cookie'] = cookie

	const resp = await fetch(url, { headers })
	const data = await resp.json() as { events?: Record<string, unknown>[] }

	if (!data.events)
		return []

	return data.events
		.filter(e => e.segs && (e.tStartMs != null))
		.map(e => {
			const segs = e.segs as { utf8?: string }[]
			const text = segs.map(s => s.utf8 ?? '').join('').trim()
			const startMs = String(e.tStartMs)
			const endMs = String(Number(e.tStartMs) + Number(e.dDurationMs ?? 0))
			return { text, startMs, endMs }
		})
		.filter(s => s.text.length > 0 && s.text != '\n')
}

export async function fetchTranscript(input: string, lang: string = 'en'): Promise<TranscriptResult> {
	const videoId = extractVideoId(input)
	if (!videoId)
		throw new Error(`Could not extract video ID from: ${input}`)

	const cookie = process.env.YOUTUBE_COOKIE
	const pageHeaders: Record<string, string> = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		'Accept-Language': 'en-US,en;q=0.9'
	}
	if (cookie)
		pageHeaders['Cookie'] = cookie

	const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { headers: pageHeaders })
	const html = await pageResp.text()

	const title = html.match(/<title>(.*?)<\/title>/)?.[1]?.replace(' - YouTube', '').trim() ?? 'Unknown'
	const author = html.match(/"ownerChannelName":"(.*?)"/)?.[1] ?? 'Unknown'

	// Extract caption tracks from ytInitialPlayerResponse
	const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var|const|let|\s*<\/script)/)
	if (!playerMatch)
		throw new Error(`No transcript available for video ${videoId}${!cookie ? ' (tip: set YOUTUBE_COOKIE env var)' : ''}`)

	const player = JSON.parse(playerMatch[1])
	const tracks: CaptionTrack[] = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []

	if (tracks.length == 0)
		throw new Error(`No transcript available for video ${videoId}`)

	// Pick best track: prefer requested lang, fall back to English, then first available
	const pick = (code: string) => tracks.find(t => t.languageCode == code)
	const track = pick(lang) ?? pick('en') ?? tracks[0]

	const segments = await fetchCaptionTrack(track.baseUrl, cookie)

	if (segments.length == 0)
		throw new Error(`Transcript empty for video ${videoId}`)

	return { title, author, videoId, segments }
}

export function formatTranscript(result: TranscriptResult, includeTimestamps: boolean): string {
	return result.segments
		.map(seg => includeTimestamps ? `${formatTimestamp(seg.startMs)} ${seg.text}` : seg.text)
		.join('\n')
}
