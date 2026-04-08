# kwiki read

Read a specific wiki entry.

## Arguments

$ARGUMENTS — the entry to read, as "path/entry" or "path entry"

## Instructions

1. Parse $ARGUMENTS to extract the node path and entry name.
2. If ambiguous, call `wiki_search` or `wiki_list` to find the right entry.
3. Call `wiki_read` with the path and entry name.
4. Present the full entry content to the user.
