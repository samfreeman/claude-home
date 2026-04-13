---
name: kwiki-delete
description: "Delete a wiki entry. Use when the user asks to 'delete from kwiki', 'remove wiki entry'."
---

# kwiki-delete

Delete a wiki entry from the kwiki knowledge base.

## kwiki root

The wiki lives at `$KWIKI_ROOT` (defaults to `~/kwiki`).

## Arguments

`$ARGUMENTS` — what to delete.

## Workflow

1. **Resolve the target** via Glob + Read
2. **Show** the full entry to the user so they can confirm
3. **Warn** about consequences: other entries may have `[[wikilinks]]` pointing at this one — they'll become broken references (not file-level errors, but broken in Obsidian)
4. Optionally **Grep** `$KWIKI_ROOT/wiki/` for `[[{slug}]]` to show which entries link to this one
5. Get explicit confirmation
6. Use Bash `rm` to delete the file
