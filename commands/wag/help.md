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
| `/wag:adr` | Design a PBI — Architecture Decision Record with snag and learning awareness |
| `/wag:snag` | Capture a plan defect, resolve it, optionally promote to a learning |
| `/wag:audit` | Scan all projects against promoted learnings — compliance matrix |
| `/wag:apply` | Walk through audit gaps and apply fixes with user approval |

## Typical flow

```
/wag:create-nextjs myapp     # scaffold app + optional layers + git
cd myapp
/wag:init                    # add .wag/ planning infrastructure
/wag:adr                     # design a PBI (creates feature branch)
/wag:dev                     # implement the ADR (coming soon)
```

## During development

When you discover an upstream assumption is wrong:

```
/wag:snag                    # capture and resolve the plan defect
```

Snag resolution updates the impacted doc. If the learning applies across projects, promote it.

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
