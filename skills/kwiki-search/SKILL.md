---
name: kwiki-search
description: "Search the kwiki knowledge base. Use when the user asks to 'search kwiki', 'find in wiki', or says 'kwiki [topic]'."
---

# kwiki-search

Search the kwiki knowledge base for the user's query.

## kwiki root

The wiki lives at `$KWIKI_ROOT` (defaults to `~/kwiki`).

## Arguments

`$ARGUMENTS` — the search query.

## Workflow

1. **Grep** `$KWIKI_ROOT/wiki/` with the query (case-insensitive). This finds matches in titles, aliases, body text, wikilinks, everything
2. If Grep returns results, **Read** the top matches in full and present them
3. If Grep returns nothing, **Glob** `$KWIKI_ROOT/wiki/*.md` and **Read** the frontmatter of all entries. Look for semantic matches — entries that are about the query even if they don't contain the exact words
4. Present what you find. If nothing matches even semantically, say so

Prefer reading a few entries in full over many entries shallowly. The user wants context, not a hit list.
