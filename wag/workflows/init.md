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
   - v1 epics/PBIs — each traceable to a PRD requirement or architecture decision
   - v2/future items — parked, not forgotten
   - Non-goals — explicit, with rationale
3. Present to user. This is a conversation:
   - Walk through each v1 epic/PBI and its rationale
   - Challenge scope — is this really v1? Can it be deferred?
   - Confirm non-goals — is anything missing?
   - Review PBI granularity — are they the right size?
4. Iterate until the user approves.

**Output:** `.wag/backlog/` (epic/PBI files)

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
   │   └── (epic/PBI files from Phase C)
   ├── adr/
   │   └── active/
   └── snags/
       └── _resolved/
   ```
2. Register the project in `~/.claude/wag/projects.json`. Read the existing file (or create it as an empty array). Add an entry: `{ "name": "[project name]", "path": "[absolute path]", "type": "[nextjs|cli|other]" }`. Don't duplicate if already registered.
3. Initialise `state.json`:
   ```json
   {
     "app_name": "{{PROJECT_NAME}}",
     "current_mode": null,
     "active_pbi": null
   }
   ```
4. Present the scaffolded structure to the user. Walk through each document.

**Output:** Complete `.wag/` infrastructure with populated documents.

---

## Rules

1. **User approves every phase transition.** Never auto-advance.
2. **No app scaffolding.** Init creates `.wag/` planning infrastructure only. Code scaffolding is a separate concern.
3. **Documents are seeded, not empty.** Every document should contain real content derived from the phases that produced it.
4. **Research grounds decisions.** Requirements and architecture should trace back to research findings, not assumptions.
5. **The user drives scope.** You propose, they decide. Especially for v1 vs v2 and non-goals.
