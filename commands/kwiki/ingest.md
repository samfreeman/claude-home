# kwiki ingest

Add content to the kwiki raw intake hopper for later processing.

## Arguments

$ARGUMENTS — description of what to ingest, or a URL

## Instructions

1. Determine what the user wants to ingest from $ARGUMENTS.
2. If a URL is provided, fetch the content and extract the relevant text.
3. Call `wiki_ingest` with:
   - **title** — clear descriptive title
   - **content** — the raw content
   - **source_url** — if a URL was provided
   - **source_type** — one of: youtube, article, pdf, conversation, other
4. Confirm the item was added to the hopper.
5. Ask the user if they want to process it now (run `/kwiki/process`).
