---
name: kwiki-capture
description: "Conversational kwiki knowledge capture from rough voice or text input. Use this skill whenever the user wants to save something to their wiki/kwiki, capture a decision, record what they learned, document a pattern, or says things like 'add this to kwiki', 'capture this', 'remember this pattern', 'I just learned...'. Also handles YouTube video capture — pass a video ID or URL and it will pull the transcript and metadata from the google-ai-mcp cache."
---

# kwiki capture

Capture content directly into the wiki in one step. Ingests the raw, processes it into an entry, and auto-links.

## Arguments

$ARGUMENTS — content to capture (YouTube video ID/URL, file path, URL, inline text, or short description)

## Instructions

### Step 1 — Load input

Detect the form of `$ARGUMENTS` and load content:

| Form | Detection | Action |
|------|-----------|--------|
| YouTube video | 11-char video ID, or URL containing `youtube.com/watch` or `youtu.be/` | Load from transcript cache (see video flow below) |
| File path | Starts with `/` or `~/` and file exists | `Read` the file to load content |
| URL | Starts with `http://` or `https://` | Fetch and extract content |
| Inline text | Multi-line or long single line | Use directly |
| Description | Short text, not a path or URL | Use as topic description — proceed with conversational capture |

#### Video flow

When a YouTube video is detected:

1. Extract the video ID from the input (11-char alphanumeric string, or from the URL query/path).
2. Look for cached data in `~/.claude/mcp-servers/google-ai-mcp/cache/transcripts/`:
   - `{videoId}_meta.json` — title, channel, description, upload date, URL
   - `{videoId}.txt` — full transcript (complete videos)
   - `{videoId}_HHMMSS-HHMMSS.txt` — partial transcript segments (videos with gaps)
3. If **no meta file** exists, call `get_video_info` via google-ai-mcp to fetch and cache it.
4. If **no transcript** exists, tell the user and offer to transcribe (do not auto-transcribe — it can be slow and costly).
5. Once both meta and transcript are loaded, combine them:
   - `source_url` ← meta.url
   - `source_type` ← `youtube`
   - Use meta.title, meta.channel, meta.description as additional context for extraction
   - The transcript text is the primary content for the capture flow
6. Proceed to **Step 2** (size assessment) with the combined content.

### Step 2 — Assess size and complexity

After loading content, decide which flow to use.

**Use the multi-entry flow if ANY of these are true:**
- Content is ≥500 lines
- Content has ≥2 distinct top-level headings covering different topics
- Content spans multiple clearly distinct domains or subjects

**Otherwise use the single-entry flow.**

---

### Single-entry flow

1. Extract:
   - **title** — clear descriptive title
   - **body** — core content, cleaned up and well-structured
   - **aliases** — generous list: abbreviations, acronyms, informal names, related terms
   - **tags** — 10–20 tags (see tag rules below). **Minimum 3 tags** (hard server-side rule).
   - **source_url**, **source_type** — if known (source_type: youtube, article, pdf, conversation, other)
   - **focus** — what the extraction focused on
2. Present the extraction to the user for approval.
3. After approval, call `wiki_capture` with the full argument set.
4. If `wiki_capture` returns `InsufficientTagsError`, re-extract with more tags and retry once.
5. Confirm: entry created, auto-linking happened.

---

### Multi-entry flow

#### Phase 1 — Split plan

Propose a split plan as a table:

```
| # | Proposed entry name | Key topics | Est. tags |
|---|---------------------|------------|-----------|
| 1 | saas-pricing-models | pricing tiers, freemium, usage-based | ~15 |
| 2 | saas-onboarding-patterns | activation, trial conversion | ~12 |
| ...
```

Rules for the split plan:
- Each chunk must be a self-contained topic that makes sense as a standalone entry.
- Entry names follow kwiki slug conventions (lowercase, hyphenated).
- Overlapping tags between chunks are expected and desirable — they drive auto-linking.

**Stop and wait for the user to agree.** The user may adjust chunk boundaries, rename entries, or merge/split chunks. Do not proceed until the user confirms the plan.

#### Phase 2 — Extract and capture

Once agreed, process all chunks sequentially with no further gates:

```
for each chunk in split_plan:
    1. Extract: title, body, aliases, tags (10-20), source metadata, focus
    2. Call wiki_capture
    3. If InsufficientTagsError → re-extract with more tags, retry once
    4. Record result (success or failure)
```

No per-chunk approval. No pausing between chunks.

#### Phase 3 — Summary

Report results:

```
Captured N/N entries:
  ✓ saas-pricing-models (16 tags, 3 auto-links)
  ✓ saas-onboarding-patterns (12 tags, 5 auto-links)
  ...
```

If any failures, report them with the error.

---

### Tag rules

Tags are the only organizational mechanism in kwiki. For every entry (single or multi):
- Extract tags **per chunk**, not copy-pasted from the parent document.
- Include: technology names, pattern names, domain terms, action words.
- Target 15–20 tags per entry. Minimum 10. Hard server minimum is 3.
- Overlapping tags across related entries are good — they trigger auto-linking.
