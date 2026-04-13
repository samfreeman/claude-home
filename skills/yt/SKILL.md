---
name: yt
description: "Transcribe a YouTube video via google-ai and capture it into kwiki. Accepts a URL or video ID in $ARGUMENTS. Skips transcription if already cached, and stops early if the video is already captured in kwiki. Use when the user says 'yt <url>', 'capture this youtube', 'add this video to kwiki', or invokes /yt."
---

# yt

Transcribe a YouTube video and capture it into kwiki. Reuses cached transcripts. Surfaces existing kwiki entries instead of re-capturing.

## Workflow

### Step 1 — Resolve the video

`$ARGUMENTS` is a YouTube URL or video ID. Extract the **11-character video ID** (the string after `v=`, `youtu.be/`, or `/shorts/`). You'll need it for cache lookups.

Call `mcp__google-ai-mcp__get_video_info` with the URL/ID. Record:
- `title`
- `duration` (seconds)
- Recommended strategy (direct vs download+transcribe)

### Step 2 — Check kwiki first (MANDATORY)

Search existing wiki entries for this video ID. Grep `$KWIKI_ROOT/wiki/*.md` (default `~/kwiki/wiki/*.md`) for the video ID inside `source_url` frontmatter.

**If any entry matches**: the video is already captured. Behave like `kwiki:search`:

1. List each matching entry: title, slug, and a one-line summary pulled from the body
2. Tell the user the video is already in kwiki and point to the entries
3. **Stop.** Do not transcribe. Do not re-capture.

Only proceed to Step 3 if no entry has this video ID.

### Step 3 — Check for an existing transcript

Call `mcp__google-ai-mcp__list_transcripts`. Find the entry for this video ID, if any. Inspect its segment progress.

Decide what to do based on cache state and duration:

| Cache state | Duration | Action |
|---|---|---|
| No cache | any | Transcribe the full video |
| Complete | any | Use the cached transcript (call `transcribe_video`, returns fast) |
| Partial, beginning only, no gaps | > 40 min | Use what's cached. Don't fill the tail. |
| Partial with gaps in the middle | ≤ 40 min | Fill missing segments before capturing |
| Partial with gaps in the middle | > 40 min | Use what's cached. Don't fill gaps. |

For long videos with no cache, the `get_video_info` strategy will tell you to download first. In that case, call `mcp__google-ai-mcp__download_video` before `transcribe_video`.

`transcribe_video` handles caching internally — it only does work for missing/failed segments. For the "use cached partial range" case on long videos, call it with `startSeconds: 0` and `endSeconds` set to the end of the already-cached range so it doesn't try to transcribe the missing tail.

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
2. **Cached transcripts are the second check.** Don't re-transcribe what google-ai already has.
3. **Long videos with gaps stay partial.** Filling gaps on a 2-hour video is expensive. Only short videos (≤40 min) get gap-filled automatically.
4. **Capture always goes through kwiki:capture.** Atomic entries with wikilinks is the whole point — don't write a single monolithic "video summary" entry.
