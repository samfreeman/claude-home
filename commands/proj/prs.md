---
description: List open PRs and their status for the active project (read-only)
---

# proj:prs — Open Pull Requests

Read-only sweep of the project's open PRs — what's waiting to land, and whether it's ready. Changes nothing.

## Resolve the project

- `/proj:prs <name>` → resolve `<name>` per proj:use rules (`~/source/<name>`, origin from `.git/config`).
- `/proj:prs` → read `~/.claude/proj/current`; if unset, say so and stop (suggest `/proj:use`).

## Gather

All via `gh` with `--repo <owner/repo>` — no cd, no local git:

1. `gh pr list --repo <owner/repo> --state open` (include number, title, head branch, base, author, created date)
2. For each open PR: `gh pr checks <number> --repo <owner/repo>` and review decision (`gh pr view <number> --repo <owner/repo> --json reviewDecision,mergeable`)

## Present

One compact table: PR #, title, base ← head, checks (pass/fail/pending), review decision, age. Below it, one line per PR that is **ready to merge** (checks green, no blocking review) — these are the merge candidates.

If there are no open PRs, say exactly that in one line.

## Rules

- Read-only: `gh pr list` / `view` / `checks` only. Never merge, close, comment, or edit from this command.