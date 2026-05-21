# Init Workflow — Enriched Project Initialisation

## Purpose

Take a user from "I have an idea" to a project with populated `.wag/` infrastructure: PRD, architecture, and backlog. No app scaffolding — init builds the planning layer only.

## WAG docs structure

The `.wag/docs/` output is four things:

- **PRD.md** — product requirements document. Seeded from intake (Phase A).
- **RESEARCH.md** — research provenance. "We evaluated X, Y, Z — here's what we found." Queryable when revisiting decisions. Seeded from research (Phase B).
- **Architecture.md** — technical architecture decisions derived from research. Seeded from research (Phase B).
- **backlog/** — epics and PBIs. Derived from requirements discussion (Phase C).

PRD is the living product document. RESEARCH.md preserves evaluation context. Architecture.md captures the decisions.

## Phases

### Phase A: Intake → PRD

**Goal:** Capture what the user wants to build and seed the PRD.

**Reference:** `wag/references/questioning.md`

**Process:**
1. Start with: "Tell me what you want to build."
2. Follow the questioning methodology — open-ended, follow the energy, no premature specificity.
3. Explore the idea, motivation, users, desired outcome, and any constraints that surface naturally.
4. When the vision is clear, draft a PRD.md and present it to the user for approval.

**Output:** `.wag/docs/PRD.md`

**Transition:** User approves the PRD. Do not proceed without approval.

---

### Phase B: Research → RESEARCH.md + Architecture.md

**Goal:** Investigate unknowns before committing to a plan. Preserve evaluation context in RESEARCH.md, then seed Architecture.md with the decisions.

**Reference:** `wag/workflows/research.md`

**Process:**
1. Read the approved PRD.md.
2. Identify research questions per axis (ecosystem, feasibility, architecture patterns).
3. Launch parallel research sub-agents (or run sequentially as fallback).
4. Write RESEARCH.md — the full evaluation context: what was investigated, what was found, alternatives considered, and rationale for each choice. This is the provenance doc — "why not X?" is answered here.
5. Derive Architecture.md from research findings — tech stack choices, architecture patterns, and key decisions are pre-filled. Architecture captures the decisions; RESEARCH captures the journey.
6. Read all learning files from `~/.claude/wag/learnings/` whose `Applies to` field matches this project type. For each, merge the Template Patch section into the appropriate section of the Architecture doc.
7. Present both docs to user, discuss, and incorporate feedback.

**Output:** `.wag/docs/RESEARCH.md` + `.wag/docs/Architecture.md`

**Transition:** User approves the architecture. They may request deeper investigation on specific areas before proceeding.

---

### Phase C: Backlog

**Goal:** Synthesise PRD + Architecture into concrete, scoped epics and PBIs.

**Process:**
1. Read PRD.md and Architecture.md.
2. Draft backlog items grounded in the PRD and architecture:
   - v1 epics / PBIs — each traceable to a PRD requirement or architecture decision
   - v2 / future items — parked, not forgotten
   - Non-goals — explicit, with rationale
3. Present to user. This is a conversation:
   - Walk through each v1 epic / PBI and its rationale
   - Challenge scope — is this really v1? Can it be deferred?
   - Confirm non-goals — is anything missing?
   - Review PBI granularity — are they the right size?
4. Iterate until the user approves.

**Backlog structure:**
- Every PBI lives in an epic. Epic folders are named `epic-NNN-word/` (one-word kebab-style descriptor), and each contains an `epic.md` plus the PBI files belonging to that epic, named `PBI-PPP.md` (per-epic local number, zero-padded).
- `epic-000-general/` is the permanent bucket for loose work — bug fixes, small UI tweaks, afterthoughts, anything that doesn't deserve its own epic. It is created automatically during Phase D and always exists. PBIs in it are not pinned — when a cluster of them coheres around a shared outcome, lift them into a new feature epic.
- Canonical PBI ID is `PBI EEE.PPP` (epic number dot PBI number). This is the form used in display, commits, ADR titles, snags, and prose.

**What an epic is:**
An epic is a **business objective** — a coherent outcome that delivers value to users or the business. Not a category of tasks. A single epic's PBIs may span backend, frontend, schema, infra, and docs; what makes them an epic together is the shared outcome they deliver. Names like `epic-NNN-database` or `epic-NNN-refactoring` or `epic-NNN-bugs` are anti-patterns — those PBIs either serve a real business epic, or live in `epic-000-general`.

**Output:** `.wag/backlog/` (epic folders, including `epic-000-general/`)

**Transition:** User approves the backlog. Do not proceed without approval.

---

### Phase D: Scaffold

**Goal:** Create the remaining `.wag/` infrastructure.

**Process:**
1. Create the `.wag/` directory structure (docs and backlog already exist from prior phases):
   ```
   .wag/
   ├── state.json
   ├── docs/
   │   ├── PRD.md             (from Phase A)
   │   ├── RESEARCH.md        (from Phase B)
   │   └── Architecture.md    (from Phase B)
   ├── backlog/
   │   ├── epic-000-general/
   │   │   └── epic.md        (stub — purpose: bucket for ungrouped PBIs)
   │   ├── epic-NNN-word/     (any v1 epics authored in Phase C)
   │   │   ├── epic.md
   │   │   └── PBI-PPP.md
   │   └── _completed/
   │       └── epic-NNN-word/ (mirror per active epic, with .gitkeep)
   ├── adr/
   │   └── active/
   └── snags/
       └── _resolved/
   ```
2. Author the `epic-000-general/epic.md` stub:
   ```markdown
   # Epic 000: General

   **Priority:** P3
   **Status:** Ongoing
   **Depends on:** None

   ## Goal

   Loose collection of PBIs with no shared business outcome — bug fixes, small UI tweaks, afterthoughts, and isolated chores. Unlike feature epics, Epic 000 is not a business objective; it's a holding area. PBIs may flow into a new or existing feature epic when a coherent outcome emerges, or stay here permanently if they remain isolated.

   ## Deliverables

   - Whatever individual PBIs in this epic deliver. Per-PBI scope lives in each PBI file.

   ## Design Input Required

   None at the epic level. PBIs in this epic carry their own design context.

   ## Non-goals

   - Not a permanent home for work that belongs in a real epic. When PBIs here start clustering around a shared outcome, lift them out into a new feature epic.
   ```
3. Register the project in `~/.claude/wag/projects.json`. Read the existing file (or create it as an empty array). Add an entry: `{ "name": "[project name]", "path": "[absolute path]", "type": "[nextjs|cli|other]" }`. Don't duplicate if already registered.
4. Initialise `state.json`:
   ```json
   {
     "app_name": "{{PROJECT_NAME}}",
     "current_mode": null,
     "active_epic": "epic-000-general",
     "active_pbi": null,
     "feature_branch": null,
     "docs_page_path": null
   }
   ```
   - `active_epic` is the slug of the epic folder currently in scope. It is never null — it defaults to `"epic-000-general"` and returns to that value when no other epic is active.
   - `active_pbi` is the local per-epic PBI number as a zero-padded string like `"003"` when a PBI is in flight, or `null` when between PBIs. The full canonical ID is `PBI <active_epic-number>.<active_pbi>` (e.g., `PBI 001.003`).
   - `feature_branch` is a string like `"feature/PBI-001.003"` when an ADR has been approved for the active PBI, or `null` otherwise. `/wag:adr` writes it on approval; `/wag:dev` reads it to check out the right branch at session start.
   - `docs_page_path` is the project-relative path to the directory holding the in-app docs page (e.g., `"src/app/(dashboard)/docs"`), or `null` until `/wag:gendocs` runs for the first time. Set on first run after the user confirms a detected or chosen path; reused (but re-confirmed) on subsequent runs.
5. Present the scaffolded structure to the user. Walk through each document.

**Output:** Complete `.wag/` infrastructure with populated documents.

---

## Rules

1. **User approves every phase transition.** Never auto-advance.
2. **No app scaffolding.** Init creates `.wag/` planning infrastructure only. Code scaffolding is a separate concern.
3. **Documents are seeded, not empty.** Every document should contain real content derived from the phases that produced it.
4. **Research grounds decisions.** Requirements and architecture should trace back to research findings, not assumptions.
5. **The user drives scope.** You propose, they decide. Especially for v1 vs v2 and non-goals.
6. **Every PBI lives in an epic.** `epic-000-general/` exists from Phase D onward and absorbs all ungrouped work. There is no "standalone PBI at backlog root."
