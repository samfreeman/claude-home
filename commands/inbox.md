---
description: Read and action pending inbox messages
allowed-tools: Read, Write, Grep, Glob, Bash, TodoWrite, Task, AskUserQuestion,
  mcp__claude-memory__inbox_list,
  mcp__claude-memory__inbox_read,
  mcp__claude-memory__inbox_update
---

# Inbox - Pending Message Handler

## Your Task

Process pending messages from the claude-memory inbox.

### Step 1: Fetch Pending Messages

Call `mcp__claude-memory__inbox_list` with `status: "pending"` to get all pending inbox items.

---

### Branch A: No Pending Messages (0 items)

If there are no pending messages:

1. Tell the user: "No pending inbox messages."
2. Call `mcp__claude-memory__inbox_list` with `status: "done"` to get completed items.
3. Show the **last 3** completed messages in a summary format:
   ```
   Recent completed messages:
   - [title] (from [source], [date])
   - [title] (from [source], [date])
   - [title] (from [source], [date])
   ```
4. If there are no completed messages either, just say the inbox is empty.

---

### Branch B: Exactly 1 Pending Message

If there is exactly one pending message:

1. Call `mcp__claude-memory__inbox_read` with the item's ID to get full details.
2. Display the message to the user:
   ```
   Pending: [title]
   From: [source] | Created: [date]
   Content: [content]
   ```
3. **Take action** to fulfill the request described in the message content. Use whatever tools are necessary (Read, Write, Bash, Task, etc.) to complete the work.
4. If the action succeeds, call `mcp__claude-memory__inbox_update` with the item's ID and `status: "done"`.
5. Report the result to the user.

---

### Branch C: Multiple Pending Messages (2+ items)

If there are two or more pending messages:

1. List all pending messages for the user:
   ```
   Pending inbox messages:
   1. [title] (from [source], [date])
   2. [title] (from [source], [date])
   ...
   ```
2. Use `AskUserQuestion` to ask which message to action. Present each message title as an option.
3. Once the user picks one:
   - Call `mcp__claude-memory__inbox_read` with the chosen item's ID
   - Display the full message
   - Take action to fulfill the request
   - If the action succeeds, mark it as `done` with `mcp__claude-memory__inbox_update`
   - Report the result
