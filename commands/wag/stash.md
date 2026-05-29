---
description: Stash a thought, idea, or follow-up that surfaced mid-flow — captured fast, triaged later via /wag:docs
allowed-tools: Read, Write, Bash, Glob
---

# WAG Stash — Capture and Resume

A lightweight inbox for ideas, follow-ups, and open questions that surface during ADR or dev work. The goal is **fast capture without derailment** — you note the thought, the command writes a file, control returns immediately to whatever you were doing.

Stash items aren't PBIs (too heavy for raw thoughts), aren't snags (those halt work on purpose), and aren't learnings (those are portable rules). They're parked thoughts that get triaged later.

## Usage

```
/wag:stash "thing to consider later — one or many sentences"
/wag:stash               # no arg → asks once for the text, then captures
```

## Before you start

1. Confirm `.wag/` exists. If not, tell the user this command requires a WAG project (`/wag:init` first) and stop.
2. Do **not** halt on open snags. Stash is intentionally bypass-everything — capturing a thought during a snag-halted session is exactly the kind of moment this command exists for.

## Phase 1: Parse the input

If the user provided an arg, that's the thought verbatim — use it.

If no arg, ask once: *"What's the thought?"* Take the response verbatim. Don't grill, don't reformulate, don't ask follow-ups. The whole point is no derailment.

## Phase 2: Determine the next STASH number

Glob `.wag/stash/STASH-*.md`. Parse the numeric portion from each filename. Take the highest + 1, zero-padded to three digits. First stash is `001`.

If `.wag/stash/` doesn't exist, create it as part of the file write.

## Phase 3: Capture context

Best-effort context inference, all from local state — no questions to the user:

1. Read `.wag/state.json` for `active_epic`, `active_pbi`, `feature_branch`.
2. Check `git branch --show-current` to see which branch the user is on.
3. Look at `.wag/adr/active/` — is there an active ADR?

Build a short context line summarising where the user was. Examples:
- `Captured while: /wag:adr designing PBI 001.005 on feature/PBI-001.005`
- `Captured while: /wag:dev implementing PBI 002.003`
- `Captured on: dev branch, no active PBI`

## Phase 4: Write the file

Write to `.wag/stash/STASH-NNN.md`:

```markdown
# STASH-NNN: [first sentence or first 60 chars of the thought, as a title]

**Captured:** YYYY-MM-DDTHH:MM:SSZ
**Context:** [the context line built in Phase 3]

[The thought, verbatim. No reformulation, no extra structure.]
```

Title derivation: take the first sentence of the thought; if longer than 60 chars, truncate at the nearest word boundary and add `…`.

## Phase 5: Report and stop

One line back to the user:

> *"Stashed as `.wag/stash/STASH-NNN.md`. Resuming."*

Then stop. Do not summarise. Do not offer triage. Do not ask if there's more. The user was mid-flow — let them get back to it.

## Key rules

1. **Speed over ceremony.** The whole command is parse → infer context → write → done. If you find yourself drafting a third clarifying question, you've already failed the brief.
2. **Verbatim capture.** Whatever the user said is what gets stored. Don't "improve" it.
3. **No triage in this command.** Triage happens at `/wag:docs` time — that's where a stashed item becomes a PBI, gets folded into Architecture/PRD, or gets discarded.
4. **Stash files are immutable until triage.** Don't edit or merge stash items in this command. Each invocation creates a new numbered file.
5. **Never derails.** This command must work even when snags are open, an ADR is mid-flight, or `state.json` is in a weird state. Capture first, ask questions never.
