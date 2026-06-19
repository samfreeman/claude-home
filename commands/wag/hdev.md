---
description: Headless implement — spawn a confined Agent Team to implement the approved ADR end-to-end to a PR, unattended, reaching you only on hard-stops via Telegram
allowed-tools: Read, Glob, Grep, Bash, Agent
---

# WAG hdev — Unattended implementation

> **Superseded by `/wagh:dev`** — which guards *every* actor with its own prosecutor (DEV⇄DEVG, CQ⇄CQG, TESTER⇄TESTERG) and a per-file hard gate, and records a branch transcript. Kept for compatibility.

Headless sibling of `/wag:dev`. Implements the approved ADR with a **confined** Agent Team and runs to an **open PR** — never merging. The team's only effectors are the `hwag` MCP server (guarded `run`, `ask`/`notify`, `log`, `checkpoint`) and the `fs` MCP server. You are not in the loop except on hard-stops, which reach you over Telegram.

**Usage:** `/wag:hdev` (default — asks reach your phone) · `/wag:hdev --ask:session` (asks surface in this session instead; for when you're nearby).

## Phase 0: Pre-flight (main session — fail fast, before spawning)

Do these cheaply here; if any fails, **do not spawn** — tell the user and stop.

1. `.wag/` exists (else: run `/wag:init`).
2. **No open snag.** Scan `.wag/snags/` for any `SNAG-*.md` file. If any exist, halt — surface the SNAG id(s) and stop. An unattended run must not start on a broken foundation. (Resolve attended via `/wag:tri`.)
3. Read `.wag/state.json` → `feature_branch`. If null/missing: stop, tell the user to run `/wag:adr` or `/wag:hadr` first.
4. An **approved** ADR exists in `.wag/adr/active/` (`ADR-EEE.PPP.md`, status approved). Else stop.
5. Confirm the feature branch exists (`git rev-parse --verify`). If not, ADR approval went wrong — stop and tell the user.

## Phase 1: Determine ask channel

Parse args: `--ask:session` → channel = `session`; otherwise channel = `sms`. (Telegram delivery; "sms" = reaches the phone.) You'll pass this into the lead's prompt so it sets `channel` on every `hwag.ask` call.

## Phase 2: Spawn the confined lead and wait

Spawn **one** `hwag-architect` agent (it stands up the rest of the confined team itself). Hand it everything it needs; then wait for it to return. The command does **no** file writes or git itself — all of that happens inside the confined subtree via `hwag`/`fs`.

Lead prompt must include:
- Mode: **hdev** (implement the approved ADR — do not redesign).
- Paths: the feature branch to check out (via `hwag.run git checkout`), the ADR file, `.wag/docs/Architecture.md`.
- Team shape from the ADR (`hwag-dev` ×1–2, `hwag-tester`, `hwag-cq`).
- **Ask channel for this run** = `sms` or `session` — pass `channel:"<that>"` on every `hwag.ask` call.
- Hard-stop contract: on snag / template drift / low-confidence+high-blast-radius → `checkpoint` + `notify` + STOP; never resolve a snag, never guess a high-blast-radius fork.
- Finish contract: when CQ's final gate is fully green, open the PR (`hwag.run gh pr create --base dev`), `notify` the human the PR URL, and STOP. **Do not merge. Do not move the ADR/PBI. Do not touch state.json.** "PR open" ≠ "PBI done."

## Phase 3: Surface the outcome

When the lead returns, relay to the user:
- **PR opened:** the URL, and "review with `/wag:rvw`; merge is yours (Phase 6 of `/wag:dev`, or merge in the UI)."
- **Halted:** the stop reason and the checkpoint path, so the user can resume attended.

## Key rules
1. **Confinement is the point.** The team acts only through `hwag` + `fs`; it has no native shell or file write, so it **cannot merge** by construction.
2. **Merge stays human.** hdev ends at an open PR — always.
3. **Hard-stops reach the human, they don't get guessed past.** Snags and template drift never get auto-resolved.
4. **Thin command.** This file validates and spawns; the work lives in the confined subtree.
