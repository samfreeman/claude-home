---
description: Product development workflow - DOCS → ADR → DEV (with gate check)
allowed-tools: Read, Write, Grep, Glob, TodoWrite, Bash, Task
---

# WAG - Product Development Workflow

**Journey:** `/wag docs` → `/wag adr` → `/wag dev`

## Critical Rules

1. **Source code (src/**)** → Use Write tool (user sees diff)
2. **Infrastructure (.wag/*)** → Edit tool is fine
3. **All code** → Follow `/home/samf/source/claude/documents/typescript-rules.md`
4. **All new code must have tests** → Every PBI/ADR includes test coverage requirement

## Directory Structure

```
.wag/
├── state.json              # { app_name, current_mode, active_pbi }
├── Status.md
├── docs/
│   ├── PRD.md
│   ├── Architecture.md
│   └── decisions.md        # Decision log
├── backlog/                # PBIs as individual files
│   ├── PBI-001.md
│   ├── PBI-002.md
│   └── _completed/         # Done PBIs (moved here after merge)
└── adr/
    ├── active/             # 0 or 1 ADR (current work)
    └── completed/          # Done ADRs
```

---

## `/wag docs` - DOCS Mode

Update PRD, Architecture, and backlog PBIs.

**On entry:**
- Update state.json: `current_mode = "DOCS"`
- If `adr/active/` has an ADR → User probably hit a problem in DEV. Discuss what went wrong.
- Switch to dev branch, pull

**Collaborative workflow:**
- **As PM:** Define product vision, requirements, user stories
- **As Architect:** Make technical decisions, define patterns
- Discuss first, document in PRD/Architecture, get approval, THEN add to backlog

**On exit:**
- If any docs were modified → commit and push

---

## `/wag adr` - ADR Mode

Create Architecture Decision Record for a PBI.

**On entry:**
- Update state.json: `current_mode = "ADR"`, `active_pbi = "PBI-XXX"`
- If `adr/active/` has an ADR → User probably hit a problem in DEV. Discuss what to do.
- List PBIs from `backlog/`, recommend one based on dependencies
- Create ADR (draft) while discussing with user

**ADR must include test requirements:**
- Every ADR must have a "Testing" section
- Specify what tests need to be written for new code
- Include acceptance criterion: `[ ] Tests written for new code`

**On "approve":**
1. Move ADR to `adr/active/`
2. Update state.json and Status.md
3. Commit and push

---

## `/wag dev` - DEV Mode

**On entry:**
1. Update state.json: `current_mode = "DEV"`
2. Verify ADR exists in `adr/active/`
3. Verify on dev branch
4. Read ADR content
5. Create implementation plan
6. Begin implementation

### Development Phase

Dev completes all work uninterrupted:
- Each file change → Write tool → user approves diff
- Follow ADR requirements
- Write tests as specified in ADR

### Gate Check

When dev work is complete, run the gate before commit:

**1. wag_cop**
- Checks: lint, test, ADR moved, PBI moved, criteria complete, git clean
- If fails → show failures, dev fixes, restart gate

**2. Architect Review** (only if cop passes)
- Spawn architect agent with full `git diff`
- Architect reviews against ADR requirements
- Returns: APPROVE or REJECT + feedback

**3. Report to User**
- Show cop results
- Show architect feedback

**4. Evaluate**
- If cop failed → dev fixes, restart gate
- If architect rejects → dev fixes, restart gate
- If user disapproves → dev fixes, restart gate
- All pass → proceed to commit

### Spawning the Architect Agent (Gate Check)

Use Task tool with:
```
subagent_type: "architect"
prompt: |
  Review this complete changeset before commit.

  ## Changes
  ```diff
  [git diff output]
  ```

  ## ADR Requirements
  [ADR content]

  ## Code Style Rules
  - Single quotes, no semicolons, tabs, no trailing commas
  - == not ===, else/catch on new lines

  ## Review
  1. Does the changeset fulfill ADR requirements?
  2. Are there design concerns or missing pieces?
  3. Code style violations?

  Return: APPROVE or REJECT
  Then: Summary of findings (what's good, what needs work)
```

### On Commit (all gates pass)

1. Mark criteria `[x]` on both ADR and PBI
2. Move ADR to `adr/completed/`
3. Move PBI to `backlog/_completed/`
4. Clear state.json (mode=null, active_pbi=null)
5. Update Status.md
6. Commit to dev branch and push

---

## `/wag create [type] [app]` - Create New App

**Usage:** `/wag create nextjs my-app`

1. Run framework scaffolder:
   ```bash
   cd /home/samf/source/claude/apps
   pnpm create next-app@latest [app] \
     --typescript --tailwind --eslint --app --src-dir \
     --turbopack --import-alias "@/*" --use-pnpm --no-git --yes
   ```

2. Install dev dependencies: `pnpm add -D prettier`

3. Configure TypeScript rules (.prettierrc, eslint.config.mjs, tsconfig.json)

4. Run `/wag init` logic

---

## `/wag init [app]` - Initialize Infrastructure

1. Create `.wag/` directory structure
2. Create `state.json`: `{ "app_name": "[app]", "current_mode": null, "active_pbi": null }`
3. Create `Status.md`
4. Create `docs/` folder with templates (PRD.md, Architecture.md, decisions.md)
5. Create `backlog/` and `backlog/_completed/`
6. Create `adr/active/` and `adr/completed/`
7. Create `.claude/settings.local.json` with auto-approve permissions
8. Create `CLAUDE.md` with mandatory rules
9. Initialize git (main branch first, then dev)
10. Create README.md
11. Initial commit and push

---

## Context Header

Every response starts with:
```
🔧 **WAG: [DOCS/ADR/DEV] ([App Name])**
📍 **Application:** [app-name]
📍 **Branch:** [branch]
🎯 **Context:** [what you're doing]
```

---

## Git Workflow

- **All modes:** Work on `dev` branch
- Direct commits to `dev` on "approve"

**Commit format:**
```
[type]: [description]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Sam Freeman <sfreeman@pay-onward.com>
```

---

## Success Criteria

WAG is working if:
- Dev completes work without interruption
- Gate check validates before commit (cop → architect → user)
- All three must approve before code is committed
- typescript-rules.md violations caught by cop (lint)
- No commits without your final approval
