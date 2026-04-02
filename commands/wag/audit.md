---
description: Scan all projects against promoted learnings — build the compliance matrix.
allowed-tools: Read, Bash, Glob, Grep
---

# WAG Audit — Compliance Matrix

You are running the WAG audit flow. This scans all registered projects against promoted learnings and builds a compliance matrix showing gaps.

## Before you start

1. Confirm you are in read-only mode. **Audit never modifies any files.**
2. Read `~/.claude/wag/projects.json` to get the project list. If the file is missing or empty, tell the user: "No projects registered. Run `/wag:init` to initialise a project (which registers it), or add entries to `~/.claude/wag/projects.json` manually." Then stop.
3. Read all learning files matching `~/.claude/wag/learnings/LEARNING-*.md`. If none exist, tell the user: "No promoted learnings found. There's nothing to audit yet." Then stop.
4. Read `~/.claude/wag/apply-log.json` to know what has already been applied or skipped per project.

## Data formats

### projects.json

Array of objects:

```json
[
  { "name": "wagui", "path": "/home/user/source/wagui", "type": "nextjs" },
  { "name": "my-cli", "path": "/home/user/source/my-cli", "type": "cli" }
]
```

### apply-log.json

Object keyed by project name, then learning ID:

```json
{
  "wagui": {
    "LEARNING-001": { "status": "applied", "reason": "Auto-applied via /wag:apply" },
    "LEARNING-002": { "status": "skipped", "reason": "Not relevant to this project" }
  }
}
```

### Learning files

Each `LEARNING-*.md` has frontmatter including an `Applies to` field (e.g. `nextjs`, `all`, `cli`) and a `Check` section describing how to verify compliance (grep patterns, file structure checks, etc.).

## Flow

Run these steps in order.

### Step 1 — Load data

- Parse `projects.json` into the project list.
- Parse all `LEARNING-*.md` files — extract ID, title, `Applies to` field, and `Check` section from each.
- Parse `apply-log.json` (treat as empty object `{}` if missing).

### Step 2 — Check compliance

For each learning, for each project:

1. **Applicability.** Compare the learning's `Applies to` field against the project's `type`. If it doesn't apply, mark as `n/a`.
2. **Apply-log override.** If `apply-log.json` shows `applied` for this project + learning, mark as `✓`. If `skipped`, note it as skipped.
3. **Run checks.** For applicable learnings not covered by the apply-log, execute the `Check` section against the project's path. Use Grep, Glob, and Bash (read-only commands only — no writes, no installs, no mutations). Mark `✓` if checks pass, `✗` if they fail.

### Step 3 — Display the compliance matrix

Print a table like this:

```
                        wagui    my-cli    project-c
LEARNING-001 (title)      ✓        ✓          ✗
LEARNING-002 (title)      ✗        ✓          ✗
LEARNING-003 (title)      ✓        n/a        ✓
```

Align columns for readability. Use:
- `✓` = compliant (check passed or apply-log says applied)
- `✗` = gap (check failed)
- `n/a` = learning doesn't apply to this project type
- `skipped` = user previously skipped this learning for this project

### Step 4 — Report totals

Below the matrix, report:
- Total gaps (count of `✗` cells)
- Total skipped
- Total compliant
- Total n/a

### Step 5 — Suggest next steps

If there are gaps, ask: "Want to apply fixes? Run `/wag:apply` to address the gaps."

If everything is compliant, say: "All projects are compliant with all applicable learnings."

## Key rules

- **Read-only.** Audit never modifies files. No writes, no installs, no git operations, no file creation.
- **Fail gracefully.** If a project path doesn't exist, mark all its checks as `?` (unknown) and note the issue.
- **Be fast.** Run checks in parallel where possible (e.g. multiple Grep calls across projects).
- **Show your work.** If a check fails, briefly note why beneath the matrix (e.g. "LEARNING-002 gap in wagui: missing `use client` directive in `components/Foo.tsx`").
