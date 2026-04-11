---
name: kwiki-lint
description: "Run wiki health checks. Use when the user asks 'kwiki lint', 'check wiki health'."
---

# kwiki lint

Run health checks on the kwiki knowledge base.

## Instructions

1. Call `wiki_lint` (no arguments needed).
2. Present the results clearly, grouped by issue type:
   - Stale entries
   - Missing files
   - Broken links
   - Sparse aliases (entries with few or no aliases)
3. For sparse aliases, suggest additional aliases based on the entry content.
4. If issues are found, offer to fix them (e.g. `/kwiki:update` for sparse entries, `/kwiki:delete` for broken items).
