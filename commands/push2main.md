---
allowed-tools: Bash, Read
description: Commit all uncommitted changes and push directly to origin/main
---

## Context
Arguments: $ARGUMENTS

## Your task

This command helps you quickly commit and push changes to the main branch on the remote repository.

1. First, check the current git status to see what needs to be committed
2. If there are untracked files or changes:
   - Show the user what will be committed
   - Stage all changes (both tracked and untracked files)
   - Create a commit with an appropriate message
   - If arguments are provided, use them as the commit message
   - If no arguments, generate a descriptive commit message based on the changes
3. Before pushing, check if local is behind remote:
   - Run `git fetch origin main`
   - Check if behind with `git rev-list HEAD..origin/main --count`
   - If behind, attempt to pull with rebase: `git pull --rebase origin main`
   - If rebase has conflicts:
     - Show the conflicted files
     - For each conflict, show the conflict markers and ask user how to resolve
     - Options: keep local version, keep remote version, or abort
     - If abort, run `git rebase --abort` and stop
4. Push the current branch to origin/main using: `git push origin HEAD:main`
5. Show the final status

### Examples:
- `/push2main` - Commits all changes with auto-generated message and pushes to main
- `/push2main Fix bug in login validation` - Commits with specified message and pushes to main
- `/push2main "Update README and add new features"` - Commits with quoted message and pushes to main

### Important notes:
- This will stage ALL changes, including untracked files
- Make sure you review what's being committed before running this command
- The push will ALWAYS go to origin/main regardless of your current branch
- If you're on a feature branch, this will push your branch's commits to main
- Use with caution - this bypasses the normal PR workflow
- Automatically syncs with remote before pushing
- Will prompt for conflict resolution if needed
