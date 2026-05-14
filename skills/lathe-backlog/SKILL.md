---
name: lathe-backlog
description: Lathe Backlog phase — slice PRD into vertical epics and PBIs. Product language only, no architecture awareness. Use when breaking down product requirements into deliverable work.
disable-model-invocation: true
allowed-tools: Read Write Edit Grep Glob Bash
---

# Lathe Backlog — Vertical Slicing

**Beats 1-3 of the four-beat pattern applied to the backlog.**

1. **Desire** — what capabilities does the PRD promise?
2. **Context** — what's already in the backlog? What's completed?
3. **Approach** — slice into epics and PBIs.

Beat 4 (convergence) is handled by the orchestrator via the grill master.

---

## Current State

### PRD
!`head -80 .lathe/docs/PRD.md 2>/dev/null || echo "No PRD — run /lathe:init first"`

### Existing Backlog
!`ls .lathe/backlog/*.md 2>/dev/null | grep -v _completed || echo "Empty backlog"`

### Completed
!`ls .lathe/backlog/_completed/*.md 2>/dev/null || echo "Nothing completed"`

---

## Precondition

PRD must exist at `.lathe/docs/PRD.md`. If it doesn't, stop and tell the user to run `/lathe:init`.

---

## Beat 1: Desire

Read the PRD. Identify every user-visible capability it promises. These become epics.

An epic is a capability the user can see and use. "Users can create an account and log in" is an epic. "Set up the database" is not — that's a layer, not a capability.

---

## Beat 2: Context

Read the existing backlog. What's already sliced? What's been completed? Don't duplicate work. If the PRD changed since the last backlog run (orchestrator sets `upstream_dirty`), identify what changed and adjust.

---

## Beat 3: Approach

Slice the PRD into epics and PBIs. Write them to `.lathe/backlog/`.

### Epics

One file per epic: `.lathe/backlog/epic-NNN.md`

```markdown
# Epic NNN — [Capability Name]

## User Value
[What the user gets when this epic is done. One sentence.]

## PBIs
- PBI-NNN: [title]
- PBI-NNN: [title]

## Dependencies
[Which epics must come first, if any.]

## Demo
[How you'd demo this to a user. What they'd see.]
```

### PBIs

One file per PBI: `.lathe/backlog/PBI-NNN.md`

```markdown
# PBI-NNN — [Title]

## Epic
[Parent epic]

## User Story
As a [user], I want [capability], so that [value].

## Acceptance Criteria
- [ ] [What must be true when this is done]
- [ ] [Observable, testable, user-visible]

## Dependencies
[Which PBIs must come first, if any.]

## Size
[S/M/L — relative to other PBIs in this epic]
```

### Slicing Rules

1. **Vertical, not horizontal.** Every PBI delivers something a user can see or interact with. No "set up database" PBIs.
2. **Product language only.** No tech choices, no framework names, no implementation details. Architecture hasn't happened yet.
3. **Independently demo-able.** Each PBI, when completed, can be shown to someone. "Look, now users can do X."
4. **Small enough to ADR.** If you can't imagine writing an ADR for it, it's too big. Split it.
5. **Acceptance criteria are user-observable.** Not "database table exists" but "user sees their profile data."

---

## Completion Signal

Backlog is complete when:
1. Every capability in the PRD is covered by at least one epic.
2. Every epic has at least one PBI.
3. PBIs are ordered by dependency.
4. The user confirms the slicing captures what they want.

Tell the orchestrator: "Backlog complete. Ready for grill master."

---

## Critical Rules

1. **No architecture.** Zero tech decisions. The PBI says "user can upload a photo" not "store in S3 with presigned URLs."
2. **No new requirements.** If something isn't in the PRD, don't add it to the backlog. Push it back to Init.
3. **Numbering is global.** PBI-001 through PBI-NNN across all epics. No per-epic numbering.
4. **Epics map to PRD phases.** If the PRD has phased development, epics should roughly correspond.
