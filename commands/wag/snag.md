---
description: Capture a plan defect (snag) — resolve it, optionally promote to a cross-project learning.
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG Snag — Plan Defect Capture & Resolution

You are running the WAG snag flow. This takes a user from "something is wrong in a plan" through defect capture, resolution, and optional promotion to a cross-project learning.

## Before you start

1. Confirm `.wag/` exists in the working directory. If it does not, stop and tell the user to run `/wag:init` first.
2. Check if `.wag/snags/` exists. If not, create it (and `.wag/snags/_resolved/`) before proceeding.

## Phases

Run these in order. **The user must approve each phase before you advance.**

| Phase | What | Output |
|-------|------|--------|
| A | Capture | `.wag/snags/SNAG-NNN.md` |
| B | Resolve | Updated impacted doc, closed snag |
| C | Promote (optional) | `~/.claude/wag/learnings/LEARNING-NNN.md` |

---

## Phase A — Capture the snag

1. Ask the user: **What went wrong?** Gather enough detail to fill every field in the snag template.
2. Determine the next sequential number by scanning `.wag/snags/` for existing `SNAG-*.md` files. If none exist, start at `001`.
3. Collect the following fields from the user (ask follow-up questions until each is clear):
   - **Short title** — one-line summary
   - **Source** — who or what found the defect (e.g. "dev during implementation", "user testing", "code review")
   - **Target** — which document and section is affected (e.g. "Architecture.md > Data Model")
   - **PBI** — related PBI number, if any (can be "none")
   - **Assumed** — what the upstream document said would be true
   - **Reality** — what was actually encountered
   - **Impact** — which section of which document is wrong, and how
4. Create `.wag/snags/SNAG-NNN.md` using the snag template below, filled with the gathered content.
5. Tell the user the snag has been filed and show the path.

### Snag template

```markdown
# SNAG-NNN: [short title]

**Status:** open
**Source:** [who found it]
**Target:** [which doc section]
**PBI:** [related PBI if any]

## Assumed
[What the upstream document said would be true]

## Reality
[What was actually encountered]

## Impact
[Which section of which document is wrong, and how]

## Resolution
[Filled when resolved]
```

---

## Phase B — Resolve the snag

1. Open the impacted document identified in the snag's **Target** field. Read the relevant section.
2. Show the user the problematic section and the snag's **Reality** field side by side.
3. Help the user fix the specific assumption in the document. Write the corrected content using the Write tool so the user can review the diff.
4. Once the user approves the fix:
   - Update the snag file: set `**Status:** resolved`, fill the **Resolution** section with a summary of what was changed and where.
   - Move the snag file from `.wag/snags/SNAG-NNN.md` to `.wag/snags/_resolved/SNAG-NNN.md`.
5. Confirm to the user that the snag is closed.

---

## Phase C — Promote to learning (optional)

1. Ask the user: **Should this snag become a cross-project learning?** Explain that learnings are merged into future project inits so the same mistake is caught earlier next time.
2. If the user says no, you are done. Skip to "When you're done".
3. If the user says yes:
   - Check `~/.claude/wag/learnings/` for existing `LEARNING-*.md` files to determine the next sequential number. If the directory does not exist, create it. If no files exist, start at `001`.
   - Collect or derive the following from the snag and the fix:
     - **Short title**
     - **Applies to** — `nextjs`, `cli`, `all`, or another category
     - **Standard** — prose description of the rule that was violated
     - **Check** — mechanical detection (grep patterns, file structure checks, etc.)
     - **Violations look like** — concrete examples of the wrong state
     - **Fix pattern** — concrete steps to fix
     - **Template patch** — the section to merge into Architecture docs for new projects
   - Create `~/.claude/wag/learnings/LEARNING-NNN.md` using the learning template below.
4. Tell the user: this learning will be merged into future inits automatically. **Do NOT edit base templates directly.**

### Learning template

```markdown
# LEARNING-NNN: [short title]

**Source snag:** SNAG-NNN from [project name]
**Applies to:** [nextjs | cli | all]

## Standard
[Prose description of the rule]

## Check
[Mechanical detection — grep patterns, file structure checks]

## Violations look like
[Concrete examples]

## Fix pattern
[How to fix — concrete steps]

## Template patch
[Section to merge into Architecture doc for new projects]
```

---

## Key rules

- **User approves every step.** Never auto-advance between phases or auto-apply fixes.
- **Sequential numbering.** Scan existing files to determine the next number. Never reuse or skip numbers.
- **Create directories if missing.** `.wag/snags/`, `.wag/snags/_resolved/`, and `~/.claude/wag/learnings/` should be created on demand.
- **Do NOT edit base templates.** Learnings are stored separately and merged during future inits. Never modify the WAG template files directly.
- **Documents are fixed, not replaced.** When resolving a snag, correct the specific assumption — do not rewrite entire documents.

## When you're done

Tell the user:
- What was captured and where (snag file path)
- What was fixed and where (if resolved)
- Whether a learning was created (if promoted)
- Suggest next steps: review the fixed document, or continue with the current PBI
