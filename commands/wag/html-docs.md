---
description: Refresh all polished HTML renders — runs /wag:html-prd, /wag:html-architecture, and /wag:html-backlog in sequence
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG HTML Docs — Refresh all rendered HTML

Runner that refreshes every doc with a per-doc render command. Today that's three docs: PRD, Architecture, and Backlog. As new `/wag:html-*` siblings are added, register them here.

The runner does no rendering itself — it invokes each sub-command in turn so the user gets a coordinated refresh in one go. Each sub-command performs its own survey, theme detection, baseline diff, and write.

## Phases

For each sub-command below, run the full set of phases described in that command's file. The user is in a single conversation; pass through each command's output and let the user steer diagram reviews as they come up.

1. **`/wag:html-prd`** — read `~/.claude/commands/wag/html-prd.md` and execute its phases on `.wag/docs/PRD.md` → `.wag/docs/PRD.html`.
2. **`/wag:html-architecture`** — read `~/.claude/commands/wag/html-architecture.md` and execute its phases on `.wag/docs/Architecture.md` → `.wag/docs/Architecture.html`.
3. **`/wag:html-backlog`** — read `~/.claude/commands/wag/html-backlog.md` and execute its phases on `.wag/backlog/` → `.wag/docs/Backlog.html`.

## Source files

Before invoking, optionally fast-scan to skip docs that have no work to do:

- For PRD and Architecture: if the `.md` is unchanged since the last `.html` commit (Shared-2 diff returns no changed sections), tell the user "PRD is up to date" (or "Architecture is up to date") and skip rather than running the full survey.
- For Backlog: if no file under `.wag/backlog/` has changed since the last `Backlog.html` commit, same — tell the user "Backlog is up to date" and skip.

Skipping is a courtesy, not a hard short-circuit. If the user invokes `/wag:html-docs` explicitly, they may still want the run; ask before skipping if any doc was nearly stale.

## Summary

At the end, give the user a single combined report:

- PRD: rendered / preserved / skipped
- Architecture: rendered / preserved / skipped
- Backlog: rendered / preserved / skipped
- Theme source used
- Any docs that need committing for the next refresh to have a baseline

Remind the user to commit the changed `.html` files together with whatever Markdown changes drove the refresh.

## Key rules

1. **The runner is just orchestration.** All rendering logic lives in the per-doc commands.
2. **Each sub-command's output is shown to the user.** The runner doesn't suppress prompts — diagram reviews happen as they would if the user invoked the sub-command directly.
3. **Adding new docs** (e.g., a future `Roadmap.html`) means adding a new `/wag:html-*` command, then appending it to this runner's phase list.
