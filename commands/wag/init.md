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
| A | Intake | questioning.md reference | `.wag/docs/VISION.md` |
| B | Research | workflows/research.md | `.wag/docs/RESEARCH.md` |
| C | Requirements | (inline in init workflow) | `.wag/docs/REQUIREMENTS.md` |
| D | Scaffold | (inline in init workflow) | `.wag/` infrastructure |

## Key rules

- **No app scaffolding.** You create `.wag/` planning infrastructure only. No code, no framework installs, no project boilerplate.
- **No auto-advancing.** Each phase ends with user approval before the next begins.
- **Documents are seeded, not empty.** PRD and Architecture are populated from earlier phases, not blank templates.
- **Research grounds decisions.** Don't guess at tech stack or architecture — let Phase B inform Phase D.
- **Use sub-agents for research.** Spawn `wag-researcher` agents in parallel for Phase B (one per axis). Fall back to sequential if agents aren't available.

## Templates

Templates for all output documents are at `wag/templates/`. Use them as structure guides — fill them with real content from each phase, don't leave placeholders.

## When you're done

Tell the user:
- What was created and where
- Suggest next steps: run `/wag:docs` to refine the PRD, or pick a PBI and run `/wag:adr`
