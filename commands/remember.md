---
description: Save a fact to shared memory with smart categorization
argument-hint: <fact>
allowed-tools: mcp__claude-memory__memory_write, mcp__claude-memory__memory_search, AskUserQuestion
---

# Remember

## Your Task

Save a fact to the shared memory MCP so both Claude Code and Claude Desktop can recall it later.

### Step 1: Parse the Fact

The user said: `$ARGUMENTS`

Determine:
- **type**: Almost always "fact". Use "hardware" for devices/gear, "project" for project info.
- **category**: A logical grouping (e.g., "personal", "preference", "contact", "work", "health", "family"). Use existing categories when possible.
- **key**: A short, descriptive key (e.g., "vehicle", "favorite-color", "wife-name").
- **value**: The fact itself, **plus synonyms and related terms in parentheses** to aid future search. E.g., "Mustang Mach-E (car, vehicle, automobile, EV, electric)" or "1816 Severbrook Pl, Lawrenceville GA 30043 (home, house, residence)".

### Step 2: Check for Existing Entry

Call `memory_search` with broad terms related to the fact to see if an entry already exists. If it does, let the user know you'll be updating it.

### Step 3: Confirm

Show the user what you're about to write:

```
Type: [type]
Category: [category]
Key: [key]
Value: [value]
```

Use `AskUserQuestion` with options "Save" and "Revise" to confirm.

### Step 4: Write

Call `memory_write` with the confirmed values. Confirm to the user that the fact was saved.
