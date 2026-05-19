---
description: Create an Architecture Decision Record for a PBI — design the solution with snag awareness, template conformance, and learning compliance
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG ADR — Architecture Decision Record

Design the solution for a PBI. This is a conversation — a grill session with the user, not a one-shot generation. The ADR must be thorough enough that a developer can implement without asking design questions.

## Before you start

1. Read `wag/references/questioning.md` for conversational style guidance.
2. Confirm `.wag/` exists. If not, tell the user to run `/wag:init` first.
3. Read the current templates the ADR will need to understand:
   - `wag/templates/architecture.md` — shape of `Architecture.md`
   - `wag/templates/prd.md` — shape of `PRD.md`
   - `wag/templates/backlog-epic.md` — shape of `epic.md`
   - `wag/templates/backlog-pbi.md` — shape of each PBI file
4. Read `.wag/docs/Architecture.md` and `.wag/docs/PRD.md` for project context.

## Phase 1: Pre-flight — halt on unresolved snags and template drift

### Halt on open snags

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

### Halt on template drift

Compare the project's docs against the current templates:

- `.wag/docs/PRD.md` vs `wag/templates/prd.md`
- `.wag/docs/Architecture.md` vs `wag/templates/architecture.md`
- Each `epic.md` in `.wag/backlog/` vs `wag/templates/backlog-epic.md`
- Each PBI file in `.wag/backlog/` vs `wag/templates/backlog-pbi.md`

If any doc is missing a required section or diverges from the template shape, **halt**. Surface the drift:

> "Template drift detected:
> - [file]: [what's missing or different]
>
> How do you want to proceed? I can capture a snag and drive the resolution protocol (likely a migration to the current template), or you can direct."

Proceed only on explicit user direction.

If the project's backlog still uses the legacy scheme (global PBI numbering, standalone PBIs at the backlog root, descriptive slugs in filenames), template drift will flag it. Resolution is `/wag:migrate-backlog` — run that first, then return to `/wag:adr`.

### Check for active ADR

If `adr/active/` already contains an ADR, previous work is in progress. Present it and ask whether the user is resuming or starting fresh.

### Determine working context

Read `.wag/state.json`. `active_epic` is always set — it defaults to `"epic-000-general"` and points to whichever epic the user is working within.

**Backlog shape:**
- Every epic folder (`epic-NNN-word/`) contains an `epic.md` and zero or more `PBI-PPP.md` files.
- `epic-000-general/` is the bucket for ungrouped PBIs and always exists.

### Pick a PBI

1. List `PBI-PPP.md` files inside `.wag/backlog/<active_epic>/` (excluding `epic.md`). Show each PBI's full canonical ID (`PBI <epic>.<pbi>`), title, priority, and status.
2. Show a one-line reminder of the active epic (title + goal from `epic.md`).
3. Default path: pick a PBI from the active epic.
4. Alternatives offered only if the user asks:
   - Switch to a different epic — update `active_epic` in `state.json`.
   - The active epic is empty: either pick from another epic, or propose authoring new PBIs (run `/wag:docs` for the dedicated authoring command).

**Empty backlog (rare — only possible right after init with no Phase C content):**
Propose authoring an epic and PBIs. Run `/wag:docs` if the user prefers the dedicated command.

### Read the selected PBI

Read the PBI file for requirements and acceptance criteria. Note the canonical ID (`PBI EEE.PPP`) — you'll use it throughout the rest of this session for filenames, branch names, and headers.

Proceed to Phase 2.

## Phase 2: Design

### Load context

Read only what's needed:

1. The selected PBI: `.wag/backlog/<active_epic>/PBI-PPP.md`.
2. `.wag/docs/Architecture.md`.
3. `.wag/docs/PRD.md`.
4. `.wag/backlog/<active_epic>/epic.md`.
5. `~/.claude/wag/learnings/` — filter by the `Applies to` field; surface learnings that match this PBI's domain.

Do not pre-load the full backlog or every learning. Phase 1 has already verified template conformance; trust it.

### Grill session

Design the solution with the user. Iterative:

- Propose approaches, discuss trade-offs
- Challenge assumptions — yours and theirs
- Reference Architecture.md and applicable learnings
- Push for specificity — vague designs produce vague implementations
- Resolve one decision at a time — surface the list of open decisions once, then work through them

### Inline snag capture

If during design you discover the Architecture or PRD is wrong — an assumption doesn't hold, a section contradicts reality, a decision was under-reasoned — capture a snag on the spot using `~/.claude/wag/templates/snag.md`. Halt, then drive the snag-resolution protocol (`~/.claude/wag/workflows/snag-resolution.md`) with the user. Resolution (Steps 1–3: fix + doc propagation + PBI propagation) completes fully in this session before ADR design resumes.

**Snags originate in docs, propagate to backlog.** A snag is a defect in an upstream doc whose consequences have leaked into the backlog. A PBI that just needs sharper acceptance criteria isn't a snag — that's `/wag:docs` authoring work.

### Closing a PBI without writing an ADR

Sometimes the grill dissolves the PBI's scope entirely — deliverables already done, unachievable on the chosen tier, or out of scope given other decisions. Close the PBI per the canonical procedure at `~/.claude/wag/references/close-pbi-and-epic.md`. Commit the closure inline — no deferred ADR commit is coming.

After closure, return to Phase 1 to pick the next PBI, or end the command.

## Phase 3: Write the ADR

Write the ADR to `.wag/adr/active/ADR-EEE.PPP.md` where `EEE.PPP` is the canonical PBI ID. It must include:

```markdown
# ADR EEE.PPP: [title]

**PBI:** [link to .wag/backlog/<active_epic>/PBI-PPP.md] — PBI EEE.PPP
**Epic:** [link to .wag/backlog/<active_epic>/epic.md] — Epic EEE
**Status:** draft | approved
**Feature branch:** feature/PBI-EEE.PPP

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
**Rationale:** [why]

## What NOT to do
[Explicitly list anti-patterns and wrong approaches for this PBI]
```

## Phase 4: Approve and branch

1. Present the ADR to the user for review.
2. Iterate on changes until approved.
3. On approval, set status to `approved`.
4. Create the feature branch, write its name to `state.json`, and commit the ADR together with state:

```bash
git checkout -b feature/PBI-EEE.PPP dev
```

Then update `.wag/state.json`:
- Set `active_pbi` to the local PBI number (e.g., `"003"`).
- Set `feature_branch` to the exact branch name just created (e.g., `"feature/PBI-001.003"`). `state.json` is an ADR artifact — `/wag:dev` reads `feature_branch` verbatim to check out the right branch, so don't rely on naming conventions.

```bash
git add .wag/adr/active/ADR-EEE.PPP.md .wag/state.json
git commit -m "ADR: PBI EEE.PPP — [title]"
git push -u origin feature/PBI-EEE.PPP
```

5. Tell the user: "ADR approved on `feature/PBI-EEE.PPP`. Run `/wag:dev` when ready to implement."

## Key rules

1. **Halt on open snags.** No menu, no acknowledgment path. User directs the resolution. Protocol lives in `wag/workflows/snag-resolution.md`.
2. **Halt on template drift.** Project docs must conform to the current templates. Drift is a defect; surface it, let the user direct. Legacy-scheme backlogs are resolved via `/wag:migrate-backlog`.
3. **Templates are authoritative.** ADR follows the current templates for every doc it reads or modifies. Deviation requires a snag.
4. **User approves every phase.** Don't auto-advance.
5. **ADR quality is non-negotiable.** If it's not specific enough for a developer to implement without questions, it's not done.
6. **Learnings are standards.** The design must comply with applicable learnings or explicitly justify why not.
7. **Feature branches.** Work happens on `feature/PBI-EEE.PPP`, not directly on dev.
8. **No implementation.** `/wag:adr` designs; `/wag:dev` implements.
9. **Respect the active epic.** Default to PBIs within it. Switching is an explicit user action.
10. **One decision at a time.** In grill phases, surface the list once and resolve each decision before moving on.
11. **Canonical PBI ID everywhere.** Use `PBI EEE.PPP` in display, prose, ADR titles, commit messages, snag references. The dot-separated filename-safe form (`EEE.PPP`) appears in filenames and branch names; the colon form is not used.
