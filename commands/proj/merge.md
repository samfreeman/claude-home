---
description: Merge a PR in the active project — the permission popup is the merge button
---

# proj:merge — Land a Pull Request

Merges one PR in the project, from outside it. The single `gh pr merge` call is the approval point — the popup is the merge button. No prose "shall I?" before it.

## Resolve the project and PR

- `/proj:merge [name] [pr#]` — project resolves per proj:use rules; bare form uses `~/.claude/proj/current`.
- No PR number given → run the proj:prs gather. Exactly one open PR → that's the candidate. Several → show the table and ask which; don't pick silently.

## Pre-merge check

For the candidate PR (`gh pr view --json` + `gh pr checks`):

- Checks all green
- No blocking review (`reviewDecision` not `CHANGES_REQUESTED`)
- `mergeable` clean (no conflicts)

Any of these red → report what's wrong and stop. Merge over a red state only if the user explicitly says to in this conversation.

## Merge

Show a one-paragraph summary (title, base ← head, checks, review state), then:

```
gh pr merge <n> --repo <owner/repo> --squash --delete-branch
```

Squash is the default; use a different strategy only if the user asks. Confirm the result with the merge commit and note that the head branch was deleted.

## Rules

- One PR per invocation.
- Never `--admin`, never bypass required checks.
- The local clone is untouched — its base branch is now behind; mention it, don't pull unless asked.