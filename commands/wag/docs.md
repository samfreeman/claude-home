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
| `.wag/stash/` | Triage stashed thoughts — promote to PBI, fold into PRD/Architecture, or discard |

**Not covered by this command:**
- Picking a PBI to work on → `/wag:adr`
- Implementing a PBI → `/wag:dev`
- Migrating a project from the legacy backlog scheme → `/wag:migrate-backlog`

Snags have no capture command, but resolution lives in TRI (`/wag:tri`). If a defect in the docs is discovered mid-session, the inline snag capture flow (below) runs — halt, capture, drive TRI inline, resume.

## Phase 1: Pre-flight

### Halt on open snags

Scan `.wag/snags/` for any `SNAG-*.md` file. **If any exist, halt immediately.** Open snags halt all work — no exceptions.

- Do not present a menu of options.
- Do not ask the user for a "different disposition."
- Do not let the user "acknowledge and proceed" past the snag.
- Do not attempt to resolve the snag by guessing at its default fix.

Surface the halt to the user:

> "An open snag blocks all work:
> - SNAG-NNN — [title]. Target: [target field].
>
> Until this snag is resolved, no WAG work proceeds. Resolution happens in TRI: fix the defect at its source, propagate to docs and backlog, and land the fix where it belongs — local, global, or both. Driving `/wag:tri` inline now — confirm to proceed."

This is the TRI mid-cycle excursion. The resolution protocol (`~/.claude/wag/workflows/snag-resolution.md`) runs inline: all four steps — fix, doc propagation, PBI propagation, disposition (local / global / both, with any global rule embedded mechanically in-session) — complete fully before this command resumes. Closure deletes the snag file; once `.wag/snags/` is empty, the halted command resumes.

Open snags block ALL workflow commands, not only those that touch the snag's target. An open snag signals the WAG system has an unpatched defect.

### Check for active ADR

If `.wag/adr/active/` contains an ADR, there's work in flight. Surface this:

> "PBI EEE.PPP has an active ADR. If the docs change meaningfully, the ADR may need revisiting or a snag should be captured."

Don't block on it — the user may know the ADR is unaffected. Just make it visible.

### Surface the stash

Glob `.wag/stash/STASH-*.md` (exclude `_processed/`). If the stash is non-empty, surface a one-liner:

> "Stash has N items: STASH-NNN, STASH-NNN, … You can triage them this session — see the focus options below."

Don't drive triage automatically. Surface and move on — the user decides whether to process them now or focus elsewhere. If the stash is empty, say nothing.

### Determine focus

Ask what the user wants to work on in this session. Common entry points:
- "I need to add/change something in the PRD"
- "I need to revise an architecture decision"
- "I need to add epics/PBIs to the backlog"
- "I want to review what's there and refresh"
- "I want to triage the stash" *(only relevant if the stash is non-empty — see Phase 4)*

The rest of this workflow branches on that answer.

## Phase 2: Editing PRD or Architecture

For PRD or Architecture edits, follow the standard pattern:

1. **Discuss first, write second.** Understand the change, challenge assumptions, confirm scope before touching the file.
2. **Version the change.** Update the document's version number in the header (e.g., `Version: 1.3` → `Version: 1.4`).
3. **Record the change.** Append a line to the Provenance / Changelog section at the bottom of the document.
4. **Consistency check.** After a PRD change, scan Architecture for contradictions. After an Architecture change, scan the backlog — PBIs or epics may be affected. Surface anything that should become a snag.
5. **Speak the ubiquitous language.** Author every PRD / Architecture / backlog edit in the terms defined in Architecture's `Ubiquitous language` section — one name per referent. If the edit introduces a genuinely new referent, name it once and add it to that section (versioned like any Architecture change); if you catch a second word for something already named, reconcile it to the one term rather than letting a synonym in. Don't introduce a bounded context without a forcing function. See `~/.claude/wag/references/ubiquitous-language.md`.

If a change invalidates an active ADR or an approved PBI's acceptance criteria, **capture a snag** via `.wag/snags/SNAG-NNN.md` and flag it to the user.

### Inline snag capture

If during authoring you discover a defect in an upstream doc (PRD, Architecture, or a decision therein) — an assumption doesn't hold, a section contradicts reality, a decision was under-reasoned — capture a snag on the spot using `~/.claude/wag/templates/snag.md`. Halt, then go straight to TRI: drive `/wag:tri` inline (the protocol at `~/.claude/wag/workflows/snag-resolution.md`). The full resolution — fix, propagation, disposition — completes in this session before authoring resumes.

**Snags originate in docs, propagate to backlog.** A snag is a defect in an upstream doc whose consequences have leaked into the backlog. If a PBI just needs editing and no doc is wrong, that's plain authoring work for this command — no snag needed.

## Phase 3: Authoring the backlog

The backlog has one shape: epics. Every PBI lives in an epic folder.

- **Feature epics** — `backlog/epic-NNN-word/` folders, where `word` is a one-word kebab-style descriptor (e.g., `epic-001-auth`, `epic-002-billing`). Each contains an `epic.md` and zero or more PBI files.
- **`epic-000-general`** — the permanent bucket for loose work: bug fixes, small UI tweaks, afterthoughts, isolated chores. Always exists. Never drains. PBIs in here are not pinned — when a cluster of them starts to cohere around a shared outcome, lift them into a new (or existing) feature epic via the "Moving PBIs between epics" procedure below.
- **`epic-501-future`** — the holding bucket for envisioned, *deferred* work: backlog-shaped PBIs you intend to build later, not now. Items here are never offered as buildable work — each carries a deferral dependency (e.g. `Dependencies: PBI 001.001`, or a sentinel PBI standing for "v1 proven") so `/wag:adr` Phase 1 treats it as blocked — but they stay **visible** in the blocked footnote and feed forward into present design (`/wag:adr` Phase 2 loads them as design context). When a future item draws near, lift it into its own properly-framed feature epic.

There is no "standalone PBI at the backlog root." If a PBI doesn't fit any feature epic, it goes in `epic-000-general` (present work) or `epic-501-future` (deferred work).

### Special buckets and the epic-number namespace

Feature epics take numbers `001–199`. You won't realistically reach `200`; if you do, the backlog is over-decomposed. `000` and `200+` are reserved for **special buckets** — ongoing holding areas that aren't actively-pursued business objectives and never drain:

- `000` — `epic-000-general`, the now/unclassified bucket for loose present work.
- `200+` — special buckets whose numbers borrow **HTTP status codes** as a **soft mnemonic** (a handle, not a rule the tooling enforces). The status *class* hints at the bucket's relationship to delivery — e.g. **`5xx`** (server errors, the things that surface in production) marks work that takes priority *after* delivery: deferred while you build v1, activated once it ships. The first such bucket is **`epic-501-future`** (`501 Not Implemented` — envisioned, not built yet).

Special-bucket numbers (`000` and `200+`) are fixed: never counted when computing the next feature-epic number, and never drained.

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

**Epic number.** Before creating a new epic, scan `.wag/backlog/` (including `_completed/`) for the highest-numbered existing *feature* epic (`001–199`). The new epic gets the next number. Special buckets — `epic-000-general` and any `200+` bucket (e.g. `epic-501-future`) — are fixed and not counted.

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

## Phase 4: Triaging the stash

The stash (`.wag/stash/`) holds raw thoughts captured via `/wag:stash` during prior ADR or dev sessions. This phase walks each unprocessed item with the user and decides where it goes. Triage is per-item and the user can stop at any time — partial triage is fine, items left untouched stay stashed for the next session.

For each `STASH-NNN.md` file (exclude `_processed/`), in order:

1. **Read the file and show it to the user** — title, captured-at timestamp, context line, body.
2. **Ask: promote, defer, fold, discard, or keep?**
   - **Promote to PBI** — the thought is a unit of work to build now or soon. Drive the PBI authoring flow from Phase 3, then move the stash file to `_processed/` with a footer noting the new PBI's canonical ID and path.
   - **Defer to the future bucket** — the thought is real, backlog-shaped work for *later, not now*. Author it as a PBI in `epic-501-future/` carrying a deferral dependency (so `/wag:adr` keeps it visible-but-not-offered rather than selectable), then move the stash file to `_processed/` with a footer noting the new `PBI EEE.PPP` path. This is the home for "v2/future — parked, not forgotten."
   - **Fold into PRD or Architecture** — the thought is a product or architectural decision, not a unit of work. Drive the relevant edit from Phase 2, then move the stash file to `_processed/` with a footer noting the doc and section it landed in.
   - **Discard** — the thought is no longer useful. Capture a one-line reason from the user, then move the stash file to `_processed/` with a footer noting "Discarded: [reason]".
   - **Keep stashed** — leave the file untouched in `.wag/stash/`. The next `/wag:docs` session will surface it again.
3. **Continue to the next item** until the stash is empty or the user says "enough".

### Moving a stash item to _processed/

```bash
git mv .wag/stash/STASH-NNN.md .wag/stash/_processed/STASH-NNN.md
```

Then append a footer to the moved file:

```markdown

## Triaged: YYYY-MM-DD

**Outcome:** promoted | deferred | folded | discarded
**Landed at:** [PBI EEE.PPP path | PRD section | Architecture decision | n/a for discard]
**Reason:** [one-line — required for discard, optional otherwise]
```

Don't rewrite the original body. The footer is additive — the captured thought stays verbatim as historical record.

If `.wag/stash/_processed/` doesn't exist yet, create it as part of the first move.

### After triage

When the user is done triaging (stash empty, or they said "enough"), return to the "Determine focus" step in Phase 1 — they may still want to author other docs/PBIs in this session, or they may be done. Don't auto-advance to Exit.

## Phase 5: Exit

This mode doesn't have a strict "complete" state — it ends when the user says so. Before ending:

1. Confirm every new/changed file has been saved.
2. If PRD or Architecture were modified, confirm their version numbers and changelog entries were updated.
3. **If any rendered source changed this session, offer to refresh.** Rendered sources are `PRD.md`, `Architecture.md`, and anything under `.wag/backlog/`. If at least one changed, ask the user which surfaces to refresh:
   - `/wag:html-docs` — standalone HTML files in `.wag/docs/` (for sharing / archive).
   - `/wag:gendocs` — in-app docs page (if the project has one wired).
   - Both / either / neither — user's call.
   
   Individual html sub-commands (`/wag:html-prd`, `/wag:html-architecture`, `/wag:html-backlog`) are also runnable directly if only one doc needs refreshing.
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
11. **Stash triage is optional and per-item.** The stash is surfaced in pre-flight but never auto-processed. Triage routes each item through the normal PRD/Architecture/backlog flows — there's no shortcut. Items not processed this session stay stashed for the next.
