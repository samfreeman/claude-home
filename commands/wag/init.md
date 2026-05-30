---
description: Initialise a new project — intake, research, requirements, backlog. Creates .wag/ infrastructure with populated planning documents; standing up the app is PBI 0.1.
allowed-tools: Read, Write, Bash, Agent, WebSearch, WebFetch, Grep, Glob
---

# WAG Init — Enriched Project Initialisation

You are running the WAG init flow. This takes a user from "I have an idea" to a project with populated `.wag/` planning infrastructure.

## Before you start

1. Read `wag/workflows/init.md` for the full phase-by-phase process.
2. Read `wag/references/questioning.md` for the intake methodology.
3. **Establish the project folder.** Ask the user whether to **create a new folder** for the project or **use the current directory**:
   - *Create new* — ask for the folder name, create it under the current directory, and treat it as the project root for the rest of init. (You'll need the project name anyway; this can come from intake or be asked now.)
   - *Use current* — the cwd is the project root.

   Either way, the chosen folder is the project root for all phases. Confirm it back to the user before proceeding.
4. Confirm the working directory is the project root (not inside `.wag/` or a subdirectory).
5. Check if `.wag/` already exists. If it does, stop and ask the user — this project may already be initialised.

## Phases

Run these in order. **The user must approve each phase before you advance.**

| Phase | What | Workflow | Output |
|-------|------|----------|--------|
| A | Intake | questioning.md reference | `.wag/docs/PRD.md` (seeded) |
| B | Research | workflows/research.md | `.wag/docs/RESEARCH.md` + `.wag/docs/Architecture.md` (seeded) |
| C | Backlog | (inline in init workflow) | `.wag/backlog/` (**PBI 0.1 = infrastructure**; rest are vertical feature slices) |
| D | Scaffold | (inline in init workflow) | `.wag/` infrastructure (state.json, adr/, snags/) + root `git init` |

**Init plans; it does not scaffold the app.** What app to build is an *output* of the init review (PRD + Architecture), captured as **PBI 0.1** — `epic-000-general/PBI-001`, "stand up the project infrastructure." The app is actually built later, when PBI 0.1 is worked through `/wag:adr` → `/wag:dev` (which is where `/wag:create-nextjs` runs). Init establishes the root git repo (Phase D) so that dev cycle has a repo to merge into. A non-app project (docs-only) has no PBI 0.1.

## WAG docs structure

The `.wag/docs/` output is four things:

- **PRD.md** — product requirements document. Seeded from intake (Phase A).
- **RESEARCH.md** — research provenance. "We evaluated X, Y, Z — here's what we found." Queryable when revisiting decisions. Seeded from research (Phase B).
- **Architecture.md** — technical architecture decisions derived from research. Seeded from research (Phase B).
- **backlog/** — epics and PBIs. Derived from requirements discussion (Phase C).

PRD is the living product document. RESEARCH.md preserves evaluation context. Architecture.md captures the decisions.

## Key rules

- **Init plans; it does not scaffold the app.** Init produces the `.wag/` planning layer and the root git repo. What app to build is an *output* of the init review, captured as **PBI 0.1** (`epic-000-general/PBI-001`). The app is stood up later, when PBI 0.1 is worked via `/wag:adr` → `/wag:dev` (where `/wag:create-nextjs` runs).
- **PBI 0.1 is the infrastructure PBI.** First backlog item authored; scope = scaffold + baseline + the layers Architecture called for. It's the one sanctioned foundational PBI; every feature PBI depends on it. Non-app projects have no PBI 0.1.
- **No auto-advancing.** Each phase ends with user approval before the next begins.
- **Documents are seeded, not empty.** PRD and Architecture are populated from their respective phases, not blank templates.
- **Research grounds decisions.** Don't guess at tech stack or architecture — let Phase B inform the backlog.
- **Slice the backlog vertically.** Beyond PBI 0.1, Phase C PBIs should be thin end-to-end increments (UI → action → data) that leave the project demonstrable — not horizontal layers split by tier.
- **Use sub-agents for research.** Spawn `wag-researcher` agents in parallel for Phase B (one per axis). Fall back to sequential if agents aren't available.

## Templates

Templates for all output documents are at `wag/templates/`. Use them as structure guides — fill them with real content from each phase, don't leave placeholders.

## When you're done

Tell the user what was created and where — the `.wag/` infrastructure and the root git repo.

Then, for an app project, **offer to start PBI 0.1 next and explain that it must be next**: nothing else in the backlog can be built until the foundation exists, so PBI 0.1 (stand up the infrastructure — scaffold + baseline + layers) has to be the first thing worked. Offer to kick it off with `/wag:adr` on `PBI 000.001`. If they decline, leave the backlog ready and stop.

For a non-app project there is no PBI 0.1 — suggest `/wag:docs` to refine, or pick a PBI and run `/wag:adr`.
