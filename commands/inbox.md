---
description: Read and action pending inbox messages
allowed-tools: Read, Write, Grep, Glob, Bash, TodoWrite, Task, AskUserQuestion,
  mcp__claude-memory__inbox_list,
  mcp__claude-memory__inbox_read,
  mcp__claude-memory__inbox_update
---

# Inbox - Pending Message Handler

## Your Task

Process pending messages from desktop in the claude-memory inbox for the current project.

### Project Filtering

Determine the current project from the workspace root directory in the environment context provided at the start of the conversation (the "Working directory" value). Only show and action messages whose `project` field matches this value. Messages with a different project or no project set should be ignored.

### Step 1: Fetch Pending Messages

Call `mcp__claude-memory__inbox_list` with `status: "pending"` and `target: "code"` to get all pending inbox items sent from desktop to code. Then call `mcp__claude-memory__inbox_read` on each to check its `project` field. Filter out any items whose source is not "desktop" or whose project does not match the current workspace root.

---

### Branch A: No Pending Messages (0 items)

If there are no matching pending messages:

1. Tell the user: "No pending inbox messages for [project]."
2. Call `mcp__claude-memory__inbox_list` with `status: "done"` and `target: "code"` to get completed items. Filter to only those matching the current project.
3. Show the **last 3** matching completed messages in a summary format:
   ```
   Recent completed messages:
   - [title] (from desktop, [date])
   - [title] (from desktop, [date])
   - [title] (from desktop, [date])
   ```
4. If there are no matching completed messages either, just say the inbox is empty.

---

### Branch B: Exactly 1 Pending Message

If there is exactly one matching pending message:

1. Display the message to the user:
   ```
   Pending: [title]
   From: desktop | Project: [project] | Created: [date]
   Content: [content]
   ```
2. **Take action** to fulfill the request described in the message content. Use whatever tools are necessary (Read, Write, Bash, Task, etc.) to complete the work.
3. If the action succeeds, call `mcp__claude-memory__inbox_update` with the item's ID and `status: "done"`.
4. Report the result to the user.

---

### Branch C: Multiple Pending Messages (2+ items)

If there are two or more matching pending messages:

1. List all pending messages for the user:
   ```
   Pending inbox messages:
   1. [title] (from desktop, [date])
   2. [title] (from desktop, [date])
   ...
   ```
2. Use `AskUserQuestion` to ask which message to action. Present each message title as an option.
3. Once the user picks one:
   - Display the full message
   - Take action to fulfill the request
   - If the action succeeds, mark it as `done` with `mcp__claude-memory__inbox_update`
   - Report the result
