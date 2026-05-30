---
description: Initialise a new project — intake, research, requirements, scaffold. Creates .wag/ infrastructure with populated planning documents.
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
| C | Backlog | (inline in init workflow) | `.wag/backlog/` (epics/PBIs — vertical slices) |
| D | Scaffold | (inline in init workflow) | `.wag/` infrastructure (state.json, adr/, snags/) |
| E | App scaffold (conditional) | offers `/wag:create-nextjs` | app merged into project root, sharing one git repo with `.wag/` |

`.wag/` planning infrastructure is built **first** (Phases A–D); the app, if the design calls for one, is scaffolded **second** (Phase E). Phase E only runs when Architecture.md specifies an app stack — it's skipped for planning-only projects.

## WAG docs structure

The `.wag/docs/` output is four things:

- **PRD.md** — product requirements document. Seeded from intake (Phase A).
- **RESEARCH.md** — research provenance. "We evaluated X, Y, Z — here's what we found." Queryable when revisiting decisions. Seeded from research (Phase B).
- **Architecture.md** — technical architecture decisions derived from research. Seeded from research (Phase B).
- **backlog/** — epics and PBIs. Derived from requirements discussion (Phase C).

PRD is the living product document. RESEARCH.md preserves evaluation context. Architecture.md captures the decisions.

## Key rules

- **Planning first, app second.** Build the `.wag/` planning layer (Phases A–D) before scaffolding any app (Phase E). The planning is what decides whether an app exists and what kind.
- **You don't scaffold directly — you delegate.** When the design calls for an app, init *offers* to run the matching scaffolder (`/wag:create-nextjs` for Next.js). The scaffolder owns the scaffold-into-subfolder-then-merge-to-root mechanics and the single root-level git repo. Init decides *whether* and *which*; it never scaffolds of its own accord and never before user approval.
- **No auto-advancing.** Each phase ends with user approval before the next begins.
- **Documents are seeded, not empty.** PRD and Architecture are populated from their respective phases, not blank templates.
- **Research grounds decisions.** Don't guess at tech stack or architecture — let Phase B inform Phase D.
- **Slice the backlog vertically.** Phase C PBIs should be thin end-to-end increments (UI → action → data) that leave the project demonstrable — not horizontal layers split by tier.
- **Use sub-agents for research.** Spawn `wag-researcher` agents in parallel for Phase B (one per axis). Fall back to sequential if agents aren't available.

## Templates

Templates for all output documents are at `wag/templates/`. Use them as structure guides — fill them with real content from each phase, don't leave placeholders.

## When you're done

Tell the user:
- What was created and where — `.wag/` infrastructure, and (if Phase E ran) the scaffolded app at the project root with `.git` at the root
- Suggest next steps: run `/wag:docs` to refine the PRD, or pick a PBI and run `/wag:adr`
