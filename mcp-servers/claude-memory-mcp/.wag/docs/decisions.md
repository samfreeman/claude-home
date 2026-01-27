# claude-memory - Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-27 | Use single handler file for all workstream tools | Keeps related logic together, matches existing pattern |
| 2026-01-27 | Lookup by name or id for workstreams | Consistent with relay tools, user-friendly |
| 2026-01-27 | CASCADE delete on workstream | Prevents orphaned records |
