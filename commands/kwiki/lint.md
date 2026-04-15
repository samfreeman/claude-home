---
name: kwiki-lint
description: "Health-check the kwiki wiki. Use when the user says 'kwiki lint', 'check kwiki health'."
---

# kwiki-lint

Periodic health check for the kwiki knowledge base. Run every 5-10 ingests or when things feel stale.

## Tooling

**Pure filesystem. No MCP.** Use `cat`, `find`, `grep` via bash and direct file read/write. Do NOT use any kwiki MCP server tools. This wiki is entirely file-based.

## Wiki root

`$KWIKI_ROOT` — defaults to `/mnt/c/Users/samfr/Dropbox/Claude/kwiki`.

## Workflow

### Step 1 — Inventory

1. `find $KWIKI_ROOT/wiki -name '*.md'` to get all pages
2. `cat` each page's frontmatter and body
3. Build a full picture: what exists, what links to what

### Step 2 — Check for issues

Scan for these issue types, in priority order:

**Contradictions** — pages that make conflicting claims about the same thing. Flag with the specific claims and which sources back each side.

**Stale claims** — information that newer sources have superseded. Check source dates against claim dates.

**Broken wikilinks** — `[[target]]` references where `wiki/{target}.md` doesn't exist. Use `grep -oP '\[\[([^\]]+)\]\]'` to extract all wikilinks, then check each target file exists.

**Orphan pages** — pages with zero inbound links from other pages. `grep -rl` across all wiki pages to find which pages are never referenced.

**Missing pages** — concepts mentioned repeatedly in body text but lacking their own page.

**Missing cross-references** — pages that discuss the same topic but don't link to each other.

**Weak pages** — pages with no wikilinks in their body (isolated nodes).

**Index drift** — pages that exist on disk but aren't listed in `index.md`, or index entries pointing to missing pages. Compare `find` output against `grep` of index.md.

### Step 3 — Report

Present issues grouped by type with severity:

```
## Lint Report — YYYY-MM-DD

### 🔴 Errors (fix now)
- Broken link: [[missing-page]] referenced from wiki/some-page.md
- Index drift: wiki/unlisted-page.md not in index.md

### 🟡 Warnings (fix soon)
- Orphan: wiki/isolated-concept.md (0 inbound links)
- Contradiction: wiki/page-a.md and wiki/page-b.md disagree on X

### 🔵 Info (consider)
- Missing page: "concept X" mentioned 4 times but has no page
- Weak page: wiki/thin-page.md has no outbound wikilinks
```

### Step 4 — Offer fixes

For each issue, propose a specific fix. Don't auto-fix — present the plan and wait for approval.

### Step 5 — Log

Append to `$KWIKI_ROOT/log.md`:

```
## [YYYY-MM-DD] lint | Health check

Issues found: X errors, Y warnings, Z info.
Fixed: [list of fixes applied after user approval]
```
