---
description: Senior architect review of the feature branch (or its PR) — fresh, independent, returns APPROVE / REQUEST_CHANGES with structured findings
allowed-tools: Read, Write, Bash, Glob, Grep, Agent
---

# WAG RVW — Senior Architect Review

Bring in an independent senior architect for a fresh review of the active feature branch. They read the ADR, the diff, Architecture, and the PR (if one exists), then return a structured verdict.

The senior architect is deliberately **not** the in-team Architect from `/wag:dev`. The embedded Architect watched the code being written; this reviewer arrives cold. Both perspectives have value — `/wag:rvw` is the cold one.

This is the RVW step of the cycle: `ADR → [DEV → RVW]* → TRI`. (`/wag:review` is a synonym.)

## Usage

```
/wag:rvw              # default: review the active feature branch from state.json
/wag:rvw <PR#>        # bare integer → resolve to PR's headRefName
/wag:rvw <branch>     # explicit branch name
```

## Before you start

1. Confirm `.wag/` exists. If not, tell the user to run `/wag:init` first.
2. Read `.wag/state.json`. The default target is `feature_branch`. If the user didn't pass an arg and `feature_branch` is null, halt and tell the user there's nothing on the books to review — they need an active ADR (`/wag:adr`) or to pass an explicit target.
3. Resolve the target:
   - User passed a bare integer → treat as PR number. Resolve via `gh pr view <PR#> --json headRefName`.
   - User passed any other string → treat as a branch name.
   - Otherwise default to `feature_branch` from `state.json`.
4. **Halt on open snags.** Standard WAG pre-flight check. Scan `.wag/snags/` for any `SNAG-*.md` file. If any exist, surface the halt and route to TRI — drive `/wag:tri` inline (the resolution protocol at `~/.claude/wag/workflows/snag-resolution.md`) before continuing. Open snags block all WAG work.

## Phase 1: Gather context

1. Fetch and verify the branch:

   ```bash
   git fetch origin
   git rev-parse --verify origin/<branch> 2>/dev/null || git rev-parse --verify <branch>
   ```

   If the branch doesn't exist anywhere, halt and tell the user.

2. Confirm the base. WAG branches are based on `dev` — sanity check with `git merge-base dev <branch>`. If the merge-base looks wrong (e.g. the branch was based on `main`), surface that to the user before proceeding.

3. Check for an open PR:

   ```bash
   gh pr list --head <branch> --state open --json number,url,title
   ```

   Record the PR number and URL if one is open. Without a PR, the review is purely against the diff.

4. Read the ADR. From the branch name (`feature/PBI-EEE.PPP`), derive the path:
   - First try `.wag/adr/active/ADR-EEE.PPP.md`.
   - If not present, try `.wag/adr/completed/ADR-EEE.PPP.md` (the PBI may have already been merged and is being reviewed retroactively).
   - If neither exists, halt — there's no spec to review against.

5. Identify the PBI file from the ADR's `**PBI:**` link.

## Phase 2: Spawn the senior architect

Invoke the senior architect via the Agent tool. **Use a fresh subagent** — independence is the entire point. Don't summarise the diff for them; let them pull it.

Invoke as `Agent` with `subagent_type: "general-purpose"` and a prompt that briefs them as a senior architect doing an independent review. The prompt must include:

- Their role and why they exist (the cold-eyes argument)
- The branch name and base (`dev`)
- The PR number and URL (or "none")
- The ADR path
- `.wag/docs/Architecture.md` path
- `.wag/docs/PRD.md` path
- The PBI path
- The review dimensions (see below)
- The exact output format (see below)
- Instructions to read the diff themselves via `git diff origin/dev...<branch>` and `gh pr view`/`gh pr diff` if a PR exists

Wait for the report.

### Review dimensions to brief into the prompt

The reviewer evaluates on four axes. Each gets a per-axis verdict and specific findings with file:line cites:

1. **ADR conformance** — does the code implement what the ADR specified? Are all PBI acceptance criteria demonstrably satisfied? Any ADR decisions silently dropped?
2. **Architecture conformance** — does it respect patterns in `Architecture.md`? Tech stack, layering, module boundaries? Does it satisfy Architecture's conformance manifest — including the validation-boundary policy (every external→typed value runs through `safeParse`) where a runtime schema library is in use? Does the code **speak the ubiquitous language** — names (types, fields, columns, functions) match Architecture's `Ubiquitous language` section, one name per referent, with no divergent synonyms and no artificially-introduced bounded context? (See `~/.claude/wag/references/ubiquitous-language.md`.) A name that diverges from a project-owned term is a finding here; a wrong term in Architecture's section itself is a snag candidate.
3. **Design and code quality** — coupling, abstractions, edge cases, error handling, test coverage proportional to risk.
4. **Security** — injection, exposed secrets, auth/authz gaps, unsafe defaults.

### Snag candidates

Brief the reviewer: if a finding traces upstream (the code follows the ADR but the ADR itself is wrong because Architecture/PRD is wrong), flag a **snag candidate** in the report. The reviewer does NOT capture or resolve snags — `/wag:rvw` decides with the user.

A snag is a defect in an upstream doc whose consequences have leaked downstream. A code bug is not a snag.

### Output format the reviewer must return

```markdown
# Senior Review — PBI EEE.PPP

**Branch:** feature/PBI-EEE.PPP
**PR:** #NNN (or "none")
**Reviewed:** YYYY-MM-DD
**Verdict:** APPROVE | REQUEST_CHANGES

## Summary
[2-4 sentences: what was reviewed, the headline finding, the verdict.]

## ADR conformance
**Axis verdict:** pass | concerns | fail
[Bullets with file:line cites.]

## Architecture conformance
**Axis verdict:** pass | concerns | fail
[As above.]

## Design and code quality
**Axis verdict:** pass | concerns | fail
[As above.]

## Security
**Axis verdict:** pass | concerns | fail
[As above.]

## Snag candidates
[Upstream doc defects, if any. Each one: target doc + section, what's wrong, why it matters. If none, write "None."]

## Required actions
[Only if Verdict is REQUEST_CHANGES. Concrete, numbered changes — name files, name functions, name the violation. If APPROVE, write "None — ready to merge."]
```

### Verdict rule the reviewer must follow

- **APPROVE** — ready to merge as-is. Snag candidates may still exist (they're about upstream docs, not this code).
- **REQUEST_CHANGES** — at least one finding must be addressed before merge. Reject for substance, not for taste. Style nits without functional impact are findings under the relevant axis, not blockers.
- If hedging, pick `REQUEST_CHANGES`. The user can override.

## Phase 3: Capture the review

1. Determine the review number for this PBI. Glob `.wag/reviews/REVIEW-EEE.PPP-*.md`. Take the highest existing index + 1, zero-padded to three digits. First review is `001`.

2. Write the report to `.wag/reviews/REVIEW-EEE.PPP-NNN.md`, exactly as the reviewer produced it. Don't reformat. Don't summarise.

3. If `.wag/reviews/` doesn't exist yet, create the directory as part of the write.

## Phase 4: Post to PR (if one exists)

If the target had an open PR, post the review as a PR comment:

```bash
gh pr review <PR#> --comment --body "$(cat .wag/reviews/REVIEW-EEE.PPP-NNN.md)"
```

Always use `--comment` (not `--approve` / `--request-changes`). GitHub blocks self-authored PRs from being approved or requested-changes by the author, and these PRs are authored by the user via `/wag:dev`. The verdict is already in the report body header — that's the structural signal.

Prefix the posted body with a one-line tag so PR readers know what this is:

```
<!-- /wag:rvw — senior architect, independent of the in-team Architect -->
```

If no PR exists, skip this phase — the report on disk is the deliverable.

## Phase 5: Handle snag candidates

If the report's `Snag candidates` section is non-empty:

1. Surface each candidate to the user. Show: target doc + section, what's wrong, why it matters.
2. Per candidate, the user picks one of two routes:
   - **It blocks** — the defect poisons the work under review. Capture it as a snag (`~/.claude/wag/templates/snag.md`) and go straight to TRI: drive `/wag:tri` inline.
   - **It can wait** — leave it in the report. The cycle-end `/wag:tri` drain reads the latest review's snag candidates and dispositions each one (capture-and-resolve, or dismiss) with the user there.

## Phase 6: Commit and push

Commit the review file on the feature branch:

```bash
git add .wag/reviews/REVIEW-EEE.PPP-NNN.md
git commit -m "review: PBI EEE.PPP — [verdict]"
git push origin <branch>
```

The review is an artifact of the PBI's lifecycle, same as the ADR. It belongs on the feature branch's history so it survives the squash-merge.

## Phase 7: Report to the user

> "Senior architect review complete.
> - Verdict: APPROVE | REQUEST_CHANGES
> - Report: `.wag/reviews/REVIEW-EEE.PPP-NNN.md`
> - PR: <URL> (or 'no PR')
>
> [If REQUEST_CHANGES] Required actions are in the report. Address them on `feature/PBI-EEE.PPP`, then re-run `/wag:rvw` for a follow-up.
> [If APPROVE] Implementation looks ready to merge. Tell `/wag:dev` 'merge' when you're ready."

## Key rules

1. **Independence is the point.** The reviewer reads the source artifacts and forms their own view. Never hand them a summary the in-team Architect wrote.
2. **Read-only review.** The reviewer does not write to `.wag/`, `src/`, or `tests/`. The command captures the report; the reviewer just produces it.
3. **Snag candidates are not snags.** The reviewer flags; the command and user decide whether a candidate becomes a snag — immediately if it blocks, otherwise at the cycle-end `/wag:tri` drain.
4. **Each review is preserved.** Reviews are numbered (`-001`, `-002`, …) per PBI — iteration history matters for the audit trail. Never overwrite.
5. **Verdict is structural, not advisory.** `APPROVE` = ready to merge as-is. `REQUEST_CHANGES` = do not merge until Required actions are addressed. User can override.
6. **The PR comment matches the report.** Don't paraphrase the verdict in the PR comment and write something different to the file. What's on disk is what was posted.
7. **`--comment` always.** GitHub blocks self-PR approvals and change-requests. The verdict lives in the report header.
8. **One feature branch can be reviewed many times.** Each iteration adds a new numbered report.
