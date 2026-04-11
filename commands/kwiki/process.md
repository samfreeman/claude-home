# kwiki process

Process unprocessed raw items in the kwiki intake hopper.

## Instructions

1. Call `wiki_status` to find unprocessed raws.
2. If none, tell the user and stop.
3. For each unprocessed raw, read it from the filesystem at the kwiki data root (`/mnt/c/Users/samfr/Dropbox/Claude/kwiki/raw/<raw_id>.md`).
4. Also call `wiki_list` at the root to see available nodes, so you can pick the best target path.
5. For each raw item, extract:
   - **title** — clear, descriptive title
   - **body** — the core content, cleaned up and well-structured
   - **aliases** — generous list of alternative names someone might search for. Include abbreviations, acronyms, informal names, and related terms.
   - **tags** — be aggressive here. Extract every meaningful searchable term from the content. Include:
     - Primary topic tags (the obvious ones)
     - Technology/tool names mentioned (e.g. `turso`, `kysely`, `sqlite`)
     - Pattern/concept names (e.g. `isolation`, `promote-up`)
     - Domain terms someone might search for (e.g. `saas`, `connection-strings`, `env-vars`)
     - Action words that describe what this is about (e.g. `seeding`, `migration`)
     - **Minimum 3 tags** (hard server-side rule — `wiki_process` rejects with `InsufficientTagsError` if fewer). Aim for 10-20 per entry.
     - **Format tags as plain comma-separated strings** (e.g. `saas, turso, libsql`). Do NOT pass JSON arrays like `["saas", "turso"]` — the brackets and quotes get stored literally and corrupt the tag index.
   - **target_path** — which node this belongs under
   - **focus** — what the extraction focused on

6. Present the extraction to the user for approval before calling `wiki_process`.
7. After `wiki_process` succeeds, the server automatically auto-links this entry to any existing entries in other nodes with a tag/alias overlap score >= 2.0 (tag = 1.0, alias = 0.5). You do NOT need to call `wiki_link` — that's for manual cross-references only.
8. If `wiki_process` returns `InsufficientTagsError`, re-extract with more tags and retry. This is a programming error, not a user issue.
