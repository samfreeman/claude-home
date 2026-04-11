---
name: init
description: Initialize WAG infrastructure for a project. Creates .wag/ directory, docs templates, CLAUDE.md, and git setup. Use when starting a new WAG-managed project.
disable-model-invocation: true
allowed-tools: Read Write Edit Grep Glob Bash
---

# WAG Init — Project Initialization

Set up WAG infrastructure for a project. This does NOT scaffold or install anything — it creates the `.wag/` management layer and git configuration.

## Pre-check
!`if [ -d ".wag" ]; then echo "⚠️ .wag/ already exists. This project is already initialized."; else echo "✅ No .wag/ found. Ready to initialize."; fi`

If `.wag/` already exists, inform the user and stop.

---

## Phase 1: .wag/ Directory

Create the full directory structure:

```
.wag/
├── docs/
│   ├── PRD.md
│   ├── Architecture.md
│   └── decisions.md
├── backlog/
│   └── _completed/
└── adr/
    ├── active/
    └── completed/
```

### docs/PRD.md

```markdown
# [App Name] — Product Requirements Document

## Overview
[What the app does in 2-3 sentences.]

## Problem Statement
[Why this app exists. What pain does it solve.]

## Target Users
[Who uses this and how.]

## User Flow
[Step-by-step: what happens when the user interacts with the app.]

## UI Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Public landing page |

## Phased Development
[Phases with goals, deliverables, and success metrics. Each phase is independently demo-able.]

## Non-Goals
[What we're explicitly NOT building (yet).]

## Security Considerations
[Relevant security concerns for this app.]

## Success Metrics
[How we know it's working.]
```

### docs/Architecture.md

```markdown
# [App Name] — Architecture

## Overview
[One paragraph: what the app does and its core architectural pattern.]

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| | | |

## System Architecture
[Diagram or description of how components interact.]

## Architecture Patterns
[Key patterns used in this project.]

## Project Structure
[Directory layout.]

## Database Schema
[Tables, if applicable.]

## Environment Variables

| Variable | Description |
|----------|-------------|

## References
- [PRD](./PRD.md)
- [Decision Log](./decisions.md)
```

### docs/decisions.md

```markdown
# Decision Log

Record significant architectural choices here.

Format:
### Decision: [Short title]
**Date:** YYYY-MM-DD
**Context:** Why we faced this decision.
**Decision:** What we chose.
**Consequences:** What follows from this choice.
```

---

## Phase 2: CLAUDE.md

Create `CLAUDE.md` at project root. Ask the user for a one-line project description.

```markdown
# CLAUDE.md

## Project
**[app-name]** — [one-line description]

## Mandatory Rules

### 1. All File Changes Require Diff Review
All file modifications must use the Write tool so the user can review diffs.

### 2. Code Style
Follow `~/.claude/documents/typescript-rules.md` for all .ts, .tsx, .js, .jsx files.

### 3. Git Commit Authorship
All commits must include:

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: [user name] <[user email]>
```

---

## Phase 3: README.md

```markdown
# [App Name]

[One-line description]

## Getting Started

[To be filled in after project setup.]
```

---

## Phase 4: .claude/settings.local.json

Auto-approve permissions for WAG workflows:

```json
{
    "permissions": {
        "allow": [
            "Bash(pnpm test:*)",
            "Bash(pnpm lint:*)",
            "Bash(pnpm build:*)",
            "Bash(pnpm dev:*)",
            "Bash(git add:*)",
            "Bash(git push:*)",
            "Bash(git checkout:*)",
            "Bash(git pull:*)",
            "Bash(git status:*)",
            "Bash(git log:*)",
            "Bash(git diff:*)",
            "Bash(ls:*)",
            "Bash(tree:*)"
        ],
        "deny": [
            "Bash(git push --force*)",
            "Bash(git push -f*)",
            "Bash(git push*origin main*)",
            "Bash(git push*origin master*)",
            "Bash(git reset --hard*)"
        ]
    }
}
```

---

## Phase 5: Git Init

### Step 1: Initialize repo

```bash
git init
```

### Step 2: Per-repo identity

Check for existing git identity:

```bash
git config user.name
git config user.email
```

If both are set, show them and ask the user to confirm. If not set or user declines, ask for name and email. Set per-repo config (no `--global`).

These values also fill the CLAUDE.md co-author tags.

### Step 3: SSH key selection

List SSH keys:

```bash
ls ~/.ssh/*.pub
```

Show available keys, ask which to use. Configure per-repo:

```bash
git config core.sshCommand "ssh -i ~/.ssh/[chosen key]"
```

### Step 4: Remote URL

Ask for remote URL. If not ready, skip — they can add it later.

### Step 5: Verify auth

If remote was added, verify SSH key works:

```bash
git ls-remote origin
```

If this fails, stop and help diagnose. Do not continue until auth works.

### Step 6: Branches, commit, push

```bash
git checkout -b main
git add .
git commit -m "init: WAG infrastructure"
git checkout -b qa
git checkout -b dev
```

If remote was added and auth verified:

```bash
git push origin main
git push origin qa
git push origin dev
```

---

## Phase 6: Wrap Up

Inform user: "Project initialized. Run `/docs` to define product requirements, then `/adr` to start your first PBI."
