---
description: Product development workflow - DOCS → ADR → DEV (with gate check)
allowed-tools: Read, Write, Grep, Glob, TodoWrite, Bash, Task
---

# WAG - Product Development Workflow

**Journey:** `/wag docs` → `/wag adr` → `/wag dev`

## Core Principle: Sandbox + Gate

AI has **complete freedom** on feature branches. Gates (lint/tests + architect + user) validate before merging to dev.

```
feature/PBI-XXX (sandbox)     dev (protected)
       │                           │
       │  AI works freely          │
       │  commits, experiments     │
       │                           │
       └──► gate ──► user ──►──────┘
            (lint+tests+architect)  approves
```

## Critical Rules

1. **Source code (src/**)** → Use Write tool (user sees diff)
2. **Infrastructure (.wag/*)** → Edit tool is fine
3. **All code** → Follow `/home/samf/.claude/documents/typescript-rules.md`
4. **All new code must have tests** → Every PBI/ADR includes test coverage requirement
5. **Feature branch workflow** → AI works on feature/PBI-XXX, not dev

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

### On Entry

1. Create and switch to feature branch:
   ```bash
   git checkout dev && git pull
   git checkout -b feature/[PBI] # e.g., feature/PBI-028
   ```
2. Update state.json: `current_mode = "DEV"`
3. Verify ADR exists in `adr/active/`
4. Read ADR content
5. Create implementation plan
6. Begin implementation

### Development Phase (Sandbox)

Dev has **complete freedom** on the feature branch:
- Each file change → Write tool → user approves diff
- Follow ADR requirements
- Write tests as specified in ADR
- Commit as needed (user approves each commit)
- Push to feature branch freely

### Gate Check (Before Merge to Dev)

When dev work is complete, run the gate:

**1. Run Lint & Tests**
- Run lint and tests
- If fails → dev fixes, restart gate

**2. Architect Review** (only if lint/tests pass)
- Spawn architect agent with full `git diff`
- Architect reviews against ADR requirements
- Returns: APPROVE or REJECT + feedback
- If rejects → dev fixes, restart gate

**3. Report to User**
- Show lint/test results
- Show architect feedback
- Wait for user approval

**4. Evaluate**
- If lint/tests failed → dev fixes, restart gate
- If architect rejects → dev fixes, restart gate
- If user disapproves → dev fixes, restart gate
- All pass → proceed to merge

### Spawning the Architect Agent (Gate Check)

Use Task tool with:
```
subagent_type: "architect"
prompt: |
  Review this complete changeset before merge to dev.

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

### On Merge (all gates pass)

1. Mark criteria `[x]` on both ADR and PBI
2. Move ADR to `adr/completed/`
3. Move PBI to `backlog/_completed/`
4. Commit final state on feature branch
5. Merge to dev:
   ```bash
   git checkout dev
   git merge feature/[PBI] --no-ff -m "Merge feature/[PBI]: [description]"
   git push origin dev
   ```
6. Clear state.json (mode=null, active_pbi=null)
7. Update Status.md
8. Commit and push
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

**Branches:**
- `main` - Production
- `dev` - Protected integration branch
- `feature/PBI-XXX` - AI sandbox (one per PBI)

**Commit format:**
```
[type]: [description]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Sam Freeman <sfreeman@pay-onward.com>
```

**AI can freely:**
- Commit to feature branch
- Push to feature branch

**AI cannot (enforced by deny list):**
- Push directly to dev
- Push directly to main
- Force push

---

## Success Criteria

WAG is working if:
- Dev works freely on feature branch
- Gate check validates before merge (lint/tests → architect → user)
- All three must approve before code is merged to dev
- typescript-rules.md violations caught by lint
- No merges to dev without your final approval
