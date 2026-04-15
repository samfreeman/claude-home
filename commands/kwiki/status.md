---
name: kwiki-status
description: "Show kwiki wiki status. Use when the user says 'kwiki status', 'wiki status', 'what's in kwiki'."
---

# kwiki-status

Show the current state of the kwiki knowledge base.

## Tooling

**Pure filesystem. No MCP.** Use `cat`, `find`, `grep`, `wc` via bash. Do NOT use any kwiki MCP server tools. This wiki is entirely file-based.

## Wiki root

`$KWIKI_ROOT` — defaults to `/mnt/c/Users/samfr/Dropbox/Claude/kwiki`.

## Workflow

1. `cat $KWIKI_ROOT/index.md` — report page counts by category
2. `find $KWIKI_ROOT/raw -type f | wc -l` — count raw sources
3. `find $KWIKI_ROOT/wiki -name '*.md' | wc -l` — count wiki pages (compare against index to catch drift)
4. `tail -30 $KWIKI_ROOT/log.md` — show recent activity
5. Present a summary:

```
## kwiki Status

Sources: N raw files
Wiki pages: N total (M sources, P entities, Q concepts, R analyses)
Index entries: N (drift: X pages not in index)
Last activity: [date] — [verb] | [subject]

Recent log:
- [date] ingest | ...
- [date] query | ...
- [date] lint | ...
```
