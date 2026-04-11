---
name: docs
description: Documentation mode — update PRD, Architecture, decisions, and backlog PBIs. Use when defining product requirements, making architectural decisions, or managing the backlog.
disable-model-invocation: true
allowed-tools: Read Write Edit Grep Glob Bash(cat *) Bash(ls *) Bash(git checkout *) Bash(git pull *) Bash(git add *) Bash(git commit *) Bash(git push *) Bash(git branch *) Bash(git status *) Bash(git diff *)
---

# WAG DOCS — Documentation Mode

Update PRD, Architecture, and backlog PBIs.

## Pre-check
!`if [ ! -f ".wag/docs/PRD.md" ]; then echo "⚠️ No PRD.md found. Run /init first to create project infrastructure."; fi`

If no PRD exists, inform the user and stop. PRD is created by `/init`.

## Current State

### Branch & Checkout
!`git checkout dev 2>&1 && git pull 2>&1 || echo "⚠️ checkout/pull failed — see above"`

### App
!`basename "$(pwd)"`

### Active ADR
!`ls .wag/adr/active/ 2>/dev/null || echo "None"`

### Current PRD
!`head -20 .wag/docs/PRD.md 2>/dev/null || echo "No PRD.md found"`

### Current Backlog
!`ls .wag/backlog/*.md 2>/dev/null | grep -v _completed || echo "No PBIs in backlog"`

---

## Critical Rules

1. **Only the user switches modes** — never auto-transition. Stay in docs until user runs another command.
2. If `adr/active/` has an ADR → user probably hit a problem in DEV. Discuss what went wrong.

---

## Collaborative Workflow

- **As PM:** Define product vision, requirements, user stories.
- **As Architect:** Make technical decisions, define patterns.
- Discuss first, document in PRD/Architecture, get approval, THEN add to backlog.

---

## On Exit

If any docs were modified, commit and push:

```bash
git add .wag/
git commit -m "docs: [description of what changed]"
git push origin $(git branch --show-current)
```

Stay in DOCS mode until user runs another command.

---

## Git Rules

- Commit format: `[type]: [description]`
- AI cannot: push to main, force push
