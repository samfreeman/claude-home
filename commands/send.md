---
description: Send an informational message to Claude Desktop
argument-hint: <message>
allowed-tools: AskUserQuestion, mcp__claude-memory__inbox_send
---

# Send Message to Desktop

## Your Task

Send a message to Claude Desktop via the claude-memory inbox.

**Important context:** Claude Desktop does NOT have access to files, bash commands, or any code tools. It can only read/write memory, manage the inbox, and have conversations. Messages should **inform** desktop of a situation — not tell it to take action on files or code.

### Step 1: Determine the Message

- If `$ARGUMENTS` is provided, use it as the message content.
- If `$ARGUMENTS` is empty, look at the recent conversation context and compose a brief informational summary of what has been done or what the current situation is.

### Step 2: Preview and Confirm

Before sending, show the user a preview of the message:

```
To: desktop
Project: [project root]
Title: [short summary]
Content: [full message]
```

Use `AskUserQuestion` to ask the user to approve or revise the message. Provide options like "Send as-is" and "Revise".

- If the user approves, proceed to Step 3.
- If the user wants to revise, ask what to change, update the message, and preview again.

### Step 3: Send

Call `mcp__claude-memory__inbox_send` with:
- `source`: "code"
- `target`: "desktop"
- `title`: A short summary (under 60 chars) derived from the message
- `content`: The full message
- `project`: The workspace root directory from the environment context provided at the start of the conversation (the "Working directory" value). Do NOT use pwd or any bash command — use the value from the initial environment info.

Confirm to the user that the message was sent.
