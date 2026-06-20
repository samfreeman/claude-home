---
description: Headless implement — implement the approved ADR unattended, each actor guarded by its court (DEV⇄DEVG, CQ⇄CQG, TESTER⇄TESTERG), to an open PR. Native wag2 tools. Never merges. Supersedes /wag:hdev.
allowed-tools: Read, Glob, Grep, Bash, Write, Agent
---

# WAGH Dev — guarded, unattended implementation

**Base + delta.** This runs `/wag:dev`'s implementation procedure as its base, executed by an Agent Team where **every actor is paired with a guardian**. **Read `/wag:dev` for the substance** (team shape, file ownership, the gate, the PR) and `~/.claude/wag/references/branch-transcript.md` for the court contract. This file is **only the headless delta**.

**wag2 is not confined.** The team is the same native `wag-*` team `/wag:dev` spawns — native `Read`/`Write`/`Bash` — plus a `wag-guardian` per actor. The "never merge / never push to main" discipline is behavioral, backed by your deny-list. Escalations reach you over **Telegram** by default; `--ask:session` keeps them in-session.

This is the `( (DEV → DEVG)* | (CQ → CQG)* | (TESTER → TESTERG)* )` segment — the implementation half of the iterated `[impl → RVW]*` bracket. `/wagh:rvw` is the review half; `/wagh:loop` drives the loop between them.

## Usage

```
/wagh:dev                 # escalations reach your phone via Telegram
/wagh:dev --ask:session   # escalations surface in this session
```

## Phase 0: Pre-flight (main session — fail fast, before spawning)

On any failure, **do not spawn**:
1. `.wag/` exists.
2. **No open snag.**
3. `state.json.feature_branch` is set (else run `/wagh:adr` first).
4. An **approved** ADR exists in `.wag/adr/active/`.
5. The feature branch exists.

## Phase 1: Channel

`--ask:session` → `session`, else `sms` (Telegram). Passed to every agent.

## Phase 2: Stand up the guarded team

Spawn the lead (`wag-architect`), which stands up — per the ADR's Team Shape — the standard `/wag:dev` team **with each actor paired to its `wag-guardian`:**

| Actor (Defense) | Guardian (Prosecution) | Indictment source |
|---|---|---|
| `wag-dev` ×1–2 | **DEVG** | `wag-dev` → `## Guardian watches` |
| `wag-cq` | **CQG** | `wag-cq` → `## Guardian watches` |
| `wag-tester` | **TESTERG** | `wag-tester` → `## Guardian watches` |

**The delta — every base `/wag:dev` point that would turn to the user, and the guardian gates that replace the team's own self-checks:**

| Base `/wag:dev` behavior | Headless routing |
|---|---|
| Dev writes a `src/` file | **DEVG hard gate: Dev asks before the edit; DEVG signs off; only then does the file land.** Per-file. |
| Dev presents an implementation approach | DEVG reviews the **plan** before any file is touched |
| CQ runs the gates | **CQG sanity-checks** that every required gate was applied + succeeded (same list, no re-gating); failures routed back to Dev |
| Tester writes a `tests/` file | **TESTERG hard gate**, per-file, same shape as DEVG |
| Architect escalates a snag to the user | hard-stop: PBI-scoped snag + `notify` + STOP this PBI |
| any single charge deadlocks at N or hits high blast-radius | the **guardian** escalates via `hwag.ask` (Telegram, or session relay); no answer → PBI-scoped snag + STOP (N per-contestation, resets on each resolved charge) |

**DEVG/TESTERG are pair programmers, not PR reviewers** — the PR is RVW's (`/wagh:rvw`). **CQ owns the mechanical gate; DEVG is the semantic prosecutor** — green is necessary, not sufficient.

**Recording:** every gate, every file, every escalation writes a digest to `.wag/transcripts/PBI-EEE.PPP.md` via native `Write` — terse on agreement, verbatim on a fight. No step is unrecorded.

## Phase 3: Finish — open the PR, never merge

When CQ's final gate is green **and** every guardian has signed off, the lead opens the PR via native `Bash` (`gh pr create --base dev`), commits the transcript, `notify`s the PR URL, and **STOPS**. **Do not merge. Do not move the ADR/PBI. Do not touch `state.json`.** "PR open" ≠ "PBI done." Merge is the human's verdict.

## Phase 4: Surface outcome

Relay: PR URL + transcript path → "review with `/wagh:rvw`; merge is yours"; or the halt/snag reason.

## Key rules
1. **Every actor is guarded.** No `src` or `tests` file lands without its guardian's per-file sign-off; no gate passes without CQG's completeness check.
2. **Behavioral discipline, not confinement.** Native tools; never-merge is a kept rule (the locked door is wag3). The deny-list still blocks push-to-main mechanically.
3. **Hard-stops reach you over Telegram, never guessed past.**
4. **Thin command.** Validate + stand up the guarded team; the work lives in the spawned agents. Ends at an open PR — always.