# CLAUDE.md

## Mandatory Rules

### 1. Questions Get Answers, Not Actions

If the user's prompt contains a question mark, they are asking a question. Answer it. Do not write code, create files, or make changes — only research and respond. A `?` means the user wants understanding, not a solution.

### 2. All File Changes Require Diff Review

All file modifications must use the **Write** tool so the user can review diffs before approval.

- ✅ Use `Write` tool for all file changes
- ❌ Never use `Edit` tool (no diff shown to user)
- ❌ Never use bash commands to modify files (echo, sed, awk, etc.)

### 3. TypeScript/JavaScript Code Style

All `.ts`, `.tsx`, `.js`, `.jsx` files must follow the rules in `/home/samf/source/claude/documents/typescript-rules.md`

Key rules (see file for full details):
- Single quotes for strings
- Tabs for indentation (4 spaces wide)
- No semicolons
- No trailing commas
- `==` instead of `===`
- Single-statement blocks without braces
- else/catch on new lines

### 4. Never Use AskUserQuestion

Never use the AskUserQuestion tool. Just ask questions as plain text and let the user type their answer.

### 5. Never Commit to Main

Always commit to `dev`. Never commit or push directly to `main`. If the working directory is on `main`, stop and ask the user how to proceed.

### 6. Never Chain Git Commands

Run `git add`, `git commit`, and `git push` as separate Bash calls. Never combine with `&&` or `;`. The permission system handles commit approval.

---

## Git Commit Authorship

All commits must include:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Sam Freeman <sam.freeman.55@gmail.com>
```
