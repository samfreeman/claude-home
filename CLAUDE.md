# CLAUDE.md

## Mandatory Rules

### 1. Questions Get Answers, Not Actions

If the user's prompt contains a question mark, they are asking a question. Answer it. Do not write code, create files, or make changes — only research and respond. A `?` means the user wants understanding, not a solution.

### 2. No Bash File Modifications

Never use bash commands to modify files (echo, sed, awk, etc.). Use Edit or Write tools.

### 3. TypeScript/JavaScript Code Style

All `.ts`, `.tsx`, `.js`, `.jsx` files must follow the rules in `~/.claude/documents/typescript-rules.md`

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

### 6. Never Chain Bash Commands

Run each command as its own Bash tool call. Never combine with `&&` or `;`.

Why: the permission system approves per Bash call. Chaining collapses multiple commands into one approve/deny decision, so a sensitive command (`git push`, `rm`, `curl`) can ride in behind an innocuous one (`cd`, `ls`) without separate review. It's a safety seam, not a style preference.

---

## Knowledge Base

A personal wiki (kwiki) lives at `/mnt/c/Users/samfr/Dropbox/Claude/kwiki`. It follows the Karpathy LLM Wiki pattern — raw sources in, structured wiki pages out, with cross-references and an index.

- **Search it** with `/kwiki query [question]` when a topic might already be captured
- **Add to it** with `/kwiki ingest [source]` when we discover something worth keeping — a pattern, a decision rationale, a concept worth naming
- The wiki compounds over time. If a conversation produces a useful insight, offer to capture it.

---

## Git Commit Authorship

All commits must include:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Sam Freeman <sam.freeman.55@gmail.com>
```
