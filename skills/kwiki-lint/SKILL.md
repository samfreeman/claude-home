---
name: kwiki-lint
description: "Run wiki health checks. Use when the user asks 'kwiki lint', 'check wiki health'."
---

# kwiki-lint

Run health checks on the kwiki knowledge base.

## kwiki root

The wiki lives at `$KWIKI_ROOT` (defaults to `~/kwiki`).

## Workflow

1. **Glob** `$KWIKI_ROOT/wiki/*.md`
2. For each entry, **Read** and check:
   - Frontmatter present and valid (title, aliases list)
   - Has at least one `[[wikilink]]` in body (entries with zero links are orphans — flag them)
   - Body is not a pure summary (flag entries that look like "here's what X said" without the LLM's distillation)
3. **Grep** for broken wikilinks: for every `[[target]]` reference, check that `$KWIKI_ROOT/wiki/{target}.md` exists
4. Report issues grouped by type:

```
## Lint issues

**Orphans** (no wikilinks in body):
- entry-a
- entry-b

**Broken links**:
- entry-c references [[missing-entry]]

**Missing frontmatter**:
- entry-d (no aliases)
```

5. If issues found, offer to fix — but don't auto-fix without explicit approval.
