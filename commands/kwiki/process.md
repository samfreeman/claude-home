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
     - Aim for 10-20 tags per entry. More is better than fewer — tags are the search index.
   - **target_path** — which node this belongs under
   - **focus** — what the extraction focused on

6. Present the extraction to the user for approval before calling `wiki_process`.
7. After processing, confirm success.
