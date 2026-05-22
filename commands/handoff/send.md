---
description: Compact the current conversation into a handoff document for another agent to pick up, or return results to the original session.
argument-hint: <what the next session should focus on, or how to frame the results>
---

# handoff:send

Write a handoff document summarising the current conversation so another agent can continue the work — or, if a `/handoff:read` already happened in a counterpart session, write the results document for the original session to debrief.

## Where to write

Use `$TMPDIR/handoffs/` if `$TMPDIR` is set, otherwise `/tmp/handoffs/`. `mkdir -p` if missing.

Pick the filename by what's already on disk:

- `handoff.md` missing → write **`handoff.md`** (you're session 1, starting a new round).
- `handoff.md` exists, `handoff.results.md` missing → write **`handoff.results.md`** (you're session 2, returning your work).
- Both exist → ask the user before overwriting `handoff.results.md`. Never auto-overwrite `handoff.md` — starting a new round is an explicit choice.

## What to include

Reference existing artifacts (PRDs, plans, ADRs, issues, commits, diffs) by path or URL. Don't duplicate them.

Add a short "Suggested skills" section listing skills the other session should invoke.

Redact secrets, credentials, and PII.

If `$ARGUMENTS` is present, treat it as the focus for the next session (or the framing for the results) and tailor the doc accordingly.

Print the full path of the file you wrote.
