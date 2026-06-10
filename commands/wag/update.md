---
description: Bring a project's .wag/ up to the latest wag2 — express intent to get current. Stamps a version, walks the change-record chain (or diagnoses the delta when records are missing), and reconciles the project advisorily.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Skill
---

# WAG Update — Get this project onto the latest wag2

You are running `/wag:update` inside a project. This is an **express intent**: bring this project's `.wag/` from whatever era it was created in up to the **latest** wag2 shape — and stamp that version so the next update knows where it started.

This is the **only** wag command that owns versioning. Every other command is version-blind; it only reaches for `/wag:update` when it can't complete because the project looks inconsistent with what the command expects (see *When other commands defer here*).

**Advisory, never silent.** Update proposes a reconciliation plan and the user approves it — step by step for anything destructive. Each project drifted differently; there is no one-size transform. When in doubt, diagnose and propose — do not auto-rewrite.

---

## How versioning works

Three moving parts:

- **Latest version** — `~/.claude/wag/config.json` → `version`. The running tooling *is* the latest; this field is how it knows its own number. Update **reads** this; it never writes it.
- **Project stamp** — `.wag/state.json` → `wag_version`. The version this project was last brought up to. `/wag:init` writes it for new projects; `/wag:update` advances it. Absent = the project predates versioning (a legacy project).
- **Change records** — `~/.claude/wag/changes/<version>.md`, one prose link per version. Each says *what changed from the prior version and how to bring a project up*. Together they form the path `vA → … → vLatest`. Update walks the links between the project's stamp and latest.

The records are **not a programmatic script** — they're a delta you *understand* and then apply to the specifics of this project.

**The chain has gaps today.** We started versioning partway through wag2's life, so most historical links don't exist. For an unstamped or pre-record project, you don't have a link to read — you **diagnose the delta** against the canonical shape and the strategy catalog below, and propose the changes. Going forward, every wag2 change lays its link, so the gaps stop growing.

---

## Canonical target shape (latest)

Reconcile *toward* this. Source of truth: `~/.claude/wag/workflows/init.md` Phase E and `~/.claude/wag/templates/`.

```
.wag/
├── state.json            { app_name, wag_version, current_mode, active_epic,
│                           active_pbi, feature_branch, docs_page_path }
├── docs/
│   ├── PRD.md
│   ├── RESEARCH.md
│   └── Architecture.md
├── backlog/
│   ├── epic-000-general/         (always exists)
│   │   └── epic.md
│   ├── epic-NNN-word/
│   │   ├── epic.md
│   │   └── PBI-PPP.md            (per-epic local number; canonical ID = PBI EEE.PPP)
│   └── _completed/
│       └── epic-NNN-word/        (mirror per active epic, .gitkeep)
├── adr/
│   └── active/                   (ADR files: ADR-EEE.PPP.md)
└── snags/                        (open snags only — resolution deletes the file; _resolved/ is pre-0.3.0 legacy)
```

Conventions at latest: per-epic PBI numbering (`PBI EEE.PPP`); branches `feature/PBI-EEE.PPP`; **no infrastructure PBI** (the baseline is scaffolded by init, not a backlog item); `active_epic` is never null (defaults to `epic-000-general`).

---

## Flow

### Phase 1 — Determine the gap

1. Confirm `.wag/` exists. If not, this isn't a WAG project — stop and say so.
2. Read `.wag/state.json`. Note `wag_version` (the stamp).
3. Read `~/.claude/wag/config.json` → `version` (latest).
4. Decide the path:
   - **Stamped and current** (`wag_version` == latest) → nothing to do. Tell the user, stop.
   - **Stamped and behind** → list `~/.claude/wag/changes/` and gather every record with version in `(stamp, latest]`. These are your links.
   - **Unstamped (legacy)** → no links to read. Run the **strategy catalog** below as a diagnosis pass: detect each known delta against the project, and note anything that doesn't match a known delta for the *diagnose-and-propose* fallback (S7).

### Phase 2 — Build the reconciliation plan

Assemble one ordered plan from whatever sources apply (change-record links, the strategy catalog, S7 diagnosis). For each item, state: **what's drifted**, **the proposed change**, and **how it'll be verified**. Present the whole plan to the user as a plain summary before touching anything.

If the plan includes the legacy **backlog-numbering** migration (S3), that is its own large, conversational flow — hand off to `/wag:migrate-backlog` for that part rather than duplicating it here, then resume.

### Phase 3 — Execute (approved items only)

Apply the approved changes. Use `git mv` for moves/renames, `Write`/`Edit` for file contents (never shell redirection), `mkdir` for new dirs. Keep structural changes together so the tree never sits half-migrated. Commit with a clear message:

```
chore(wag): update .wag/ to wag2 v<latest> (from v<stamp|legacy>)
```

### Phase 4 — Stamp and verify

1. Set `.wag/state.json` → `wag_version` to the latest version.
2. Re-read the project against the canonical shape; confirm each planned item landed.
3. Tell the user what changed, what was skipped (and why), and suggest the next command (`/wag:adr`, `/wag:docs`).

---

## Strategy catalog — every delta we know how to reconcile

Each strategy is **Detect → Reconcile → Verify**. Run them as a diagnosis pass for legacy projects; for stamped projects the change-record links usually point at the relevant ones. Strategies are not mutually exclusive — a deeply legacy project triggers several.

### S1 — No version stamp
- **Detect:** `state.json` has no `wag_version`.
- **Reconcile:** This is the baseline marker, not a fix in itself — it means run the full catalog as diagnosis. The stamp is written last (Phase 4), once everything else is reconciled.
- **Verify:** `wag_version` present and equal to latest after Phase 4.

### S2 — state.json schema drift
- **Detect:** Missing any latest field — `active_epic`, `feature_branch`, `docs_page_path` (and `wag_version`). (Real example: a legacy state is just `{app_name, current_mode, active_pbi}`.)
- **Reconcile:** Add the missing fields with correct defaults — `active_epic` defaults to `"epic-000-general"` (never null), `feature_branch`/`docs_page_path` default to `null`, `active_pbi` stays a zero-padded string or `null`. Don't clobber values that already carry real state.
- **Verify:** `state.json` has the full latest field set; in-flight values preserved.

### S3 — Legacy backlog numbering / standalone PBIs / no epic-000-general
- **Detect:** Global `PBI-NNN` numbering, descriptive-slug filenames (`PBI-NNN-slug.md`), standalone PBIs at the backlog root, or a missing `epic-000-general/`.
- **Reconcile:** This is the per-epic-numbering migration — **hand off to `/wag:migrate-backlog`**, which owns the survey, the per-epic renumbering, folder/branch/ADR renames, and the single migration commit. Resume `/wag:update` afterward for any remaining deltas.
- **Verify:** Backlog matches the canonical shape; `/wag:migrate-backlog` Phase 4 passes.

### S4 — Infrastructure PBI present
- **Detect:** A foundation/infrastructure PBI exists (e.g. `PBI 000.001`, a "PBI 0.1", or an epic whose sole job is scaffolding the baseline). Latest wag2 scaffolds the baseline in `/wag:init` — there is no infrastructure PBI.
- **Reconcile:** Confirm the baseline the PBI describes actually exists in the repo (it usually does — the project's been built). If so, retire the PBI: move any *still-unbuilt* work it carried into the feature slice that needs it, or into `epic-000-general`; mark the scaffolding part done. If the baseline does *not* yet exist, leave the PBI and flag it — the project is mid-foundation and shouldn't be force-migrated. **Ask before removing any PBI.**
- **Verify:** No standalone infrastructure PBI remains, and no real outstanding work was dropped.

### S5 — Missing `.wag/` subdirs
- **Detect:** Any of `adr/active/`, `backlog/_completed/` (mirrors), or `epic-000-general/` absent. (`snags/_resolved/` is no longer expected — as of 0.3.0 resolution deletes the snag file; an existing `_resolved/` is legacy and may be removed per the 0.3.0 change record.)
- **Reconcile:** Create the missing scaffolding with `.gitkeep` where empty. This is additive and safe — still list it in the plan.
- **Verify:** Directory tree matches the canonical shape.

### S6 — Missing or legacy docs
- **Detect:** `docs/RESEARCH.md` absent (predates the provenance doc); or a legacy `docs/decisions.md` where latest uses the decision-log / reasoning structure (`~/.claude/wag/templates/decision-log.md`, `reasoning-local.md`); or PRD/Architecture not matching current templates.
- **Reconcile:** **Diagnose, don't fabricate.** You can't reconstruct research provenance that was never written — propose seeding a stub `RESEARCH.md` noting it's retroactive, or leave it and flag. For `decisions.md`, read it and propose how its content maps onto the current structure; confirm the mapping with the user before rewriting. Never invent decision history.
- **Verify:** Docs present and structured per latest, or explicitly flagged as intentionally-stubbed.

### S7 — Unknown drift (the diagnose-and-propose fallback)
- **Detect:** Something in `.wag/` doesn't match any strategy above and doesn't match the canonical shape — an unfamiliar file, a structure no current convention explains.
- **Reconcile:** Compare against the canonical shape and templates, form a hypothesis about which era it's from and what the intended current form is, and **propose** the change to the user with your reasoning. This is the "figure it out" path the gaps force — most legacy work lands here until the change-record chain fills in. If you genuinely can't tell, say so and leave it.
- **Verify:** Either reconciled with user sign-off, or explicitly left with a noted reason.

---

## Going forward — laying the link

Update only works because the chain is maintained. When wag2 itself changes in a way that alters what lands in a project's `.wag/` (schema, layout, file convention), that change ships three things:

1. **Bump** `~/.claude/wag/config.json` → `version`.
2. Confirm **`/wag:init` stamps** the new version into new projects.
3. **Lay the link** — add `~/.claude/wag/changes/<new-version>.md`: what changed from the prior version, and the Detect → Reconcile → Verify strategy to bring an older project up. (Promote it into the catalog above when it's a delta `/wag:update` should always know.)

**Who remembers:** by mutual recognition, not machinery — but when the change was *requested by the user*, the assistant owns it. The same turn that edits the command lays the link and bumps the version, without waiting to be reminded. The user is the backstop, not the trigger.

A change that doesn't touch the on-disk project shape (wording, a tooling refactor) needs none of this.

---

## When other commands defer here

Other wag commands don't version-check on every run. But when one **can't complete because the project looks inconsistent with what it needs** — `/wag:adr` expecting epics that aren't there, `/wag:dev` expecting a `feature_branch` field, a command finding the backlog in a shape it doesn't recognise — the likely culprit is version drift. That command surfaces the mismatch and offers `/wag:update`. This command is where that offer lands.

---

## Key rules

1. **Advisory and approval-gated.** Propose a plan; the user approves it. Anything destructive (removing a PBI, rewriting docs, renumbering) is confirmed explicitly. Additive scaffolding still gets listed.
2. **Read latest, never write it.** Update reads `config.json.version` and *advances* `state.json.wag_version`; it never bumps the tooling version.
3. **Diagnose over assume.** Gaps in the chain are expected — when there's no link to read, reason from the canonical shape and propose. Never fabricate history (research, decisions) that was never recorded.
4. **Stamp last.** `wag_version` is written in Phase 4, only after the rest reconciles, so a half-done update is never mistaken for current.
5. **Delegate the big migrations.** Backlog renumbering is `/wag:migrate-backlog`'s job — call it, don't reimplement it.
6. **Planning artifacts only.** Update touches `.wag/` (and branch/ADR names via migrate-backlog). It does not change `src/` or `tests/`.
