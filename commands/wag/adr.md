---
description: Create an Architecture Decision Record for a PBI — design the solution with snag awareness and learning compliance
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG ADR — Architecture Decision Record

Design the solution for a PBI. This is a conversation — a grill session with the user, not a one-shot generation. The ADR must be thorough enough that a developer can implement without asking design questions.

## Before you start

1. Read `wag/references/questioning.md` for conversational style guidance.
2. Confirm `.wag/` exists. If not, tell the user to run `/wag:init` first.
3. Read `.wag/docs/Architecture.md` and `.wag/docs/PRD.md` for project context.

## Phase 1: Pre-flight checks

### Check for open snags

Read `.wag/snags/` for any open snag files (status: open). If any exist, present them:

> "There are open snags that may affect this work:"
> - SNAG-001: [title] — targets [doc section]
> - SNAG-002: [title] — targets [doc section]

Upstream truth must be correct before starting new work. The user resolves or explicitly acknowledges each snag before continuing.

### Check for active ADR

If `adr/active/` already contains an ADR, previous work is in progress. Present it to the user and discuss — are they resuming, or starting fresh?

### Pick a PBI

List PBIs from `.wag/backlog/`. The user picks one, or specifies one directly. Read the PBI file for requirements and acceptance criteria.

## Phase 2: Design

### Load context

1. Read the selected PBI.
2. Read `.wag/docs/Architecture.md` — the current architecture.
3. Read `.wag/docs/PRD.md` — the product requirements.
4. Read `~/.claude/wag/learnings/` for standards relevant to this PBI's domain. Filter by the `Applies to` field. Surface relevant learnings to the user:

> "These learnings apply to this work:"
> - LEARNING-001: [title] — [standard summary]
> - LEARNING-003: [title] — [standard summary]

The ADR should reference and comply with these learnings.

### Grill session

Design the solution with the user. This is iterative:

- Propose approaches, discuss trade-offs
- Challenge assumptions — yours and theirs
- Reference the Architecture doc and learnings
- If multiple approaches exist, lay them out with pros/cons
- Push for specificity — vague designs produce vague implementations

### Inline snag capture

If during design you discover the Architecture or PRD is wrong — an assumption doesn't hold, a section contradicts reality — capture a snag on the spot:

1. Create `.wag/snags/SNAG-NNN.md` (same format as `/wag:snag`)
2. Guide the user through resolving it — fix the impacted doc section
3. Ask about promotion to a learning
4. Continue designing with the corrected context

Don't make the user leave the command. Handle it inline.

## Phase 3: Write the ADR

Write the ADR to `.wag/adr/active/PBI-XXX-ADR.md`. It must include:

```markdown
# PBI-XXX ADR: [title]

**PBI:** [link to PBI file]
**Status:** draft | approved
**Feature branch:** feature/PBI-XXX

## Issue Summary
- **Type:** feature | bug | refactor | chore
- **Priority:** high | medium | low
- **Effort:** S | M | L | XL
- **Description:** [what and why]
- **Acceptance criteria:** [from the PBI]

## Technical Context
- **Affected modules:** [which parts of the codebase]
- **Current implementation:** [how it works now, if applicable]
- **Problem statement:** [what's wrong or missing]

## Architecture Decisions

### Decision 1: [title]
**Choice:** [what we chose]
**Alternatives considered:** [what else we looked at]
**Rationale:** [why this choice]
**Code example:**
```typescript
// concrete example of the pattern
```

### Decision 2: [title]
...

## Applicable Learnings
[List learnings from ~/.claude/wag/learnings/ that apply, and how the design complies]

## Implementation Plan
[Specific files to create/modify, in order, with what changes]

| # | File | Action | What |
|---|------|--------|------|
| 1 | src/... | create | ... |
| 2 | src/... | modify | ... |

## Interfaces
[TypeScript interfaces, function signatures, type definitions]

## Testing Strategy
- **Unit tests:** [specific scenarios]
- **Integration tests:** [specific flows]
- **Edge cases:** [what could go wrong]

## Team Shape
**Devs:** 1 | 2
**Rationale:** [why — e.g. "two independent modules with no shared files" or "sequential dependencies, one Dev"]

## What NOT to do
[Explicitly list anti-patterns and wrong approaches for this PBI]
```

## Phase 4: Approve and branch

1. Present the ADR to the user for review.
2. User approves (or requests changes — iterate).
3. On approval, set status to `approved`.
4. Create feature branch and commit:

```bash
git checkout -b feature/PBI-XXX dev
git add .wag/adr/active/PBI-XXX-ADR.md
git commit -m "ADR: PBI-XXX — [title]"
git push -u origin feature/PBI-XXX
```

5. Tell the user: "ADR approved on `feature/PBI-XXX`. Run `/wag:dev` when ready to implement."

## Key rules

1. **User approves every phase.** Don't auto-advance.
2. **ADR quality is non-negotiable.** If it's not specific enough for a developer to implement without questions, it's not done.
3. **Snags before new work.** Open snags must be addressed before designing.
4. **Learnings are standards.** The design must comply with existing learnings or explicitly justify why not.
5. **Feature branches.** Work happens on `feature/PBI-XXX`, not directly on dev.
6. **No implementation.** ADR mode designs. `/wag:dev` implements.
