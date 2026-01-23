---
allowed-tools: Read, Write, Glob, Bash
description: Copy user commands to the current project
---

## Context

Commands to copy: $ARGUMENTS

## Your task

Copy commands from the user's `~/.claude/commands/` directory to the current project's `.claude/commands/` directory.

1. **List Available Commands**:
   - If no arguments provided, list all commands in `~/.claude/commands/`
   - Show which ones already exist in the project

2. **Select Commands**:
   - If arguments provided, use those as command names
   - Otherwise, ask user to select which commands to copy
   - Support "all" to copy all user commands

3. **Check Conflicts**:
   - For each command, check if it exists in `.claude/commands/`
   - If conflicts exist, ask whether to:
       - Skip the command
       - Overwrite project version
       - Show comparison first

4. **Copy Commands**:
   - Read from `~/.claude/commands/[name].md`
   - Write to `.claude/commands/[name].md`
   - Preserve exact content

5. **Update Report**:
   - List all successfully copied commands
   - Note any skipped commands
   - Explain that project commands take precedence

Example usage:

- `/usercmds2prj` - Interactive selection
- `/usercmds2prj format-json todo` - Copy specific commands
- `/usercmds2prj all` - Copy all user commands
