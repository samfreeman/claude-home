---
name: kwiki-update
description: "Update an existing wiki entry. Use when the user asks to 'update kwiki entry', 'edit wiki entry', 'change the entry on...'."
---

# kwiki-update

Update an existing wiki entry. The update replaces the file — read first, write second.

## kwiki root

The wiki lives at `$KWIKI_ROOT` (defaults to `~/kwiki`).

## Arguments

`$ARGUMENTS` — what to change (e.g. "the entry on v8 isolates — add a note about Firecracker").

## Workflow

1. **Resolve the target entry.** Use the kwiki:read command or Glob + Read to find the right file
2. **Read** `$KWIKI_ROOT/wiki/{slug}.md` in full
3. **Load the wiki context** — Glob and read other entries that may be relevant to the update. Same mandatory step as kwiki:capture
4. Construct the new body. Preserve frontmatter (update the `updated` timestamp). Include `[[wikilinks]]` to related existing entries wherever the new body mentions them
5. Present the diff to the user and wait for approval
6. **Write** the file with the updated content

## Principles

- Update is just read + edit + write. No tools hide it.
- Wikilinks are STILL mandatory on updates. If the new body mentions something with an entry, link it.
- Don't lose existing wikilinks in the body. Preserve or improve.
