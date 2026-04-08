# kwiki update

Update the body content of an existing wiki entry.

## Arguments

$ARGUMENTS — the entry to update and what to change

## Instructions

1. Parse $ARGUMENTS for the node path and entry name.
2. Call `wiki_read` to fetch the current content.
3. Present the current content and the proposed changes to the user.
4. After approval, call `wiki_update` with the new body.
5. Confirm the update.
