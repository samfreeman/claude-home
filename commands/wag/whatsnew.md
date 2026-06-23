---
description: Show what's new in WAG tooling since the last time this command was run
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG What's New

You are running the WAG whatsnew flow. This summarises changes to the WAG tooling itself (commands, templates, workflows, references) since the last time the user ran the command — so a collaborator who pulled the latest `claude-home` can quickly understand what was added or changed.

This is **read-only over the user's projects**. It only writes to `~/.claude/wag/whatsnew-state.json` (the persisted last-seen SHA).

## Scope of "what's new"

WAG tooling lives under two paths in `~/.claude/`:

- `commands/wag/` — slash command definitions (`*.md`)
- `wag/` — config, templates, workflows, references, projects/apply state

These are the only paths considered. Everything else in `claude-home` is out of scope for this command.

## Argument

`$ARGUMENTS` is an optional git ref or date expression used as the lower bound for the diff window.

- If empty, use the persisted `last_seen_sha` from `~/.claude/wag/whatsnew-state.json`.
- If the state file is missing or has no SHA, default to `7 days ago`.
- If provided, accept any of:
  - A commit SHA (full or short)
  - A relative date like `1 week ago`, `2026-05-01`, `yesterday`
  - A ref like `HEAD~20`, `main@{1.day.ago}`

When an explicit `$ARGUMENTS` is passed, **do not update the persisted state** — the user is asking a one-off question, not advancing their checkpoint.

## Flow

Run these steps in order.

### Step 1 — Resolve the lower bound

1. If `$ARGUMENTS` is non-empty, set `SINCE = $ARGUMENTS` and `EXPLICIT = true`.
2. Otherwise:
   - Read `~/.claude/wag/whatsnew-state.json` if it exists.
   - If it has a `last_seen_sha`, set `SINCE = <that sha>` and `EXPLICIT = false`.
   - If missing or empty, set `SINCE = 7.days.ago` and `EXPLICIT = false`. Tell the user: "First run — showing changes from the last 7 days."

### Step 2 — Verify we can run git

All git commands must run with `-C ~/.claude` so the command works regardless of the user's current working directory.

Check that `~/.claude` is a git repo:

```bash
git -C ~/.claude rev-parse --is-inside-work-tree
```

If this fails, tell the user: "`~/.claude` is not a git repository — this command needs git history to work." Then stop.

### Step 3 — Collect the commit list

```bash
git -C ~/.claude log --pretty=format:'%H%x09%s' "<SINCE>..HEAD" -- commands/wag wag
```

- If the output is empty, tell the user: "No WAG changes since `<SINCE>`." Then go to Step 7 (state update) and stop.
- Otherwise parse each line as `<sha>\t<subject>`.

### Step 4 — Collect changed files per commit

For each commit, run:

```bash
git -C ~/.claude show --name-status --pretty=format: <sha>
```

Each line is `<status>\t<path>` where status is `A` (added), `M` (modified), `D` (deleted), `R...` (renamed), etc. Only keep paths under `commands/wag/` or `wag/`.

You may run these in parallel via multiple Bash calls in one message.

### Step 5 — Categorise and enrich

Bucket every changed file into one of:

| Bucket | Paths |
|---|---|
| **New commands** | `commands/wag/*.md` with status `A` |
| **Changed commands** | `commands/wag/*.md` with status `M` |
| **Removed commands** | `commands/wag/*.md` with status `D` |
| **New / changed templates** | `wag/templates/*` |
| **New / changed workflows** | `wag/workflows/*` |
| **New / changed references** | `wag/references/*` |
| **Config / other** | anything else under `wag/` (e.g. `config.json`, `projects.json`, `apply-log.json`) |

For each **new command**, read the file and extract the `description:` frontmatter line so the report can show the one-line purpose. Skip this for changed commands (the commit subject is usually more informative).

### Step 6 — Print the report

Print one section per non-empty bucket, in the order above. Skip empty buckets entirely.

Format:

```
What's new in WAG since <SINCE> (<N> commits)

New commands
  /wag:whatsnew — Show what's new in WAG tooling since the last run
  /wag:gendocs  — Generate / refresh the in-app docs page

Changed commands
  /wag:docs   — sharpen epic definition (6ffe48a)
  /wag:adr    — per-epic PBI numbering (25ea1a4)

Templates
  + wag/templates/backlog-epic.md
  M wag/templates/prd.md

Workflows
  M wag/workflows/snag-resolution.md
```

Align the columns inside each section for readability. Use `+`, `M`, `-` for added/modified/deleted in non-command sections. Cite the short SHA only where it adds value (e.g. for changed commands, so a collaborator can `git show` it).

End the report with a footer:

```
<N> commits · <SINCE>..HEAD · run `git -C ~/.claude log <SINCE>..HEAD -- commands/wag wag` for full history
```

### Step 7 — Update state

If `EXPLICIT = false`, write the current HEAD SHA to `~/.claude/wag/whatsnew-state.json`:

```json
{ "last_seen_sha": "<current HEAD sha>", "last_seen_at": "<ISO timestamp>" }
```

Get the current SHA with:

```bash
git -C ~/.claude rev-parse HEAD
```

If `EXPLICIT = true`, do not touch the state file. Add one line to the report: "(state not updated — explicit ref was provided)".

## Key rules

- **Read-only over the world.** Only writes to `~/.claude/wag/whatsnew-state.json`. Never touches user projects, never modifies wag/ or commands/wag/.
- **Always use `git -C ~/.claude`.** The user may be in any directory.
- **No fabrication.** If a commit subject doesn't tell you what changed, say so — don't invent a summary from the file paths alone. The diff is one `git show` away if it matters.
- **Group, don't list every commit.** A reader wants the shape of the changes, not a raw commit dump. The footer points them at the raw log if they want it.
