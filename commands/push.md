---
allowed-tools: Bash, Read
description: Commit all uncommitted changes and push to GitHub
---

## Context

Arguments: $ARGUMENTS

## Your task

This command helps you quickly commit and push changes to the current branch on GitHub.

1. First, check the current git status to see what needs to be committed
2. If there are untracked files or changes:
   - Show the user what will be committed
   - Stage all changes (both tracked and untracked files)
   - Create a commit with an appropriate message
   - If arguments are provided, use them as the commit message
   - If no arguments, generate a descriptive commit message based on the changes
3. Before pushing, check if local is behind remote:
   - Get current branch name with `git branch --show-current`
   - Run `git fetch origin <current-branch>`
   - Check if behind with `git rev-list HEAD..origin/<current-branch> --count`
   - If behind, attempt to pull with rebase: `git pull --rebase origin <current-branch>`
   - If rebase has conflicts:
       - Show the conflicted files
       - For each conflict, show the conflict markers and ask user how to resolve
       - Options: keep local version, keep remote version, or abort
       - If abort, run `git rebase --abort` and stop
4. Push the commits to the current branch on GitHub using: `git push origin HEAD`
   - If branch doesn't exist on remote, use: `git push -u origin HEAD`
5. Show the final status and confirm which branch was pushed

### Examples:

- `/push` - Commits all changes with auto-generated message and pushes to current branch
- `/push Fix bug in login validation` - Commits with specified message and pushes to current branch
- `/push "Update README and add new features"` - Commits with quoted message and pushes to current branch

### Important notes:

- This will stage ALL changes, including untracked files
- Make sure you review what's being committed before running this command
- The push will go to the current branch on GitHub
- If you haven't set up tracking for the current branch, it will create it
- Automatically syncs with remote before pushing
- Will prompt for conflict resolution if needed
