---
description: Headless ADR — design the ADR for a PBI unattended, as a two-agent court (ADR actor ⇄ ADRG guardian), reaching you only on hard calls via Telegram. Native wag2 tools. Supersedes /wag:hadr's design mode.
allowed-tools: Read, Glob, Grep, Bash, Write, Agent
---

# WAGH ADR — guarded, unattended ADR design

**Base + delta.** This runs `/wag:adr`'s design procedure as its base, executed by a two-agent court instead of a grill with you. **Read `/wag:adr` for the substance** (PBI pick, design, ADR shape, branch+commit) and `~/.claude/wag/references/branch-transcript.md` for the court contract. This file describes **only the headless delta** — base `/wag:adr` never grows headless verbiage.

**wag2 is not confined.** Actors and the guardian use **native tools** (`Read`/`Write`/`Bash`); the "never merge / never push to main" discipline is behavioral, backed by your deny-list. Escalations reach you over **Telegram** (`hwag` `ask`/`notify`) — that's the default. `--ask:session` routes them into this session instead, for when you're nearby.

This is the `(ADR → ADRG)*` segment of the per-PBI grammar.

## Usage

```
/wagh:adr [PBI EEE.PPP]      # explicit PBI, else highest-priority eligible; escalations → your phone
/wagh:adr --ask:session      # escalations surface in this session instead
```

## Phase 0: Pre-flight (main session — fail fast, before spawning)

On any failure, **do not spawn** — stop and tell the user:
1. `.wag/` exists (else `/wag:init`).
2. **No open snag** in `.wag/snags/`. Any → halt, surface ids, stop. (Resolve attended via `/wag:tri`.)
3. **No template drift** (per `/wag:adr`'s drift rules). Drift → halt, stop.

## Phase 1: PBI + branch + channel

- **PBI:** arg if given, else auto-pick the highest-priority **eligible** (all deps closed) open PBI; record which. Write `active_epic`/`active_pbi` to `state.json`.
- **Branch up front.** Create `feature/PBI-EEE.PPP` off `dev` now and write it to `state.json.feature_branch`. **This is the headless delta from base `/wag:adr`** (which branches at approval): the `(ADR → ADRG)` court writes a transcript turn at *every* step, so the branch must exist **before** the court starts — otherwise the transcript has nowhere to land (you'd still be on `dev`). The court and its transcript live on this branch from turn one.

  **Git discipline (all phases):** run **plain git from the repo root** — the working directory *is* the project root. The branch command is exactly `git checkout -b feature/PBI-EEE.PPP dev`. **Never `git -C <path> …`** — baking an absolute path defeats the allow-list (forcing a per-project rule and a permission prompt on every call) and violates rule #9. Same for every later `git add` / `git commit` / `gh` call: plain, from the cwd.
- **Channel:** `--ask:session` → `session`, else `sms` (Telegram). Pass into both agents' prompts.

## Phase 2: Stand up the court and wait

Spawn **two** agents via `Agent` and let them run the loop:

- **ADR actor** — `wag-architect`, running the base `/wag:adr` design procedure in self-play (it states each design option, picks, and justifies, consulting the reasoning docs).
- **ADRG** — `wag-guardian` spawned as **ADRG**, told it guards the ADR actor (it reads `wag-architect`'s `## Guardian watches`).

**The delta — every base `/wag:adr` human-turn is re-routed:**

| Base `/wag:adr` turns to the user for… | Headless routing |
|---|---|
| grill questions during design | the actor **asks ADRG**; ADRG answers as the user would (reasoning docs are its standing) |
| approving each design decision | `(ADR → ADRG)` loop → ADRG approves, or charges and the actor reworks/pushes back (N is per-contestation; resets on each resolved charge) |
| approving the finished ADR | **ADRG's approval flips status to `approved`** and advances the loop — the stand-in for base Phase 4 approval |
| a discovered snag / doc defect | hard-stop: PBI-scoped snag + `notify` + STOP this PBI (never resolved unattended) |
| a low-confidence + high-blast-radius fork | ADRG escalates via `hwag.ask` (Telegram, or session relay if `--ask:session`); no answer → snag + STOP |

**Recording:** every step writes a transcript digest to `.wag/transcripts/PBI-EEE.PPP.md` via native `Write` (terse on agreement, verbatim on a fight). Decisions are also logged to `.wag/decisions/ADR-EEE.PPP.md`.

**On ADRG approval:** the actor writes the ADR with `Write`, sets status `approved`, and via native `Bash` commits the ADR + state + transcript **onto the already-created `feature/PBI-EEE.PPP`** (the branch exists from Phase 1; approval doesn't create it). **No PR** — that's `/wagh:dev`.

## Phase 3: Surface outcome

Relay: ADR approved on `feature/PBI-EEE.PPP` (+ decision-log + transcript paths) → "run `/wagh:dev` to implement"; or the halt/snag reason.

## Key rules
1. **The court replaces the grill.** ADR and ADRG are independent agents; design completes only *through* the `(ADR → ADRG)*` loop, never by self-approval.
2. **ADRG is the user's stand-in** — answers grill questions and gives the approval that flips the ADR to `approved`.
3. **Behavioral discipline, not confinement.** Native tools; the never-merge rule is kept, not enforced by capability (that's wag3). Escalation reaches you over Telegram.
4. **Thin command.** Validate + stand up the court; the work lives in the spawned agents. No PR.