---
name: lathe-orchestrator
description: Lathe orchestrator — manages project state, phase flow, grill master spawning, and push. Always loaded before any phase skill. Use when detecting Lathe project context or managing workflow state.
allowed-tools: Read Write Edit Grep Glob Bash Task
---

# Lathe — Orchestrator

Always loaded first. Every `/lathe:*` command reads this before reading its phase skill. No orchestrator, no Lathe.

---

## Startup Sequence

Every invocation runs this:

1. **Detect project.** Check cwd for `.lathe/`. Walk up if needed.
2. **No `.lathe/` found?** Ask the user what project we're working on. New project → run `/lathe:init`.
3. **Preconditions.** Check for `turso` CLI (`which turso`). Check for `~/.claude/lathe.env`. If either is missing, stop and tell the user what to install/create.
4. **Connect to Turso.** Source `~/.claude/lathe.env` for `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Read state for this project.
5. **Freshness check.** Compare Turso `last_updated` against local `.lathe/.last_sync`.
   - Turso newer → "Changes from another machine. Pull first."
   - Local newer → "Local changes haven't synced. Something went wrong."
   - Match → proceed.
5. **`/lathe` alone?** Show status, recommend next phase, stop.
6. **`/lathe:*` phase?** Orchestrator is loaded — phase skill takes over for beats 1-3.

---

## Turso State

State lives in Turso, not files. Keyed by project.

```sql
CREATE TABLE lathe_state (
  project TEXT PRIMARY KEY,
  current_phase TEXT,
  active_pbi TEXT,
  active_epic TEXT,
  trust_init INTEGER DEFAULT 5,
  trust_backlog INTEGER DEFAULT 5,
  trust_architecture INTEGER DEFAULT 5,
  trust_adr INTEGER DEFAULT 5,
  trust_dev INTEGER DEFAULT 5,
  trust_retro INTEGER DEFAULT 5,
  upstream_dirty INTEGER DEFAULT 0,
  last_updated TEXT
);
```

Trust is N — the trust dial per phase. High = show all signals. Low = self-correct silently. Starts at 5. User adjusts over time.

### Local Sync

`.lathe/.last_sync` — a single timestamp written alongside every Turso update. The freshness check compares these two values. If they don't match, something happened on another machine.

---

## Push Ownership

Inside a Lathe project, push goes through the orchestrator. No end-runs.

Push is one operation with compensation:
1. `git push`
2. If push succeeds → write Turso state (phase, PBI, timestamp)
3. If Turso write succeeds → write local `.last_sync`
4. If git push fails → stop, nothing else happens
5. If Turso write fails → push already happened, flag inconsistency. Freshness check catches it on next startup.

The `/push` command should check for `.lathe/` in the repo root. If present, refuse and tell the user to go through Lathe. Pushing the `~/.claude` repo (skill changes) is separate — not a Lathe concern.

---

## Phase Flow

```
Init → Backlog → Architecture → ADR → Dev → Retro
                                  ↑              │
                                  └──────────────┘
                                  (next PBI)
```

- Architecture can patch PRD → orchestrator sets `upstream_dirty`, re-runs backlog before next ADR.
- ADR can push back upstream → orchestrator handles re-sequencing.
- Retro feeds technical PBIs back to backlog.
- Only the user advances phases. Orchestrator recommends, never auto-transitions.

---

## Grill Master (Beat 4)

After every phase completes beats 1-3, the orchestrator spawns a grill master subagent using the Task tool.

The grill master gets:
- The phase that just completed
- All inputs the phase read
- All outputs the phase produced
- Evaluation criteria for this phase (from `~/.claude/skills/lathe-grill-master/prompt.md`)

The grill master returns:
- **Signal:** green, yellow, or red
- **Capture log:** what it found, what changed

### Signal Handling

**Green (N > 0):** Show the human: "✅ [phase] green. [summary]." Write event. Recommend next phase.

**Green (N = 0):** Write event silently. Proceed.

**Yellow (any N):** Show the human what the grill master found and what the phase agent self-corrected. Write event + capture. Human approves, modifies, or takes over. On approval, signal becomes green.

**Red (any N):** Show the human what's wrong and why the agent couldn't self-correct. Write event + capture. Human resolves — modify, take over, or push back upstream. Pushing upstream sets `upstream_dirty`.

---

## Events

Every phase completion writes a BOD-shaped event to `.lathe/events/`:

```json
{
  "timestamp": "ISO-8601",
  "phase": "init|backlog|architecture|adr|dev|retro",
  "pbi": "PBI-NNN or null",
  "signal": "green|yellow|red",
  "summary": "One-line description",
  "capture": "path to capture log if non-green"
}
```

Filename: `[timestamp]-[phase]-[signal].json`

BOD-shaped — when Lathe migrates onto BOD, this is a storage layer swap.

---

## `.lathe/` Directory

```
.lathe/
├── .last_sync
├── docs/
│   ├── PRD.md
│   ├── RESEARCH.md
│   └── Architecture.md
├── backlog/
│   ├── epic-NNN.md
│   ├── PBI-NNN.md
│   └── _completed/
├── adr/
│   ├── active/
│   └── completed/
├── events/
├── captures/
└── wiki/
    └── index.md
```

---

## Status Display

`/lathe` alone shows:

```
⚙️ LATHE: [project name]
📍 Phase: [current_phase]
📍 Epic: [active_epic or "—"]
📍 PBI: [active_pbi or "—"]
🔧 Trust: init=[N] backlog=[N] arch=[N] adr=[N] dev=[N] retro=[N]
⚠️ Upstream dirty: [yes/no]
→ Recommended: [next action]
```

---

## Context Header

Every response inside a Lathe project includes:

```
⚙️ LATHE: [PHASE] ([project])
📍 PBI: [active PBI or "—"]
🎯 [what you're doing]
```
