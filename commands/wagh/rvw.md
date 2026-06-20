---
description: Headless review — the cold senior-architect review (RVW) of the feature branch, double-checked by its guardian (RVWG) before the verdict is accepted. Native wag2 tools. The loop-control signal of the headless cycle.
allowed-tools: Read, Glob, Grep, Bash, Write, Agent
---

# WAGH RVW — guarded, unattended review

**Base + delta.** This runs `/wag:rvw`'s senior-architect review as its base, with the reviewer's verdict gated by a guardian. **Read `/wag:rvw` for the substance** (target resolution, the five review dimensions, the report format, capture, PR comment) and `~/.claude/wag/references/branch-transcript.md` for the court contract. This file is **only the headless delta**.

**wag2 is not confined.** Both agents use **native tools**; escalations reach you over **Telegram** by default (`--ask:session` to keep them in-session).

This is the `(RVW → RVWG)` segment that closes each pass of the iterated `[impl → RVW]*` bracket. **In-loop RVW is a loop-control signal** — a clean, RVWG-accepted verdict **exits** the bracket; a `REQUEST_CHANGES` verdict **remands to DEV** (`/wagh:dev`) and the bracket repeats. It is distinct from the human's back-gate review.

## Usage

```
/wagh:rvw                 # default: the active feature branch from state.json
/wagh:rvw <PR#>|<branch>  # explicit target, as base /wag:rvw
```

## Phase 0–1: Pre-flight + context

Exactly `/wag:rvw`'s pre-flight and context-gather (snag halt, target resolve, fetch branch, find the ADR, the PBI, applicable learnings). No delta.

## Phase 2: The court — reviewer + guardian

Spawn **two** agents via `Agent`:

- **RVW** — the cold senior architect, exactly as base `/wag:rvw` Phase 2 (a fresh independent reviewer; pulls the diff itself with native `Bash`; produces the five-dimension report and verdict). **It alone writes the Review.**
- **RVWG** — `wag-guardian` spawned as **RVWG**. RVW has no standing actor def, so its indictment is briefed inline below.

### RVWG's indictment (`## Guardian watches`, briefed inline)

Both RVW and RVWG review the PR. **RVWG writes no review of its own** — it double-checks what RVW found and what the Review says. **The Review cannot be accepted until RVWG agrees.** Charges:

1. **Coverage** — did RVW actually evaluate all five dimensions, or skim? Did it **pull the diff** (`git diff origin/dev...<branch>`, `gh pr diff`) rather than review from a summary?
2. **Verdict-evidence consistency** — does the verdict follow from the findings? An `APPROVE` sitting above unaddressed `fail`/`concerns` findings is incoherent; a `REQUEST_CHANGES` resting only on taste (no functional impact) is over-blocking.
3. **Earned exit** — because RVW is the loop-exit signal, a **false `APPROVE` ships dirty code to the back-gate**. That is the blast radius RVWG guards: it must be satisfied the `APPROVE` is *earned* before the bracket is allowed to exit.

**The loop:** `(RVW → RVWG)`. RVWG agrees → the verdict is accepted. RVWG charges → RVW re-reviews (re-pull, re-justify, or correct the verdict). N is per-contestation (resets on each resolved charge). A single charge deadlocked at N, or high blast-radius → escalate via `hwag.ask` (Telegram); no answer → PBI-scoped snag + STOP.

## Phase 3: Capture + record

- Capture the Review exactly as base `/wag:rvw` Phase 3 (`.wag/reviews/REVIEW-EEE.PPP-NNN.md`), post to the PR (Phase 4), commit (Phase 6) with native `Bash` — **only after RVWG accepts**.
- Write the `(RVW → RVWG)` digest to the transcript with native `Write` (terse on a clean accept, verbatim if RVWG charged).

## Phase 4: Signal

Return the **accepted verdict** as the loop-control signal:
- **APPROVE** (RVWG-accepted) → exit the `[impl → RVW]*` bracket; ready for the human's back-gate.
- **REQUEST_CHANGES** → remand to `/wagh:dev`; the bracket repeats.

(Under `/wagh:loop` this signal is consumed by the orchestrator; run standalone, relay it to the user.)

## Key rules
1. **RVWG gates the verdict, doesn't replace it.** RVW writes the Review; RVWG only accepts or charges. Authors nothing.
2. **The exit must be earned.** A false APPROVE is the failure mode RVWG exists to stop.
3. **Snag candidates** are handled exactly as base `/wag:rvw` Phase 5 — flagged, not auto-resolved.