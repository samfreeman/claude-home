---
description: Show all WAG commands and usage guide
allowed-tools: Read, Bash
---

# WAG Help

Show available WAG commands and their usage.

## Commands

| Command | Description |
|---------|-------------|
| `/wag:help` | Show this help |
| `/wag:create-nextjs` | Create a new Next.js app with baseline deps, optional layers, and git |
| `/wag:add-db` | Add Turso/Kysely database layer |
| `/wag:add-auth` | Add BetterAuth authentication (requires database) |
| `/wag:add-theme` | Add tweakcn theming and dark mode |
| `/wag:init` | Add planning infrastructure (intake → research → requirements → scaffold) |
| `/wag:docs` | Refine PRD/Architecture, author epics and PBIs |
| `/wag:html-docs` | Runner — refresh every standalone-HTML render (PRD, Architecture, Backlog) in sequence |
| `/wag:html-prd` | Render `PRD.md` as polished HTML |
| `/wag:html-architecture` | Render `Architecture.md` as polished HTML |
| `/wag:html-backlog` | Render `.wag/backlog/` as polished HTML — epic + PBI accordions with filter pills and search |
| `/wag:gendocs` | Generate / refresh the in-app docs page (Next.js + ShadCN + Tailwind) — scaffolds route + bakes PRD/Architecture/Backlog/Updates into TSX |
| `/wag:adr` | Design a PBI — Architecture Decision Record with snag and learning awareness |
| `/wag:dev` | Implement the ADR — spawn an Agent Team (Architect, Dev, CQ, Tester) |
| `/wag:migrate-backlog` | One-time migration of a project's existing backlog to the per-epic numbering scheme |
| `/wag:audit` | Scan all projects against promoted learnings — compliance matrix |
| `/wag:apply` | Walk through audit gaps and apply fixes with user approval |
| `/wag:whatsnew` | Summarise WAG tooling changes since the last run (for collaborators pulling latest claude-home) |

## Typical flow

```
/wag:create-nextjs myapp     # scaffold app + optional layers + git
cd myapp
/wag:init                    # add .wag/ planning infrastructure
/wag:adr                     # design a PBI (creates feature branch)
/wag:dev                     # implement the ADR (Agent Team)
```

## During development

When you discover an upstream assumption is wrong, the active command (`/wag:docs`, `/wag:adr`, or `/wag:dev`) captures a snag inline and halts. The snag-resolution protocol (`~/.claude/wag/workflows/snag-resolution.md`) runs in-session — fix the doc, propagate updates to affected PBIs — before the halted command resumes. No separate snag command.

## Cross-project intelligence

```
/wag:audit                   # scan all projects against learnings
/wag:apply                   # fix gaps with user approval
```

The learning loop: snags become learnings, learnings become standards, standards are checked by audit, gaps are fixed by apply. New projects inherit learnings via init.

## Updating

```bash
npx wag-cc
```
