# kwiki link

Create a cross-reference between two wiki entries in different nodes.

## Arguments

$ARGUMENTS — the two entries to link

## Instructions

1. Parse $ARGUMENTS for the source and target entries.
2. If ambiguous, use `wiki_search` or `wiki_list` to find the right entries.
3. Confirm the link with the user: "Link [from_path/from_entry] -> [to_path/to_entry]"
4. Call `wiki_link` with the paths, entries, and an optional note about the relationship.
5. Confirm the link was created.

Note: `wiki_link` creates **manual** links (marked `auto: false`). Manual links are preserved when tags/aliases are updated on either end — they're never touched by the auto-link recomputation pass. Use this tool for relationships that overlap doesn't capture (e.g. "this pattern superseded that one", "cross-domain analogy").
