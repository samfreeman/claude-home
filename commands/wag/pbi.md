---
description: Manage PBIs and epics in the backlog — create, renumber, move, close, list, lint
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# WAG PBI — backlog management

Single dedicated entry point for backlog CRUD outside the design/build flow. `/wag:docs` authors PBIs in service of the PRD, `/wag:adr` designs them, `/wag:dev` implements them — and each of those touches the backlog as a side effect. This command exists for the cases where you just want to manage the backlog directly: create one new PBI, renumber a gappy sequence, move a PBI between epics, close work that didn't need an ADR.

It is also the one place to run **lint** — a read-only validation pass over the entire backlog (the dragonpay-api `PBI-015` collision is exactly what lint catches).

## Before you start

1. Confirm `.wag/` exists. If not, tell the user to run `/wag:init` first and stop.
2. Read `wag/templates/backlog-pbi.md` and `wag/templates/backlog-epic.md` — these are the authoritative shapes for any file this command writes.
3. Read `wag/references/close-pbi-and-epic.md` — the canonical procedure for closing PBIs and draining epics.
4. Read `.wag/state.json` for context (the previous `active_epic` is used only as a soft default when an operation needs an epic choice — never as a filter).

### Halt on open snags (mutating operations only)

Scan `.wag/snags/` for any file with `**Status:** open`. If any exist, halt all *mutating* operations (new PBI, new epic, renumber, move, close) and surface the snag using the same halt language as `/wag:adr` Phase 1 — open snags signal the WAG system has an unpatched defect, and backlog edits during that state can leak the defect further.

`list` and `lint` are read-only and may run regardless. If the user explicitly requests one of those during a snag halt, run it. Otherwise drive the snag-resolution protocol.

## Ask what to do

Present the available operations to the user as a short list and ask which one. Default to `list` if the user is ambiguous — it's the least destructive and shows them the current state.

| Op | What it does |
|---|---|
| **new pbi** | Create a new PBI in some epic (with safe numbering) |
| **new epic** | Create a new epic and its `_completed/` mirror |
| **renumber** | Renumber an open PBI within its epic (cleanup) |
| **move** | Move an open PBI from one epic to another |
| **close** | Close a PBI (closure note + `git mv` + drain check) |
| **list** | List every open PBI grouped by epic, with eligible/blocked markers |
| **lint** | Validate the whole backlog (read-only) |

Conduct each op as a conversation. Confirm before any write. Show diffs before any commit.

## Operations

### new pbi

1. **Pick the epic.** List every epic folder in `.wag/backlog/` (excluding `_completed/`) — show number, title, goal, and current open PBI count. Suggest the previous `active_epic` as the default; let the user pick any.
2. **Compute the next number safely.** Scan **both** the active epic folder and its `_completed/` mirror for existing PBI numbers, take the max, add 1:

   ```bash
   ls .wag/backlog/<epic>/PBI-*.md .wag/backlog/_completed/<epic>/PBI-*.md 2>/dev/null \
     | sed -E 's|.*PBI-0*([0-9]+)\.md|\1|' \
     | sort -n | tail -1
   ```

   Zero-pad to three digits.
3. **Collision guard.** Before writing, check `test -f .wag/backlog/_completed/<epic>/PBI-PPP.md`. If the file exists, halt — closed PBI numbers are immutable. The compute step above should prevent this, but the guard is a backstop in case state is inconsistent.
4. **Gather fields.** Walk the user through title, priority (P1/P2/P3), dependencies (other PBIs by full `PBI EEE.PPP` form, or "None"), description, deliverables, acceptance criteria, testing requirements, technical notes. Reference the PBI template for the exact shape.
5. **Verify dependency direction (within-epic).** Same-epic deps must reference lower local numbers (LEARNING-005). Cross-epic deps are unconstrained.
6. **Verify dependencies resolve.** Every `PBI EEE.PPP` referenced must exist somewhere — active or `_completed/`. If a referenced PBI doesn't exist, halt and ask the user to either fix the reference or stop.
7. **Write the file** to `.wag/backlog/<epic>/PBI-PPP.md` using the Write tool against the template. Header: `# PBI EEE.PPP: [title]` (full canonical ID).
8. **Stage and commit.** Show the diff. On user confirmation, `git add` the file and commit with message `backlog: create PBI EEE.PPP — [title]`.

### new epic

1. **Compute the next epic number.** Scan `.wag/backlog/` including `_completed/` for the highest existing *feature* epic (`001–199`). Next = max + 1. Special buckets — `epic-000-general` and any `200+` bucket (e.g. `epic-501-future`) — are fixed and not counted in the max.
2. **Gather fields.** Ask for the kebab-case slug (the `word` in `epic-NNN-word`), title, priority, goal (1–3 sentences, business outcome), deliverables, design input required, non-goals. Reference the epic template.
3. **Create both folders.**
   - `mkdir -p .wag/backlog/epic-NNN-slug/`
   - `mkdir -p .wag/backlog/_completed/epic-NNN-slug/`
   - `touch .wag/backlog/_completed/epic-NNN-slug/.gitkeep` (the mirror always exists so PBI closures stay simple moves — see `wag/references/close-pbi-and-epic.md`).
4. **Write `epic.md`** from the template, into the active folder.
5. **Stage and commit.** `git add` both folders. Commit message: `backlog: create epic EEE — [title]`.

### renumber

Use this when reordering or removing open PBIs leaves the local sequence uncomfortably gappy. **Closed PBI numbers never move** — they stay where they are forever; only open PBIs renumber.

1. **Pick the PBI to renumber.** Show open PBIs grouped by epic; user picks one.
2. **Pick the new local number.** Verify the chosen number isn't:
   - already used by another open PBI in that epic
   - already used by a PBI in `_completed/<epic>/` (immutable — refuse and ask for a different number)
3. **Move the file.** `git mv .wag/backlog/<epic>/PBI-OLD.md .wag/backlog/<epic>/PBI-NEW.md`.
4. **Update the header.** Edit the moved file: change `# PBI EEE.OLD: ...` to `# PBI EEE.NEW: ...`.
5. **Update inbound references.** Grep `.wag/` for the old canonical ID and update other open PBIs, open snags, and the active ADR (if present). Closed PBIs in `_completed/` and resolved snags are not rewritten.
6. **If the active ADR cites the PBI**, also `git mv` the ADR file (`ADR-EEE.OLD.md` → `ADR-EEE.NEW.md`) and update its body header. The feature branch keeps its name unless the user explicitly asks to rename it.
7. **Stage and commit.** Bundle the rename + header edit + reference updates + ADR move (if any) into one commit: `backlog: renumber PBI EEE.OLD → PBI EEE.NEW`.

### move

Move an open PBI between epics. **Completed PBIs cannot be moved** — their epic membership is locked the moment they enter `_completed/`. The one exception is full-project migration via `/wag:migrate-backlog`.

1. **Pick the PBI to move.** Show open PBIs grouped by epic; user picks one.
2. **Pick the destination epic.** Show all open epics; user picks one (or proposes a new epic — in which case run the `new epic` operation first, then return here).
3. **Compute the destination's next local number** using the same safe scan as `new pbi` (active + `_completed/` of the destination epic, max + 1).
4. **Move and renumber.** `git mv .wag/backlog/<src-epic>/PBI-OLD.md .wag/backlog/<dst-epic>/PBI-NEW.md`. Update the header `# PBI EEE.PPP: ...` to the new canonical ID.
5. **Update inbound references.** Same as `renumber` — only open PBIs, open snags, the active ADR (if any) are rewritten.
6. **If the active ADR cites the PBI**, `git mv` and update its body header.
7. **Stage and commit.** One bundled commit: `backlog: move PBI <old-id> → PBI <new-id>`.

### close

Implements the canonical procedure from `wag/references/close-pbi-and-epic.md`. Use this when a PBI is done and doesn't need to flow through `/wag:dev` Phase 5 (e.g. work the user did by hand, or a PBI that was actually nothing).

1. **Pick the PBI to close.** Show open PBIs grouped by epic; user picks one.
2. **Add the closure note.** Edit the PBI file:
   - Add a `**Status:** Closed <date> — <short reason>` line in the header. Use today's date.
   - Add a `> **Closure note.**` block summarising what actually happened vs what the PBI listed. Cite any SNAGs or LEARNINGs produced.
3. **Move to the mirror.** `git mv .wag/backlog/<epic>/PBI-PPP.md .wag/backlog/_completed/<epic>/PBI-PPP.md`.
4. **Remove `.gitkeep` from the mirror** if this is the first closure into that mirror.
5. **Epic drain check** (skip for special buckets — `epic-000-general` and any `200+` bucket like `epic-501-future`, which are ongoing and never drain). If the active epic folder now contains only `epic.md` (no remaining PBI files), ask the user: *"All PBIs in `epic-NNN-word` are complete. Mark the epic done?"*
   - On yes: update `epic.md`'s `**Status:**` to `Completed <date>`, `git mv` it to the mirror, `rmdir` the active folder. If `state.json.active_epic == "epic-NNN-word"`, reset to `"epic-000-general"`.
   - On no: leave the empty epic folder as-is.
6. **Stage and commit.** Bundle the closure edit + the move + any drain ceremony + `state.json` change into one commit: `backlog: close PBI EEE.PPP — [short reason]`. If the epic also drained, include `· close epic EEE` in the subject.

### list

Read-only. Identical surface to `/wag:adr` Phase 1 "Pick a PBI" step 1–4, minus the selection. No state changes.

1. Glob `.wag/backlog/epic-*/PBI-*.md` (exclude `_completed/`).
2. Parse each: ID, title, priority, dependencies.
3. For each, determine eligibility — every dep must live in `_completed/` for the PBI to be eligible. Otherwise it's blocked.
4. Print grouped by epic (sorted by number; PBIs within each epic sorted by local number). Each line shows full canonical ID, title, priority, and an `eligible` or `blocked on PBI X.Y, …` marker.
5. Footer: total open / total eligible / total blocked.

### lint

Read-only validation of the entire backlog. Run all checks and report findings. Make no changes — diagnosis only. Suggest the corresponding `/wag:pbi` op for each fix.

Checks:

1. **PBI number collisions across active and `_completed/`.** For each epic, intersect the set of local PBI numbers in the active folder with the set in `_completed/<epic>/`. Any non-empty intersection is a defect. *(This is the dragonpay-api `PBI-015` failure mode — closed PBI numbers must never be reused.)*
2. **Dependency direction (within-epic).** For every open PBI, every same-epic dependency must reference a strictly lower local number. (LEARNING-005)
3. **Cross-epic dependencies resolve.** Every `PBI EEE.PPP` referenced as a dependency must exist somewhere — under an active epic folder or in `_completed/`.
4. **Epic mirror exists.** Every `epic-NNN-word/` folder under `.wag/backlog/` must have a matching `_completed/epic-NNN-word/` folder (with at least a `.gitkeep` if empty).
5. **Filename shape.** PBI files must be `PBI-PPP.md` exactly — no descriptive-slug suffixes (`PBI-PPP-something.md`). Legacy-scheme drift; suggest `/wag:migrate-backlog`.
6. **PBI header matches filename.** The `# PBI EEE.PPP:` header inside each file must match the epic folder number and the filename's `PPP`.
7. **No orphaned ADRs.** Every file in `.wag/adr/active/` named `ADR-EEE.PPP.md` should correspond to an open PBI at that path.

Report findings in a short table — defect, file(s), suggested fix. If everything passes, say so plainly. End with a one-liner: `Lint: N defect(s) across M file(s).`

## Key rules

1. **Single entry point for non-design backlog edits.** `/wag:docs`, `/wag:adr`, and `/wag:dev` still touch the backlog as part of their flows; `/wag:pbi` is the place for direct, deliberate management.
2. **Closed PBI numbers are immutable.** Every mutating op refuses to write into a number that exists in `_completed/`.
3. **Templates are authoritative.** Reference `wag/templates/backlog-pbi.md` and `backlog-epic.md` for every file this command writes — do not improvise headings or fields.
4. **`lint` and `list` never mutate.** They diagnose only. Fixes go through the other operations or `/wag:migrate-backlog`.
5. **Open snags halt mutating ops.** Lint and list still run, so you can diagnose even during a halt.
6. **Bundled commits.** When an op involves multiple file changes (rename + header edit + reference updates + ADR move + `state.json`), they commit together. `state.json` never commits separately from the work it represents.
7. **Canonical IDs in prose, dot-form in filenames.** Display, prose, headers, commit messages use `PBI EEE.PPP`. Filenames and branch paths use `EEE.PPP` (dot, no space, no colon).
