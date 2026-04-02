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

## Typical flow

```
/wag:create-nextjs myapp     # scaffold app + optional layers + git
cd myapp
/wag:init                    # add .wag/ planning infrastructure
```

`create-nextjs` handles app scaffolding, baseline deps (shadcn, mobx, zod, vitest, playwright), and asks which optional layers to add. It runs `/wag:add-db`, `/wag:add-auth`, and `/wag:add-theme` in the correct order based on your choices.

`init` runs four phases to create `.wag/` planning infrastructure:

1. **Intake** — capture your vision through conversation
2. **Research** — parallel investigation of ecosystem, feasibility, architecture patterns
3. **Requirements** — synthesise vision + research into scoped requirements
4. **Scaffold** — create `.wag/` with populated PRD, Architecture, and backlog

The add-* commands can also be run standalone on an existing project.

## Updating

```bash
npx wag-cc --global
```
