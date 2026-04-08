# kwiki lint

Run health checks on the kwiki knowledge base.

## Arguments

$ARGUMENTS — optional path to scope the check

## Instructions

1. Call `wiki_lint` with the path from $ARGUMENTS (or global if none given).
2. Present the results clearly, grouped by issue type:
   - Stale entries
   - Missing files
   - Broken links
   - Sparse aliases (entries with few or no aliases)
3. For sparse aliases, suggest additional aliases based on the entry content.
4. If issues are found, offer to fix them (e.g. `/kwiki/update` for sparse entries, `/kwiki/delete` for broken items).
