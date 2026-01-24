---
description: Product development workflow with UI - DOCS → ADR → DEV (broadcasts to wagui)
allowed-tools: Read, Write, Grep, Glob, TodoWrite, Bash, Task, mcp__wag__wag_set_state, mcp__wag__wag_send_message, mcp__wag__wag_get_state, mcp__wag__wag_get_history, mcp__wag__wag_clear
---

# WAGU - WAG with UI

WAGU = WAG + real-time UI broadcasting via MCP.

**Ports:** `3098` (frontend) | `3099` (server)

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
wag_set_state(app, appRoot, repo?, mode, branch: "dev", context, pbi?)
```
- `appRoot`: Absolute path to app root directory
- `repo`: Optional repo root if different from appRoot

Example:
```typescript
wag_set_state({
  app: "wagui",
  appRoot: "/home/samf/.claude/tools/wagui",
  repo: "/home/samf/.claude",
  mode: "DEV",
  branch: "dev",
  context: "Starting development",
  pbi: "PBI-028"
})
```

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

**On entry:**
1. `wag_set_state(app, "DEV", "dev", "Starting development", pbi)`
2. Update state.json: `current_mode = "DEV"`
3. Verify ADR in `adr/active/`, verify dev branch
4. Read ADR, create plan
5. `wag_send_message("dev", "system", "Starting DEV mode with [N] tasks")`

### Development Phase

Dev completes all work uninterrupted:
- Each file change → Write tool → user approves diff
- Follow ADR requirements
- Write tests as specified in ADR
- Update task progress: `wag_set_state(..., task: N, totalTasks: T)`

### Gate Check

When dev work is complete, run the gate before commit:

**1. wag_cop**
```
wag_send_message("dev", "system", "Running gate check...")
```
- Run `wag_cop(pbi)` via MCP
- If fails → `wag_send_message("dev", "system", "Cop failed: [failures]")`
- Dev fixes issues, restart gate

**2. Architect Review** (only if cop passes)
```
wag_send_message("dev", "system", "Cop passed. Running architect review...")
```
- Spawn architect agent with full `git diff`
- Architect reviews against ADR requirements
- `wag_send_message("architect", "review", feedback, approved: bool)`
- If rejects → dev fixes, restart gate

**3. Report to User**
- Show cop results
- Show architect feedback
- Wait for user approval

**4. Evaluate**
- If cop failed → dev fixes, restart gate
- If architect rejects → dev fixes, restart gate
- If user disapproves → dev fixes, restart gate
- All pass → proceed to commit

### Architect Agent (Gate Check)

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

1. Mark criteria `[x]` on ADR and PBI
2. `mv adr/active/*.md adr/completed/`
3. `mv backlog/PBI-XXX.md backlog/_completed/`
4. Clear state.json: `mode=null, active_pbi=null`
5. Update Status.md
6. Commit and push
7. `wag_clear()`
8. `wag_send_message("dev", "system", "PBI completed")`

---

## Critical Rules

1. **Source code** → Write tool (user sees diff)
2. **Infrastructure (.wag/)** → Edit tool OK
3. **All code** → Follow typescript-rules.md
4. **Only user switches modes** - never auto-transition

---

## Git

Branch: `dev` | Commit format:
```
[type]: [description]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Sam Freeman <sfreeman@pay-onward.com>
```
