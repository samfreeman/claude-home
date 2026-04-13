---
name: kwiki-status
description: "Show wiki overview. Use when the user asks 'kwiki status', 'wiki health', 'what's pending in kwiki'."
---

# kwiki-status

Show the current state of the kwiki knowledge base.

## kwiki root

The wiki lives at `$KWIKI_ROOT` (defaults to `~/kwiki`).

## Workflow

1. **Glob** `$KWIKI_ROOT/wiki/*.md` — entry count
2. **Glob** `$KWIKI_ROOT/raw/*.md` — unprocessed raw count (if raw directory exists)
3. Present a clean overview:

```
## kwiki status
- entries: N
- raws (unprocessed): M
```

Keep it brief.
