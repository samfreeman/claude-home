---
description: Headless ADR — design the ADR for a PBI unattended, as a two-agent court (ADR actor ⇄ ADRG guardian), reaching you only on hard calls via Telegram. Supersedes /wag:hadr's design mode.
allowed-tools: Read, Glob, Grep, Bash, Agent
---

# WAGH ADR — guarded, unattended ADR design

**Base + delta.** This command runs `/wag:adr`'s design procedure as its base, executed by a confined two-agent court instead of a grill with you. **Read `/wag:adr` for the substance** (PBI pick, design, ADR shape, branch+commit) and `~/.claude/wag/references/branch-transcript.md` for the court contract. This file describes **only the headless delta** — base `/wag:adr` never grows headless verbiage.

This is the `(ADR → ADRG)*` segment of the per-PBI grammar.

## Usage

```
/wagh:adr [PBI EEE.PPP]      # explicit PBI, else highest-priority eligible
/wagh:adr --ask:session      # escalations surface here, not on your phone
```

## Phase 0: Pre-flight (main session — fail fast, before spawning)

Identical to `/wag:hadr`'s pre-flight. Do these here; on any failure, **do not spawn** — stop and tell the user:
1. `.wag/` exists (else `/wag:init`).
2. **No open snag** in `.wag/snags/`. Any → halt, surface ids, stop. (Resolve attended via `/wag:tri`.)
3. **No template drift** (per `/wag:adr`'s drift rules). Drift → halt, stop.

## Phase 1: PBI + channel

- **PBI:** arg if given, else auto-pick the highest-priority **eligible** (all deps closed) open PBI; record which. Write `active_epic`/`active_pbi` to `state.json`.
- **Channel:** `--ask:session` → `session`, else `sms`. Pass into both agents' prompts.

## Phase 2: Stand up the court and wait

Spawn **two** confined agents and let them run the loop:

- **ADR actor** — `hwag-architect` in ADR mode (the base `/wag:adr` design procedure, confined per its headless rules).
- **ADRG** — `hwag-guardian` spawned as **ADRG**, told it guards the ADR actor (it reads `hwag-architect`'s `## Guardian watches`).

**The delta — every base `/wag:adr` human-turn is re-routed:**

| Base `/wag:adr` turns to the user for… | Headless routing |
|---|---|
| grill questions during design | the actor **asks ADRG**; ADRG answers as the user would (reasoning docs are its standing) |
| approving each design decision | `(ADR → ADRG)` loop → ADRG approves, or charges and the actor reworks/pushes back (N is per-contestation; resets on each resolved charge — see transcript reference) |
| approving the finished ADR | **ADRG's approval flips status to `approved`** and advances the loop — the stand-in for base Phase 4 approval |
| a discovered snag / doc defect | hard-stop: `checkpoint` + PBI-scoped snag + `notify` + STOP this PBI (never resolved unattended) |
| a low-confidence + high-blast-radius fork | ADRG escalates via `hwag.ask`; `[hwag:no-answer]` → snag + STOP |

**Recording:** every step writes a transcript digest to `.wag/transcripts/PBI-EEE.PPP.md` (terse on agreement, verbatim on a fight). Every decision is also logged via `hwag.log_decision` to `.wag/decisions/ADR-EEE.PPP.md`.

**On ADRG approval:** the actor writes the ADR via `fs`, sets status `approved`, creates `feature/PBI-EEE.PPP`, and commits the ADR + state + transcript via `hwag.run`. **No PR** — that's `/wagh:dev`.

## Phase 3: Surface outcome

Relay: ADR approved on `feature/PBI-EEE.PPP` (+ decision-log + transcript paths) → "run `/wagh:dev` to implement"; or the halt/snag reason + checkpoint path.

## Key rules
1. **The court replaces the grill.** ADR and ADRG are independent agents; design completes only *through* the `(ADR → ADRG)*` loop, never by self-approval.
2. **ADRG is the user's stand-in** — answers grill questions and gives the approval that flips the ADR to `approved`.
3. **Hard-stops reach you, never guessed past.** Snags/drift → PBI-scoped snag + STOP; high-blast-radius coin-flips → escalate.
4. **Thin command.** Validate + stand up the court; the work lives in the confined subtree. No PR.