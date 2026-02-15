---
description: Commit and push changes to dev
---

# Push — Commit & Push to Dev

## Step 1: Guard — Must Be on Dev

Run `git branch --show-current`. If the result is not `dev`, tell the user:

> "You're on `[branch]`, not `dev`. Refusing to push."

Stop. Do nothing else.

## Step 2: Check for Uncommitted Changes

Run `git status`. If there are no uncommitted changes (nothing modified, deleted, or untracked):

- Check if the local branch is ahead of `origin/dev` with `git status -sb`.
- If ahead, run `git push` and confirm success.
- If not ahead, tell the user: "Nothing to commit or push."
- Stop.

## Step 3: Analyze Changes

Run these in parallel:
- `git diff` — unstaged changes
- `git diff --staged` — staged changes
- `git status -u` — full file list including untracked
- `git log --oneline -5` — recent commit style

Review every change. Understand what was added, modified, and deleted. Build a clear picture of what this commit represents.

## Step 4: Commit & Push

1. Present a summary of what changed and the proposed commit message.
2. Stage all relevant files by name (not `git add -A` or `git add .`).
3. Commit with the proposed message. Always end the message with:
   ```
   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   Co-Authored-By: Sam Freeman <sam.freeman.55@gmail.com>
   ```
4. Run `git push`.
5. Confirm success.
