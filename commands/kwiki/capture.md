# kwiki capture

Capture content directly into the wiki in one step. Ingests the raw, processes it, and auto-links — all in a single server-side call.

## Arguments

$ARGUMENTS — content to capture (description, URL, or inline text)

## Instructions

1. Determine what the user wants to capture from $ARGUMENTS.
2. If a URL is provided, fetch and extract the content.
3. Call `wiki_list` at the root to see available target nodes.
4. Extract:
   - **title** — clear descriptive title (used for both raw filename and entry name)
   - **body** — core content, cleaned up and well-structured
   - **aliases** — generous list: abbreviations, acronyms, informal names, related terms
   - **tags** — aggressive: 10-20 tags covering technology names, pattern/concept names, domain terms, action words. **Minimum 3 tags** (hard server-side rule).
   - **target_path** — which node this belongs under
   - **source_url**, **source_type** — if known (source_type must be one of: youtube, article, pdf, conversation, other)
   - **focus** — what the extraction focused on
5. Present the extraction to the user for approval.
6. After approval, call `wiki_capture` with the full argument set.
7. Confirm: raw written, entry created. Auto-linking happens automatically on the server — no `wiki_link` calls needed.
8. If `wiki_capture` returns `InsufficientTagsError`, re-extract with more tags and retry.
