# Close PBI and Epic — canonical procedure

When PBIs and epics close, the filesystem reflects status. Active and closed work live in
mirrored folder trees:

```
.wag/backlog/
├── epic-NNN-word/                # active epic
│   ├── epic.md
│   └── PBI-PPP.md                # active PBIs (per-epic numbering)
└── _completed/
    └── epic-NNN-word/            # mirror of the epic, pre-created at epic authoring
        ├── .gitkeep              # until the first PBI closes or the epic drains
        └── PBI-PPP.md            # closed PBIs
```

Every PBI lives in an epic. Loose work — bug fixes, small UI tweaks, afterthoughts — lives
in `epic-000-general/`, the permanent bucket for ungrouped PBIs.

## Pre-create the mirror at epic authoring

When `/wag:docs` creates a new epic at `backlog/epic-NNN-word/`, it also creates
`backlog/_completed/epic-NNN-word/` with a `.gitkeep` placeholder. The mirror always exists;
downstream close operations are simple moves with no create-if-missing logic.

`epic-000-general/` and its mirror are created during `/wag:init` and exist for every project.

## Close a PBI

Triggers:
- `/wag:dev` Phase 5 — implementation complete, PBI done.
- `/wag:adr` closed-without-ADR path — the grill dissolves the PBI's scope to trivial or zero.
- Rare: inline snag resolution (per `~/.claude/wag/workflows/snag-resolution.md`) eliminates the PBI entirely.

Procedure:

1. Add a closure note at the top of the PBI file if scope changed materially. Include:
   - A `**Status:** Closed <date> — <short reason>` line in the header.
   - A `> **Closure note.**` block summarising what actually happened vs what the PBI listed. Cite any SNAGs produced.
2. `git mv backlog/epic-NNN-word/PBI-PPP.md backlog/_completed/epic-NNN-word/PBI-PPP.md`
3. Remove `.gitkeep` from the mirror if this is the first PBI closure there.
4. Check for epic drain (see below). **Skip the drain check for `epic-000-general`** — it's a permanent bucket and never drains in any meaningful sense.

## Close an epic (drain detection + ceremony)

An epic is drained when its active folder `backlog/epic-NNN-word/` contains only `epic.md`
(no remaining PBI files). The drain check does not apply to `epic-000-general`.

Procedure:

1. Prompt the user: *"All PBIs in `epic-NNN-word` are complete. Mark the epic done?"* The prompt is a safety check — the user may want to add more PBIs later; draining doesn't always mean finished.
2. On yes:
   - Update `epic.md`: change header `**Status:**` to `Completed <date>`. Optionally add a `> **Closure note.**` block summarising each PBI's outcome (one line each).
   - `git mv backlog/epic-NNN-word/epic.md backlog/_completed/epic-NNN-word/epic.md` — same filename; the folder path already encodes the epic identity.
   - `rmdir backlog/epic-NNN-word/` — the active folder is now empty.
   - If `state.json.active_epic == "epic-NNN-word"`, set `active_epic` back to `"epic-000-general"` (the default bucket). `active_epic` is never null in the per-epic scheme.
3. On no: leave as-is. The user will add more PBIs or explicitly close the epic later.

## Commit bundling

The closure edits + the `mv` + `state.json` changes commit together in a single commit.
Per project convention, `state.json` never commits separately from the work it represents
(see feedback memory `feedback_state_with_adr.md` where applicable).

## Migration note

Projects that adopted the older scheme (global PBI sequence, standalone PBIs at backlog root, descriptive slugs in filenames) migrate one at a time via `/wag:migrate-backlog` when work resumes on the project. New projects use the per-epic numbering and `epic-000-general` bucket from `/wag:init` onward.
