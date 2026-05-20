---
description: Update the PRD, Architecture, and backlog — author epics and PBIs, refine existing docs
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG DOCS — Docs & Backlog Authoring

Collaborative mode for maintaining the three planning surfaces: `PRD.md`, `Architecture.md`, and the backlog (epics + PBIs). Use this when the docs need a refresh or when new backlog items need to exist before `/wag:adr` can be run.

This is a conversational command — a working session with the user, not a one-shot transformation. Expect back-and-forth.

## Before you start

1. Read `wag/references/questioning.md` for conversational style guidance.
2. Confirm `.wag/` exists. If not, tell the user to run `/wag:init` first.
3. Read the current docs for context:
   - `.wag/docs/PRD.md`
   - `.wag/docs/Architecture.md`
   - `.wag/docs/RESEARCH.md` (if it exists)
4. Read `.wag/state.json` to see `active_epic` and `active_pbi` — even though docs mode doesn't modify these, they tell you where the user currently is. `active_epic` is always set (default `"epic-000-general"`).

## What this command covers

| Surface | What you do here |
|---------|------------------|
| `.wag/docs/PRD.md` | Refine product requirements, add/remove goals, update user stories, adjust scope |
| `.wag/docs/Architecture.md` | Update tech stack rows, add key decisions, revise rationale, close open questions |
| `.wag/docs/RESEARCH.md` | Add research findings that informed architecture changes (optional) |
| `.wag/backlog/` | Author epics (`epic-NNN-word/epic.md`) and PBIs (`epic-NNN-word/PBI-PPP.md`) |

**Not covered by this command:**
- Picking a PBI to work on → `/wag:adr`
- Implementing a PBI → `/wag:dev`
- Migrating a project from the legacy backlog scheme → `/wag:migrate-backlog`

Snags are not a separate command. If a defect in the docs is discovered mid-session, the inline snag capture flow (below) runs — halt, resolve, propagate, resume.

## Phase 1: Pre-flight

### Halt on open snags

Scan `.wag/snags/` for any file with `**Status:** open`. **If any exist, halt immediately.** Open snags halt all work — no exceptions.

- Do not present a menu of options.
- Do not ask the user for a "different disposition."
- Do not let the user "acknowledge and proceed" past the snag.
- Do not attempt to resolve the snag by guessing at its default fix.

Surface the halt to the user:

> "An open snag blocks all work:
> - SNAG-NNN — [title]. Target: [target field].
>
> Until this snag is resolved, no WAG work proceeds. Resolution is atomic: fix the defect in the doc, propagate the change to every affected backlog item, and close the snag — all in this session. Driving the snag-resolution protocol (`~/.claude/wag/workflows/snag-resolution.md`) now — confirm to proceed."

The snag-resolution protocol runs inline. Steps 1–3 (fix + doc propagation + PBI propagation) complete fully before this command resumes. Step 4 (promote): the assessment and LEARNING-NNN file creation — if the rule is portable — also happen in this session, mandatory. Only the embedding of that learning into commands/templates may be deferred per protocol rule #2. Once the snag moves to `.wag/snags/_resolved/`, the halted command resumes.

Open snags block ALL workflow commands, not only those that touch the snag's target. An open snag signals the WAG system has an unpatched defect.

### Check for active ADR

If `.wag/adr/active/` contains an ADR, there's work in flight. Surface this:

> "PBI EEE.PPP has an active ADR. If the docs change meaningfully, the ADR may need revisiting or a snag should be captured."

Don't block on it — the user may know the ADR is unaffected. Just make it visible.

### Determine focus

Ask what the user wants to work on in this session. Common entry points:
- "I need to add/change something in the PRD"
- "I need to revise an architecture decision"
- "I need to add epics/PBIs to the backlog"
- "I want to review what's there and refresh"

The rest of this workflow branches on that answer.

## Phase 2: Editing PRD or Architecture

For PRD or Architecture edits, follow the standard pattern:

1. **Discuss first, write second.** Understand the change, challenge assumptions, confirm scope before touching the file.
2. **Version the change.** Update the document's version number in the header (e.g., `Version: 1.3` → `Version: 1.4`).
3. **Record the change.** Append a line to the Provenance / Changelog section at the bottom of the document.
4. **Consistency check.** After a PRD change, scan Architecture for contradictions. After an Architecture change, scan the backlog — PBIs or epics may be affected. Surface anything that should become a snag.

If a change invalidates an active ADR or an approved PBI's acceptance criteria, **capture a snag** via `.wag/snags/SNAG-NNN.md` and flag it to the user.

### Inline snag capture

If during authoring you discover a defect in an upstream doc (PRD, Architecture, or a decision therein) — an assumption doesn't hold, a section contradicts reality, a decision was under-reasoned — capture a snag on the spot using `~/.claude/wag/templates/snag.md`. Halt, then drive the snag-resolution protocol (`~/.claude/wag/workflows/snag-resolution.md`) with the user. Resolution (Steps 1–3: fix + doc propagation + PBI propagation) completes fully in this session before authoring resumes.

**Snags originate in docs, propagate to backlog.** A snag is a defect in an upstream doc whose consequences have leaked into the backlog. If a PBI just needs editing and no doc is wrong, that's plain authoring work for this command — no snag needed.

## Phase 3: Authoring the backlog

The backlog has one shape: epics. Every PBI lives in an epic folder.

- **Feature epics** — `backlog/epic-NNN-word/` folders, where `word` is a one-word kebab-style descriptor (e.g., `epic-001-auth`, `epic-002-billing`). Each contains an `epic.md` and zero or more PBI files.
- **`epic-000-general`** — the permanent bucket for loose work: bug fixes, small UI tweaks, afterthoughts, isolated chores. Always exists. Never drains. PBIs in here are not pinned — when a cluster of them starts to cohere around a shared outcome, lift them into a new (or existing) feature epic via the "Moving PBIs between epics" procedure below.

There is no "standalone PBI at the backlog root." If a PBI doesn't fit any feature epic, it goes in `epic-000-general`.

### What an epic is

An epic is a **business objective** — a coherent outcome that delivers value to users or the business. It is not a category of tasks. A single epic's PBIs may span multiple categories (backend, frontend, schema, infra, docs); what makes them an epic together is the shared outcome they deliver.

Good epics:
- `epic-001-auth` — "Users can sign in and manage their account."
- `epic-002-billing` — "Customers can subscribe to a paid plan and manage their subscription."
- `epic-003-onboarding` — "New users go from sign-up to first value in under 5 minutes."

Bad epics (these are categories, not objectives — don't create them):
- `epic-NNN-database` — "Database changes." DB-touching PBIs belong to whichever business objective they serve.
- `epic-NNN-refactoring` — "Refactoring work." A refactor either belongs to an epic that needs it, or lives in `epic-000-general`.
- `epic-NNN-bugs` — "Bug fixes." Bug fixes live in `epic-000-general`; they don't share a business goal.

`epic-000-general` is the explicit exception: it's the bucket for work without a coherent shared outcome. Don't try to give it business-objective shape — that's what feature epics are for.

### Canonical PBI ID

`PBI EEE.PPP` — epic number, dot, per-epic local number, both zero-padded triples. Examples: `PBI 001.003`, `PBI 000.007`. This is the form used in display, prose, ADR titles, commit messages, and snag references.

The filename inside the epic folder is `PBI-PPP.md` — the epic number is carried by the folder, not the filename.

### When to author a feature epic vs. drop a PBI in epic-000-general

- **Feature epic** — the work spans multiple PBIs that share an architectural decision, a UI surface, a feature area, or a deployment boundary. Authoring order, cross-PBI dependencies, and "definition of done at the feature level" all matter.
- **`epic-000-general`** — the work is self-contained: a bug fix, a small refactor, a dependency upgrade, an isolated chore. There's no other PBI that needs to coordinate with it.

When in doubt, drop it in `epic-000-general`. An epic can always be created later and PBIs lifted in (open ones only — see the renumbering rule below).

### Finding the next number

**Epic number.** Before creating a new epic, scan `.wag/backlog/` (including `_completed/`) for the highest-numbered existing epic. The new epic gets the next number. `epic-000-general` is fixed and not counted.

**PBI number within an epic.** Before creating a PBI inside `epic-NNN-word/`, scan both `.wag/backlog/epic-NNN-word/` and `.wag/backlog/_completed/epic-NNN-word/` for the highest existing local PBI number. The new PBI gets the next one. **Closed PBI numbers are never reused.**

### Authoring an epic

1. Discuss the epic's scope with the user: name, goal, deliverables, dependencies on other epics, what it explicitly does *not* cover.
2. Pick a one-word descriptor for the folder. Keep it short and kebab-style if it needs hyphenation internally (but prefer a single word — e.g., `auth`, `billing`, `onboarding`).
3. Create the folder: `.wag/backlog/epic-NNN-word/`.
4. **Pre-create the completed mirror:** `mkdir -p .wag/backlog/_completed/epic-NNN-word/ && touch .wag/backlog/_completed/epic-NNN-word/.gitkeep`. The mirror always exists so downstream PBI closures are simple moves. See `~/.claude/wag/references/close-pbi-and-epic.md`.
5. Write `epic.md` from `wag/templates/backlog-epic.md`. The header reads `# Epic NNN: [Title]` (zero-padded number).
6. Offer to decompose the epic into PBIs now. If the user wants to, follow the PBI authoring guidance below, creating each PBI inside the epic folder.

### Authoring a PBI

Write the PBI file from `wag/templates/backlog-pbi.md`. The header reads `# PBI EEE.PPP: [Title]` (full canonical ID). Save it as `.wag/backlog/epic-NNN-word/PBI-PPP.md`.

A PBI represents one unit of implementable work. The body is unchanged from the template: Description, Deliverables, Acceptance Criteria, Testing Requirements, optional Technical Notes.

### Moving PBIs between epics

A PBI in `epic-000-general/` may belong in a feature epic that emerges later, or vice versa. To move an open PBI:

1. Pick the next local number in the destination epic (scan including its `_completed/` mirror).
2. `git mv backlog/<source-epic>/PBI-OLD.md backlog/<destination-epic>/PBI-NEW.md`.
3. Rewrite the title line in the file to the new full ID (`# PBI <dest-epic>.<new>: [Title]`).
4. Update any inbound references in other open PBIs, snags, or the active ADR if it cites this PBI. (Completed artifacts are not rewritten.)
5. If the PBI was the `active_pbi`, update `state.json` (`active_epic` and `active_pbi`).

**Completed PBIs cannot be moved between epics.** Their number and epic membership are locked the moment they enter `_completed/`. The one exception is full-project migration via `/wag:migrate-backlog`, which renumbers freely as a one-time tidying step.

### Renumbering an open PBI within its epic

If reordering or removing PBIs leaves the local sequence uncomfortably gappy, renumber the open PBIs in the epic. Closed PBI numbers stay where they are (never reused). For each open PBI being renumbered:

1. `git mv` the file to its new local number.
2. Rewrite the title line.
3. Update inbound references in other open PBIs and the active ADR if one exists.
4. If the active ADR's PBI is being renumbered, also rename the ADR file (`ADR-EEE.OLD.md` → `ADR-EEE.NEW.md`) and update its body header. The feature branch keeps its existing name unless you also rename it (`git branch -m feature/PBI-EEE.OLD feature/PBI-EEE.NEW`), which is supported as long as nothing else has the old branch checked out.
5. Update `state.json` (`active_pbi`, `feature_branch`) if affected.

## Phase 4: Exit

This mode doesn't have a strict "complete" state — it ends when the user says so. Before ending:

1. Confirm every new/changed file has been saved.
2. If PRD or Architecture were modified, confirm their version numbers and changelog entries were updated.
3. **If any rendered source changed this session, offer to refresh the HTML.** Rendered sources are `PRD.md`, `Architecture.md`, and anything under `.wag/backlog/`. If at least one changed, ask: "Refresh the HTML renders via `/wag:html-docs`?" If yes, hand off to the runner; if no, the `.html` lags until the next manual run. Individual sub-commands (`/wag:html-prd`, `/wag:html-architecture`, `/wag:html-backlog`) are also runnable directly if only one doc needs refreshing.
4. State.json is not modified by this command. `active_epic` and `active_pbi` are managed by `/wag:adr` and `/wag:dev`.
5. Remind the user of natural next steps:
   - "New PBIs exist — run `/wag:adr` to design the solution for one of them."
   - "If you want to discuss or revise further, re-run `/wag:docs` anytime."

## Key rules

1. **Discuss first, write second.** Every PRD/Architecture/backlog change comes after alignment, not before.
2. **Version docs that change.** PRD and Architecture have explicit version numbers and changelogs. Keep them current.
3. **Consistency over speed.** After a change, scan for downstream contradictions (PRD → Architecture → backlog). Raise snags rather than letting drift accumulate.
4. **Every PBI lives in an epic.** No standalone PBIs at the backlog root. Loose work goes in `epic-000-general`.
5. **Per-epic PBI numbering.** Each epic numbers its PBIs starting at 001. Canonical ID is `PBI EEE.PPP`. Filename is `PBI-PPP.md` inside the epic folder.
6. **Closed PBI numbers are never reused.** Scan the epic's `_completed/` mirror when picking the next number.
7. **Completed PBIs are immutable.** In steady state, completed PBIs cannot be renumbered or moved between epics. Only open PBIs can. (Migration is a separate command.)
8. **File location is the source of truth for epic membership.** A PBI in `epic-001-auth/` belongs to that epic. No frontmatter for membership.
9. **This command does not modify state.json.** `active_epic` and `active_pbi` are managed by `/wag:adr` and `/wag:dev`.
10. **No code.** Docs mode updates planning surfaces only. Implementation is `/wag:dev`.
