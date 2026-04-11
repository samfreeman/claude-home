---
name: kwiki-read
description: "Read a wiki entry. Use when the user asks to 'read kwiki entry', 'show me the entry on...', 'what does kwiki say about...'."
---

# kwiki read

Read a specific wiki entry.

## Arguments

$ARGUMENTS — the entry name to read

## Instructions

1. Parse $ARGUMENTS to extract the entry name.
2. If ambiguous, call `wiki_search` or `wiki_list` to find the right entry.
3. Call `wiki_read` with the entry name.
4. Present the full entry content to the user.
