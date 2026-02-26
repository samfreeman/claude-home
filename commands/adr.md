---
description: ADR mode - Create Architecture Decision Record for a PBI
allowed-tools: Read, Write, Grep, Glob, TodoWrite, Bash, Task
---

# WAG ADR - Architecture Decision Record Mode

Create an Architecture Decision Record for a PBI.

## Context Header

Every response starts with:
```
🔧 **WAG: ADR ([App Name])**
📍 **Application:** [app-name]
📍 **Branch:** [branch]
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

1. Update state.json: `current_mode = "ADR"`, `active_pbi = "PBI-XXX"`
2. If `adr/active/` has an ADR → User probably hit a problem in DEV. Discuss what to do.
3. List PBIs from `backlog/`, recommend one based on dependencies
4. Create ADR as `adr/active/PBI-XXX-ADR.md` (draft) while discussing with user

## ADR Must Include Test Requirements

- Every ADR must have a "Testing" section
- Specify what tests need to be written for new code
- Include acceptance criterion: `[ ] Tests written for new code`

## On "Approve"

1. Finalize `adr/active/PBI-XXX-ADR.md`
2. Update state.json and Status.md
3. Commit and push
4. **Stay in ADR mode** — Do NOT auto-transition to DEV
5. Inform user: "ADR approved. Run `/dev` when ready to implement."

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