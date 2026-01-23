---
allowed-tools: Read, TodoWrite, Bash, Glob
description: Load a previously saved conversation context
---

## Context

Load command: $ARGUMENTS

## Your task

Load a previously saved conversation context and restore the state:

1. **Determine which file to load**:
   - If $ARGUMENTS is empty, use default: `.claude/context/saved-context.json`
   - If $ARGUMENTS is "list", show all available saved contexts
   - If $ARGUMENTS contains a name, use: `.claude/context/saved-context-{name}.json`

2. **If listing saved contexts**:
   - Use Glob to list files in `.claude/context/`
   - Show each saved context with its timestamp and notes
   - Display as a formatted list

3. **If loading a context**:
   - Read the specified JSON file
   - Parse and validate the content
   - Display a summary of what's being loaded

4. **Restore the state**:
   - Use TodoWrite to restore the todo list
   - Show the git branch it was saved from (don't switch branches)
   - Display any saved notes
   - Show timestamp of when it was saved

5. **Present continuation prompt**:
   - **IMPORTANT**: Begin by stating "🔄 **CLAUDE CODE RESTARTED - LOADING SAVED CONTEXT**"
   - If `continuation_prompt` exists in saved context, display it prominently
   - This provides the current Claude session with full context to continue seamlessly
   - Include workflow status, accomplishments, next actions, and key decisions
   - Make it clear this is a fresh session continuing previous work

6. **Provide a status report**:

   ```
   🔄 **CLAUDE CODE RESTARTED - LOADING SAVED CONTEXT**

   📂 **Context Loaded from [filename]**
   Saved: [timestamp]
   Branch: [git branch when saved]
   Directory: [working directory]

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   [Display full continuation_prompt here if it exists]

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   ✅ Todo list restored with X items
   🔄 Ready to continue from saved state

   **Note**: You are Claude Code in a fresh session. Use the context above to continue the work seamlessly.
   ```

Example usage:

- `/load` - Load default saved context
- `/load list` - Show all saved contexts
- `/load meeting` - Load saved-context-meeting.json
