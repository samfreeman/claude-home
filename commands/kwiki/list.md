---
name: kwiki-list
description: "Show wiki entries. Use when the user asks 'what's in kwiki', 'list wiki', 'show entries', or wants to see all wiki content."
---

# kwiki-list

List all entries in the kwiki knowledge base.

## kwiki root

The wiki lives at `$KWIKI_ROOT` (defaults to `~/kwiki`).

## Workflow

1. **Glob** `$KWIKI_ROOT/wiki/*.md`
2. For each file, **Read** the frontmatter (title + aliases) — just enough to show the user
3. Present as a list:

```
## Entries (N)

- **{slug}** — {title}
  aliases: {comma-separated aliases}
```

Keep it brief. Don't dump full bodies unless the user asks.
