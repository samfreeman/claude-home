---
description: Headless implement — implement the approved ADR unattended, each actor guarded by its court (DEV⇄DEVG, CQ⇄CQG, TESTER⇄TESTERG), to an open PR. Never merges. Supersedes /wag:hdev.
allowed-tools: Read, Glob, Grep, Bash, Agent
---

# WAGH Dev — guarded, unattended implementation

**Base + delta.** This runs `/wag:dev`'s implementation procedure as its base, executed by a confined Agent Team where **every actor is paired with a guardian**. **Read `/wag:dev` for the substance** (team shape, file ownership, the gate, the PR) and `~/.claude/wag/references/branch-transcript.md` for the court contract. This file is **only the headless delta**.

This is the `( (DEV → DEVG)* | (CQ → CQG)* | (TESTER → TESTERG)* )` segment — the implementation half of the iterated `[impl → RVW]*` bracket. `/wagh:rvw` is the review half; the loop between them is driven by `/wagh:loop`.

## Usage

```
/wagh:dev                 # escalations reach your phone
/wagh:dev --ask:session   # escalations surface here
```

## Phase 0: Pre-flight (main session — fail fast, before spawning)

Same as `/wag:hdev`. On any failure, **do not spawn**:
1. `.wag/` exists.
2. **No open snag.**
3. `state.json.feature_branch` is set (else run `/wagh:adr` first).
4. An **approved** ADR exists in `.wag/adr/active/`.
5. The feature branch exists.

## Phase 1: Channel

`--ask:session` → `session`, else `sms`. Passed to every agent.

## Phase 2: Stand up the guarded team

Spawn the lead (`hwag-architect` in team-lead mode), which stands up — per the ADR's Team Shape — **each actor paired with its `hwag-guardian`:**

| Actor (Defense) | Guardian (Prosecution) | Indictment source |
|---|---|---|
| `hwag-dev` ×1–2 | **DEVG** | `hwag-dev` → `## Guardian watches` |
| `hwag-cq` | **CQG** | `hwag-cq` → `## Guardian watches` |
| `hwag-tester` | **TESTERG** | `hwag-tester` → `## Guardian watches` |

**The delta — every base `/wag:dev` point that would turn to the user, and the guardian gates that replace the team's own self-checks:**

| Base `/wag:dev` behavior | Headless routing |
|---|---|
| Dev writes a `src/` file | **DEVG hard gate: Dev asks before the edit; DEVG signs off; only then does the file land.** Per-file. |
| Dev presents an implementation approach | DEVG reviews the **plan** before any file is touched |
| CQ runs the gates | **CQG sanity-checks** that every required gate was applied + succeeded (same list, no re-gating); failures routed back to Dev |
| Tester writes a `tests/` file | **TESTERG hard gate**, per-file, same shape as DEVG |
| Architect escalates a snag to the user | hard-stop: `checkpoint` + PBI-scoped snag + `notify` + STOP this PBI |
| a single charge deadlocks at N or hits high blast-radius | the **guardian** escalates via `hwag.ask`; `[hwag:no-answer]` → PBI-scoped snag + STOP (N is per-contestation, resets on each resolved charge) |

**DEVG/TESTERG are pair programmers, not PR reviewers** — the PR is RVW's (`/wagh:rvw`). **CQ owns the mechanical gate; DEVG is the semantic prosecutor** — green is necessary, not sufficient.

**Recording:** every gate, every file, every escalation writes a digest to `.wag/transcripts/PBI-EEE.PPP.md` — terse on agreement, verbatim on a fight. No step is unrecorded.

## Phase 3: Finish — open the PR, never merge

When CQ's final gate is green **and** every guardian has signed off, the lead opens the PR via `hwag.run` (`gh pr create --base dev`), commits the transcript, `notify`s the PR URL, and **STOPS**. **Do not merge. Do not move the ADR/PBI. Do not touch `state.json`.** "PR open" ≠ "PBI done." Merge is the human's verdict.

## Phase 4: Surface outcome

Relay: PR URL + transcript path → "review with `/wagh:rvw`; merge is yours"; or the halt/snag reason + checkpoint path.

## Key rules
1. **Every actor is guarded.** No `src` or `tests` file lands without its guardian's per-file sign-off; no gate passes without CQG's completeness check.
2. **Confinement is the point.** The team acts only through `hwag` + `fs`; **no merge verb exists** — it cannot merge by construction.
3. **Hard-stops reach you, never guessed past.**
4. **Thin command.** Validate + stand up the guarded team; the work lives in the confined subtree. Ends at an open PR — always.