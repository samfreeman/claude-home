---
description: Generate or refresh the polished HTML versions of PRD.md and Architecture.md — themed, session-based, diff-driven diagram review
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG HTML Docs — Polished HTML render of PRD + Architecture

Generate `.wag/docs/PRD.html` and `.wag/docs/Architecture.html` as polished, self-contained HTML alongside the authoritative Markdown source. The Markdown stays the source of truth; HTML is a render for sharing and skim-reading.

This is a session, not a one-shot. Diagrams are reviewed with the user; the LLM never silently regenerates a diagram the user already polished.

## Before you start

1. Confirm `.wag/` exists and `.wag/docs/PRD.md` + `.wag/docs/Architecture.md` are present. If either is missing, tell the user to run `/wag:init` or `/wag:docs` first.
2. Read `~/.claude/wag/templates/html-shell.html` — the HTML scaffold used for renders.
3. Read `~/.claude/wag/templates/html-theme-default.css` — the fallback theme tokens.

## Phase 1: Survey

For each of `PRD.md` and `Architecture.md`:

- Check whether the paired `.html` already exists in `.wag/docs/`.
- Classify each doc as either:
  - **First render** — no `.html` exists yet (or it exists but has never been committed, so no git baseline is available).
  - **Refresh** — `.html` exists and has a git history we can diff against.

Tell the user which docs are in which state. Ask whether they want to render both, one, or skip either.

## Phase 2: Theme source

Locate the app's theme tokens. Check, in order:

1. `src/app/globals.css`
2. `app/globals.css`
3. `src/globals.css`
4. `styles/globals.css`

If found, extract the `:root { ... }` and `.dark { ... }` (or equivalent) blocks containing `--background`, `--foreground`, `--primary`, `--card`, `--border`, etc. — anything the WAG default theme uses. These tokens get injected into the HTML shell.

If no `globals.css` is found, use `~/.claude/wag/templates/html-theme-default.css` verbatim. Tell the user which source is being used.

## Phase 3: Baseline diff (per refresh doc)

For each doc in **refresh** mode:

1. Find the last commit that touched the `.html`:
   ```bash
   git log -1 --format=%H -- .wag/docs/Architecture.html
   ```
2. Read the `.md` as it was at that commit:
   ```bash
   git show <sha>:.wag/docs/Architecture.md
   ```
3. Diff that against the current `.md`. Identify which sections (by `## ` heading) have changed.

A section is "changed" if any prose inside it differs. Sections with no diff are stable — their existing rendering (including any diagram) is preserved.

If the `.html` is uncommitted (working-tree-only) or no git history exists, surface this and treat it as a **first render** instead.

## Phase 4: Diagram plan

For each doc:

- **First render:** Read the `.md` and identify candidate diagram opportunities — architecture layered stacks, data flow, sequence diagrams, ERDs, anything where prose says "X connects to Y and Z" or "the layers are A, B, C." Propose to the user *which* diagrams to author. Don't draw them yet; just list candidates with a one-line description each. The user accepts, redirects, or declines each candidate.

- **Refresh:** Walk the existing `.html` and extract its `<div class="diagram">` blocks. Map each one to its preceding `## ` or `### ` heading. For each diagram:
  - If its section is **stable** (Phase 3 found no change in that section's prose) → preserve as-is. Don't ask.
  - If its section is **changed** → propose to the user: keep, redraw, or refine. Show what the existing diagram captures (paraphrase the labels) and what the prose now says. The user picks.

Track each diagram decision. Stable diagrams will be copied verbatim into the new render; changed diagrams will be re-authored in Phase 5.

## Phase 5: Render session

Now author the new `.html` per doc. Use the shell template as the scaffold; populate placeholders:

- `{{TITLE}}` — from the doc's `# ` H1, plus the project name if it's not already in the heading (e.g., "DragonPay API — Architecture").
- `{{EYEBROW}}` — a short kicker line, e.g., the project's tagline from PRD, or `"PRD"` / `"Architecture"` plain.
- `{{META_DESCRIPTION}}` — one line: "Self-contained HTML render of `.wag/docs/<file>.md` — no external dependencies. Code blocks are collapsed by default; expand any of them for the full detail." (Adapt to the actual content shape.)
- `{{THEME_TOKENS}}` — the `:root { ... }` and `.dark { ... }` blocks from Phase 2.
- `{{TOC_ITEMS}}` — `<li><a href="#section-id">Section title</a></li>` per `## ` heading.
- `{{BODY}}` — the rendered body content.

### Body rendering

For each `## ` section in the Markdown:

- **Stable sections (refresh mode):** Copy the corresponding section's HTML from the existing `.html`, including any `<div class="diagram">`, `<details>`, tables, `<pre>` blocks. Do not regenerate prose or structure.
- **Changed sections (refresh mode) + all sections (first render):**
  - Render the prose as HTML: `## Heading` → `<h2 id="slug">Heading</h2>`, `### Sub` → `<h3>Sub</h3>`, paragraphs → `<p>`, lists → `<ul>/<ol>`, inline code → `<code>`, blockquotes → `<blockquote>`, tables → `<table>` with the shell's styling (no inline classes needed).
  - For fenced code blocks larger than ~10 lines, wrap in `<details>` with a summary that names the language and a short description:
    ```html
    <details>
      <summary><span class="kind">TS</span> Module factory — repository wiring</summary>
      <pre><code>...</code></pre>
    </details>
    ```
    Short code snippets (under ~10 lines) stay as plain `<pre><code>` for inline visibility.
  - For invariants / critical callouts (often introduced by "**Important:**" or "**Do not:**" in Markdown), wrap in `<div class="warn">`.

### Diagram authoring (changed/first-render only)

For each diagram the user approved in Phase 4:

1. Sketch the layout mentally: what are the boxes, the bands/layers, the edges? Where do labels go?
2. Author the SVG inline using the shell's `.d-*` classes (`.d-band`, `.d-box`, `.d-box-accent`, `.d-title`, `.d-sub`, `.d-edge`, etc.). The classes inherit the theme tokens, so the SVG recolours with the page.
3. Use a `viewBox` sized to fit the layout (typically 600–700 wide, height as needed).
4. Define arrowhead markers in `<defs>` if any edges have direction.
5. Show the SVG to the user. They can accept, redirect ("move the BT proxy under the PSP layer, not between"), or replace ("draw it as a sequence diagram instead").

Iterate until the user is satisfied with each diagram before moving on.

### Assemble

Substitute all placeholders into the shell template. Write the final HTML to `.wag/docs/<DocName>.html`.

## Phase 6: Summary

Tell the user what changed:

- For each doc: first-render vs. refresh, theme source, count of diagrams (kept / regenerated / authored fresh).
- Remind them to commit the `.html` alongside any `.md` changes — `git log` is the snapshot mechanism for future diff-driven renders, so the `.html` needs to be committed for the next render to work properly.
- If the project uses a `globals.css` that wasn't found in Phase 2's lookup paths, mention which lookup paths were checked so the user can move/symlink their `globals.css` if desired.

## Key rules

1. **Markdown is the source of truth.** This command never edits `.wag/docs/*.md`. If the user wants to change content, they run `/wag:docs` first, then re-render.
2. **Diff-driven diagram review.** A diagram in a stable section is never re-proposed. A diagram in a changed section is always reviewed before being kept or redrawn.
3. **User reviews each new or changed diagram.** Never silently draw or replace a diagram. Show, get input, iterate.
4. **Theme is lifted, not invented.** Pull from `globals.css` when the app has one; fall back to the WAG default only when it doesn't. Don't invent tokens.
5. **Self-contained output.** No external CSS, no web fonts, no JS frameworks. The HTML file works opened directly in any browser, no dev server needed.
6. **Scope is PRD + Architecture only.** RESEARCH.md, ADRs, epic.md, PBI files stay Markdown-only. They're working artifacts; this command is for the stable, shareable docs.
7. **Commit the `.html` after rendering.** The diff baseline for the next render relies on it being in git.
