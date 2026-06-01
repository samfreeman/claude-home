---
description: Initialise a new project — intake, research, scaffold the baseline app, backlog. Creates a running baseline plus populated .wag/ planning infrastructure; the app to build falls out of init's discovery.
allowed-tools: Read, Write, Bash, Agent, WebSearch, WebFetch, Grep, Glob, Skill
---

# WAG Init — Enriched Project Initialisation

You are running the WAG init flow. This takes a user from "I have an idea" to a running baseline app with populated `.wag/` planning infrastructure.

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
| B | Research | workflows/research.md | `.wag/docs/RESEARCH.md` + `.wag/docs/Architecture.md` (seeded, **with the baseline decided**) |
| C | Stand up the baseline | (inline in init workflow) | running baseline app + root git repo (via `/wag:create-nextjs` or another scaffolder) |
| D | Backlog | (inline in init workflow) | `.wag/backlog/` (all vertical feature slices on top of the baseline) |
| E | Finalise infra | (inline in init workflow) | `.wag/` infrastructure (state.json, adr/, snags/) + project registration |

**The app to build falls out of init's discovery, and init scaffolds it.** Intake (Phase A) and research (Phase B) decide the baseline — what kind of app, the baseline deps, the layers it ships with. Init then **stands that baseline up** (Phase C) by invoking `/wag:create-nextjs` (or another scaffolder), so the app boots before the backlog is authored. The scaffolder establishes the single root git repo and discards its own `.git`. Every backlog PBI (Phase D) is then a vertical feature slice — there is no infrastructure PBI. A non-app project (docs-only) skips Phase C.

## WAG docs structure

The `.wag/docs/` output is four things:

- **PRD.md** — product requirements document. Seeded from intake (Phase A).
- **RESEARCH.md** — research provenance. "We evaluated X, Y, Z — here's what we found." Queryable when revisiting decisions. Seeded from research (Phase B).
- **Architecture.md** — technical architecture decisions derived from research. Seeded from research (Phase B).
- **backlog/** — epics and PBIs. Derived from requirements discussion (Phase C).

PRD is the living product document. RESEARCH.md preserves evaluation context. Architecture.md captures the decisions.

## Key rules

- **The app to build falls out of discovery, and init scaffolds it.** Intake + research (Phases A–B) decide the baseline; init stands it up (Phase C) by invoking `/wag:create-nextjs` (or another scaffolder) before the backlog is authored. The baseline is init's output, not a backlog item.
- **There is no infrastructure PBI.** The baseline already exists by the time the backlog is written, so every PBI is a vertical feature slice on top of it. Non-app projects skip the scaffold phase entirely.
- **One git repo at the root.** The scaffolder establishes the single root repo and discards its own `.git`; everything (`.wag/` + app) lives under it.
- **No auto-advancing.** Each phase ends with user approval before the next begins.
- **Documents are seeded, not empty.** PRD and Architecture are populated from their respective phases, not blank templates.
- **Research grounds decisions.** Don't guess at tech stack or architecture — let Phase B inform the baseline and the backlog.
- **Slice the backlog vertically.** Phase D PBIs should be thin end-to-end increments (UI → action → data) that leave the project demonstrable — not horizontal layers split by tier.
- **Use sub-agents for research.** Spawn `wag-researcher` agents in parallel for Phase B (one per axis). Fall back to sequential if agents aren't available.

## Templates

Templates for all output documents are at `wag/templates/`. Use them as structure guides — fill them with real content from each phase, don't leave placeholders.

## When you're done

Tell the user what was created and where — the running baseline app, the root git repo, and the populated `.wag/` infrastructure.

Then suggest the next step: pick the first feature PBI and run `/wag:adr` on it. Nothing is blocked on a foundation PBI, so any v1 PBI is a valid start — recommend the one that delivers the thinnest end-to-end slice. If they'd rather refine the plan first, point them at `/wag:docs`.

For a non-app project there's no scaffold step — suggest `/wag:docs` to refine, or pick a PBI and run `/wag:adr`.
