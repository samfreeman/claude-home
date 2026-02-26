---
description: DOCS mode - Update PRD, Architecture, and backlog PBIs
allowed-tools: Read, Write, Grep, Glob, TodoWrite, Bash, Task
---

# WAG DOCS - Documentation Mode

Update PRD, Architecture, and backlog PBIs.

## Context Header

Every response starts with:
```
🔧 **WAG: DOCS ([App Name])**
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

## On Entry

1. Update state.json: `current_mode = "DOCS"`
2. If `adr/active/` has an ADR → User probably hit a problem in DEV. Discuss what went wrong.
3. Switch to dev branch and pull:
   ```bash
   git checkout dev && git pull
   ```

## Collaborative Workflow

- **As PM:** Define product vision, requirements, user stories
- **As Architect:** Make technical decisions, define patterns
- Discuss first, document in PRD/Architecture, get approval, THEN add to backlog

## On Exit

- If any docs were modified → commit and push
- Stay in DOCS mode until user runs another command

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
