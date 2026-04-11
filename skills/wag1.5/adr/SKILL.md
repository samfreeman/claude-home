---
name: adr
description: Architecture Decision Record — design the solution for a PBI. Use when planning implementation, discussing architecture, or preparing for dev work.
disable-model-invocation: true
model: claude-opus-4-20250514
allowed-tools: Read Grep Glob Bash(cat *) Bash(ls *) Bash(git branch *) Bash(git status *) Bash(git diff *) Bash(git log *)
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: |
            INPUT=$(cat)
            FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')
            if echo "$FILE" | grep -q '^src/'; then
              echo '{"decision":"block","reason":"ADR mode is for design, not implementation. Use /dev to write source code."}'
              exit 2
            fi
            exit 0
---

# WAG ADR — Architecture Decision Record

Design the solution for a PBI. No implementation — ADR mode designs, dev implements.

## Current State

### Branch
!`git branch --show-current`

### App
!`basename "$(pwd)"`

### Available PBIs
!`ls .wag/backlog/*.md 2>/dev/null | grep -v _completed || echo "No PBIs in backlog"`

### Active ADR
!`ls .wag/adr/active/ 2>/dev/null || echo "None"`

### Recent Architecture
!`head -50 .wag/docs/Architecture.md 2>/dev/null || echo "No Architecture.md found"`

---

## Critical Rules

1. **No implementation** — ADR mode designs. Source code writes are blocked by hook.
2. **Infrastructure (.wag/\*)** — Edit tool is fine for ADR and backlog files.
3. **Only the user switches modes** — never auto-transition. When done, say "ADR approved. Run `/dev` when ready to implement."

---

## On Entry

1. If `adr/active/` has an ADR → user probably hit a problem in DEV. Discuss what to do.
2. List PBIs from `backlog/`, recommend one based on dependencies.
3. Begin discussing the design with the user.
4. Create ADR as `adr/active/PBI-XXX-ADR.md` (draft) during discussion.

For PBI details, run: `bash scripts/pick-pbi.sh` from this skill's directory.

---

## ADR Content

Every ADR must include a **Testing** section specifying what tests to write and an acceptance criterion: `[ ] Tests written for new code`.

When you're ready to write the ADR file, load `adr-template.md` from this skill's directory for the template.

---

## On "Approve"

1. Finalize `adr/active/PBI-XXX-ADR.md`
2. Update Status.md
3. Commit and push:
   ```bash
   git add .wag/
   git commit -m "adr: PBI-XXX ADR approved"
   git push origin $(git branch --show-current)
   ```
4. **Stay in ADR mode** — inform user: "ADR approved. Run `/dev` when ready to implement."

---

## Git Rules

- Commit format: `[type]: [description]`
- AI cannot: push to main, force push
