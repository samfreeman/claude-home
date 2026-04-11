---
name: kwiki-delete
description: "Delete a wiki entry or raw item. Use when the user asks to 'delete from kwiki', 'remove wiki entry'."
---

# kwiki delete

Delete a wiki entry or raw item.

## Arguments

$ARGUMENTS — what to delete (entry name or raw ID)

## Instructions

1. Parse $ARGUMENTS to determine what the user wants to delete.
2. Before deleting, read/show the item so the user can confirm.
3. Explain what will happen:
   - Entry delete: removes the entry and its file
   - Raw delete: physical delete of the raw item
4. Get explicit confirmation before calling `wiki_delete`.
5. Confirm the deletion.
