---
description: Walk through audit gaps and apply learning fixes to non-compliant projects.
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG Apply — Walk Audit Gaps and Fix

You are running the WAG apply flow. This walks through every audit gap (learnings that projects don't comply with) and offers to fix each one with user approval.

## Before you start

1. Read `~/.claude/wag/projects.json` to get the list of managed projects and their paths.
2. Read all learning files from `~/.claude/wag/learnings/` (glob for `LEARNING-*.md`).
3. Check if `~/.claude/wag/apply-log.json` exists. If it does, read it — previously skipped items won't resurface.
4. If coming from a fresh audit with a gap list already built, use that. Otherwise, run the audit logic yourself: for each learning, run its Check against each project and build the gap list.

## Gap Walk

For each gap, present it to the user:

> **LEARNING-NNN: [title]**
> Not compliant: Project A, Project B.

Then for each non-compliant project:

### Step 1 — Show the violation

Show what the Check found. Be specific: file path, line, current value vs expected value.

### Step 2 — Show the fix

Show the Fix pattern from the learning. Explain what will change and where.

### Step 3 — Ask for approval

Ask: **"Apply this fix? (yes / skip with reason)"**

- **If yes:** `cd` to the project (using its path from `projects.json`), open the relevant file, apply the fix pattern. Also update the project's `Architecture.md` with the standard if not already present.
- **If skip:** Record in `~/.claude/wag/apply-log.json` with the reason so it doesn't resurface in future audits.

## Handling Snags

If the fix doesn't fit — reality differs from what the learning assumes — that's a snag against the learning itself.

Capture it: "LEARNING-NNN assumes X, but project Y does Z."

Offer the user three resolution options:

| Option | What happens |
|--------|-------------|
| **Refine** | Update the learning's Check and Fix pattern to handle this case |
| **Split** | Create NNN-a for one pattern, NNN-b for another |
| **Skip** | Record the skip with reason in `apply-log.json` |

The learning file itself gets updated — learnings are living documents. After refining or splitting, re-run the updated Check against the current project to confirm it works.

## apply-log.json Format

```json
{
  "project-name": {
    "LEARNING-001": {
      "status": "applied|skipped",
      "reason": "user-provided reason or empty for applied",
      "date": "YYYY-MM-DD"
    }
  }
}
```

## Key rules

- **User approves EVERY fix.** Never auto-apply. No exceptions.
- **No auto-advancing.** Wait for the user's response before moving to the next gap.
- **apply-log.json prevents resurfacing.** If a project+learning combo is already logged, skip it silently.
- **Snags refine learnings.** If a fix doesn't work, don't just skip — capture why and update the learning.
- **Projects are accessed by path.** Always use the path from `projects.json`, never guess.

## When you're done

Show a summary:

> **Apply complete.** Applied: N | Skipped: N | Refined: N

Tell the user if any learnings were updated and suggest running `/wag:audit` again to verify the refinements.
