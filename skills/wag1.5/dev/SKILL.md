---
name: dev
description: Development mode — implement the active ADR. All changes stay uncommitted until gates pass and user approves.
disable-model-invocation: true
allowed-tools: Read Grep Glob Bash(cat *) Bash(ls *) Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git checkout *) Bash(git pull *) Bash(git push *)
---

# WAG DEV — Development Mode

Implement the active ADR. All changes stay uncommitted until gates pass.

## Current State

### Branch & Checkout
!`git checkout dev 2>&1 && git pull 2>&1 || echo "⚠️ checkout/pull failed — see above"`

### App
!`basename "$(pwd)"`

### Active ADR
!`cat .wag/adr/active/PBI-*-ADR.md 2>/dev/null || echo "⚠️ No active ADR found. Run /adr first."`

### Current Diff
!`git diff --stat 2>/dev/null || echo "Clean working tree"`

---

## Critical Rules

1. **Use Write/Edit directly. Do not ask before writing. The popup is the approval.** Do not ask in text AND show the popup — that's double-asking.
2. **All new code must have tests** — every PBI/ADR includes test coverage requirement. This is judgment work — evaluate what needs testing.
3. **All changes stay uncommitted** — no local commits during dev. Git commit is not in your allowed-tools. The permission popup gates it.
4. **Git push is pre-approved** — implicit after the user has approved the commit via popup.

---

## On Entry

1. Checkout and pull are already done (see injected state above).
2. Verify ADR exists in the injected state. If no ADR, tell the user to run `/adr` first.
3. Read the ADR requirements.
4. Create an implementation plan — what you'll build, in what order, and why that sequence.
5. Show the plan to the user. Wait for approval before writing code.

---

## Development Phase

- Follow ADR requirements.
- Write tests as specified in ADR.
- Use Write/Edit tools directly — the popup is the approval mechanism.
- **All changes stay uncommitted** — no local commits during dev.

---

## Gate Check

When dev work is complete, run the gate:

```bash
bash ~/.claude/skills/wag1.5/dev/scripts/gate.sh
```

This runs lint → tests → build in sequence. If any step fails, output shows which step and why.

**If gate passes:** spawn the architect agent for code review.

**If gate fails:** show the failure to the user. Fix what's needed, then re-run the gate.

### Architect Review (only if lint/tests/build all pass)

Spawn the architect-1.5 agent:

```bash
claude --agent architect-1.5 --prompt "Review this changeset."
```

The architect-1.5 agent uses dynamic injection to load the diff and ADR automatically. It returns APPROVE or REJECT with feedback. If rejected, fix and re-run the gate.

### Report to User

Show all results: lint, tests, build, architect feedback. Wait for user approval.

---

## On Complete (all gates pass + user approves)

1. **Mark checkboxes** on both ADR and PBI — read them, evaluate which criteria are met, check the boxes. This is judgment work.
2. **Run the on-complete script:**

```bash
bash ~/.claude/skills/wag1.5/dev/scripts/on-complete.sh
```

This handles: move ADR to completed, move PBI to completed, stage everything, commit, and push. One user approval (the commit popup) triggers all of it.

---

## Git Rules

- Commit format: `[type]: [description]`
- AI cannot: push to main, force push, commit during dev phase
