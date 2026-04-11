---
name: kwiki-update
description: "Update an existing wiki entry. Use when the user asks to 'update kwiki entry', 'edit wiki entry', 'change the entry on...'."
---

# kwiki update

Update an existing wiki entry. Can change body, tags, aliases, or any combination.

## Arguments

$ARGUMENTS — the entry to update and what to change (e.g. "database-isolation-pattern add saas tag")

## Instructions

1. Parse $ARGUMENTS for the entry name and what's being changed.
2. Call `wiki_read` to fetch the current content.
3. Determine which fields to update:
   - **body** — if the user wants content rewritten
   - **tags** — if the user wants tags added, removed, or replaced. **`wiki_update` REPLACES the tag set**, so when adding, pass the FULL merged list (existing + new).
   - **aliases** — same rule: `wiki_update` replaces, so pass the full merged list.
4. If tags are being updated, ensure the final count is **minimum 3** — the server rejects `<3` with `InsufficientTagsError`.
5. Present the current state and the proposed changes to the user.
6. After approval, call `wiki_update` with only the fields that are changing. Omit fields that shouldn't change.
7. Confirm the update. Note: if tags or aliases changed, auto-links are recomputed on the server. Manual links are preserved.
8. If `wiki_update` returns an error, diagnose and retry — do not surface raw errors to the user without context.
