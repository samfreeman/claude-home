# Init Workflow — Enriched Project Initialisation

## Purpose

Take a user from "I have an idea" to a project with populated `.wag/` infrastructure: vision, research, requirements, PRD, architecture, and backlog. No app scaffolding — init builds the planning layer only.

## Phases

### Phase A: Intake

**Goal:** Capture the user's vision without premature specificity.

**Reference:** `wag/references/questioning.md`

**Process:**
1. Start with: "Tell me what you want to build."
2. Follow the questioning methodology — open-ended, follow the energy, no premature specificity.
3. Explore the idea, motivation, users, desired outcome, and any constraints that surface naturally.
4. When the vision is clear, draft a VISION.md and present it to the user for approval.

**Output:** `.wag/docs/VISION.md`

**Transition:** User approves the vision. Do not proceed without approval.

---

### Phase B: Research

**Goal:** Investigate unknowns before committing to a plan.

**Reference:** `wag/workflows/research.md`

**Process:**
1. Read the approved VISION.md.
2. Identify research questions per axis (ecosystem, feasibility, architecture patterns).
3. Launch parallel research sub-agents (or run sequentially as fallback).
4. Consolidate findings into RESEARCH.md.
5. Present to user, discuss, and incorporate feedback.

**Output:** `.wag/docs/RESEARCH.md`

**Transition:** User approves the research. They may request deeper investigation on specific areas before proceeding.

---

### Phase C: Requirements

**Goal:** Synthesise vision + research into concrete, scoped requirements.

**Process:**
1. Read VISION.md and RESEARCH.md.
2. Draft requirements grounded in research findings:
   - v1 requirements — each traceable to a research finding or user decision
   - v2/future requirements — parked, not forgotten
   - Non-goals — explicit, with rationale
   - PBI candidates — derived from v1 requirements, each with enough detail to become a backlog item
3. Present to user. This is a conversation:
   - Walk through each v1 requirement and its rationale
   - Challenge scope — is this really v1? Can it be deferred?
   - Confirm non-goals — is anything missing?
   - Review PBI candidates — are they the right granularity?
4. Iterate until the user approves.

**Output:** `.wag/docs/REQUIREMENTS.md`

**Transition:** User approves requirements. Do not proceed without approval.

---

### Phase D: Scaffold

**Goal:** Create the `.wag/` infrastructure with populated documents.

**Process:**
1. Create the `.wag/` directory structure:
   ```
   .wag/
   ├── state.json
   ├── docs/
   │   ├── VISION.md          (from Phase A)
   │   ├── RESEARCH.md        (from Phase B)
   │   ├── REQUIREMENTS.md    (from Phase C)
   │   ├── PRD.md             (seeded from vision + requirements)
   │   └── Architecture.md    (seeded from research)
   ├── backlog/
   │   └── (PBI files from requirements)
   ├── adr/
   │   └── active/
   └── snags/
   ```
2. Seed PRD.md from the vision (Phase A) and requirements (Phase C). Not an empty template — a populated document.
3. Seed Architecture.md from research findings (Phase B). Tech stack choices, architecture patterns, and key decisions are pre-filled from research.
4. Create PBI files in `backlog/` from the PBI candidates in requirements.
5. Initialise `state.json`:
   ```json
   {
     "app_name": "{{PROJECT_NAME}}",
     "current_mode": null,
     "active_pbi": null
   }
   ```
6. Present the scaffolded structure to the user. Walk through each document.

**Output:** Complete `.wag/` infrastructure with populated documents.

---

## Rules

1. **User approves every phase transition.** Never auto-advance.
2. **No app scaffolding.** Init creates `.wag/` planning infrastructure only. Code scaffolding is a separate concern.
3. **Documents are seeded, not empty.** Every document should contain real content derived from the phases that produced it.
4. **Research grounds decisions.** Requirements and architecture should trace back to research findings, not assumptions.
5. **The user drives scope.** You propose, they decide. Especially for v1 vs v2 and non-goals.
