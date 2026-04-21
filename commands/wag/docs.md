---
description: Update the PRD, Architecture, and backlog — author epics and PBIs, refine existing docs
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG DOCS — Docs & Backlog Authoring

Collaborative mode for maintaining the three planning surfaces: `PRD.md`, `Architecture.md`, and the backlog (epics + PBIs). Use this when the docs need a refresh or when new backlog items need to exist before `/wag:adr` can be run.

This is a conversational command — a working session with the user, not a one-shot transformation. Expect back-and-forth.

## Before you start

1. Read `wag/references/questioning.md` for conversational style guidance.
2. Confirm `.wag/` exists. If not, tell the user to run `/wag:init` first.
3. Read the current docs for context:
   - `.wag/docs/PRD.md`
   - `.wag/docs/Architecture.md`
   - `.wag/docs/RESEARCH.md` (if it exists)
4. Read `.wag/state.json` to see `active_epic` and `active_pbi` — even though docs mode doesn't modify these, they tell you where the user currently is.

## What this command covers

| Surface | What you do here |
|---------|------------------|
| `.wag/docs/PRD.md` | Refine product requirements, add/remove goals, update user stories, adjust scope |
| `.wag/docs/Architecture.md` | Update tech stack rows, add key decisions, revise rationale, close open questions |
| `.wag/docs/RESEARCH.md` | Add research findings that informed architecture changes (optional) |
| `.wag/backlog/` | Author epics (`epic-NNN-slug/epic.md`) and PBIs (`PBI-NNN-slug.md`, either inside an epic folder or at the backlog root) |

**Not covered by this command:**
- Picking a PBI to work on → `/wag:adr`
- Implementing a PBI → `/wag:dev`

Snags are not a separate command. If a defect in the docs is discovered mid-session, the inline snag capture flow (below) runs — halt, resolve, propagate, resume.

## Phase 1: Pre-flight

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

### Check for active ADR

If `.wag/adr/active/` contains an ADR, there's work in flight. Surface this:

> "PBI-XXX has an active ADR. If the docs change meaningfully, the ADR may need revisiting or a snag should be captured."

Don't block on it — the user may know the ADR is unaffected. Just make it visible.

### Determine focus

Ask what the user wants to work on in this session. Common entry points:
- "I need to add/change something in the PRD"
- "I need to revise an architecture decision"
- "I need to add epics/PBIs to the backlog"
- "I want to review what's there and refresh"

The rest of this workflow branches on that answer.

## Phase 2: Editing PRD or Architecture

For PRD or Architecture edits, follow the standard pattern:

1. **Discuss first, write second.** Understand the change, challenge assumptions, confirm scope before touching the file.
2. **Version the change.** Update the document's version number in the header (e.g., `Version: 1.3` → `Version: 1.4`).
3. **Record the change.** Append a line to the Provenance / Changelog section at the bottom of the document.
4. **Consistency check.** After a PRD change, scan Architecture for contradictions. After an Architecture change, scan the backlog — PBIs or epics may be affected. Surface anything that should become a snag.

If a change invalidates an active ADR or an approved PBI's acceptance criteria, **capture a snag** via `.wag/snags/SNAG-NNN.md` and flag it to the user.

### Inline snag capture

If during authoring you discover a defect in an upstream doc (PRD, Architecture, or a decision therein) — an assumption doesn't hold, a section contradicts reality, a decision was under-reasoned — capture a snag on the spot using `~/.claude/wag/templates/snag.md`. Halt, then drive the snag-resolution protocol (`~/.claude/wag/workflows/snag-resolution.md`) with the user. Resolution (Steps 1–3: fix + doc propagation + PBI propagation) completes fully in this session before authoring resumes.

**Snags originate in docs, propagate to backlog.** A snag is a defect in an upstream doc whose consequences have leaked into the backlog. If a PBI just needs editing and no doc is wrong, that's plain authoring work for this command — no snag needed.

## Phase 3: Authoring the backlog

The backlog has two kinds of items:

- **Epics** — `backlog/epic-NNN-slug/` folders containing an `epic.md` and zero or more PBI files. Epics group related PBIs that deliver a coherent capability.
- **Standalone PBIs** — `backlog/PBI-NNN-slug.md` files at the backlog root. Bug fixes, one-offs, and work that doesn't belong to any epic.

Not every PBI belongs to an epic. The backlog can mix both shapes freely.

### When to author an epic vs a standalone PBI

- **Epic** — the work spans multiple PBIs that share an architectural decision, a UI surface, a feature area, or a deployment boundary. Authoring order, cross-PBI dependencies, and "definition of done at the feature level" all matter.
- **Standalone PBI** — the work is self-contained. A bug fix. A small refactor. A dependency upgrade. An isolated chore. There's no other PBI that needs to coordinate with it.

When in doubt, propose standalone. An epic can always be created later and existing standalone PBIs moved into it.

### Finding the next number

Before creating a new epic or PBI, scan `.wag/backlog/` (including `_completed/` subfolders) to find the highest-numbered existing item. New numbers are sequential and do not reuse the numbers of completed items. Epic numbering and PBI numbering are independent sequences (epics go `epic-001`, `epic-002`; PBIs go `PBI-001`, `PBI-002`).

### Authoring an epic

1. Discuss the epic's scope with the user: name, goal, deliverables, dependencies on other epics, what it explicitly does *not* cover.
2. Create the folder: `.wag/backlog/epic-NNN-slug/` where `slug` is a short kebab-case descriptor.
3. **Pre-create the completed mirror:** `mkdir -p .wag/backlog/_completed/epic-NNN-slug/ && touch .wag/backlog/_completed/epic-NNN-slug/.gitkeep`. The mirror always exists so downstream PBI closures are simple moves. See `~/.claude/wag/references/close-pbi-and-epic.md`.
4. Write `epic.md` using this template:

```markdown
# Epic N: [Title]

**Priority:** P1 | P2 | P3
**Status:** Ready | Blocked — waiting on [X] | In progress | Done
**Depends on:** [other epics, PBIs, or "None"]

## Goal

[One to three sentences describing what this epic delivers and why it exists. Trace to PRD/Architecture where possible.]

## Deliverables

- [concrete shippable outputs — code, docs, infrastructure, whatever the epic produces]

## Design Input Required

[What design decisions, PRD updates, or architecture choices need to be in place before PBIs in this epic can be worked. "None" is a valid answer.]

## Non-goals

[What this epic explicitly does NOT cover, to prevent scope creep.]
```

5. Offer to decompose the epic into PBIs now. If the user wants to, follow the PBI authoring guidance below, creating each PBI inside the epic folder.

### Authoring a PBI

A PBI represents one unit of implementable work. Per existing PBI conventions, the file contains:

```markdown
# PBI-NNN: [Title]

**Priority:** P1 | P2 | P3
**Dependencies:** [other PBIs, or "None"]

## Description

[What and why. Reference the epic (if this PBI belongs to one), PRD sections, Architecture decisions, or previous PBIs as relevant.]

## Deliverables

[Concrete files/features to be produced. Specific enough that an ADR can be written from this.]

## Acceptance Criteria

- [ ] [Specific, testable outcomes]

## Testing Requirements

- [ ] [Specific test coverage the implementation must include]

## Technical Notes

[Optional — implementation hints, gotchas, reference patterns. Not a design — that's the ADR's job.]
```

**Where does the PBI file go?**
- If the PBI belongs to an epic: `.wag/backlog/epic-NNN-slug/PBI-NNN-slug.md`
- If the PBI is standalone: `.wag/backlog/PBI-NNN-slug.md`

### Moving PBIs between standalone and epic membership

If a standalone PBI becomes part of an emerging epic, physically move the file into the epic folder. Conversely, if a PBI is removed from its epic, move it to the backlog root. Always prefer a clean file location over notes-in-frontmatter.

## Phase 4: Exit

This mode doesn't have a strict "complete" state — it ends when the user says so. Before ending:

1. Confirm every new/changed file has been saved.
2. If PRD or Architecture were modified, confirm their version numbers and changelog entries were updated.
3. State.json is not modified by this command. `active_epic` and `active_pbi` are set by `/wag:adr` when actual work begins.
4. Remind the user of natural next steps:
   - "New PBIs exist — run `/wag:adr` to design the solution for one of them."
   - "If you want to discuss or revise further, re-run `/wag:docs` anytime."

## Key rules

1. **Discuss first, write second.** Every PRD/Architecture/backlog change comes after alignment, not before.
2. **Version docs that change.** PRD and Architecture have explicit version numbers and changelogs. Keep them current.
3. **Consistency over speed.** After a change, scan for downstream contradictions (PRD → Architecture → backlog). Raise snags rather than letting drift accumulate.
4. **Epics are optional.** Not every PBI needs to live in an epic. Bug fixes, one-offs, and small refactors can be standalone.
5. **Epic and PBI numbering are independent sequences.** Scan existing items (including `_completed/`) to find the next number in each sequence. Never reuse numbers.
6. **File location is the source of truth for epic membership.** A PBI in `epic-001-slug/` belongs to that epic. A PBI at the backlog root does not.
7. **This command does not modify state.json.** `active_epic` and `active_pbi` are managed by `/wag:adr` and `/wag:dev`.
8. **No code.** Docs mode updates planning surfaces only. Implementation is `/wag:dev`.
