---
description: Render .wag/docs/Architecture.md as polished HTML — themed, session-based, diff-driven diagram review
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG HTML Architecture — Polished HTML render of the Architecture doc

Generate `.wag/docs/Architecture.html` from `.wag/docs/Architecture.md`. The Markdown stays the source of truth; HTML is a render for sharing and skim-reading.

This is a session, not a one-shot. Diagrams (layer stacks, data flow, sequence, ERDs) are reviewed with the user; the LLM never silently regenerates a diagram the user already polished.

For shared theme/shell/diff/write logic, see `~/.claude/wag/references/html-render.md`. The phases below are Architecture-specific; the shared procedure handles the boilerplate.

## Phase 1: Survey

1. Confirm `.wag/docs/Architecture.md` exists. If missing, tell the user to run `/wag:init` or `/wag:docs` first.
2. Check whether `.wag/docs/Architecture.html` exists.
3. Classify:
   - **First render** — no `.html`, or `.html` exists but uncommitted.
   - **Refresh** — `.html` exists and has a git history we can diff against.
4. Read `~/.claude/wag/references/html-render.md` if you haven't this session.

## Phase 2: Shared theme + baseline

Run Shared-1 (theme source) and Shared-2 (baseline diff) from the shared procedure.

## Phase 3: Diagram plan

Architecture is diagram-heavy. Typical diagrams:
- **Layered stack** — UI / State / Interface / Infrastructure layers, with what lives in each
- **Data flow** — request → service → repository → DB; provider integration paths
- **Sequence diagrams** — auth flow, payment flow, anything multi-actor
- **ERD** — entities and relationships (use `.erd-*` classes from the shell)
- **Provider topology** — when the project integrates several external services

For each:
- **First render:** Walk the `.md` and propose diagram candidates with a one-line description each. Reference the dragonpay `Architecture.html` if you want a feel for the bar — bands for layers, accent boxes for entry points, dashed lifelines for sequences.
- **Refresh:** Extract `<div class="diagram">` blocks from the existing `.html`, map each to its preceding `## ` or `### ` heading. Stable section → preserve. Changed section → propose keep / redraw / refine with the user.

Track each diagram decision. Stable diagrams are copied verbatim; changed diagrams are re-authored in Phase 4.

## Phase 4: Render session

Load `~/.claude/wag/templates/html-shell.html`. Populate placeholders per Shared-3:

- `{{TITLE}}` — "ProjectName — Architecture"
- `{{EYEBROW}}` — the project's domain or short architectural identity (e.g., "Payment Abstraction Layer · BlackDragon Capital")
- `{{META_DESCRIPTION}}` — "Self-contained HTML render of `.wag/docs/Architecture.md`. Code blocks are collapsed by default; expand any of them for the full detail."
- `{{TOC_ITEMS}}` — one `<li>` per `## ` heading
- `{{BODY}}` — see below

### Body rendering

For each `## ` section in the Architecture doc:

- **Stable section (refresh mode):** Copy verbatim from the existing `.html`.
- **Changed section (refresh) or all sections (first render):**
  - Render the prose as semantic HTML: headings, paragraphs, lists, tables, blockquotes, inline code.
  - Tech stack tables get the shell's table styling (no extra classes needed).
  - For TypeScript interface definitions, function signatures, or implementation snippets, wrap in `<details>` with a summary chip — `<span class="kind">TS</span>` for TypeScript, `<span class="kind sql">SQL</span>` for migrations, `<span class="kind tree">TREE</span>` for directory dumps, `<span class="kind env">ENV</span>` for environment variable lists.
  - For invariants and "do not" callouts, wrap in `<div class="warn">`.
  - For diagrams approved in Phase 3, author the SVG inline using the shell's `.d-*` classes (architectural) or `.erd-*` classes (entity-relationship). `viewBox` typically 600–700 wide. Define arrowhead markers in `<defs>`. Show each one to the user, iterate until accepted.

## Phase 5: Write + summarise

Run Shared-4. Write to `.wag/docs/Architecture.html`. Tell the user what was rendered/preserved, which theme source was used, and remind them to commit the `.html` so the next refresh has a baseline.

## Key rules

1. **Architecture.md is the source.** This command never edits it.
2. **Diff-driven diagram review.** Stable diagrams stay; changed diagrams are reviewed before re-authoring.
3. **User reviews each new or changed diagram.** Never silently draw or replace.
4. **Self-contained output.** No externals.
