---
allowed-tools: Write, Read, TodoWrite, Bash
description: Save the current conversation context and state
---

## Context

Save command: $ARGUMENTS

## Your task

Save the current conversation state to a context file for later loading:

1. **Determine save location**:
   - If $ARGUMENTS is empty, use default: `.claude/context/saved-context.json`
   - If $ARGUMENTS contains a name, use: `.claude/context/saved-context-{name}.json`
   - Create the directory if it doesn't exist

2. **Gather current state**:
   - Use TodoWrite to get current todo list
   - Get current git branch and status
   - Note current working directory
   - Include timestamp

3. **Generate continuation prompt**:
   - Create a detailed restoration prompt that includes:
     - Workflow status header (🔥 **ACTIVE WORKFLOW:** format)
     - Current PBI/DEV work and status
     - What's been accomplished (from completed todos)
     - What's next (from pending todos)
     - Key decisions and context
     - Recently modified files
     - Active branch and location

4. **Save context file** with structure:

   ```json
   {
     "timestamp": "ISO 8601 timestamp",
     "git_branch": "current branch",
     "working_directory": "path",
     "git_status": "git status output",
     "todos": [...current todo list...],
     "notes": "any notes from $ARGUMENTS after the name",
     "conversation_context": "brief summary of what was being worked on",
     "continuation_prompt": "Detailed prompt for next Claude session to restore context",
     "active_pbi": "PBI number and title if in PBI workflow",
     "pbi_status": "Current PBI state",
     "key_decisions": ["list of important decisions made"],
     "recent_changes": ["list of files/changes made"],
     "next_actions": ["specific next steps to take"]
   }
   ```

5. **Confirm save**:
   - Show what was saved
   - Display the save location
   - Provide instructions for loading
   - Display key parts of the continuation prompt for verification

Example usage:

- `/save` - Save to default location
- `/save meeting` - Save as saved-context-meeting.json
- `/save pbi-work Working on PBI-002 authentication` - Save with name and notes
