---
name: kwiki-read
description: "Read a wiki entry. Use when the user asks to 'read kwiki entry', 'show me the entry on...', 'what does kwiki say about...'."
---

# kwiki-read

Read a specific wiki entry from the kwiki knowledge base.

## kwiki root

The wiki lives at `$KWIKI_ROOT` (defaults to `~/kwiki`).

## Arguments

`$ARGUMENTS` — the entry slug or a name/alias to find.

## Workflow

1. Try the direct path first: **Read** `$KWIKI_ROOT/wiki/{slug}.md` if the argument looks like a slug
2. If not found, **Glob** `$KWIKI_ROOT/wiki/*.md` and **Read** frontmatter of candidates, matching against title or aliases (case-insensitive)
3. Once matched, **Read** the full file
4. Present the full entry content — frontmatter + body — to the user

If multiple entries match, show the user the candidates and ask which one they want.
