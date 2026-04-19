---
description: Implement the active ADR — spawn an Agent Team with Architect, Dev, CQ, and Tester roles
allowed-tools: Read, Write, Bash, Glob, Grep, Agent
---

# WAG Dev — Agent Team Implementation

Implement the approved ADR using a coordinated Agent Team. Four roles, strict file ownership, quality gates at every step.

## Before you start

1. Confirm `.wag/` exists. If not, tell the user to run `/wag:init` first.
2. Check `adr/active/` for an approved ADR (status: approved). If none exists, tell the user to run `/wag:adr` first.
3. Read the ADR — this is the spec. Everything flows from it.
4. Read `.wag/docs/Architecture.md` for project context.
5. Read `~/.claude/wag/learnings/` for standards relevant to this ADR's domain. Filter by the `Applies to` field.

## Phase 1: Check out feature branch

The ADR specifies a feature branch (`feature/PBI-XXX`). Verify it exists and check it out:

```bash
git checkout feature/PBI-XXX
```

If the branch doesn't exist, something went wrong during ADR approval. Stop and tell the user.

## Phase 2: Spawn Agent Team

Read the **Team Shape** section from the ADR to determine how many Devs to spawn (1 or 2). Stand up the team. Each teammate loads their agent definition from `agents/wag/`.

### Architect (lead, Opus)

- Decomposes the ADR into tasks for the shared task list
- Each task includes: description, file ownership, dependencies, acceptance criteria
- Validates implementation against Architecture/PRD. Writes planning docs only (`.wag/docs/`, `.wag/adr/`, `.wag/snags/`) for snag resolution. Does not write `src/` or `tests/`.

### Dev ×1-2 (Sonnet)

- Implements code from task assignments
- Owns `src/` files exclusively — no other role writes to `src/`
- Claims tasks from the Architect's task list
- Escalates snags to Architect when blocked

### CQ Engineer (Opus)

- Read-only quality enforcer — never fixes anything, only reports
- Runs per-file checks (lint, style) continuously during active work
- Runs per-task checks (build, test) on task completion
- Findings during active work are advisory — Dev/Tester can acknowledge "known, resolves when X is done"
- Runs the final gate when all tasks are complete

### Tester (Sonnet)

- Writes tests alongside implementation
- Owns `tests/` files exclusively — no other role writes to `tests/`
- Works in parallel with Dev, writing tests as tasks are implemented
- Follows the Testing Strategy from the ADR

### File ownership summary

Two file writers with non-overlapping directories:
- **Dev** → `src/`
- **Tester** → `tests/`

Two read-only evaluators:
- **Architect** — planning docs only (`.wag/`), no `src/` or `tests/`
- **CQ Engineer** — reporting, no file writes

## Phase 3: Work

1. **Architect** publishes the task list with assignments and dependencies.
2. **Devs** claim tasks and implement. Each Dev works on independent tasks.
3. **Tester** writes tests alongside — as a Dev completes a task, Tester writes or updates corresponding tests.
4. **CQ** runs checks continuously:
   - Per-file: lint, style — on every file write
   - Per-task: build, test — on task completion
5. CQ findings during active work are **advisory**. Dev/Tester can acknowledge: "known, resolves when X is done."
6. If Dev or Tester hits a snag → message Architect → Architect resolves or escalates to user.

## Phase 4: Final gate (all tasks complete)

CQ runs the full gate. Everything must pass — no advisory findings allowed.

1. **CQ** runs: lint, build, test suite, coverage.
2. **Architect** validates implementation matches Architecture and ADR.
3. If anything fails → responsible teammate fixes → CQ re-runs.
4. Repeat until all clear.
5. **Architect** reports to user: implementation complete, all gates passed.

## Phase 5: PR

1. Create PR from `feature/PBI-XXX` to `dev`.
2. Move ADR from `adr/active/` to `adr/completed/`.
3. Close the PBI per the canonical procedure at `~/.claude/wag/references/close-pbi-and-epic.md`:
   - **Epic PBI** (`backlog/epic-NNN-slug/PBI-NNN.md`): `mv` to `backlog/_completed/epic-NNN-slug/PBI-NNN.md`. The mirror folder was pre-created when the epic was authored; remove the mirror's `.gitkeep` if this is the first PBI closed there.
   - **Standalone PBI** (`backlog/PBI-NNN.md`): `mv` to `backlog/_completed/PBI-NNN.md` (flat).
4. **Check for epic drain.** If the PBI came from an epic folder and the active folder now contains only `epic.md`:
   - Prompt: *"All PBIs in `<slug>` are complete. Mark the epic done?"*
   - **If yes:** update `epic.md` header (`**Status:** Completed <date>`, optional closure-note block summarising PBI outcomes); `git mv backlog/<slug>/epic.md backlog/_completed/<slug>/<slug>.md` (rename to folder slug); `rmdir backlog/<slug>/`; clear `active_epic` in `state.json` (set to `null`).
   - **If no:** leave the epic active with only its `epic.md`; don't change `active_epic`. The user may add more PBIs later.
5. **Update `state.json`:**
   - Clear `active_pbi` (set to `null`) — the PBI is complete.
   - Clear `active_epic` only if the user confirmed epic completion in step 4.
6. User reviews and approves the PR.
7. Squash merge to `dev`.

```bash
gh pr create --base dev --head feature/PBI-XXX --title "PBI-XXX: [title]" --body "$(cat <<'EOF'
## Summary
[From ADR]

## Changes
[File list from implementation]

## Test plan
[From ADR Testing Strategy]
EOF
)"

# After user approves:
git checkout dev
git merge --squash feature/PBI-XXX
git commit
```

## Phase 6: Team shutdown

1. Shut down all teammates.
2. Clean up team resources.

## Key rules

1. **The ADR is the spec.** If it's not in the ADR, don't implement it.
2. **File ownership is strict.** Dev writes `src/`, Tester writes `tests/`, Architect writes `.wag/` docs only. CQ writes nothing.
3. **CQ never fixes anything.** Only reports.
4. **Architect writes planning docs only.** `.wag/docs/`, `.wag/adr/`, `.wag/snags/` — never `src/` or `tests/`.
5. **User can intervene at any time.** Any role can be redirected.
6. **Snags escalate to user via Architect** when no prior resolution exists.
7. **Advisory findings during active work.** Dev/Tester can acknowledge known issues that will resolve with later work. At the final gate, everything must pass.
8. **Feature branches.** Work happens on `feature/PBI-XXX`, not directly on dev.
9. **Preserve epic membership when completing.** Completed PBIs that came from an epic folder go to `_completed/epic-NNN-slug/` (pre-created at epic authoring), not flat `_completed/`. Epic drain is detected automatically, but closure is confirmed by the user — don't auto-close an epic without the prompt.
