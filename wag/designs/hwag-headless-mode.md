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
- [x] Step 8 — DONE. `hwag` in `.mcp.json` (roots `~/.claude` `~/source`; Telegram via `${HWAG_TELEGRAM_TOKEN}`/`${HWAG_TELEGRAM_CHAT_ID}` shell env — never committed); `fs`+`hwag` enabled; allowlisted `mcp__hwag__{run,ask,notify,log_decision,checkpoint}` + `mcp__fs__*` (confined agents run `dontAsk`). Bot `@Wag55Bot`, chat id `8689392547`; exports added to `~/.bashrc`. **Bridge verified end-to-end** — outbound send (bot→phone) and inbound reply (phone→bot via `getUpdates`) both confirmed. `TelegramMessenger.ask` drains to baseline offset before sending, so leftover test messages won't be mistaken for replies.
  - **Activation:** the current session predates the registration + env, so → **restart Claude Code** to launch `hwag` with the new config.
- [x] **Env-wiring bug found + fixed (2026-05-29, session de762c5e).** The Step-8 "bridge verified end-to-end" was a **curl test with the token pasted into the URL** (prior session f71ef2b0) — it proved the bot/token/chat-id/Telegram round-trip, but **never exercised the MCP-server-reads-env path**, which was broken: `.mcp.json` used `${HWAG_TELEGRAM_TOKEN}` expansion against Claude's *process* env, and the VSCode-extension launch (`…→sh→sh→sh→node→claude`) never sources `~/.bashrc` (hits the interactive guard at `~/.bashrc:8`, exports are at L137). So the live server got the **literal placeholder** as its token → `mcp__hwag__notify` returned Telegram **404**. **Fix:** the server now loads the secret itself via `node --env-file=${HOME}/.claude/mcp-servers/hwag-mcp/.env.local` (Node 20.20 ✓, no dep); `.env.local` holds the exports, is **gitignored** (`hwag-mcp/.gitignore` L4), never checked in; the `.mcp.json` `env` block was removed (a process-env var takes precedence over `--env-file`). **This also removes the launch-method constraint** — the server reads the file regardless of how Claude starts, so a normal (extension) restart works. Verified in isolation pre-restart: `node --env-file` loads a 46-char token + chat id. Commits on `dev`: `1c2f2b8` (gitignore guard), `ab9df4c` (env-file fix) — **not yet pushed**. The token also still lives in `~/.bashrc` (interactive shells / manual curl); de-dup later if desired.
- [x] **Env-fix verified on live server (2026-05-29, post-restart).** `pgrep -af hwag` shows the respawned process carries `--env-file=/home/samfr/.claude/mcp-servers/hwag-mcp/.env.local`; `.env.local` (104 B, mode 644) holds `HWAG_TELEGRAM_TOKEN` + `HWAG_TELEGRAM_CHAT_ID`. `mcp__hwag__notify` returned `sent` (NOT curl). `tg()` throws on any non-`ok` Telegram response (`sms.ts:37`), so `sent` proves Telegram returned `ok:true` — the placeholder-token 404 that masked the original bug would have thrown. **Real MCP-reads-env path proven.**
- [x] **Agent-discovery bug found + fixed (2026-05-29, post-restart session).** First attempt at the Step-9 capability gate failed: spawning `hwag-architect` via the Agent tool returned `agent type 'hwag-architect' not found`. Root cause (confirmed against official subagents docs via claude-code-guide): **`name:` is a REQUIRED frontmatter field with no filename fallback** — `.claude/agents/` IS scanned recursively (the `wag/` subdir is fine), but every `hwag-*.md` (and the older `wag-*.md`) was authored without `name:`, so the harness silently discarded them. Top-level `architect.md` worked only because it has `name: architect`. **Fix:** added `name:` to all four confined defs (`hwag-architect`, `hwag-dev`, `hwag-cq`, `hwag-tester`). **Registry loads at session start → requires a Claude restart to take effect** (same constraint class as the MCP env fix — can't hot-reload). ⚠️ **Latent, out-of-scope:** the attended `wag-*` agents also lack `name:`, so today's `/wag:dev` team-spawn is likely broken the same way — flagged to user, NOT fixed here (attended flow, separate concern).
- [ ] Step 9 — End-to-end dry run on a throwaway PBI (also resolves V3 timeout ceiling + V5 team-coordination tools). Bridge verified (above). **Blocked on restart** to pick up the `name:`-fixed agent defs (the confined subtree cannot spawn until the registry reloads). After restart: (a) capability-gate test by spawning the confined `hwag-architect` (no Telegram needed) — prove it has only `Read/Grep/Glob + mcp__fs__* + mcp__hwag__* + Agent/SendMessage/TaskUpdate`, no native Bash/Write/Edit; (c) the `ask`→Telegram→reply round-trip + V3 ceiling (needs user at phone — coordinate).
  - **(c) BLOCKED — second confinement-wiring bug found (2026-05-29, same session).** Fired one live `mcp__hwag__ask` from the confined architect with the user at their phone; it returned **`No such tool available: mcp__hwag__ask`** instantly (no Telegram sent, no block, no round-trip). Probing showed the confined agent resolved **only** its native baseline `Read/Grep/Glob/SendMessage` — **none** of `mcp__fs__*`, `mcp__hwag__*`, `Agent`, `TaskUpdate`. **Root cause (confirmed via claude-code-guide against official subagents docs):** listing an MCP server's tools in a subagent's `tools:` allowlist is **not sufficient** — the server must ALSO be declared in an **`mcpServers:`** frontmatter field, or it isn't connected and its tools never resolve. The Step-4 defs were authored without `mcpServers:`, so the whole `fs`+`hwag` effector surface was absent → hadr/hdev non-functional as built. (Subtlety: this is the real reason the earlier probe "couldn't see" the MCP tools — NOT deferred-loading as first assumed; the (a) caveat is superseded.) **Fix staged (this session):** added `mcpServers:` to all four confined defs — `[fs, hwag]` on architect/dev/tester, `[hwag]` only on cq (read-only by design, no fs). `tools:` wildcards left as-is for now; **cq already uses explicit `mcp__hwag__*` tool names**, so post-restart it's a natural control for whether wildcards ALSO need expanding. **Same registry-reload constraint → needs ANOTHER restart before (c) can be retried.** Not yet committed.
  - **⚠️ V5 design risk surfaced (2026-05-29).** Per the official subagents docs (via claude-code-guide), **`Agent` is among the tools NOT available to subagents even when listed in `tools:` — "subagents cannot spawn other subagents."** If that holds in this teams-enabled harness, the confined `hwag-architect` (itself a subagent) **could not stand up the dev/cq/tester team**, breaking the `hdev` model (doc §"+ `Agent` on the lead so it can spawn the team"). **Unverified in THIS harness** (agent-teams ARE enabled here — `SendMessage`/team spawning exist — so the docs' blanket claim may not apply to teams mode). **Does NOT affect `hadr` (architect runs solo) or the ask test.** Decision deferred to user: left `Agent` in the architect def; V5 to be settled empirically by an actual `hdev` team spawn after the `mcpServers:` fix lands. The security property (no native effectors → no merge) is unaffected either way.
  - **(a) PASSED (2026-05-29, post-name-fix restart, session this one).** `Agent` resolved `hwag-architect` → **`name:` fix confirmed live** (registry reload took). Spawned with a pure introspection/probe prompt: agent returned `tool_uses: 0` — it had **no `Bash` function to invoke at all** (not a runtime refusal; the tool is absent from its schema). Self-confirmed **NO `Bash`/`Write`/`Edit`/`NotebookEdit`**. **Merge-impossible-by-construction holds** (hard `tools:` gate per V2). ⚠️ **Caveat on introspection limits:** a subagent can only prove a tool's *absence* (by having nothing to call); it canNOT reliably *enumerate* its deferred MCP/coordination tools — the probe agent couldn't "see" `mcp__fs__*`, `mcp__hwag__*`, `Agent`, or `TaskUpdate` in its visible schema despite the def granting them (deferred-tool loading, same as main session). **Consequence: V5 (team-coordination tools actually work) is NOT provable by introspection — only by a real `hdev` team spawn.** The *security* property (no native effectors → no merge) is fully confirmed regardless. **Note:** `hadr` runs the architect *solo* (self-play), so **V5/team-coordination is exercised by `hdev`, not `hadr`.** **Target DECIDED (user, 2026-05-29): `~/source/cmn-payonward-portal`, PBI `000.004`** — a dummy "liveness health endpoint" PBI added to `epic-000-general` (committed `329d3c7` on that repo's `dev`). cmn-payonward-portal already uses the per-epic `EEE.PPP` scheme (`coin-bounce`/`cs-bounce` are still flat `PBI-NNN` → would mismatch), is on `dev`, clean, no open snags, no active ADR → clean hadr pre-flight. The PBI is tiny + self-contained (`GET /api/health` → `{status:"ok"}`) so `hdev` can carry it to a PR.

  - **(b) PASSED + (c) PASSED (2026-05-29, post-`mcpServers:`-fix restart, this session).** The `mcpServers:` fix (committed `c9a6728`) took. **(b)** Spawned the confined `hwag-architect` and had it *actually call* MCP tools (not just introspect): `mcp__fs__fs_read` returned file content ✅; `mcp__hwag__run` reached its policy layer ✅. Both **wildcard** grants (`mcp__fs__*`, `mcp__hwag__*`) resolve — no need to expand to explicit names. All 5 hwag tools visible (`run`/`ask`/`notify`/`log_decision`/`checkpoint`), all `mcp__fs__*` visible. **No native `Bash`/`Write`/`Edit`/`NotebookEdit`** — confinement still holds. The earlier "No such tool available" is fully resolved. **(c)** Fired ONE live `mcp__hwag__ask` from the confined agent with the user at their phone — it **blocked, polled Telegram, the user replied "Looks good", and the reply landed back in the agent's context intact** (~20s round-trip). **V3 ask-bridge CONFIRMED.** Harness tool-call ceiling is ≥ the observed block; exact ceiling unprobed (would need a no-reply test) but per design that's UX tuning, not a blocker (`HWAG_ASK_TIMEOUT_MS` default 240s).
  - **Two side-findings from the (b) probe.** (1) **Git-command form:** `mcp__hwag__run` rejects git's global-option form (`git -C <path> status`) because the allowlist reads `-C` as the command — but plain `git status` + the required `cwd` param executes fine (`exit 0`). NOT a real bug (cwd is mandatory in the run schema). Hardened anyway: added an operating-rule line to `hwag-architect.md` telling the agent to lead with the bare tool name + use `cwd`, never inline `-C`. **(NB: agent-def edits load at session start → not live until next restart; live hadr this session uses the pre-edit def, which is fine since the architect uses `cwd` naturally.)** (2) **🟡 V5 signal:** `Agent` is listed in the architect's `tools:` but is **absent from its callable schema** (so is `TaskUpdate`; only `SendMessage` of the 3 coordination tools resolved) — consistent with the docs' "subagents cannot spawn subagents." **Caveat:** introspection can't reliably enumerate deferred/coordination tools, so this is *suggestive, not conclusive*; the real settling move remains an actual `hdev` team spawn. Does NOT affect `hadr` (solo).

**Current position:** Steps 1–8 complete. **Step 9 (a) capability gate PASSED, (b) `mcpServers:` MCP-resolution PASSED, (c) ask-bridge round-trip PASSED (V3 confirmed live).** The two wiring bugs (missing `name:`, missing `mcpServers:`) are both fixed and confirmed live. **Next: the full unattended design run — `/wag:hadr 000.004` on `~/source/cmn-payonward-portal`** (solo architect, no team → V5 not exercised here). **Then, if hadr holds: `/wag:hdev` for the V5 team-coordination test** — watch whether the confined architect can spawn the dev/cq/tester team given the `Agent`-absent signal; fallback is `disallowedTools: Bash,Write,Edit,NotebookEdit` (denylist preserves coordination tools). Open polish: mid-run channel switch; verifications V4 (`--ask:session`), V5 (team spawn), exact ask ceiling.
**Committed:** `dev` @ `b73e21c` (`feat(wag): add headless mode …`), then `1c2f2b8` + `ab9df4c` (env-file fix), `b5e4a06` (`name:` fix), `c9a6728` (`mcpServers:` fix). `dist/` is gitignored (repo convention — built locally; exists on this machine). `LEARNING-009.md` left untracked intentionally (unrelated to hwag — handle separately).
