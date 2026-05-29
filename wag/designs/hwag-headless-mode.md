# HWAG — `hadr` / `hdev`

**Status:** In progress — design converged, build started
**Owner:** Sam
**Created:** 2026-05-29

**Naming convention (defined once):** the `h` prefix marks the *unattended* variant of WAG. Commands live under the wag umbrella and are invoked as **`/wag:hadr`** and **`/wag:hdev`** (files at `commands/wag/hadr.md`, `commands/wag/hdev.md`); the MCP server that serves them is `hwag`. The existing attended commands `/wag:adr` / `/wag:dev` are untouched. (Because `h` already carries the meaning, this doc doesn't spell out "headless" alongside the `h`-names.)

**This doc is the resume point.** Spec + build sequence + live progress checklist. If work stops mid-stream, pick up from the Progress Tracker at the bottom.

---

## 1. Founding problem

A single ADR took ~2 hours of synchronous grilling. A lot of the grill answers were "obvious." The pain isn't the grill per se — it's that the grill interrogates *everything*, including the obvious calls, and chains the human to the keyboard for the whole session.

**The fix is not to delete the grill. It's to triage and remote it:** let accumulated reasoning absorb the obvious decisions so the agent never asks them, and turn the genuinely hard decisions into a *short* exchange — over SMS, async, only when it matters.

---

## 2. Converged design (full spec)

### Mode
- New, **separate** commands: `hadr` / `hdev`. The existing `adr` / `dev` are **untouched**.
- Finish line is a **PR** you review via `/wag:review`. **It never merges.** The irreversible gate stays human.

### `hadr`
- **Self-play grill:** the agent asks each question, lists the options, **picks one, and justifies it** — instead of waiting on the user.
- Reads two **reasoning docs** at the start of a run:
  - **Global** (`~/.claude/wag/`) — cross-project design heuristics ("when two designs tie, prefer fewer moving parts").
  - **Local** (`.wag/`) — project conventions ("in this app, auth flows through module X").
- Writes a per-run **decision log**: every question, the options, the pick, the justification, and a **confidence rating**.
- The decision log triages itself by confidence so later review targets the coin-flips, not all decisions equally.

### `hdev`
- **No reasoning doc of its own.** The design lives in the ADR (produced by `hadr` with its reasoning docs); dev's own rule is "if it's not in the ADR, don't implement it." Micro-decisions (naming, file layout, test shape) get caught at PR review.
- **Dev-layer learning goes through WAG learnings, not a loop.** Reconsidered (the "dev needs reasoning too" thread) and reaffirmed: the dev team executes, it doesn't self-question, so `hadr`'s self-grill→log→promote loop has no input at the dev layer. Quality-discipline failures (CQ waving a lint warning, dev `_`-prefixing to silence one) are handled by the existing **learnings** mechanism — dev/CQ load `~/.claude/wag/learnings/` by "Applies to" and enforce them; recurring failures get promoted to a learning via the normal flow. The unifying meta-preference across both layers: *prefer up-front correctness over expedient shortcuts (deferral, silenced warnings, faked fixes) when the shortcut compounds into future cost.* In `hadr` it's a judgment heuristic (reasoning doc); in dev/CQ it's a checkable standard (learning with a grep Check). **Follow-up:** author a learning for lint-bypass cheats (`_`-prefix on unused, `eslint-disable`, `@ts-ignore`, stray `any`) with a grep Check CQ must enforce.
- It's today's Agent-Team flow (Architect / Dev / CQ / Tester) **minus the merge gate** and **minus snag-escalation-to-user** (snags now hard-stop instead).

### The compounding loop (self-correction engine)
`hadr` reads reasoning docs → self-plays → writes the log → **(separate, on-demand) log-grill** → user's corrections get **promoted** to the right reasoning doc (global or local — same judgment call as snag→learning) → next `hadr` run is sharper.

- **The log-grill is a separate, explicitly-invoked mode** of the `hadr` command family. It **never auto-fires** at the start of an unattended run — auto-firing a human grill at the top of a walk-away command defeats the mode. You sit down to grill the log *when you choose to*.
- The log-grill is `adr`'s grill **run in reverse**: instead of grilling forward to produce an ADR, you grill backward over decisions already made; the output is reasoning-doc edits, not a new ADR.
- Consequence: the unattended run is only *half* of what `hadr` does. The command is really "the design-decision system"; unattended generation is one of its two faces.

### Stop taxonomy (hard-stop → human)
An unattended run handles the safe middle and hard-stops on exactly three things (shared logic: "when being wrong is expensive and I can't be confident, hand back"):
1. **Open snag** — known defect in an upstream doc. (pre-flight + mid-run)
2. **Template drift** — known defect in doc structure. (pre-flight)
3. **Low-confidence + high-blast-radius decision** — a foundational fork it shouldn't guess on. (mid-run)

Stops 1–2 are pre-flight; stop 3 can fire mid-run. A stop reaches the user via the **SMS bridge**, never by silently building on a broken foundation.

### Confinement — capability, not discipline (the load-bearing part)
**Verified against official docs:**
- A command/skill's `allowed-tools` is **pre-approval only — NOT a capability restriction.** Every tool stays callable; settings.json still governs. (So an `hdev.md` listing only `mcp__hwag__*` would NOT stop the orchestrator from calling native `Bash` — and `gh:*` is allowlisted, so merge would be reachable.)
- A **subagent's `tools:` field IS a hard capability gate, enforced by the harness.** Omitted tools are removed before the subagent sees them.

**Therefore:**
> The unattended work **cannot run in the main session.** It runs entirely inside a **spawned agent subtree** whose every node — lead *and* every teammate — carries a `tools:` allowlist of **only the `hwag` MCP server** (+ `Agent` on the lead, so it can spawn the team). That is a hard harness gate.

- `hadr` / `hdev` skills become **thin**: validate preconditions, spawn the confined lead agent, wait.
- "Only in the unattended mode" is automatic — only this subtree carries the restricted defs; the interactive session and `adr`/`dev` are untouched. No global settings change.
- Runs in the **normal interactive session** — **no `claude -p`, no external harness.**

### `hwag` — the MCP server (sole effector)
The confined subtree's *only* way to act. Exposes:
- **File ops** — reuse what the `fs` MCP already provides (read / write / edit / move / grep / etc.).
- **Guarded `run`** — toolchain bash the team legitimately needs: `git` branch/add/commit/push, `gh pr create`, test/build/lint. Validates each command against a **deny policy** and rejects `gh pr merge`, `git push origin main|master`, `rm -rf`, etc.
- **`ask` / `notify`** — the SMS human-bridge (see below).
- **Decision-log writer.**
- **No merge tool exists → merge is impossible by construction**, not by prompt discipline. (Today, `gh:*` is allowlisted, so the only thing protecting the merge gate is the command not issuing the merge — weak for an unsupervised run. `hwag` fixes this by *not having the capability*.)

### The SMS bridge
- **Primary path — `ask` blocks in-session and does the SMS round-trip inside one tool call.** Agent calls `ask` → `hwag` sends the SMS, **blocks polling its own inbox** for the reply → reply returns into the agent's context → agent continues. The "resume" is just the tool call returning. No relaunch, no `-p`, no detached process, no checkpoint dance.
- **Multi-turn discussion is supported by looping `ask`.** The agent is already a Claude instance, so it drives the conversation itself — no separate API call needed. Each SMS message = one `ask` round-trip; the **timeout is per-message** (resets each turn), so a ten-message back-and-forth works as long as each reply lands within the window. Cost = SMS messages (pennies) + marginal agent tokens. Termination is the agent's judgment ("ok, go" = done); user can always send "stop, do X".
- **`hwag` owns its own timeout, set safely below the harness ceiling**, and returns a graceful `"no answer → checkpoint and halt"` rather than letting the harness kill the call uncleanly.
- **Fallback (timeout / asleep):** the agent writes a checkpoint and exits cleanly; user **manually resumes** at the machine later. (Accepted: exact ceiling is UX tuning, not a design blocker.)
- **Ideal (deferred):** inbound-SMS auto-resume without returning to the machine — but that needs a relaunch mechanism (a harness), which is explicitly **out of scope**. v1 is block-in-`ask` + manual-resume fallback.
- **Ask-channel toggle (`--ask:session`).** `ask` is transport-agnostic; only delivery differs. `/wag:hadr --ask:session` (and `/wag:hdev --ask:session`) sets the run's channel to **`session`** — ask the human in-session — instead of the default **`sms`**. The session channel is for "launched headless, happen to be nearby, don't want SMS setup/cost." Implemented behind the same interface; the in-session path needs **MCP elicitation** (see V4).
- **Mid-run channel switch (not yet coded).** The launch flag sets the *initial* channel; you can flip it mid-run because the switch rides on the channel itself. (1) **Explicit:** reply to an ask with a control word (`→sms` / `→session`) → `hwag` mutates a server-side `currentChannel` for the rest of the run. (2) **Automatic:** a `session` ask that times out (you walked off) **escalates that question to SMS** before halting — silent hand-off, costing one session-window's delay. Requires: server-side mutable `currentChannel` (init from flag) + control-reply parsing + session→sms timeout fallback in the `ask` handler.

---

## 3. Components to build

| # | Component | Location (proposed) | Notes |
|---|-----------|---------------------|-------|
| A | `hwag` MCP server | TBD (decision D2) | fs ops + guarded `run` + `ask`/`notify` SMS + log writer. No merge tool. |
| B | Confined agent defs | `agents/wag/h*` (e.g. `hwag-lead.md`, `hwag-dev.md`, `hwag-tester.md`, `hwag-cq.md`) | `tools:` = `mcp__hwag__*` only (+ `Agent` on lead). MUST use the **enforcing** key (see V2). |
| C | `hadr` command | `commands/wag/hadr.md` | Thin: validate → spawn confined lead → self-play grill → log → PR. Plus on-demand log-grill mode. |
| D | `hdev` command | `commands/wag/hdev.md` | Thin: validate → spawn confined team → team flow minus merge gate. |
| E | Reasoning docs | global `~/.claude/wag/reasoning/` + local `.wag/reasoning/` (names TBD) | Initial scaffolds + format. |
| F | Decision-log format | `.wag/` per-run | Q / options / pick / justification / confidence. |
| G | settings.json | `~/.claude/settings.json` | Register `hwag` in `enabledMcpjsonServers`; allowlist `mcp__hwag__*`. |

---

## 4. Must-verify before relying on confinement

- **V1 (DONE):** `allowed-tools` (command/skill) = pre-approval only; subagent `tools:` = hard gate. ✅ Confirmed via official docs.
- **V2 (DONE):** ✅ Confirmed via official subagents docs. The enforcing key for subagents is **`tools:`** (hard allowlist; unlisted tools removed before the subagent sees them). **`allowed-tools:` does NOT exist in subagent frontmatter — it is silently ignored.** Confined variants MUST use `tools: mcp__hwag__*, Agent` (MCP wildcard is valid) + `permissionMode: dontAsk` as an extra layer. ⚠️ **Corollary:** the existing `wag-*.md` agents use `allowed-tools:`, so today's `adr`/`dev` teammates are NOT capability-confined — they rely on prompt discipline + file-ownership convention. Fine for attended mode; the reason headless needs the real gate. Supported subagent fields: `name, description, tools, disallowedTools, model, permissionMode, maxTurns, skills, mcpServers, hooks, memory, background, effort, isolation, color, initialPrompt`.
- **V3 (OPEN):** Confirm a spawned subagent can make a **blocking** MCP tool call that holds long enough to be useful (the SMS answer window), and find where the harness ceiling is (possibly tunable via an MCP-timeout config).
- **V4 (OPEN):** For the `--ask:session` channel — confirm Claude Code surfaces **MCP elicitation** prompts to the user, AND that it does so for a tool called from inside a *spawned subagent*. Confirm the elicitation API shape against `@modelcontextprotocol/sdk ^1.9` before wiring (do not guess). Until verified, `askInSession()` throws so a misconfigured `session` run fails loudly.
- **V5 (OPEN):** Confirm the exact **Agent-Team coordination tools** a confined lead needs to stand up + run the team (beyond `Agent`/`SendMessage`/`TaskUpdate` — possibly `TeamCreate`, `Monitor`, `TaskOutput`, `TaskStop`). The confined `tools:` allowlists must include whatever the team machinery requires or coordination silently breaks. The **security property is unaffected** either way (no `Bash` → no merge). Verify at dry-run (Step 9). **Fallback** if the allowlist proves too tight: switch the confined defs to `disallowedTools: Bash, Write, Edit, NotebookEdit` (denylist preserves all coordination tools, still removes the dangerous native effectors).

## 5. Open build-time decisions

- **D1 — DECIDED: Telegram Bot API.** Free; `getUpdates` long-poll *is* our block-and-poll `ask` (no webhook/harness). `TelegramMessenger` built in `src/sms.ts`. Remaining: user does one-time `@BotFather` setup → bot token + chat id → env `HWAG_TELEGRAM_TOKEN` / `HWAG_TELEGRAM_CHAT_ID` (wired at Step 8). Interface kept channel-neutral (`Messenger`) so Twilio / Android-gateway could swap in later.
- **D2 — `hwag` runtime & location.** Language (TS/Node likely, to match `fs` MCP patterns), where the server lives, how it's registered.
- **D3 — Reasoning doc names/paths** (global + local) and initial seed content.

---

## 6. Build sequence (phased so every stop is coherent)

1. **Plan doc** (this file). ✅
2. **Scaffolding, no external deps:** reasoning-doc templates (global + local seeds), decision-log format spec. Pure markdown, committable, de-risks the design.
3. **`hwag` server skeleton:** project structure + tool stubs (`fs.*`, `run`, `ask`, `notify`, `log.write`) with the deny-policy for `run` and **no merge tool**. SMS stubbed behind an interface until D1.
4. **Confined agent defs (B)** using the verified enforcing key (V2).
5. **`hdev` command (D)** — thinnest, reuses the existing team flow minus merge gate.
6. **`hadr` command (C)** — self-play grill + log + on-demand log-grill mode.
7. **Wire SMS provider (D1)** into the `ask`/`notify` stubs.
8. **settings.json registration (G).**
9. **End-to-end dry run** on a throwaway PBI.

---

## 7. Progress tracker  ← RESUME HERE

- [x] Step 1 — Plan doc written (`wag/designs/hwag-headless-mode.md`)
- [x] Step 2 — Reasoning-doc templates + decision-log format spec
  - global seed: `wag/reasoning/global.md` (G-001..003)
  - local template: `wag/templates/reasoning-local.md`
  - decision-log template: `wag/templates/decision-log.md` (encodes the low-confidence+high-blast-radius → escalate stop rule)
- [x] Step 3 — `hwag` server skeleton at `mcp-servers/hwag-mcp/`
  - `package.json`, `tsconfig.json` (mirror fs-mcp: ESM, SDK ^1.9, zod, tsc→dist)
  - `src/policy.ts` — run validator: no-chaining gate + denylist (merge / push-main / force / rm -rf) + allowlist (git/gh/build/test). **Security core.**
  - `src/sms.ts` — `SmsProvider` iface + `StubSmsProvider` (degrades to no-answer→halt) + ask-channel toggle + `askInSession` stub (throws pending V4)
  - `src/index.ts` — tools `run` / `ask` / `notify` / `log_decision` / `checkpoint`. **No merge tool exists.**
  - ⏳ NOT yet: `npm install` + `npm run build` (deps not installed — `process` type error until then); mid-run channel switch not coded; D1 provider + V4 session channel stubbed.
- [x] Build-verify — `npm install` + `npm run build` clean; `dist/{index,policy,sms}.js` emitted. Server compiles.
- [x] D1 — Telegram chosen; `TelegramMessenger` implemented (send + getUpdates poll). Needs user's bot token + chat id at Step 8.
- [x] Step 4 — Confined agent defs in `agents/wag/`:
  - `hwag-architect.md` (lead, opus) — `tools: Read,Grep,Glob, mcp__fs__*, mcp__hwag__*, Agent, SendMessage, TaskUpdate`. Serves both modes (hadr self-play design + hdev team lead). Hard-stop/escalate/no-merge rules baked in.
  - `hwag-dev.md` (sonnet) — fs write + hwag, no Agent. No quality shortcuts.
  - `hwag-cq.md` (opus) — **NO fs grant → cannot write, capability-enforced read-only**; runs checks via `hwag.run`; detects lint cheats + hard-fails.
  - `hwag-tester.md` (sonnet) — fs write (tests/) + hwag.
  - All `permissionMode: dontAsk`. No `Bash`/`Write`/`Edit` anywhere → merge impossible. (Coordination tools = V5.)
- [x] Step 5 — `/wag:hdev` at `commands/wag/hdev.md` — thin: main-session pre-flight (snag/ADR/branch) → spawn confined `hwag-architect` (hdev mode) → surface PR or halt. `--ask:session` passed through.
- [x] Step 6 — `/wag:hadr` at `commands/wag/hadr.md` — two faces: unattended **design** (spawn confined lead → self-play → log → ADR+branch, no PR) + attended **`--grill-log`** (read log → reverse-grill → promote to reasoning/learnings).
- [x] Step 7 — folded into D1/build: `TelegramMessenger` done; only env wiring remains (Step 8).
- [~] Step 8 — registration DONE: `hwag` in `.mcp.json` (args roots `~/.claude` `~/source`; Telegram via `${HWAG_TELEGRAM_TOKEN}`/`${HWAG_TELEGRAM_CHAT_ID}` shell env — **never committed**); `fs`+`hwag` added to `enabledMcpjsonServers`; allowlisted `mcp__hwag__{run,ask,notify,log_decision,checkpoint}` + `mcp__fs__*` (needed because confined agents run `dontAsk`). **Remaining:** user finishes `@BotFather` → export the two env vars in shell profile → **restart Claude Code** (MCP servers spawn at session start).
- [ ] Step 9 — End-to-end dry run on a throwaway PBI (also resolves V3 timeout ceiling + V5 team-coordination tools).

**Current position:** Steps 1–6 complete; `hwag` compiles, agent defs + both commands written. Next: **Step 8** (register server + Telegram env — blocked on user's `@BotFather` token/chat-id), then **Step 9** dry run. Open polish: mid-run channel switch; verifications V3/V4/V5.
**Not yet committed.** On branch `dev`. Nothing pushed.
