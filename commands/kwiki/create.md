# kwiki create

Create a new node in the wiki tree.

## Arguments

$ARGUMENTS — the path and description for the new node

## Instructions

1. Parse $ARGUMENTS for the node path and description.
2. Call `wiki_list` at the root to show existing nodes for context.
3. Confirm the path and description with the user before creating.
4. Call `wiki_create` with path, description, and optionally aliases and tags.
5. Confirm the node was created.
