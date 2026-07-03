---
description: Set the active project for proj:* commands
---

# proj:use — Set the Active Project

The `proj:*` command family acts on a project from outside it (merge its PRs, push, sweep status). Rather than naming the project on every command, `proj:use` establishes the active project once; every other `proj:*` command defaults to it. A command may still name a project explicitly to override for that one invocation.

## Resolution — dynamic, no registry

Projects live at `~/source/<name>`. To resolve a name:

1. The directory `~/source/<name>` must exist and contain a git repo.
2. The GitHub `owner/repo` comes from the origin URL in `~/source/<name>/.git/config` (handle both `git@github.com:` and `git@github.com-personal:` host forms).

## State

`~/.claude/proj/current` — the active project's short name, one line, gitignored. Other `proj:*` commands read it when invoked without a project argument.

## With an argument: `/proj:use <name>`

1. Resolve `<name>` per above.
2. **Resolves** → Write the name to `~/.claude/proj/current`. Confirm in one line: name, `owner/repo`, path.
3. **Doesn't resolve** → Say why (no such folder, or no git repo/origin) and list the folders under `~/source` that do resolve.

## Without an argument: `/proj:use`

Show the current project (from the state file, or "none set") and list the folders under `~/source`. Change nothing.