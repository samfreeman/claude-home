---
name: kwiki-capture
description: "Conversational kwiki knowledge capture from rough voice or text input. Use this skill whenever the user wants to save something to their wiki/kwiki, capture a decision, record what they learned, document a pattern, or says things like 'add this to kwiki', 'capture this', 'remember this pattern', 'I just learned...'"
---

# kwiki-capture

Capture knowledge into the kwiki knowledge base. The LLM reads existing entries, decomposes new content into atomic concepts, and writes new entries that reference existing ones via `[[wikilinks]]`.

**This is curation, not form-filling.** You MUST read the existing wiki before writing anything. New entries MUST include `[[wikilinks]]` to related existing entries wherever the body text discusses something that already has an entry.

## kwiki root

The wiki lives at `$KWIKI_ROOT` (defaults to `~/kwiki`). Check the env var first. If unset, use `~/kwiki`.

Structure:

```
~/kwiki/
  wiki/           # wiki entries (*.md)
  raw/            # raw source material (*.md)
```

## Entry format

Each wiki entry is a markdown file with YAML frontmatter:

```markdown
---
title: Clear Human-Readable Title
aliases:
  - alternative name
  - another alias
  - acronym
source_type: youtube | article | pdf | conversation | other
source_url: https://...    # optional
created: 2026-04-12T...
---

Body content with [[wikilinks]] to related entries.
```

**Entry filename** is the slug of the title: `lowercase-with-hyphens.md`. Wikilinks use the slug: `[[lowercase-with-hyphens]]`.

## Workflow

### Step 1 — Load input

Detect the form of `$ARGUMENTS`:

| Form | Detection | Action |
|------|-----------|--------|
| File path | Starts with `/` or `~/` and file exists | Read the file |
| URL | Starts with `http://` or `https://` | Fetch and extract content |
| Inline text | Multi-line or long single line | Use directly |
| Description | Short text | Treat as topic for conversational capture |

### Step 2 — Load the wiki context (MANDATORY)

Before writing anything:

1. **Glob** `$KWIKI_ROOT/wiki/*.md` to get the full list of existing entries
2. **Read** entries relevant to the new content. Start with frontmatter (title + aliases) to find candidates, then read full bodies for the closest matches
3. Build a mental index: which entries exist, what they cover, what slugs and aliases they use

Do NOT skip this step. If you skip it, wikilinks won't get inserted and the graph stays disconnected.

### Step 3 — Decompose the input

Identify the atomic concepts, tools, people, techniques, and decisions in the input. Ask: does each of these deserve its own entry, or is it a passing mention?

**Rules of thumb:**
- A concept that has its own name and a distinct meaning → its own entry
- A summary of multiple concepts → split into atomic entries, one per concept
- Passing mentions of existing entries → wikilink, don't duplicate
- Don't create summary entries. Create concept entries.

Propose a split plan as a table:

```
| # | New entry slug | What it is | Links to existing |
|---|----------------|------------|-------------------|
| 1 | v8-isolates | sandboxing tech | [[agent-sandboxing-and-isolation]] |
| 2 | ... | ... | ... |
```

Present the plan to the user and wait for approval. The user may adjust boundaries, rename, merge, split.

### Step 4 — Write each entry

For each entry in the approved plan:

1. Write the body text. Wherever it mentions an existing entry by name, alias, or concept — wrap it as `[[existing-entry-slug]]`. Use the slug, not the alias text. Obsidian resolves on filename.
2. Write a new file at `$KWIKI_ROOT/wiki/{slug}.md` using the Write tool, with the frontmatter format above
3. Do NOT write to an index file. The wiki discovers entries via Glob — no index needed

### Step 5 — Verify and report

- Confirm each file was created
- Report the entries captured and the wikilinks inserted

## Principles

1. **Read before write.** Always. This is the difference between a wiki and a pile of notes.
2. **Atomic entries.** One concept per entry. Decompose.
3. **Wikilinks use slugs.** `[[v8-isolates]]` not `[[V8 Isolates]]`. The filename is the target.
4. **Existing entries are truth.** Don't duplicate. Link.
5. **The graph is the test.** If the entries don't cross-reference, you did it wrong.
