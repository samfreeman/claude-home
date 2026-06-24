---
name: yt
description: "Transcribe a YouTube video via google-ai, then discuss with the user what's worth keeping and selectively capture it into kwiki. Accepts a URL or video ID in $ARGUMENTS. Reuses cached transcripts. Surfaces what's already captured. Use when the user says 'yt <url>', 'capture this youtube', 'add this video to kwiki', or invokes /yt."
---

# yt

Transcribe a YouTube video, then **decide with the user what's worth keeping** before anything lands in kwiki. The transcript is raw material — not a foregone capture. Some videos are worth nothing, some are worth a single idea, some are worth the lot. The discussion is what decides.

Transcription runs entirely through Gemini fetching the public YouTube URL server-side — no download, no yt-dlp, so YouTube's bot check never fires. Long videos that exceed Gemini's one-shot output limit are chunked automatically inside `transcribe_video` (server-side Gemini range clipping); you don't manage that.

## Workflow

### Step 1 — Resolve the video

`$ARGUMENTS` is a YouTube URL or video ID. Extract the **11-character video ID** (the string after `v=`, `youtu.be/`, or `/shorts/`). You'll need it for cache and kwiki lookups.

Optionally call `mcp__google-ai-mcp__get_video_info` with the URL/ID to capture the **title** and **channel** (via YouTube oEmbed — lightweight, no download). You'll want the title for provenance and to ground the discussion. If oEmbed fails (private/age-restricted video), it returns `Unknown` — transcription may still work, so continue.

### Step 2 — Has this exact video already been captured?

Grep `$KWIKI_ROOT/wiki/*.md` (default `~/kwiki/wiki/*.md`) for the video ID inside `source_url` frontmatter.

**If an entry matches**, this exact video was already mined. Surface the matching entries (title, slug, one-line summary) and tell the user it's already in kwiki. Don't silently re-transcribe — ask whether there's a reason to revisit (e.g. they think something was missed). Default to stopping.

If nothing matches, continue.

### Step 3 — Transcribe

Call `mcp__google-ai-mcp__transcribe_video` with the YouTube URL.

- It returns a cached transcript instantly if one exists — use it, don't force a re-transcription (re-transcription is rare and pointless when the cache is warm).
- Otherwise Gemini transcribes the URL directly. Long videos are chunked internally and stitched — no action needed from you.
- If it reports that **Gemini is unavailable** (every model returned UNAVAILABLE/503), stop and tell the user transcription can't proceed right now. There is no fallback — try again later.

To inspect what's already cached before transcribing, call `mcp__google-ai-mcp__list_transcripts`.

### Step 4 — Read the transcript and assess value

Read the transcript yourself. Pull out the genuinely valuable material — the ideas, claims, decisions, techniques, or facts worth remembering — and separate it from filler, sponsor reads, repetition, and throat-clearing.

Cross-check the valuable candidates against kwiki: search `$KWIKI_ROOT/wiki/*.md` for the concepts the video covers. Flag what's **net-new** versus what kwiki **already holds** (and where the video adds nuance to an existing entry rather than duplicating it). This overlap map is what makes the discussion sharp — you're not proposing to re-capture what's already there.

### Step 5 — Discuss with the user (the point of this skill)

Bring the user a concise read of what the video offers and **decide together what graduates into kwiki**. This is a conversation, not a yes/no gate. Present:

- The handful of valuable points, in plain terms
- Which are net-new vs. already covered (from Step 4)
- Your read on what's actually worth keeping — but the user decides

The outcome is open. It might be **nothing** (the video had no durable value), a **single idea**, a few entries, or the **whole thing**. Don't steer toward capture for its own sake. If the honest answer is "there's nothing here worth keeping," say that.

### Step 6 — Capture only what was agreed

If — and only if — the discussion lands on something worth keeping, hand that scope to `kwiki:capture` via the Skill tool. Give it the agreed material plus provenance:

```
Capture this into kwiki — scope agreed with the user (see below).

source_url: https://www.youtube.com/watch?v=<video_id>
source_type: youtube
video_title: <title from get_video_info>

Scope to capture: <what the user agreed is valuable — could be the whole transcript or specific points>

Transcript:
<full transcript text, for context>
```

Let `kwiki:capture` run its workflow — decompose into atomic concepts, link with `[[wikilinks]]`, write entries — but bounded to the agreed scope, not the entire transcript by default. Make sure the entries include `source_url` and `source_type: youtube` in frontmatter so Step 2 can find them on future runs.

If the discussion concluded there's nothing to keep, stop. The cached transcript remains for later; nothing goes into kwiki.

## Principles

1. **The discussion decides — not the skill.** Transcription produces raw material. Whether any of it is worth keeping, and which parts, is settled with the user. Never autopilot into a capture.
2. **Don't capture for its own sake.** "Nothing here is worth keeping" is a valid, common outcome. Say it plainly rather than manufacturing an entry.
3. **Already-captured is the first check; overlap informs the discussion.** Surface what kwiki already holds so you propose net-new value, not duplicates.
4. **Cached transcripts are reused.** `transcribe_video` returns them automatically; don't force a re-transcription.
5. **Gemini fetches the URL — nothing is downloaded.** No yt-dlp, no bot check, no segment management. If Gemini is down, transcription is down; say so and stop.
6. **When you do capture, go through `kwiki:capture`.** Atomic entries with wikilinks is the point — but bounded to the agreed scope, never a monolithic "video summary" dump.
