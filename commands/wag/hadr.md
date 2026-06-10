---
description: Headless ADR — design an ADR unattended via self-play grill (reaching you only on hard calls via Telegram), or grill a prior decision log to train the reasoning docs
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, Agent
---

# WAG hadr — Unattended ADR design + log-grill

Headless sibling of `/wag:adr`. Two faces of one design-decision system:

- **Design run (default):** a confined `hwag-architect` self-plays the grill — reads the reasoning docs, picks each design call and justifies it, logs every decision, escalates only the genuinely hard ones to you over Telegram, and writes the ADR on a feature branch. Finishes at an ADR + branch (no PR — that's `/wag:hdev`).
- **Log-grill (`--grill-log`):** *attended*, in this session. You grill a prior run's decision log; your corrections get promoted into the global / project-local reasoning docs so the next run is sharper. This **never** runs as part of a design run — auto-grilling would defeat "walk away."

**Usage:** `/wag:hadr [PBI EEE.PPP]` · `/wag:hadr --ask:session` · `/wag:hadr --grill-log [log-file]`

---

## Mode select
- Args contain `--grill-log` → **Log-grill mode** (below, attended).
- Otherwise → **Design mode** (below, spawns confined lead).

---

## Design mode (unattended)

### Phase 0: Pre-flight (main session — fail fast, before spawning)
1. `.wag/` exists (else `/wag:init`).
2. **No open snag** in `.wag/snags/` (any `SNAG-*.md`). If any → halt, surface ids, stop. Don't spawn. (Resolve attended via `/wag:tri`.)
3. **No template drift** — project docs conform to current templates. If drift → halt, stop. (Resolve attended / `/wag:migrate-backlog`.)

### Phase 1: PBI + channel
- **PBI:** if given as an arg, use it. Else auto-pick the highest-priority **eligible** (all deps closed) open PBI; record which one. Write `active_epic` / `active_pbi` to `state.json`.
- **Channel:** `--ask:session` → `session`, else `sms`. Pass into the lead's prompt.

### Phase 2: Spawn the confined lead and wait
Spawn one `hwag-architect` in **hadr mode**. Prompt must include:
- The selected PBI path + canonical ID; Architecture.md + PRD.md + epic.md; applicable learnings.
- **Read the reasoning docs first:** `~/.claude/wag/reasoning/global.md` + `.wag/reasoning/local.md`.
- Self-play the grill; **log every decision** via `hwag.log_decision` to `.wag/decisions/ADR-EEE.PPP.md` (confidence + blastRadius + source). Stop rule: low-confidence + high-blast-radius → `hwag.ask` (channel as given), loop for discussion; `[hwag:no-answer]` → `checkpoint` + `notify` + STOP.
- Apply **G-004** (prefer up-front correctness over deferral when it shapes future work).
- Write the ADR to `.wag/adr/active/ADR-EEE.PPP.md`, set status `approved`, create `feature/PBI-EEE.PPP`, commit ADR + state via `hwag.run`. **No PR.**
- Hard-stop contract: snag / template drift discovered mid-design → `checkpoint` + `notify` + STOP; never resolve a snag, never guess a high-blast-radius fork.

### Phase 3: Surface outcome
Relay: ADR written on `feature/PBI-EEE.PPP` (+ decision-log path) → "run `/wag:hdev` to implement, or `/wag:hadr --grill-log` to review the calls it made"; or the halt reason + checkpoint path.

---

## Log-grill mode (attended, in-session)

You are present — this is a normal interactive grill, **not** confined, run in the main session.

1. **Locate the log.** Use the named file, else glob `.wag/decisions/*.md` and pick the most recent. Read it.
2. **Triage.** Surface the decisions worth your attention **first**: `confidence: low`, `blastRadius: high`, or `disposition: escalated-sms`. Skim the rule-sourced, high-confidence ones.
3. **Grill.** For each questionable call: was the pick right? Was the reasoning sound? Reverse-grill — you challenge, the agent defends or concedes.
4. **Promote corrections.** For each correction, write it to the right reasoning doc (same judgment as snag→learning):
   - cross-project heuristic → `~/.claude/wag/reasoning/global.md` (next `G-NNN`).
   - this-project convention → `.wag/reasoning/local.md` (next `L-NNN`).
   - a **checkable** standard (greppable) → it belongs as a **learning** (`~/.claude/wag/learnings/`), not a reasoning heuristic.
   Cite provenance (the log + decision id).
5. **Record** that the log was grilled (note at the top of the log file).

---

## Key rules
1. **Design run is unattended and confined** — the lead acts only through `hwag` + `fs`, never merges, never opens a PR.
2. **Log-grill is attended** and never auto-fires inside a design run.
3. **Hard-stops reach you; they're never guessed past.** Snags/drift halt; high-blast-radius coin-flips escalate.
4. **Thin command.** Validate + spawn (design) or grill + promote (log-grill); the design work lives in the confined subtree.
