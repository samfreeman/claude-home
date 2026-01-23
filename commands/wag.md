---
description: Product development workflow - DOCS → ADR → DEV (with architect review)
allowed-tools: Read, Write, Grep, Glob, TodoWrite, Bash, Task
---

# WAG - Product Development Workflow

**Journey:** `/wag docs` → `/wag adr` → `/wag dev`

WAG uses architect review in DEV mode to ensure code quality before you see any diffs.

## Why Architect Review?

In long Claude sessions, rules get buried in context and compliance drops. WAG solves this by:

1. **Architect gate** - Every code change reviewed by fresh-context Architect agent
2. **No diff without approval** - You only see diffs for Architect-approved changes
3. **Reject = rethink** - If Architect rejects, we discuss a new approach

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

## `/wag dev` - DEV Mode (Architect-Gated)

**On entry:**
1. Update state.json: `current_mode = "DEV"`
2. Verify ADR exists in `adr/active/`
3. Verify on dev branch
4. Read ADR content
5. Create implementation plan
6. Begin implementation (one task at a time)

### Architecture

```
Orchestrator (you talk to me)
    │
    ├── I propose code changes
    │
    ├── Spawn Architect agent to review
    │       └── Returns: APPROVE or REJECT + reasoning
    │
    └── If APPROVE → Call Write (you see diff)
        If REJECT → Show concerns, discuss new approach
```

**Orchestrator writes code proposals directly.**
**Architect is the gate.** You only see diffs for approved changes.

### The Flow (Per Task)

```
1. Orchestrator reads files, proposes code change
       ↓
2. Orchestrator spawns Architect agent with:
   - The proposed change
   - ADR requirements
   - typescript-rules.md
       ↓
3. Architect returns APPROVE or REJECT
       ↓
4. If APPROVE:
   - Show "🏗️ **Architect:** [reasoning]"
   - Call Write tool (you see diff in VS Code)
   - Wait for your approval
       ↓
5. If REJECT:
   - Show "🏗️ **Architect:** [concerns]"
   - Discuss: "How should we approach this differently?"
   - Do NOT call Write
       ↓
6. Move to next task (or rework current task)
```

### Spawning the Architect Agent

Use Task tool with:
```
subagent_type: "architect"
prompt: |
  Review this proposed code change.

  ## Proposed Change
  File: [path]
  ```typescript
  [PROPOSED CODE]
  ```

  ## ADR Requirements
  [RELEVANT SECTION]

  ## Code Style Rules
  - Single quotes, no semicolons, tabs, no trailing commas
  - == not ===, else/catch on new lines
  - Single-statement blocks without braces

  ## Your Assessment
  1. Does it meet ADR requirements?
  2. Does it follow code style rules?
  3. Any bugs, security issues, or design concerns?

  Return: APPROVE or REJECT
  Then: 2-3 sentences explaining why.
```

### Presenting Results

**If Architect approves:**
```
🏗️ **Architect:** APPROVE - [reasoning]

[Call Write tool - user sees diff]
```

**If Architect rejects:**
```
🏗️ **Architect:** REJECT - [concerns]

The Architect flagged issues with this approach. Let's discuss:
- [summarize concerns]
- What direction would you like to take?
```

Do NOT call Write if Architect rejects.

### On "approve" (when all ADR work is done)

1. Run quality gates: format → lint → type-check → test
2. Mark criteria `[x]` on both ADR and PBI
3. Move ADR to `adr/completed/`
4. Move PBI to `backlog/_completed/`
5. Clear state.json (mode=null, active_pbi=null)
6. Update Status.md
7. Commit to dev branch and push

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

## Quality Gates

Run from app directory before final approve:
```bash
pnpm format          # Auto-format code
pnpm lint            # Check code quality
pnpm type-check      # Verify types
pnpm test            # Run tests
```

All must pass before committing.

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
- You only see diffs for Architect-approved changes
- Architect rejections lead to discussion, not forced writes
- typescript-rules.md violations caught before you see the diff
- No file changes without your approval
