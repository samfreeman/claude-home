# Init Workflow — Enriched Project Initialisation

## Purpose

Take a user from "I have an idea" to a **running baseline app** with a populated `.wag/` planning layer and a backlog ready to work — PRD, architecture, a scaffolded app that boots, and epics/PBIs derived against it.

**What app to build falls out of init's discovery.** Intake (Phase A) and research (Phase B) produce the PRD and Architecture, and that conversation is what decides the **baseline** — what kind of app, the baseline deps, and which layers (db/auth/theme) it ships with. The baseline is not a backlog item to be designed later; it's the ground-0 decision init reaches and then **acts on**.

**Init scaffolds the baseline before the backlog.** Once the baseline is settled, init stands it up (Phase C) by invoking `/wag:create-nextjs` (or another scaffolder). The app boots *before* any backlog conversation, so the backlog is authored against a project that already exists. Every PBI is then a vertical feature slice — there is no infrastructure PBI and nothing for the rest of the backlog to block on.

Init establishes the git repo at the project root, and that single WAG repo is the one the scaffolder merges into — the scaffolder's own `.git` is discarded.

## WAG docs structure

The `.wag/docs/` output is four things:

- **PRD.md** — product requirements document. Seeded from intake (Phase A).
- **RESEARCH.md** — research provenance. "We evaluated X, Y, Z — here's what we found." Queryable when revisiting decisions. Seeded from research (Phase B).
- **Architecture.md** — technical architecture decisions derived from research. Seeded from research (Phase B).
- **backlog/** — epics and PBIs. Derived from requirements discussion (Phase D).

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
4. **Capture the domain vocabulary as it surfaces** — the words the user keeps using for the core things — pinning **one name per referent** (settle synonyms on the spot). This is the seed of the project's ubiquitous language; Phase B crystallises it into Architecture's `Ubiquitous language` section. See `~/.claude/wag/references/ubiquitous-language.md`.
5. When the vision is clear, draft a PRD.md. Author freely — any structure that serves the product, written **in the captured terms**. Before presenting for approval, check the draft against the **required-content manifest** at the top of `~/.claude/wag/templates/prd.md`: every item answered somewhere in the doc, or resolved in the grill now. The doc must leave init ADR-ready.

**Output:** `.wag/docs/PRD.md`

**Transition:** User approves the PRD. Do not proceed without approval.

---

### Phase B: Research → RESEARCH.md + Architecture.md (and the baseline decision)

**Goal:** Investigate unknowns before committing to a plan. Preserve evaluation context in RESEARCH.md, then seed Architecture.md with the decisions — including the **baseline**: what kind of app this is, its baseline deps, and which layers (db/auth/theme) ship in ground 0. This is the decision Phase C acts on.

**Reference:** `wag/workflows/research.md`

**Process:**
1. Read the approved PRD.md.
2. Identify research questions per axis (ecosystem, feasibility, architecture patterns).
3. Launch parallel research sub-agents (or run sequentially as fallback).
4. Write RESEARCH.md — the full evaluation context: what was investigated, what was found, alternatives considered, and rationale for each choice. This is the provenance doc — "why not X?" is answered here.
5. Derive Architecture.md from research findings — tech stack choices, architecture patterns, and key decisions are pre-filled. Architecture captures the decisions; RESEARCH captures the journey. **Define the `Ubiquitous language` section** here: crystallise the vocabulary captured in Phase A into a glossary of core domain terms, one name per referent — the names every later layer and the code follow. Grill it for synonyms and resist artificial bounded contexts (see `~/.claude/wag/references/ubiquitous-language.md`). Author freely, then check the draft against the **required-content manifest** at the top of `~/.claude/wag/templates/architecture.md` (the ubiquitous-language item among them): every item answered somewhere, or resolved before approval. The doc must leave init ADR-ready.
6. Read all learning files from `~/.claude/wag/learnings/` whose `Applies to` field matches this project type. For each, merge the Template Patch section into the appropriate section of the Architecture doc.
7. **Settle the baseline.** Pin down ground 0 explicitly so Phase C has something concrete to scaffold: what kind of app (Next.js web app, Node service, CLI, library — this selects the scaffolder), the baseline deps, the layers that ship now vs. are deferred, and the platform/tier (name the tier and confirm the feature exists on it — see LEARNING-003). Record these in Architecture.md as the baseline.
8. Present both docs to user, discuss, and incorporate feedback.

**Output:** `.wag/docs/RESEARCH.md` + `.wag/docs/Architecture.md` (with the baseline decided)

**Transition:** User approves the architecture and the baseline. They may request deeper investigation on specific areas before proceeding.

---

### Phase C: Stand up the baseline

**Goal:** Scaffold the baseline app decided in Phase B, so the rest of init works against a project that actually boots.

**Process:**
1. Re-confirm the baseline from Architecture.md with the user — app kind, baseline deps, layers in ground 0.
2. For an **app project**, stand it up by invoking the appropriate scaffolder via the Skill tool:
   - **Next.js app:** `/wag:create-nextjs` — passes through the baseline deps and the chosen layers (db / auth / theme). It establishes the single root git repo and discards its own `.git` (see that command for the subfolder-merge mechanics and the merge-up-vs-keep-in-subfolder choice).
   - **Other app kinds** (Node service, CLI) may have no WAG scaffolder yet — stand them up manually per Architecture.md, still under one git repo at the project root.
3. Confirm the app boots / builds clean before moving on.

For a **non-app project** (docs-only, research-only) there is nothing to scaffold — skip this phase.

**Output:** A running baseline app at the project root, under the root git repo.

**Transition:** User confirms the baseline is stood up. Do not proceed to the backlog until the app exists (app projects).

---

### Phase D: Backlog

**Goal:** Synthesise PRD + Architecture into concrete, scoped epics and PBIs, authored against the now-running baseline.

**Process:**
1. Read PRD.md and Architecture.md.
2. Draft backlog items grounded in the PRD and architecture. The baseline already exists (Phase C), so every PBI is a vertical feature slice built on top of it — there is no infrastructure PBI:
   - v1 epics / PBIs — each traceable to a PRD requirement or architecture decision
   - v2 / future items — authored into `epic-501-future/` (the future bucket): parked, not forgotten, and carried forward into later design
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
- The baseline is already stood up (Phase C), so it is **not** a PBI. Treat any purely-foundational PBI (a shared schema package, an auth substrate) as an exception to justify, not the default — push the foundation *into* the first feature slice that needs it whenever you can.

When a proposed PBI looks horizontal, say so and propose the vertical recut before moving on.

**Backlog structure:**
- Every PBI lives in an epic. Epic folders are named `epic-NNN-word/` (one-word kebab-style descriptor), and each contains an `epic.md` plus the PBI files belonging to that epic, named `PBI-PPP.md` (per-epic local number, zero-padded).
- `epic-000-general/` is the permanent bucket for loose work — bug fixes, small UI tweaks, afterthoughts, anything that doesn't deserve its own epic. It is created automatically during Phase E and always exists. PBIs in it are not pinned — when a cluster of them coheres around a shared outcome, lift them into a new feature epic.
- `epic-501-future/` is the holding bucket for *deferred* work — envisioned PBIs you intend to build later. Created during Phase E. Its PBIs carry a deferral dependency so `/wag:adr` keeps them visible-but-not-offered and feeds them into later design. (Feature epics take `001–199`; `000` and `200+` are reserved, ongoing special buckets — the `200+` numbers borrow HTTP status codes as a soft mnemonic, so `501` = "Not Implemented".)
- Canonical PBI ID is `PBI EEE.PPP` (epic number dot PBI number). This is the form used in display, commits, ADR titles, snags, and prose.

**What an epic is:**
An epic is a **business objective** — a coherent outcome that delivers value to users or the business. Not a category of tasks. A single epic's PBIs may span backend, frontend, schema, infra, and docs; what makes them an epic together is the shared outcome they deliver. Names like `epic-NNN-database` or `epic-NNN-refactoring` or `epic-NNN-bugs` are anti-patterns — those PBIs either serve a real business epic, or live in `epic-000-general`.

**Output:** `.wag/backlog/` (epic folders, including `epic-000-general/` and `epic-501-future/`)

**Transition:** User approves the backlog. Do not proceed without approval.

---

### Phase E: Finalise .wag/ infrastructure

**Goal:** Create the remaining `.wag/` infrastructure and register the project. The app (Phase C) and the backlog (Phase D) already exist; this phase completes the planning scaffold around them.

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
   │   │   └── epic.md        (stub — bucket for ungrouped present work)
   │   ├── epic-501-future/
   │   │   └── epic.md        (stub — bucket for deferred/envisioned work)
   │   ├── epic-NNN-word/     (any v1 epics authored in Phase D)
   │   │   ├── epic.md
   │   │   └── PBI-PPP.md
   │   └── _completed/
   │       └── epic-NNN-word/ (mirror per active epic, with .gitkeep)
   ├── adr/
   │   └── active/
   └── snags/
       └── _resolved/
   ```
2. Author the special-bucket stubs. First, `epic-000-general/epic.md`:
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

   Then `epic-501-future/epic.md`:
   ```markdown
   # Epic 501: Future

   **Priority:** P3
   **Status:** Ongoing
   **Depends on:** None

   ## Goal

   Holding bucket for envisioned, deferred work — backlog-shaped PBIs the project intends to build later, not now. Unlike feature epics, Epic 501 is not a business objective being actively pursued; it's where "v2/future — parked, not forgotten" lives as concrete, pointable PBIs. Each PBI carries a deferral dependency so `/wag:adr` keeps it visible-but-not-offered — it surfaces in the blocked footnote and feeds Phase 2 design context. When a future item draws near, lift it into its own properly-framed feature epic.

   (Number `501` follows the special-bucket convention: feature epics use `001–199`; `200+` buckets borrow HTTP status codes as a soft mnemonic. `501 Not Implemented` = envisioned, not built yet; the `5xx` class marks work that takes priority after delivery.)

   ## Deliverables

   - Whatever individual future PBIs in this epic describe. Per-PBI scope lives in each PBI file.

   ## Design Input Required

   None at the epic level. Future PBIs carry their own design context and inform present ADRs via `/wag:adr` Phase 2.

   ## Non-goals

   - Not a backlog of now-work. PBIs here are deferred by definition; promote one to a feature epic when it's time to build it.
   ```
3. Register the project in `~/.claude/wag/projects.json`. Read the existing file (or create it as an empty array). Add an entry: `{ "name": "[project name]", "path": "[absolute path]", "type": "[nextjs|cli|other]" }`. Don't duplicate if already registered.
4. Initialise `state.json`:
   ```json
   {
     "app_name": "{{PROJECT_NAME}}",
     "wag_version": "{{WAG_VERSION}}",
     "current_mode": null,
     "active_epic": "epic-000-general",
     "active_pbi": null,
     "feature_branch": null,
     "docs_page_path": null
   }
   ```
   - `wag_version` stamps the wag2 tooling version this project was created under. Read it from `~/.claude/wag/config.json` (`version`) and write that exact value — do not hardcode. This is the stamp `/wag:update` reads to migrate the project forward; without it the project looks legacy/unstamped.
   - `active_epic` is the slug of the epic folder currently in scope. It is never null — it defaults to `"epic-000-general"` and returns to that value when no other epic is active.
   - `active_pbi` is the local per-epic PBI number as a zero-padded string like `"003"` when a PBI is in flight, or `null` when between PBIs. The full canonical ID is `PBI <active_epic-number>.<active_pbi>` (e.g., `PBI 001.003`).
   - `feature_branch` is a string like `"feature/PBI-001.003"` when an ADR has been approved for the active PBI, or `null` otherwise. `/wag:adr` writes it on approval; `/wag:dev` reads it to check out the right branch at session start.
   - `docs_page_path` is the project-relative path to the directory holding the in-app docs page (e.g., `"src/app/(dashboard)/docs"`), or `null` until `/wag:gendocs` runs for the first time. Set on first run after the user confirms a detected or chosen path; reused (but re-confirmed) on subsequent runs.
5. Ensure the single git repository exists at the project root. For an **app project** it was already established in Phase C — the scaffolder runs `git init` at the root before scaffolding and discards its own `.git`, so there's one repo tracking both `.wag/` and the app. For a **non-app project** (no Phase C scaffold), run `git init` at the project root now so `.wag/` is version-controlled.
6. Present the finalised structure to the user. Walk through each document.

**Output:** Complete `.wag/` infrastructure with populated documents, alongside the baseline app, under a single git repo rooted at the project root.

**Transition:** User approves the finalised `.wag/`. Init is complete — proceed to wrap-up.

---

## Wrap-up: pick the first PBI

When init finishes the baseline is already standing and the backlog is authored against it. Tell the user what was created — the running app, the git repo, and the populated `.wag/` planning layer — then suggest picking the first feature PBI and running `/wag:adr` on it. Nothing is blocked on a foundation PBI, so any v1 PBI is a valid starting point; recommend one that delivers the thinnest end-to-end slice. If the user wants to refine the plan first, point them at `/wag:docs`.

---

## Rules

1. **User approves every phase transition.** Never auto-advance.
2. **The baseline falls out of discovery, and init scaffolds it.** Intake + research decide the baseline (Phase B); init stands it up (Phase C) before the backlog is authored. The baseline is init's output, not a backlog item — there is no infrastructure PBI.
3. **Documents are seeded, not empty.** Every document should contain real content derived from the phases that produced it.
4. **Research grounds decisions.** Requirements and architecture should trace back to research findings, not assumptions.
5. **The user drives scope.** You propose, they decide. Especially for v1 vs v2 and non-goals.
6. **Every PBI lives in an epic.** `epic-000-general/` exists from Phase E onward and absorbs all ungrouped work. There is no "standalone PBI at backlog root."
7. **Slice vertically.** Backlog PBIs should be thin end-to-end increments that leave the project demonstrable, not horizontal layers split by tier. See Phase D.
