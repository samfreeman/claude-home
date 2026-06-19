---
name: yt
description: "Transcribe a YouTube video via google-ai and capture it into kwiki. Accepts a URL or video ID in $ARGUMENTS. Skips transcription if already cached, and stops early if the video is already captured in kwiki. Use when the user says 'yt <url>', 'capture this youtube', 'add this video to kwiki', or invokes /yt."
---

# yt

Transcribe a YouTube video and capture it into kwiki. Reuses cached transcripts. Surfaces existing kwiki entries instead of re-capturing.

Transcription runs entirely through Gemini fetching the public YouTube URL server-side — no download, no yt-dlp, so YouTube's bot check never fires. Long videos that exceed Gemini's one-shot output limit are chunked automatically inside `transcribe_video` (server-side Gemini range clipping); you don't manage that.

## Workflow

### Step 1 — Resolve the video

`$ARGUMENTS` is a YouTube URL or video ID. Extract the **11-character video ID** (the string after `v=`, `youtu.be/`, or `/shorts/`). You'll need it for cache and kwiki lookups.

Optionally call `mcp__google-ai-mcp__get_video_info` with the URL/ID to capture the **title** and **channel** (via YouTube oEmbed — lightweight, no download). You'll want the title for kwiki provenance. If oEmbed fails (private/age-restricted video), it returns `Unknown` — transcription may still work, so continue.

### Step 2 — Check kwiki first (MANDATORY)

Search existing wiki entries for this video ID. Grep `$KWIKI_ROOT/wiki/*.md` (default `~/kwiki/wiki/*.md`) for the video ID inside `source_url` frontmatter.

**If any entry matches**: the video is already captured. Behave like `kwiki:search`:

1. List each matching entry: title, slug, and a one-line summary pulled from the body
2. Tell the user the video is already in kwiki and point to the entries
3. **Stop.** Do not transcribe. Do not re-capture.

Only proceed to Step 3 if no entry has this video ID.

### Step 3 — Transcribe

Call `mcp__google-ai-mcp__transcribe_video` with the YouTube URL.

- It returns a cached transcript instantly if one exists.
- Otherwise Gemini transcribes the URL directly. Long videos are chunked internally and stitched — no action needed from you.
- If it reports that **Gemini is unavailable** (every model returned UNAVAILABLE/503), stop and tell the user transcription can't proceed right now. There is no fallback — try again later.

To inspect what's already cached before transcribing, call `mcp__google-ai-mcp__list_transcripts`.

### Step 4 — Hand off to kwiki:capture

Invoke the `kwiki:capture` command via the Skill tool. Give it the transcript plus provenance:

```
Capture this YouTube transcript into kwiki.

source_url: https://www.youtube.com/watch?v=<video_id>
source_type: youtube
video_title: <title from get_video_info>

Transcript:
<full transcript text>
```

Let `kwiki:capture` run its full workflow: read existing entries, decompose into atomic concepts, propose a split plan, wait for user approval, and write entries with `[[wikilinks]]`. Do not try to bypass or shortcut that workflow — the decompose/link step is the whole point of kwiki.

Make sure the entries written include `source_url` and `source_type: youtube` in their frontmatter so Step 2 can find them on future runs.

## Principles

1. **Kwiki is the first check.** If the video is already captured, surface the entries — don't redo the work.
2. **Cached transcripts are the second check.** `transcribe_video` reuses them automatically; don't force re-transcription.
3. **Gemini fetches the URL — nothing is downloaded.** No yt-dlp, no bot check, no segment management. If Gemini is down, transcription is down; say so and stop.
4. **Capture always goes through kwiki:capture.** Atomic entries with wikilinks is the whole point — don't write a single monolithic "video summary" entry.
