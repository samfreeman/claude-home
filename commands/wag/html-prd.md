---
description: Render .wag/docs/PRD.md as polished HTML — themed, session-based, diff-driven diagram review
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG HTML PRD — Polished HTML render of the PRD

Generate `.wag/docs/PRD.html` from `.wag/docs/PRD.md`. The Markdown stays the source of truth; HTML is a render for sharing and skim-reading.

This is a session, not a one-shot. Diagrams (user flows, journey maps, anything visual) are reviewed with the user; the LLM never silently regenerates a diagram the user already polished.

For shared theme/shell/diff/write logic, see `~/.claude/wag/references/html-render.md`. The phases below are PRD-specific; the shared procedure handles the boilerplate.

## Phase 1: Survey

1. Confirm `.wag/docs/PRD.md` exists. If missing, tell the user to run `/wag:init` or `/wag:docs` first.
2. Check whether `.wag/docs/PRD.html` exists.
3. Classify:
   - **First render** — no `.html`, or `.html` exists but uncommitted.
   - **Refresh** — `.html` exists and has a git history we can diff against.
4. Read `~/.claude/wag/references/html-render.md` if you haven't this session.

## Phase 2: Shared theme + baseline

Run Shared-1 (theme source) and Shared-2 (baseline diff) from the shared procedure.

## Phase 3: Diagram plan

For the PRD, diagrams are typically:
- **User journey maps** — flows from sign-up through first value
- **Persona / segment diagrams** — visual carve-out of who the product serves
- **Scope diagrams** — what's in v1 vs. v2 vs. non-goals, drawn as overlapping regions
- **Feature dependency graphs** — when PRD calls out that feature X enables Y

For each:
- **First render:** Walk the `.md` and propose diagram candidates with a one-line description each. User accepts, redirects, or declines per candidate.
- **Refresh:** Extract `<div class="diagram">` blocks from the existing `.html`, map each to its preceding `## ` heading. Stable section → preserve as-is. Changed section → propose keep / redraw / refine with the user. Show what the existing diagram captured and what the current prose says.

Track each diagram decision. Stable diagrams are copied verbatim; changed diagrams are re-authored in Phase 4.

## Phase 4: Render session

Load `~/.claude/wag/templates/html-shell.html`. Populate placeholders per Shared-3:

- `{{TITLE}}` — "ProjectName — PRD" (or just "PRD" if the project name is already prominent elsewhere in the source `.md` title)
- `{{EYEBROW}}` — the project's tagline or one-line value prop from the PRD
- `{{META_DESCRIPTION}}` — "Self-contained HTML render of `.wag/docs/PRD.md`. Code blocks are collapsed by default; expand any of them for the full detail."
- `{{TOC_ITEMS}}` — one `<li>` per `## ` heading
- `{{BODY}}` — see below

### Body rendering

For each `## ` section in the PRD:

- **Stable section (refresh mode):** Copy the section's HTML verbatim from the existing `.html`, including any diagrams, `<details>` blocks, callouts, tables.
- **Changed section (refresh) or all sections (first render):**
  - Render the prose as semantic HTML: headings, paragraphs, lists, tables, blockquotes, inline code. Use the shell's existing styling.
  - For long fenced code blocks (>10 lines), wrap in `<details>` with a summary chip. Short snippets stay as plain `<pre><code>`.
  - For critical product callouts ("**Important:** must launch by Q3", "**Non-goal:** we are not building X"), wrap in `<div class="warn">`.
  - For diagrams approved in Phase 3, author the SVG inline using the shell's `.d-*` classes. Show each one to the user, iterate until accepted.

## Phase 5: Write + summarise

Run Shared-4. Write to `.wag/docs/PRD.html`. Tell the user what was rendered/preserved, which theme source was used, and remind them to commit the `.html` so the next refresh has a baseline.

## Key rules

1. **PRD.md is the source.** This command never edits it.
2. **Diff-driven diagram review.** Stable diagrams stay; changed diagrams are reviewed before re-authoring.
3. **User reviews each new or changed diagram.** Never silently draw or replace.
4. **Self-contained output.** No externals.
