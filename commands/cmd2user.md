---
allowed-tools: Read, Write, Bash, Glob
description: Copy a project command to user's command directory
---

## Context

Command to copy: $ARGUMENTS

## Your task

Copy a project command from `.claude/commands/` to the user's `~/.claude/commands/` directory. Follow these steps:

1. If no command name is provided in $ARGUMENTS, ask the user which project command they want to copy.

2. Check if the project command exists in `.claude/commands/[name].md`
   - If not found, list available project commands and ask user to choose

3. Ensure the user's command directory exists:
   - Check if `~/.claude/commands/` exists
   - If not, create it with `mkdir -p ~/.claude/commands/`

4. Check if the command already exists in the user directory:
   - If it exists, ask user if they want to overwrite it
   - Show a comparison if they want to see differences

5. Copy the command file from project to user directory:
   - Read the project command file
   - Write it to `~/.claude/commands/[name].md`

6. Confirm the copy was successful and explain:
   - The command is now available globally across all projects
   - How to use it (with `/user:command` to explicitly use user version)
   - That project commands still take precedence without prefix

Example usage:

- `/cmd2user cbimg` - Copies the cbimg command to user directory
- `/cmd2user` - Interactive mode to choose from available commands
