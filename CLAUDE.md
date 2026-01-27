# CLAUDE.md

## Mandatory Rules

### 1. All File Changes Require Diff Review

All file modifications must use the **Write** tool so the user can review diffs before approval.

- ✅ Use `Write` tool for all file changes
- ❌ Never use `Edit` tool (no diff shown to user)
- ❌ Never use bash commands to modify files (echo, sed, awk, etc.)

### 2. TypeScript/JavaScript Code Style

All `.ts`, `.tsx`, `.js`, `.jsx` files must follow the rules in `/home/samf/source/claude/documents/typescript-rules.md`

Key rules (see file for full details):
- Single quotes for strings
- Tabs for indentation (4 spaces wide)
- No semicolons
- No trailing commas
- `==` instead of `===`
- Single-statement blocks without braces
- else/catch on new lines

---

## Git Commit Authorship

All commits must include:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Sam Freeman <sam.freeman.55@gmail.com>
```