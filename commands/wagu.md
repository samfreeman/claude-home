---
description: Product development workflow with UI - DOCS → ADR → DEV (broadcasts to wagui)
allowed-tools: Read, Write, Grep, Glob, TodoWrite, Bash, Task, mcp__wag__wag_set_state, mcp__wag__wag_send_message, mcp__wag__wag_get_state, mcp__wag__wag_get_history, mcp__wag__wag_clear, mcp__wag__wag_gate, mcp__wag__wag_cop
---

# WAGU - WAG with UI

WAGU = WAG + real-time UI broadcasting via MCP.

**Ports:** `3098` (frontend) | `3099` (server)

---

## Core Principle: Sandbox + Gate

AI has **complete freedom** on feature branches. Gates (cop + architect + user) validate before merging to dev.

```
feature/PBI-XXX (sandbox)     dev (protected)
       │                           │
       │  AI works freely          │
       │  commits, experiments     │
       │                           │
       └──► wag_gate ──► user ──►──┘
            (cop+architect)  approves
```

---

## App Detection & Working Directory

On entry to any mode, detect the target app and its root folder.

**All bash commands must be prefixed with `cd [appRoot] &&`** to ensure they run from the app's root folder.

For wagui, appRoot is: `/home/samf/.claude/tools/wagui`

---

## Startup Scripts

Use the package.json scripts for starting/stopping wagui:

```bash
cd /home/samf/.claude/tools/wagui && pnpm wag:start
```

This script:
1. Kills existing processes on ports 3098/3099
2. Starts the server (port 3099)
3. Starts the frontend (port 3098)
4. Opens browser in Windows (WSL2 compatible)

To stop:
```bash
cd /home/samf/.claude/tools/wagui && pnpm wag:stop
```

---

## MCP Broadcasting Rules

### 1. On mode entry
```
wag_set_state(app, appRoot, repo?, mode, branch, context, pbi?)
```
- `appRoot`: Absolute path to app root directory
- `repo`: Optional repo root if different from appRoot
- `branch`: Current git branch (feature/PBI-XXX or dev)

### 2. When speaking as a role
```
wag_send_message(role, type, content, file?, task?, pbi?, approved?)
```
- Forward user messages: `role: "user"`
- Your responses: `role: "pm" | "architect" | "dev"`
- Types: `chat`, `proposal`, `review`, `diff`, `decision`, `system`, `context`

### 3. On PBI completion
```
wag_clear()
```

### 4. The wagui test
If someone reads only wagui (not Claude Code), can they follow the conversation? Send messages accordingly.

---

## Startup (`/wagu start`)

```bash
cd [appRoot] && pnpm wag:start
```

Then call `wag_clear()` to reset state.

For `/wagu adr` and `/wagu dev`: check if ports are listening first, start if needed.

---

## DOCS Mode (`/wagu docs`)

**On entry:**
1. `wag_set_state(app, "DOCS", "dev", "Entering DOCS mode")`
2. Update state.json: `current_mode = "DOCS"`
3. Check for ADR in `adr/active/` → if exists, discuss what went wrong
4. Switch to dev branch, pull
5. `wag_send_message("pm", "system", "Entered DOCS mode")`

**Workflow:** PM defines requirements, Architect makes technical decisions. Document in PRD/Architecture, then add to backlog.

**On exit:** Commit and push if docs modified.

---

## ADR Mode (`/wagu adr`)

**On entry:**
1. `wag_set_state(app, "ADR", "dev", "Creating ADR", pbi)`
2. Update state.json: `current_mode = "ADR"`, `active_pbi`
3. Check for ADR in `adr/active/` → if exists, discuss what to do
4. List PBIs, recommend one
5. `wag_send_message("architect", "system", "Entered ADR mode")`

**Workflow:** User selects PBI → Architect explores and writes ADR → Discuss → PM for business alignment if needed.

**On "approve":**
1. Ensure ADR in `adr/active/`
2. Update state.json, Status.md
3. Commit and push
4. `wag_send_message("architect", "decision", "ADR approved for [PBI]")`
5. **STOP** - Tell user: "Run `/wagu dev` when ready."

---

## DEV Mode (`/wagu dev`)

### On Entry

1. Create and switch to feature branch:
   ```bash
   git checkout dev && git pull
   git checkout -b feature/[PBI] # e.g., feature/PBI-028
   ```
2. `wag_set_state(app, "DEV", "feature/[PBI]", "Starting development", pbi)`
3. Update state.json: `current_mode = "DEV"`
4. Verify ADR in `adr/active/`
5. Read ADR, create plan
6. `wag_send_message("dev", "system", "Starting DEV mode on feature/[PBI]")`

### Development Phase (Sandbox)

Dev has **complete freedom** on the feature branch:
- Edit, write, experiment
- Commit as needed (user approves each commit)
- Run tests iteratively
- Push to feature branch freely
- Update task progress: `wag_set_state(..., task: N, totalTasks: T)`

### Gate Check (Before Merge to Dev)

When dev work is complete, run the gate:

**1. Run wag_gate**
```
wag_send_message("dev", "system", "Running gate check...")
wag_gate(pbi)
```

The gate automatically:
- Runs lint
- Runs tests
- Broadcasts results to wagui

If cop fails → dev fixes issues, run gate again.

**2. Architect Review** (only if cop passes)

Gate returns diff and ADR. Spawn architect agent:
```
subagent_type: "architect"
prompt: |
  Review this complete changeset before merge to dev.

  ## Changes
  ```diff
  [diff from gate result]
  ```

  ## ADR Requirements
  [adr from gate result]

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

After architect responds:
```
wag_send_message("architect", "review", [architect feedback], approved: [bool])
```

If architect rejects → dev fixes, run gate again.

**3. User Review**

User sees in wagui or Claude Code:
- Cop results (lint + tests)
- Architect review
- Full diff

Wait for user approval before proceeding.

**4. Merge to Dev (all gates pass)**

After user approves:
1. Mark criteria `[x]` on ADR and PBI
2. `mv adr/active/*.md adr/completed/`
3. `mv backlog/PBI-XXX.md backlog/_completed/`
4. Commit final state on feature branch
5. Merge to dev:
   ```bash
   git checkout dev
   git merge feature/[PBI] --no-ff -m "Merge feature/[PBI]: [description]"
   git push origin dev
   ```
6. Clear state.json: `mode=null, active_pbi=null`
7. `wag_cop(pbi)` - Final postcondition check
8. `wag_clear()`
9. `wag_send_message("dev", "system", "PBI completed and merged to dev")`

---

## Critical Rules

1. **Source code** → Write tool (user sees diff)
2. **Infrastructure (.wag/)** → Edit tool OK
3. **All code** → Follow typescript-rules.md
4. **Only user switches modes** - never auto-transition
5. **Feature branch workflow** - AI works on feature/PBI-XXX, not dev
6. **Gate before merge** - wag_gate + architect + user must pass before merge

---

## Git Workflow

**Branches:**
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