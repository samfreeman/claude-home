---
description: DEV mode - Implement ADR with gate check before commit
allowed-tools: Read, Write, Grep, Glob, TodoWrite, Bash, Task
---

# WAG DEV - Development Mode

Implement the active ADR. All changes stay uncommitted until gates pass.

## Context Header

Every response starts with:
```
🔧 **WAG: DEV ([App Name])**
📍 **Application:** [app-name]
📍 **Branch:** dev
🎯 **Context:** [what you're doing]
```

---

## Critical Rules

1. **Source code (src/**)** → Use Write tool (user sees diff)
2. **Infrastructure (.wag/*)** → Edit tool is fine
3. **All code** → Follow `~/.claude/documents/typescript-rules.md`
4. **All new code must have tests** → Every PBI/ADR includes test coverage requirement
5. **Only the user can switch modes** → Never auto-transition between DOCS/ADR/DEV
6. **No commits during dev** → All changes stay uncommitted until gate passes and user approves

---

## State Contract

**File:** `.wag/state.json`
**Format:** `{ "app_name": string, "current_mode": string|null, "active_pbi": string|null }`

Read on entry, update during workflow, clear on PBI completion.

---

## Directory Structure

```
.wag/
├── state.json
├── Status.md
├── docs/
│   ├── PRD.md
│   ├── Architecture.md
│   └── decisions.md
├── backlog/
│   ├── PBI-001.md
│   ├── PBI-002.md
│   └── _completed/
└── adr/
    ├── active/             # 0 or 1 ADR (current work)
    │   └── PBI-XXX-ADR.md
    └── completed/
```

---

## Core Principle: Gate Before Commit

```
dev branch
    │
    │  AI writes code, user reviews each diff
    │  nothing is committed
    │
    └──► gate ──► user ──► commit + push
         (lint+tests+build+architect)  approves
```

---

## On Entry

1. Switch to dev branch and pull:
   ```bash
   git checkout dev && git pull
   ```
2. Update state.json: `current_mode = "DEV"`
3. Verify ADR exists in `adr/active/PBI-XXX-ADR.md`
4. Read ADR content
5. Create implementation plan
6. Begin implementation

## Development Phase

- Each file change → Write tool → user approves diff
- Follow ADR requirements
- Write tests as specified in ADR
- **All changes stay uncommitted** — no local commits during dev

---

## Gate Check (Before Commit)

When dev work is complete, run the gate in this order:

**1. Lint**
- Run lint (may auto-fix files)
- If lint changed files, re-stage them
- If lint errors remain → dev fixes, restart gate

**2. Tests**
- Run unit tests
- If fails → dev fixes, restart gate

**3. Build**
- Run build to verify the app compiles (catches missing references, type errors, etc.)
- If fails → dev fixes, restart gate

**4. Architect Review** (only if lint/tests/build all pass)
- Spawn architect agent with full `git diff`
- Architect reviews against ADR requirements
- Returns: APPROVE or REJECT + feedback
- If rejects → dev fixes, restart gate

**5. Report to User**
- Show lint/test/build results
- Show architect feedback
- Wait for user approval

**6. Evaluate**
- If any step failed → dev fixes, restart gate
- If user disapproves → dev fixes, restart gate
- All pass → proceed to commit and push

---

## Spawning the Architect Agent (Gate Check)

Use Task tool with:
```
subagent_type: "architect"
prompt: |
  Review this complete changeset before push to dev.

  ## Changes
  ```diff
  [git diff output]
  ```

  ## ADR Requirements
  [ADR content]

  ## Code Style Rules (apply to project src/ code only)
  For files in src/** (project source code):
  - Single quotes, no semicolons, tabs, no trailing commas
  - == not ===, else/catch on new lines

  Do NOT apply these style rules to:
  - Third-party code, vendor files, or node_modules
  - Generated files (e.g., package-lock.json, pnpm-lock.yaml)
  - Framework boilerplate or config files

  ## Review
  1. Does the changeset fulfill ADR requirements?
  2. Are there design concerns or missing pieces?
  3. Code style violations in project source code?

  Return: APPROVE or REJECT
  Then: Summary of findings (what's good, what needs work)
```

---

## On Complete (all gates pass + user approves)

Do all file changes first, then one commit, then push:

1. Mark criteria `[x]` on both ADR and PBI
2. Move `adr/active/PBI-XXX-ADR.md` to `adr/completed/`
3. Move `backlog/PBI-XXX.md` to `backlog/_completed/`
4. Clear state.json (mode=null, active_pbi=null)
5. Update Status.md
6. Stage everything and commit (single commit — code + state changes together)
7. Push:
   ```bash
   git push origin dev
   ```

---

## Git Workflow

**Branches:**
- `main` - Production
- `dev` - Integration branch (gate-checked before commit+push)

**Commit format:**
```
[type]: [description]
```

**AI cannot:**
- Commit during dev phase (all changes stay uncommitted until gate passes)
- Push to dev without passing gate
- Push directly to main
- Force push
