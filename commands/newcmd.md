---
allowed-tools: Read, Write, Glob
description: Create a new Claude command interactively
---

## Context

Command name: $ARGUMENTS

## Your task

Create a new Claude command by guiding the user through the process. Follow these steps:

1. **Command Name**:
   - If provided in $ARGUMENTS, use that name
   - Otherwise, ask user for the command name (without .md extension)
   - Validate: lowercase, no spaces, alphanumeric + hyphens only

2. **Choose Location**:
   - Ask whether to create in:
       - Project directory (`.claude/commands/`) - for project-specific commands
       - User directory (`~/.claude/commands/`) - for global commands
   - Explain the difference

3. **Command Configuration**:
   - Ask for a brief description (one line)
   - Ask which tools the command needs (comma-separated list)
   - Common tools: Read, Write, Bash, Edit, Grep, Glob, WebSearch, etc.

4. **Command Template**:
   - Ask user to describe what the command should do
   - Create a template with:
       - Proper frontmatter (allowed-tools, description)
       - Context section with $ARGUMENTS
       - Task section with user's description
       - Example usage if applicable

5. **Create the Command**:
   - Write the command file to chosen location
   - Show the created content
   - Explain how to use it (`/commandname` or `/user:commandname`)

Example interaction:

```
User: /newcmd
Assistant: I'll help you create a new command. What would you like to name it?
User: format-json
Assistant: Where should this command be created?...
```
