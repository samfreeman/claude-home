---
description: Initialise a new project — intake, research, requirements, scaffold. Creates .wag/ infrastructure with populated planning documents.
allowed-tools: Read, Write, Bash, Agent, WebSearch, WebFetch, Grep, Glob
---

# WAG Init — Enriched Project Initialisation

You are running the WAG init flow. This takes a user from "I have an idea" to a project with populated `.wag/` planning infrastructure.

## Before you start

1. Read `wag/workflows/init.md` for the full phase-by-phase process.
2. Read `wag/references/questioning.md` for the intake methodology.
3. Confirm the working directory is the project root (not inside `.wag/` or a subdirectory).
4. Check if `.wag/` already exists. If it does, stop and ask the user — this project may already be initialised.

## Phases

Run these in order. **The user must approve each phase before you advance.**

| Phase | What | Workflow | Output |
|-------|------|----------|--------|
| A | Intake | questioning.md reference | `.wag/docs/PRD.md` (seeded) |
| B | Research | workflows/research.md | `.wag/docs/RESEARCH.md` + `.wag/docs/Architecture.md` (seeded) |
| C | Backlog | (inline in init workflow) | `.wag/backlog/` (epics/PBIs) |
| D | Scaffold | (inline in init workflow) | `.wag/` infrastructure (state.json, adr/, snags/) |

## WAG docs structure

The `.wag/docs/` output is four things:

- **PRD.md** — product requirements document. Seeded from intake (Phase A).
- **RESEARCH.md** — research provenance. "We evaluated X, Y, Z — here's what we found." Queryable when revisiting decisions. Seeded from research (Phase B).
- **Architecture.md** — technical architecture decisions derived from research. Seeded from research (Phase B).
- **backlog/** — epics and PBIs. Derived from requirements discussion (Phase C).

PRD is the living product document. RESEARCH.md preserves evaluation context. Architecture.md captures the decisions.

## Key rules

- **No app scaffolding.** You create `.wag/` planning infrastructure only. No code, no framework installs, no project boilerplate.
- **No auto-advancing.** Each phase ends with user approval before the next begins.
- **Documents are seeded, not empty.** PRD and Architecture are populated from their respective phases, not blank templates.
- **Research grounds decisions.** Don't guess at tech stack or architecture — let Phase B inform Phase D.
- **Use sub-agents for research.** Spawn `wag-researcher` agents in parallel for Phase B (one per axis). Fall back to sequential if agents aren't available.

## Templates

Templates for all output documents are at `wag/templates/`. Use them as structure guides — fill them with real content from each phase, don't leave placeholders.

## When you're done

Tell the user:
- What was created and where
- Suggest next steps: run `/wag:docs` to refine the PRD, or pick a PBI and run `/wag:adr`
