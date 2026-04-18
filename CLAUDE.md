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

### 7. Don't Manufacture User Intent

Don't take questions or statements as user intent. Unless the intent is expressly given, do not manufacture it.

- A question is a question — answer it, don't treat it as a request to act.
- Don't paraphrase the user's position into claims they didn't make.
- Suggestions are fine — they help the user confirm whether I've understood. But offer them *as* suggestions and do not take action until told to do so.

When uncertain, ask — do not guess in the user's voice.

### 8. Let the Popup Ask

Never prose-ask for approval before a file change. Draft the change inline for review, then call the Edit/Write tool. The permission popup is the single approval point.

Why: the harness already prompts the user to approve or reject each tool call. Adding "OK to write this?" / "Shall I proceed?" in text on top of it creates two approvals for one change. The user has to say "yes" twice. Trust the popup.

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
