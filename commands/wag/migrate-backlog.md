---
description: Migrate a project's existing backlog to the per-epic numbering scheme — one-time, conversational, user-driven
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG Migrate-Backlog — One-time scheme migration

The WAG backlog convention changed. The current scheme is documented in:
- `~/.claude/wag/templates/backlog-epic.md`
- `~/.claude/wag/templates/backlog-pbi.md`
- `~/.claude/wag/references/close-pbi-and-epic.md`
- `~/.claude/wag/workflows/init.md` (Phase C / Phase D)

This command **does not auto-migrate**. It surveys the project, explains the new scheme, and walks the user through a stepwise migration. Every step is approved before execution. Each project is different — there is no one-size-fits-all transform.

Use this when a project initialised under the legacy scheme is being reopened for work, and `/wag:adr` or `/wag:docs` flags template drift.

## What's different in the new scheme

Old scheme (legacy):
- PBIs were numbered in a single global sequence: `PBI-001`, `PBI-002`, … project-wide.
- Filenames carried a descriptive slug: `PBI-NNN-some-feature.md`, `epic-NNN-some-area/`.
- Standalone PBIs lived at the backlog root: `.wag/backlog/PBI-NNN-slug.md`.
- `state.json.active_epic` could be `null` (standalone work mode).
- ADR files: `PBI-XXX-ADR.md`. Branches: `feature/PBI-XXX`. Display: `PBI-XXX`.

New scheme (per-epic):
- PBIs are numbered **within each epic**, starting at `001`. Canonical ID is `PBI EEE.PPP` (epic number dot per-epic number, both zero-padded triples).
- Epic folders use a one-word descriptor: `epic-001-auth/`, `epic-002-billing/`.
- PBI filenames carry only the local number: `PBI-PPP.md`. The epic number comes from the folder.
- Every PBI lives in an epic. There is no "standalone PBI at the backlog root." Loose work — bug fixes, small UI tweaks, afterthoughts — lives in `epic-000-general/`, which always exists.
- `state.json.active_epic` is never null. Default is `"epic-000-general"`.
- ADR files: `ADR-EEE.PPP.md`. Branches: `feature/PBI-EEE.PPP`. Display: `PBI EEE.PPP`.

## Phase 1: Survey

1. Confirm `.wag/` exists. If not, this isn't a WAG project — stop.
2. Read `.wag/state.json`. Note the current `active_epic`, `active_pbi`, `feature_branch` values.
3. List `.wag/backlog/` contents:
   - Epic folders (anything matching `epic-*/`).
   - Standalone PBI files at the root (anything matching `PBI-*.md` not in an epic folder).
   - Completed work in `.wag/backlog/_completed/` (both epic-mirror subfolders and flat standalone PBIs).
4. List `.wag/adr/active/` — any open ADR uses the legacy `PBI-XXX-ADR.md` naming and will need renaming during migration.
5. Note the current branch with `git branch --show-current`. If it's a `feature/PBI-XXX` legacy-form branch, it will need renaming.

Present the survey to the user as a plain summary:

> "Found:
> - N feature epics: epic-001-foo, epic-002-bar, …
> - M standalone PBIs at the backlog root
> - K completed PBIs (in mirrors / flat)
> - Open ADR: PBI-XXX-ADR.md (or: none)
> - Active branch: feature/PBI-XXX (or: not on a feature branch)
> - state.json: active_epic=…, active_pbi=…, feature_branch=…"

## Phase 2: Plan the migration

Walk through each decision with the user. Don't move files yet.

### Decision 1: Epic shape and folder renames

Migration is the right moment to check that legacy epics are actually business objectives, not categories. An epic should be a coherent outcome (e.g., "users can sign in," "customers can subscribe") whose PBIs may span backend, frontend, schema, and docs — *not* a category like "database changes" or "refactoring" or "bugs."

For each existing `epic-NNN-slug/`:

1. **Is it a real business objective?**
   - If yes → continue to the rename below.
   - If no (it's a category) → propose dissolving it. Its PBIs either get redistributed into real business epics, or drop into `epic-000-general`. The epic folder itself is removed (its `epic.md` doesn't survive).
2. **Folder rename.** For epics that survive, propose a one-word replacement if the current slug is multi-word or undesirable (e.g., `epic-001-invite-only-auth-flow` → `epic-001-auth`). The epic *number* stays. Renaming changes the folder slug only.

Confirm each decision with the user. They may keep some epics and slugs as-is.

### Decision 2: epic-000-general

`epic-000-general/` doesn't exist in the legacy scheme. We create it.

- Create the folder.
- Create the mirror `_completed/epic-000-general/` with a `.gitkeep`.
- Write a stub `epic.md` per the template in `~/.claude/wag/workflows/init.md` Phase D.

### Decision 3: Migrate standalone PBIs

Each standalone PBI (`backlog/PBI-NNN-slug.md`) moves into an epic. Two choices per PBI:
- **Move into `epic-000-general`** — the default. Renumber to the next local slot in that epic.
- **Lift into a feature epic** — if the PBI clearly belongs to one. Renumber to the next local slot in that epic.

The user decides per PBI. Same logic applies to completed standalones in `_completed/PBI-NNN-slug.md`.

### Decision 4: Per-epic renumbering

For each epic (legacy or new), build a clean per-epic sequence that reflects chronology — earlier work gets lower numbers. Closed PBIs happened before any still-open PBIs in the same epic, so they take the low slots. Concretely:

1. **Number completed PBIs first**, in completion order (oldest closure → newest). The original legacy PBI number is usually a good chronological proxy; otherwise fall back to file mtime in `_completed/` or `git log --diff-filter=A` for the file.
2. **Number active PBIs next**, in dependency order (same-epic deps reference lower local numbers), taking the slots immediately after the last completed PBI.

This is the one and only window where completed PBIs can be renumbered. After migration the immutability rule reapplies, and new PBIs always take the next free slot — which guarantees that in a mixed epic the active PBIs sit above the closed ones, matching the order work actually happened.

Present the proposed numbering as a mapping table per epic. Example:

> Epic 001 (auth):
> - Completed: PBI 001.001 (was PBI-001 scaffold), PBI 001.002 (was PBI-002 schema)
> - Active:    PBI 001.003 (was PBI-003 invite-flow), PBI 001.004 (was PBI-007 magic-link)

Confirm before moving.

### Decision 5: Filename strip

In the new scheme, PBI filenames are `PBI-PPP.md` — no slug. Confirm with the user that the title inside the file is enough to identify the PBI when browsing (it is — the title line carries the descriptive name).

### Decision 6: Active ADR + branch

If an ADR is open in `.wag/adr/active/`:
- It is named `PBI-XXX-ADR.md` (legacy). Rename to `ADR-EEE.PPP.md` (the active PBI's new canonical ID).
- Update the ADR's header line to `# ADR EEE.PPP: [title]` and the `**PBI:**` / `**Epic:**` / `**Feature branch:**` lines to match.

If on a `feature/PBI-XXX` branch, rename it: `git branch -m feature/PBI-XXX feature/PBI-EEE.PPP`. The branch keeps its commits; only the name changes. Push the renamed branch and delete the old one upstream after the rename is verified.

### Decision 7: state.json

After migration:
- `active_epic` becomes the slug of the active PBI's epic, or `"epic-000-general"` if no work is in flight.
- `active_pbi` becomes the local per-epic number (e.g., `"003"`), or `null` if no work is in flight.
- `feature_branch` updates to the renamed branch, or stays `null`.

## Phase 3: Execute

Once Decisions 1–7 are agreed:

1. Create `epic-000-general/` (folder, mirror, stub `epic.md`).
2. Rename epic folders per Decision 1. `git mv` each one.
3. For each PBI being moved/renumbered: `git mv backlog/<old-path>/PBI-OLD-slug.md backlog/<new-epic>/PBI-NEW.md`. Rewrite the title line in the file to the new full ID.
4. Update inbound references inside PBI bodies, `epic.md` files, the active ADR (if any), and any open snags. Search the project for legacy-form references (`PBI-\d+\b`) and rewrite them to the new canonical form.
5. Rename the open ADR and update its body (Decision 6).
6. Rename the feature branch if applicable (Decision 6).
7. Update `state.json` (Decision 7).
8. Commit everything in a single migration commit:

```bash
git commit -m "chore: migrate .wag/backlog to per-epic numbering scheme

- Move standalone PBIs into epic-000-general or feature epics
- Renumber PBIs per-epic (closed PBI numbers reassigned as part of migration)
- Rename epic folders to one-word slugs
- Strip descriptive slugs from PBI filenames
- Create epic-000-general bucket and mirror
- Rename active ADR and feature branch if applicable
- Update state.json defaults"
```

## Phase 4: Verify

1. Re-run the survey from Phase 1. Confirm the backlog matches the new shape.
2. Read `.wag/state.json` and confirm the new values.
3. If an ADR is open, confirm `/wag:dev` would now find the right branch via `feature_branch`.
4. Suggest the user run `/wag:adr` or `/wag:dev` to verify template drift no longer fires.

## Key rules

1. **User approves every decision.** Don't auto-rewrite anything in Phase 2. Execute only in Phase 3 after sign-off.
2. **Migration is the one window where completed PBIs can be renumbered.** After this command finishes, the immutability rule reapplies.
3. **Closed PBI numbers are never reused, except during migration.** This is the deliberate trade-off — once migration commits, the new per-epic sequences are authoritative.
4. **Single migration commit.** All moves, renames, and `state.json` updates land together so the working tree never sits in a half-migrated state on `dev`.
5. **Active branch handled inline.** If the project is mid-flight on a `feature/PBI-XXX` branch, the migration also renames the branch and the active ADR — don't leave them on the legacy form.
6. **No code changes.** This command moves planning artifacts only. `src/` and `tests/` are untouched.
