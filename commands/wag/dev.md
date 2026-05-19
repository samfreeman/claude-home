---
description: Implement the active ADR — spawn an Agent Team with Architect, Dev, CQ, and Tester roles
allowed-tools: Read, Write, Bash, Glob, Grep, Agent
---

# WAG Dev — Agent Team Implementation

Implement the approved ADR using a coordinated Agent Team. Four roles, strict file ownership, quality gates at every step.

## Before you start

1. Confirm `.wag/` exists. If not, tell the user to run `/wag:init` first.
2. Read `.wag/state.json` and get `feature_branch`. If the field is missing or null, tell the user to run `/wag:adr` first — no ADR has been approved.
3. Check out the feature branch:

```bash
git checkout <feature_branch>
```

If the branch doesn't exist, something went wrong during ADR approval. Stop and tell the user. `/wag:dev` never assumes it's already on the right branch — the checkout is explicit every session.

4. Check `adr/active/` for an approved ADR (status: approved). If none exists, tell the user to run `/wag:adr` first. The ADR filename follows `ADR-EEE.PPP.md` (canonical PBI ID).
5. Read the ADR — this is the spec. Everything flows from it.
6. Read `.wag/docs/Architecture.md` for project context.
7. Read `~/.claude/wag/learnings/` for standards relevant to this ADR's domain. Filter by the `Applies to` field.

## Phase 1: Pre-flight — halt on unresolved snags

Scan `.wag/snags/` for any file with `**Status:** open`. **If any exist, halt immediately.** Open snags halt all work — no exceptions.

- Do not present a menu of options.
- Do not ask the user for a "different disposition."
- Do not let the user "acknowledge and proceed" past the snag.
- Do not attempt to resolve the snag by guessing at its default fix.

Surface the halt to the user:

> "An open snag blocks all work:
> - SNAG-NNN — [title]. Target: [target field].
>
> Until this snag is resolved, no WAG work proceeds. Resolution is atomic: fix the defect in the doc, propagate the change to every affected backlog item, and close the snag — all in this session. Driving the snag-resolution protocol (`~/.claude/wag/workflows/snag-resolution.md`) now — confirm to proceed."

The snag-resolution protocol runs inline. Steps 1–3 (fix + doc propagation + PBI propagation) complete fully before this command resumes. Step 4 (promote): the assessment and LEARNING-NNN file creation — if the rule is portable — also happen in this session, mandatory. Only the embedding of that learning into commands/templates may be deferred per protocol rule #2. Once the snag moves to `.wag/snags/_resolved/`, the halted command resumes.

Open snags block ALL workflow commands, not only those that touch the snag's target. An open snag signals the WAG system has an unpatched defect.

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

### Inline snag capture

If any team role during implementation discovers a defect in the ADR, Architecture, or upstream docs — a design assumption doesn't hold, an acceptance criterion is unachievable, a decision contradicts reality — the finding escalates to Architect. Architect captures the snag using `~/.claude/wag/templates/snag.md` and halts the team. All work stops. Architect drives the snag-resolution protocol (`~/.claude/wag/workflows/snag-resolution.md`) with the user inline. Steps 1–3 (fix + doc propagation + PBI propagation) plus Step 4 assessment and LEARNING file creation (if the rule is portable) complete fully in this session before implementation resumes.

**Snags originate in docs, propagate to backlog.** A bug in the code itself isn't a snag — Dev just fixes it. A PBI with an unachievable acceptance criterion traces upstream to a doc defect and is a snag.

## Phase 4: Final gate (all tasks complete)

CQ runs the full gate. Everything must pass — no advisory findings allowed.

1. **CQ** runs: lint, build, test suite, coverage.
2. **Architect** validates implementation matches Architecture and ADR.
3. If anything fails → responsible teammate fixes → CQ re-runs.
4. Repeat until all clear.
5. **Architect** reports to user: implementation complete, all gates passed.

## Phase 5: PR

1. Create PR from `feature/PBI-EEE.PPP` to `dev`.
2. Move ADR from `adr/active/ADR-EEE.PPP.md` to `adr/completed/ADR-EEE.PPP.md`.
3. Close the PBI per the canonical procedure at `~/.claude/wag/references/close-pbi-and-epic.md`:
   - `git mv backlog/<active_epic>/PBI-PPP.md backlog/_completed/<active_epic>/PBI-PPP.md`. The mirror folder was pre-created when the epic was authored; remove the mirror's `.gitkeep` if this is the first PBI closed there.
4. **Check for epic drain.** If `<active_epic>` is not `epic-000-general` and the active folder now contains only `epic.md`:
   - Prompt: *"All PBIs in `<active_epic>` are complete. Mark the epic done?"*
   - **If yes:** update `epic.md` header (`**Status:** Completed <date>`, optional closure-note block summarising PBI outcomes); `git mv backlog/<active_epic>/epic.md backlog/_completed/<active_epic>/epic.md`; `rmdir backlog/<active_epic>/`; set `active_epic` in `state.json` back to `"epic-000-general"`.
   - **If no:** leave the epic active with only its `epic.md`; don't change `active_epic`. The user may add more PBIs later.
   - **Skip this check entirely for `epic-000-general`** — it's a permanent bucket and never drains.
5. **Update `state.json`:**
   - Clear `active_pbi` (set to `null`) — the PBI is complete.
   - Clear `feature_branch` (set to `null`) — the feature branch is merged.
   - Update `active_epic` only if the user confirmed epic completion in step 4 (set to `"epic-000-general"`).
6. User reviews and approves the PR.
7. Squash merge to `dev`.

```bash
gh pr create --base dev --head feature/PBI-EEE.PPP --title "PBI EEE.PPP: [title]" --body "$(cat <<'EOF'
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
git merge --squash feature/PBI-EEE.PPP
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
8. **Feature branches.** Work happens on `feature/PBI-EEE.PPP`, not directly on dev.
9. **Preserve epic membership when completing.** Completed PBIs go to `_completed/<active_epic>/PBI-PPP.md` (mirror pre-created at epic authoring). Epic drain is detected automatically except for `epic-000-general`, which never drains. Closure of a real epic is confirmed by the user — don't auto-close without the prompt.
