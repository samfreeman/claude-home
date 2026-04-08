# kwiki delete

Delete a wiki entry, raw item, or node.

## Arguments

$ARGUMENTS — what to delete (entry, raw, or node path)

## Instructions

1. Parse $ARGUMENTS to determine what the user wants to delete.
2. Before deleting, read/show the item so the user can confirm.
3. Explain what will happen:
   - Entry delete: de-indexes from parent and deletes the file
   - Raw delete: physical delete of the raw item
   - Node delete (path only): logical de-index from parent
   - Node delete with purge: physical delete of de-indexed storage
4. Get explicit confirmation before calling `wiki_delete`.
5. Confirm the deletion.
