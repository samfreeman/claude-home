---
description: Push the active project's committed work from outside it
---

# proj:push — Push a Project's Branch

For when a confined project session has committed but its settings deny the push. This command pushes from here. It pushes existing commits only — it never stages or commits; uncommitted changes belong to the project session.

## Resolve the project

- `/proj:push [name] [branch]` — project resolves per proj:use rules; bare form uses `~/.claude/proj/current`.

## Detect what needs pushing

This is local git, so work inside the project directory (one plain command per Bash call, per the covenant):

1. `cd` to the project path (its own call), then verify identity: `git rev-parse --show-toplevel` must resolve to the intended project before anything mutating.
2. `git status -sb` and `git branch -vv` — find branches ahead of (or missing from) their upstream.
3. Nothing ahead and no unpushed branches → verify fresh (never trust stale state), then report "nothing to push" with the evidence.

## Push

- Branch named → push that branch. Otherwise → the current branch if it's ahead; if a different branch is the one ahead, say so and ask.
- `git push origin <branch>` (add `-u` if no upstream yet).

## Rules

- Never push `main` or `qa`. If that's what's ahead, stop and report — that's a from-here decision for the user.
- Never `--force`, never skip hooks.
- Never commit here. Uncommitted work in the project is reported, not handled.
- When done, return to `~/.claude` (cd back) so later commands don't act on a stale cwd.