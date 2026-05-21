---
description: List all WAG commands
allowed-tools: Bash, Read
---

List every WAG command by reading `~/.claude/commands/wag/`.

Steps:
1. Run `ls ~/.claude/commands/wag/` to get every `.md` file.
2. For each file, read its frontmatter `description:` field.
3. Output a single markdown table — two columns, `Command` and `Description` — with one row per file. The command name is `/wag:<basename>` (drop the `.md`).
4. Sort rows alphabetically by command name.
5. No preamble, no trailing sections, no "typical flow" — just the table.

If a file has no `description:` in its frontmatter, show `—` in the Description column.
