# kwiki search

Search the kwiki knowledge base for the user's query.

## Arguments

$ARGUMENTS — the search query

## Instructions

1. Call `wiki_search` with the query from $ARGUMENTS.
2. If no results, try synonyms, abbreviations, or related terms (e.g. "db" for "database", "auth" for "authentication"). Try up to 3 alternative queries before giving up.
3. For each match, call `wiki_read` to fetch the full entry.
4. Present a concise summary of what was found. If multiple entries matched, highlight the most relevant one first.
5. If nothing was found after retries, say so and suggest what terms might exist based on `wiki_status`.
