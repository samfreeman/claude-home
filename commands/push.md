---
description: Commit and push changes (case-aware)
---

# Push — Commit & Push (case-aware)

Goal: push what we have. The path depends on state.

## Step 1: Detect the case

Run in parallel:
- `git rev-parse --is-inside-work-tree 2>&1`
- `git branch --show-current`
- `git status -sb`
- `git remote get-url origin 2>&1 || true`

Decide:
- **Case 1 — Already on `dev`.** Commit (with permission) and push dev.
- **Case 2 — No repo / no origin.** Bootstrap: `git init` if needed, create `main` + `dev`, create remote (`gh repo create`), push both.
- **Case 3 — On any other branch with a repo.** Commit on the current branch, push the branch, open a PR to dev.

## Step 2: Commit (Cases 1 & 3)
1. `git diff`, `git diff --staged`, `git status -u`, `git log --oneline -5` in parallel.
2. Summarize the changes and propose a commit message.
3. Stage relevant files by name (never `-A` / `.`).
4. Commit with the standard authorship trailer.

## Step 3: Push (case-specific)
- **Case 1:** `git push origin dev`.
- **Case 2:** `git push -u origin main` then `git push -u origin dev`.
- **Case 3:**
  - `git push -u origin <current-branch>`.
  - `gh pr create --base dev --head <current-branch>` with a title/body summarizing the commits since the merge-base with dev. Return the PR URL.

## Rules
- Never push to `main` or `qa` directly (Case 2 bootstrap is the only exception, and only on empty branches).
- Never `--force`, never skip hooks.
- Always confirm uncommitted state with user before committing.
- Never merge a PR automatically — the human controls the merge button.
