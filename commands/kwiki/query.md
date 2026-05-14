---
name: kwiki-query
description: "Query the kwiki wiki. Use when the user says 'kwiki query [question]', 'ask kwiki', 'kwiki [question]'."
---

# kwiki-query

Ask questions against the kwiki knowledge base. The wiki is the primary source — answer from it, not from general knowledge.

## Tooling

**Pure filesystem.** Use `cat`, `find`, `grep` via bash and direct file read/write. This wiki is entirely file-based.

## Wiki root

`$KWIKI_ROOT` — defaults to `/mnt/c/Users/samfr/Dropbox/Claude/kwiki`.

## Arguments

`$ARGUMENTS` — the question.

## Workflow

### Step 1 — Read the index

`cat $KWIKI_ROOT/index.md` to find pages relevant to the question.

### Step 2 — Read relevant pages

`cat` the wiki pages identified from the index. Follow wikilinks to pull in related context. Read as many pages as needed — prefer depth over surface.

### Step 3 — Synthesize an answer

Answer the question using the wiki content. Cite pages with `[[wikilinks]]`:

> The LLM Wiki pattern ([[llm-wiki-pattern]]) differs from RAG ([[rag]]) in that...

If the wiki doesn't have enough information to answer, say so explicitly and suggest what sources could be ingested to fill the gap.

### Step 4 — Offer to file the answer

If the answer is substantive — a comparison, a synthesis, an analysis — offer to save it as a new wiki page. Good answers shouldn't vanish into chat history.

If the user agrees:
1. Write the answer as `wiki/{descriptive-slug}.md` with proper frontmatter and wikilinks
2. Read `index.md`, add the new page under Analyses, write it back
3. Append to `log.md`: `## [YYYY-MM-DD] query | Question summary`

## Principles

- **Wiki first.** The wiki IS the knowledge base. Don't bypass it with general knowledge.
- **Cite pages.** Every claim should trace to a wiki page.
- **Compound the wiki.** Good answers become new pages.
