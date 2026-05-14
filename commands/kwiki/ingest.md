---
name: kwiki-ingest
description: "Ingest a source into the kwiki wiki. Use when the user says 'kwiki ingest [path|url|text]', 'add to kwiki', 'ingest this'."
---

# kwiki-ingest

Ingest a source into the kwiki knowledge base. This is the primary operation — it reads a source, creates/updates wiki pages, maintains cross-references, and updates the index.

## Tooling

**Pure filesystem.** Use `cat`, `find`, `grep`, `cp`, `ls` via bash and direct file read/write. This wiki is entirely file-based.

## Wiki root

`$KWIKI_ROOT` — defaults to `/mnt/c/Users/samfr/Dropbox/Claude/kwiki`.

## Arguments

`$ARGUMENTS` — the source to ingest. Can be:

| Form | Detection | Action |
|------|-----------|--------|
| File path | Starts with `/` or `~/` and file exists | `cat` the file |
| URL | Starts with `http://` or `https://` | `curl` and extract content |
| Inline text | Multi-line or long single line | Use directly |
| Description | Short text | Treat as topic — ask the user for more |

## Workflow

### Step 1 — Save the raw source

Copy or write the source material into `$KWIKI_ROOT/raw/`. This is the immutable record. Never modify raw files after creation.

- File: `cp` to `raw/{original-filename}`
- URL: save extracted content as `raw/{slugified-title}.md` with source URL in frontmatter
- Inline text: write as `raw/{descriptive-slug}.md`

### Step 2 — Read the wiki context (MANDATORY)

Before writing any wiki pages:

1. `cat $KWIKI_ROOT/index.md` to understand what already exists
2. `cat` wiki pages relevant to the new content
3. Build a mental map: what's covered, what's missing, what needs updating

Do NOT skip this. If you skip it, cross-references won't happen and the wiki stays flat.

### Step 3 — Discuss with the user

Present key takeaways from the source. Ask what to emphasize. A single source might warrant:

- A source summary page (always)
- New entity pages (people, tools, concepts that deserve their own page)
- Updates to existing pages (new information about something already in the wiki)

Propose a plan as a table:

```
| Action | Page | What changes |
|--------|------|-------------|
| Create | wiki/sources/karpathy-llm-wiki.md | Source summary |
| Create | wiki/llm-wiki-pattern.md | New concept page |
| Update | wiki/rag.md | Add contrast with wiki pattern |
```

Wait for the user's approval before writing.

### Step 4 — Write pages

For each page in the approved plan:

1. **Source summary** → write to `wiki/sources/{slug}.md`. Links back to the raw file. Contains key points, not a copy of the source.
2. **New pages** → write to `wiki/{slug}.md`. One concept per page. Use `[[wikilinks]]` to reference existing pages wherever the text discusses them.
3. **Updated pages** → `cat` the existing page, integrate the new information, add/update wikilinks, write the full file back. Don't overwrite — weave in.

Page format:
```markdown
---
title: Page Title
created: YYYY-MM-DDTHH:MM:SS
source: "[[sources/source-slug]]"
tags: [tag1, tag2]
---

# Page Title

One-line summary.

Body with [[wikilinks]] to related pages.
```

Filenames: lowercase, hyphens, no spaces.

### Step 5 — Update index

Read `$KWIKI_ROOT/index.md`, add new pages under the appropriate category with a one-line summary and link, write the full file back.

### Step 6 — Update log

Append to `$KWIKI_ROOT/log.md`:

```
## [YYYY-MM-DD] ingest | Source Title

Summary of what was ingested and what pages were created/updated.
Pages touched: wiki/sources/foo.md, wiki/bar.md, wiki/baz.md
```

### Step 7 — Report

Confirm what was created and updated. List the wikilinks that were added.

## Principles

- **One source at a time.** Stay involved. Quality over throughput.
- **Read before write.** The cross-references are the point.
- **The wiki compounds.** Every ingest should make the whole wiki richer, not just add an isolated page.
- **Raw is immutable.** Once saved, never touch it.
