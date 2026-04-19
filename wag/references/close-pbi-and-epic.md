# Close PBI and Epic — canonical procedure

When PBIs and epics close, the filesystem reflects status. Active and closed work live in
mirrored folder trees:

```
.wag/backlog/
├── <epic-slug>/                  # active epic
│   ├── epic.md
│   └── PBI-NNN-*.md              # active PBIs
├── _completed/
│   ├── <epic-slug>/              # mirror of the epic, pre-created at epic authoring
│   │   ├── .gitkeep              # until the first PBI closes or the epic drains
│   │   └── PBI-NNN-*.md          # closed PBIs
│   └── PBI-NNN-*.md              # closed standalones (flat)
└── PBI-NNN-*.md                  # active standalones (flat)
```

## Pre-create the mirror at epic authoring

When `/wag:docs` creates a new epic at `backlog/<slug>/`, it also creates
`backlog/_completed/<slug>/` with a `.gitkeep` placeholder. The mirror always exists;
downstream close operations are simple moves with no create-if-missing logic.

## Close a PBI

Triggers:
- `/wag:dev` Phase 5 — implementation complete, PBI done.
- `/wag:adr` closed-without-ADR path — the grill dissolves the PBI's scope to trivial or zero.
- Rare: `/wag:snag` resolution eliminates the PBI entirely.

Procedure (PBI that belongs to an epic):

1. Add a closure note at the top of the PBI file if scope changed materially. Include:
   - A `**Status:** Closed <date> — <short reason>` line in the header.
   - A `> **Closure note.**` block summarising what actually happened vs what the PBI listed. Cite any SNAGs or LEARNINGs produced.
2. `mv backlog/<slug>/PBI-NNN-*.md backlog/_completed/<slug>/PBI-NNN-*.md`
3. Remove `.gitkeep` from the mirror if this is the first PBI closure there.
4. Check for epic drain (see below).

Procedure (standalone PBI — not in an epic):

1. Same closure note.
2. `mv backlog/PBI-NNN-*.md backlog/_completed/PBI-NNN-*.md`
3. No epic-drain check.

## Close an epic (drain detection + ceremony)

An epic is drained when its active folder `backlog/<slug>/` contains only `epic.md`
(no remaining PBI files).

Procedure:

1. Prompt the user: *"All PBIs in `<slug>` are complete. Mark the epic done?"* The prompt is a safety check — the user may want to add more PBIs later; draining doesn't always mean finished.
2. On yes:
   - Update `epic.md`: change header `**Status:**` to `Completed <date>`. Optionally add a `> **Closure note.**` block summarising each PBI's outcome (one line each).
   - `git mv backlog/<slug>/epic.md backlog/_completed/<slug>/epic.md` — same filename; the folder path already encodes the epic identity.
   - `rmdir backlog/<slug>/` — the active folder is now empty.
   - If `state.json.active_epic == <slug>`, set `active_epic: null`.
3. On no: leave as-is. The user will add more PBIs or explicitly close the epic later.

## Commit bundling

The closure edits + the `mv` + `state.json` changes commit together in a single commit.
Per project convention, `state.json` never commits separately from the work it represents
(see feedback memory `feedback_state_with_adr.md` where applicable).

## Migration note

This convention formalises what was done ad-hoc through SNAG-003 and the PBI-002 / PBI-003
closures on ChatR (2026-04-18 / 2026-04-19). Projects that adopted the older flat
`_completed/` pattern may have PBI files at `backlog/_completed/PBI-NNN-*.md` without an
epic-mirror folder — that's fine for standalones. For epic PBIs under the old pattern,
either leave them in place (historical) or `mv` into a reconstructed
`backlog/_completed/<slug>/` mirror during the next `/wag:docs` refresh.
