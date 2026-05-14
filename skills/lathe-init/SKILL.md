---
name: lathe-init
description: Lathe Init phase — product discovery. Produces PRD and RESEARCH.md. Use when starting a new Lathe project or resuming Init.
disable-model-invocation: true
allowed-tools: Read Write Edit Grep Glob Bash
---

# Lathe Init — Product Discovery

**Beats 1-3 of the four-beat pattern applied to the whole product.**

1. **Desire** — what does the user want to build? Why?
2. **Context** — what exists? Market, prior art, constraints, tech landscape.
3. **Approach** — how should this be built? Scope, phases, non-goals.

Beat 4 (convergence) is handled by the orchestrator via the grill master. This skill does NOT self-evaluate.

---

## Current State

### Project
!`basename "$(pwd)"`

### Package Info
!`cat package.json 2>/dev/null | head -10 || echo "No package.json"`

### Existing PRD
!`cat .lathe/docs/PRD.md 2>/dev/null || echo "No PRD yet"`

### Existing Research
!`cat .lathe/docs/RESEARCH.md 2>/dev/null || echo "No research yet"`

---

## Precondition

Init only runs inside an existing project directory. It does NOT scaffold or create apps. If there's no project here, stop and tell the user.

## On First Run (no `.lathe/`)

1. Read the existing codebase — understand what's already here (package.json, README, src/, etc.).
2. Create `.lathe/` directory structure:

```bash
mkdir -p .lathe/{docs,backlog/_completed,adr/{active,completed},events,captures,wiki}
```

3. Write initial state to Turso (project name from directory, phase = init).
4. Write `.lathe/.last_sync` with current timestamp.
5. Let the user explain what they want. Proceed to beats 1-3.

---

## On Resume (`.lathe/` exists, phase is init)

Read existing PRD and RESEARCH.md. Pick up where we left off.

---

## Beat 1: Desire

Shut up and listen. The user will tell you what they want to build. Your job is to understand, not to interview. Ask ONE follow-up at a time, only when you genuinely don't understand something. Never fire a list of questions. Never ask something the user already answered.

The user often arrives with the idea already formed. Let them talk. Reflect back what you heard. If something is unclear or missing, ask about that one thing. Then listen again.

---

## Beat 2: Context (Research)

Start with what's already here. Read the codebase. Understand the existing architecture, dependencies, patterns, and state. Then investigate the broader context. Write findings to `.lathe/docs/RESEARCH.md`.

- Existing codebase — what's built, what shape is it in, what patterns are established?
- Prior art — what else is out there?
- Technical landscape — what tools/frameworks/patterns apply?
- Constraints — what can't change?
- Risks — what could go wrong?

Research is a living document. It grows as the project grows. Init creates the first version.

### RESEARCH.md Format

```markdown
# Research — [App Name]

## Prior Art
[What exists, what we can learn from it, what we're doing differently.]

## Technical Landscape
[Relevant tech, frameworks, patterns. Why they fit or don't.]

## Constraints
[Hard limits — tech, time, team, budget, compliance.]

## Risks
[What could go wrong. Ordered by likelihood × impact.]

## Open Questions
[Things we don't know yet that matter.]
```

---

## Beat 3: Approach (PRD)

Draft the PRD at `.lathe/docs/PRD.md`. This is the product truth — what we're building, why, and the shape of the solution.

### PRD Format

```markdown
# [App Name] — Product Requirements Document

## Overview
[What the app does in 2-3 sentences.]

## Problem Statement
[Why this app exists. What pain does it solve.]

## Target Users
[Who uses this and how.]

## User Flow
[Step-by-step: what happens when the user interacts with the app.]

## Phased Development
[Phases with goals and deliverables. Each phase is independently demo-able. Vertical slices — user-visible capabilities, not layers.]

## Non-Goals
[What we're explicitly NOT building.]

## Success Metrics
[How we know it's working.]
```

The PRD is deliberately lean. No tech stack, no architecture, no implementation details. That's Architecture's job. The PRD is pure desire — what and why, never how.

---

## Completion Signal

Init is complete when:
1. PRD.md exists and the user is satisfied with it.
2. RESEARCH.md exists with at least prior art and constraints.
3. The user says "this captures what I want" or equivalent.

Tell the orchestrator: "Init complete. Ready for grill master." The orchestrator handles beat 4.

---

## Critical Rules

1. **No architecture in the PRD.** No tech stack, no database choices, no framework decisions. Pure product.
2. **No backlog in Init.** Init discovers the product. Backlog slices it. Separate phases.
3. **Vertical thinking from the start.** Phases in the PRD are user-visible capabilities, not layers. "Users can sign up and see a dashboard" not "Set up database and auth."
4. **Research is not optional.** Even if the user thinks they know, write RESEARCH.md. The grill master checks PRD against research.
