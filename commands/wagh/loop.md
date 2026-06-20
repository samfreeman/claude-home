---
description: Headless loop — scope a small batch of PBIs and walk away; the guarded court designs, implements, and reviews each to a PR stack, waking you only on hard calls via Telegram. Native wag2 tools. Never merges.
allowed-tools: Read, Glob, Grep, Bash, Write, Agent
---

# WAGH Loop — the unattended orchestrator

The only genuinely new logic in the `wagh:` set. It drives a **batch** of PBIs through the guarded per-PBI grammar to a **PR stack**, unattended. `/wagh:adr`, `/wagh:dev`, `/wagh:rvw` are its per-step primitives; this file is the conductor.

**Read `~/.claude/wag/references/branch-transcript.md` first** — the court contract and the grammar live there. **wag2 is not confined:** native tools throughout, behavioral never-merge discipline; escalation over Telegram by default.

## The human is essential at exactly three spots — all outside the loop

1. **Front — scoping the batch.** You pick the PBIs (origination + a compounding throttle, ~2–3). The loop runs only what you scope.
2. **Escalation — hard calls.** A deadlock-at-N or a too-big blast radius reaches you via Telegram (`hwag.ask`); you answer and sleep again. No answer ⇒ a PBI-scoped snag.
3. **Back — draining the PR stack.** Perception / UI evaluation (no agent has a sense organ for it) **and merge** (the one irreversible verdict). **The loop never merges; it only stacks PRs.**

## Usage

```
/wagh:loop                  # scope interactively, then run; escalations → phone via Telegram
/wagh:loop --ask:session    # escalations surface in this session
/wagh:loop --parallel       # allow independent PBIs to run concurrently in worktrees (default: serial)
```

## Phase 0: Pre-flight (attended — before you walk away)

1. `.wag/` exists; `state.json` initialised.
2. **No open snag** in `.wag/snags/` — an unattended run must not start on a broken foundation. Any → halt, route to `/wag:tri`.
3. **No template drift** (per `/wag:adr`'s rules). Drift → halt.

## Phase 1: Scope the batch (attended — this is the throttle)

This is the one conversation the loop has with you. Keep it tight:

1. Present every **eligible** open PBI (all deps closed), exactly as `/wag:adr` Phase 1 presents them, grouped by epic.
2. You pick the batch — typically **2–3**. Picking *is* the throttle; the loop won't exceed it.
3. **Build the dependency DAG** over the picked set: an edge `A → B` where B lists A in `Dependencies`. Independent PBIs are DAG roots; dependent chains serialize. Reject a batch with a cycle (surface it).
4. Confirm the channel (`sms`/Telegram default, `session` if `--ask:session`) and isolation (serial default; `--parallel` → worktrees). Then you walk away.

## Phase 2: Drive the DAG

Process the DAG in topological order. For each PBI whose dependencies are all **satisfied** (closed or PR-approved in this batch):

**Run the guarded per-PBI grammar:**

```
(ADR → ADRG)*  →  [ impl → (RVW → RVWG) ]*
```

1. **`/wagh:adr`** for the PBI → approved ADR on `feature/PBI-EEE.PPP`.
2. **`/wagh:dev`** → implement under the per-actor guards → open PR.
3. **`/wagh:rvw`** → guarded review. **APPROVE (RVWG-accepted)** ⇒ this PBI's PR joins the stack, done. **REQUEST_CHANGES** ⇒ remand to step 2; repeat the bracket until APPROVE or escalation.

**Isolation:**
- **Serial (default):** width=1 — process DAG-ready PBIs one at a time in topological order. Declared independence ≠ code independence, so serial sidesteps file collisions entirely.
- **`--parallel`:** independent (no inter-PBI edge) ready PBIs run **concurrently, each in its own git worktree** on its own `feature/` branch off `dev`. Because the loop **never merges**, undeclared file overlap can't collide mid-run — any conflict surfaces only when *you* drain the stack at the back-gate, which is where a human already is.

## Phase 3: Dependency recheck on every stop

When a PBI **stops** (any guardian raised a PBI-scoped snag after no answer to an escalation):

1. **Quarantine** that PBI and everything downstream of it in the DAG (its dependents can't proceed on a snagged foundation).
2. **Recheck the DAG** and **continue every PBI that's still safe** — independent subtrees keep running. This is graceful degradation, not a batch halt.
3. Record the quarantine + reason in that PBI's transcript.

## Phase 4: Batch end — notify and hand back

When the DAG is drained (every PBI either PR-stacked or quarantined), `hwag.notify` the human (Telegram) with:

- **The PR stack** — each approved PBI's PR URL, ready for back-gate review + merge.
- **Quarantined PBIs** — id + snag reason, for attended `/wag:tri`.
- **Transcripts** — `.wag/transcripts/PBI-*.md` for the wake-up read; reviewing them is also the precedent-promotion step (escalation resolutions → reasoning docs).

Then STOP. **Nothing is merged. Nothing in `.wag/` is moved.** The PBIs are not done until you perceive, accept, and merge each PR yourself.

## Key rules
1. **You scope; the loop runs only that.** The batch you pick is the hard throttle.
2. **The loop never merges.** It produces a PR stack and stops. Merge is your verdict at the back-gate.
3. **One stop never halts the batch.** A PBI-scoped snag quarantines its subtree; the dependency recheck keeps the rest moving.
4. **Every step is recorded.** The transcripts are complete (if terse) so your wake-up read has no blind spots.
5. **Thin conductor.** This file scopes + sequences; all the work lives in `/wagh:adr|dev|rvw` and their courts.