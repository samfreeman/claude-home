# Init Workflow — Enriched Project Initialisation

## Purpose

Take a user from "I have an idea" to a project with populated `.wag/` infrastructure — PRD, architecture, and a backlog ready to work. Init produces the **planning layer**; it does **not** scaffold the app.

**What app to build is an output of init, not an action init takes.** Intake (Phase A) and research (Phase B) produce the PRD and Architecture; reviewing those docs is what decides the stack, the layers, and the shape of the app. Init captures that decision — it doesn't execute it.

**Standing up the app is PBI 0.1.** The very first backlog item — `epic-000-general/PBI-001`, canonical `PBI 000.001` — is "stand up the project infrastructure": scaffold the app, baseline deps, and whatever layers (db/auth/theme) Architecture called for. Every other PBI is a vertical feature slice that depends on 0.1. This is the one legitimate foundational PBI — the justified exception to vertical slicing (see Phase C) — and it's first. The app actually gets built when PBI 0.1 is worked through the normal `/wag:adr` → `/wag:dev` cycle, which is where `/wag:create-nextjs` (or another scaffolder) runs.

Init still establishes the git repo at the project root (Phase D), so by the time PBI 0.1 is implemented there's a repo for the scaffolder to merge into.

## WAG docs structure

The `.wag/docs/` output is four things:

- **PRD.md** — product requirements document. Seeded from intake (Phase A).
- **RESEARCH.md** — research provenance. "We evaluated X, Y, Z — here's what we found." Queryable when revisiting decisions. Seeded from research (Phase B).
- **Architecture.md** — technical architecture decisions derived from research. Seeded from research (Phase B).
- **backlog/** — epics and PBIs. Derived from requirements discussion (Phase C).

PRD is the living product document. RESEARCH.md preserves evaluation context. Architecture.md captures the decisions.

## Phases

### Phase 0: Establish the project folder

Before intake, settle where the project lives. Ask the user whether to **create a new folder** or **use the current directory**:
- *Create new* — ask for the folder name, create it under the cwd, and treat it as the project root for every subsequent phase.
- *Use current* — the cwd is the project root (it may already exist and be where the user invoked init).

Confirm the chosen root back to the user. This folder is where `.wag/` is built and where the app (if any) is later merged.

---

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
   - **PBI 0.1 — the infrastructure PBI.** The first item authored is always `epic-000-general/PBI-001` (canonical `PBI 000.001`): "stand up the project infrastructure." Its scope is whatever Architecture decided — scaffold the app (e.g. via `/wag:create-nextjs`), baseline deps, and the chosen layers (db / auth / theme). For a non-app project (docs-only, research-only) there is no infrastructure to stand up, so skip PBI 0.1.
   - **Every PBI blocks on 0.1.** When PBI 0.1 exists, every other PBI lists `PBI 000.001` in its `Dependencies:` line — there is no codebase to build against until the foundation is stood up, so nothing can start before it. This is a cross-epic dependency (named with the full `PBI 000.001` form), so it's compatible with the per-epic dependency-direction rule. PBI 0.1 itself depends on nothing.
   - v1 epics / PBIs — each traceable to a PRD requirement or architecture decision
   - v2 / future items — parked, not forgotten
   - Non-goals — explicit, with rationale
3. Present to user. This is a conversation:
   - Walk through each v1 epic / PBI and its rationale
   - Challenge scope — is this really v1? Can it be deferred?
   - Confirm non-goals — is anything missing?
   - Review PBI granularity — are they the right size?
   - Check the slice — is each PBI vertical (see below)?
4. Iterate until the user approves.

**Slice vertically.**
Wherever it's feasible, a PBI should be a **thin end-to-end increment** — a vertical slice that cuts through every layer the feature touches (UI → server action / API → data / schema) and leaves the project in a demonstrable state. After a vertical PBI ships, you can *show* something: a user can perform the action and see the result, even if it's narrow.

The anti-pattern is **horizontal slicing** — PBIs split by layer rather than by outcome: "set up the whole database schema," then "build all the API routes," then "build all the screens." Each horizontal PBI ships nothing a user can see, and nothing is demonstrable until the last one lands. Avoid this.

Concretely, when drafting and challenging PBIs:
- Prefer "user can create and view a single todo (input → action → row → render)" over "create the todos table."
- Each PBI's Deliverables and Acceptance Criteria should include an observable, user- or caller-facing outcome — not just an internal layer being present.
- It's fine for an early slice to be deliberately narrow (one entity, one happy path, hardcoded edges) and for later slices in the same epic to widen it. Width grows across slices; depth (end-to-end) holds in every slice.
- The infrastructure PBI (**PBI 0.1**) is the one sanctioned foundational exception — standing up the scaffold and layers genuinely can't be a feature slice, and everything depends on it. Beyond 0.1, treat further purely-foundational PBIs (a shared schema package, an auth substrate) as exceptions to justify, not the default. Push the foundation *into* the first feature slice that needs it whenever you can.

When a proposed PBI looks horizontal, say so and propose the vertical recut before moving on.

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
5. Initialise the git repository at the project root (`git init`) if one doesn't already exist. This is the single repo for the project — it tracks `.wag/` now, and the app later, when PBI 0.1 is implemented and the scaffolder merges the app in. Establishing it here means `.wag/` is version-controlled from the start, and when PBI 0.1's dev cycle runs the scaffolder it finds an existing repo (so `create-next-app` won't create a competing one in its subfolder).
6. Present the scaffolded structure to the user. Walk through each document.

**Output:** Complete `.wag/` infrastructure with populated documents, under a git repo rooted at the project root.

**Transition:** User approves the scaffolded `.wag/`. Init is complete — proceed to wrap-up.

---

## Wrap-up: hand off to PBI 0.1

Init does not scaffold the app. When init finishes, tell the user what was created, then — for an app project — **offer to start PBI 0.1 next** and explain *why it has to be next*:

> "The planning layer is in place. The next step is **PBI 0.1 — stand up the project infrastructure** (scaffold + baseline + layers). Nothing else in the backlog can be built until the foundation exists, so this PBI must be worked first. Want me to start it now with `/wag:adr` on PBI 0.1?"

If the user agrees, hand off to `/wag:adr` for `PBI 000.001`. If they decline, leave the backlog ready and stop — they can start the dev cycle whenever. For a non-app project there is no PBI 0.1; just report that init is complete.

---

## Rules

1. **User approves every phase transition.** Never auto-advance.
2. **Init plans; it never scaffolds the app.** Init produces the `.wag/` planning layer (PRD, Architecture, backlog) and the root git repo. What app to build is an *output* of the init review, captured as **PBI 0.1** — the app is actually stood up later, when PBI 0.1 is worked through `/wag:adr` → `/wag:dev`.
3. **Documents are seeded, not empty.** Every document should contain real content derived from the phases that produced it.
4. **Research grounds decisions.** Requirements and architecture should trace back to research findings, not assumptions.
5. **The user drives scope.** You propose, they decide. Especially for v1 vs v2 and non-goals.
6. **Every PBI lives in an epic.** `epic-000-general/` exists from Phase D onward and absorbs all ungrouped work. There is no "standalone PBI at backlog root."
7. **Slice vertically.** Backlog PBIs should be thin end-to-end increments that leave the project demonstrable, not horizontal layers split by tier. See Phase C.
