---
description: Initialise a new project — intake, research, scaffold the baseline app, backlog. Creates a running baseline plus populated .wag/ planning infrastructure; the app to build falls out of init's discovery.
allowed-tools: Read, Write, Bash, Agent, WebSearch, WebFetch, Grep, Glob, Skill
---

# WAG Init — Enriched Project Initialisation

You are running the WAG init flow. This takes a user from "I have an idea" to a running baseline app with populated `.wag/` planning infrastructure.

## Before you start

1. Read `wag/workflows/init.md` for the full phase-by-phase process.
2. Read `wag/references/questioning.md` for the intake methodology.
3. **Guard:** confirm the working directory is the project root (not inside `.wag/` or a subdirectory), and check whether `.wag/` already exists — if it does, stop and ask the user, as this project may already be initialised.
4. **Establish the project folder** (workflow Phase 0) before intake begins.

## The process lives in the workflow

`wag/workflows/init.md` is the single source of truth for the phase-by-phase procedure (Phases 0/A–E), the WAG docs structure, and the templates. Follow it — don't restate it here. This command's job is the pre-flight above and the hand-off below.

## Non-negotiables

A few rules govern the whole flow; the workflow explains the *why*:

- **One git repo at the root.** The scaffolder establishes it and discards its own `.git`; `.wag/` + app live under it.
- **No infrastructure PBI.** Init scaffolds the baseline (Phase C) before the backlog, so every PBI is a vertical feature slice. Non-app projects skip Phase C.
- **Approval-gated phases.** No auto-advancing — each phase ends with user approval before the next begins.

## When you're done

Tell the user what was created and where — the running baseline app, the root git repo, and the populated `.wag/` infrastructure.

Then suggest the next step: pick the first feature PBI and run `/wag:adr` on it. Nothing is blocked on a foundation PBI, so any v1 PBI is a valid start — recommend the one that delivers the thinnest end-to-end slice. If they'd rather refine the plan first, point them at `/wag:docs`.

For a non-app project there's no scaffold step — suggest `/wag:docs` to refine, or pick a PBI and run `/wag:adr`.
