---
description: Product development workflow - DOCS → ADR → DEV (with gate check)
allowed-tools: Read, Write, Grep, Glob, TodoWrite, Bash, Task
---

# WAG - Product Development Workflow

**Journey:** `/wag docs` → `/wag adr` → `/wag dev`

## Core Principle: Gate Before Commit

AI works on dev branch. All changes stay uncommitted until gates (lint/tests/build + architect + user) validate.

```
dev branch
    │
    │  AI writes code, user reviews each diff
    │  nothing is committed
    │
    └──► gate ──► user ──► commit + push
         (lint+tests+build+architect)  approves
```

## Critical Rules

1. **Source code (src/**)** → Use Write tool (user sees diff)
2. **Infrastructure (.wag/*)** → Edit tool is fine
3. **All code** → Follow `/home/samf/.claude/documents/typescript-rules.md`
4. **All new code must have tests** → Every PBI/ADR includes test coverage requirement
5. **Only the user can switch modes** → Never auto-transition between DOCS/ADR/DEV
6. **No commits during dev** → All changes stay uncommitted until gate passes and user approves

## Directory Structure

```
.wag/
├── state.json              # { app_name, current_mode, active_pbi }
├── Status.md
├── docs/
│   ├── PRD.md
│   ├── Architecture.md
│   └── decisions.md        # Decision log
├── backlog/                # PBIs as individual files
│   ├── PBI-001.md
│   ├── PBI-002.md
│   └── _completed/         # Done PBIs (moved here after merge)
└── adr/
    ├── active/             # 0 or 1 ADR (current work)
    │   └── PBI-XXX-ADR.md  # Named to match PBI
    └── completed/          # Done ADRs
```

---

## `/wag docs` - DOCS Mode

Update PRD, Architecture, and backlog PBIs.

**On entry:**
- Update state.json: `current_mode = "DOCS"`
- If `adr/active/` has an ADR → User probably hit a problem in DEV. Discuss what went wrong.
- Switch to dev branch, pull

**Collaborative workflow:**
- **As PM:** Define product vision, requirements, user stories
- **As Architect:** Make technical decisions, define patterns
- Discuss first, document in PRD/Architecture, get approval, THEN add to backlog

**On exit:**
- If any docs were modified → commit and push
- Stay in DOCS mode until user runs another command

---

## `/wag adr` - ADR Mode

Create Architecture Decision Record for a PBI.

**On entry:**
- Update state.json: `current_mode = "ADR"`, `active_pbi = "PBI-XXX"`
- If `adr/active/` has an ADR → User probably hit a problem in DEV. Discuss what to do.
- List PBIs from `backlog/`, recommend one based on dependencies
- Create ADR as `adr/active/PBI-XXX-ADR.md` (draft) while discussing with user

**ADR must include test requirements:**
- Every ADR must have a "Testing" section
- Specify what tests need to be written for new code
- Include acceptance criterion: `[ ] Tests written for new code`

**On "approve":**
1. Finalize `adr/active/PBI-XXX-ADR.md`
2. Update state.json and Status.md
3. Commit and push
4. **Stay in ADR mode** — Do NOT auto-transition to DEV
5. Inform user: "ADR approved. Run `/wag dev` when ready to implement."

---

## `/wag dev` - DEV Mode

### On Entry

1. Switch to dev branch and pull:
   ```bash
   git checkout dev && git pull
   ```
2. Update state.json: `current_mode = "DEV"`
3. Verify ADR exists in `adr/active/PBI-XXX-ADR.md`
4. Read ADR content
5. Create implementation plan
6. Begin implementation

### Development Phase

- Each file change → Write tool → user approves diff
- Follow ADR requirements
- Write tests as specified in ADR
- **All changes stay uncommitted** — no local commits during dev

### Gate Check (Before Commit)

When dev work is complete, run the gate in this order:

**1. Lint**
- Run lint (may auto-fix files)
- If lint changed files, re-stage them
- If lint errors remain → dev fixes, restart gate

**2. Tests**
- Run unit tests
- If fails → dev fixes, restart gate

**3. Build**
- Run build to verify the app compiles (catches missing references, type errors, etc.)
- If fails → dev fixes, restart gate

**4. Architect Review** (only if lint/tests/build all pass)
- Spawn architect agent with full `git diff`
- Architect reviews against ADR requirements
- Returns: APPROVE or REJECT + feedback
- If rejects → dev fixes, restart gate

**5. Report to User**
- Show lint/test/build results
- Show architect feedback
- Wait for user approval

**6. Evaluate**
- If any step failed → dev fixes, restart gate
- If user disapproves → dev fixes, restart gate
- All pass → proceed to commit and push

### Spawning the Architect Agent (Gate Check)

Use Task tool with:
```
subagent_type: "architect"
prompt: |
  Review this complete changeset before push to dev.

  ## Changes
  ```diff
  [git diff output]
  ```

  ## ADR Requirements
  [ADR content]

  ## Code Style Rules (apply to project src/ code only)
  For files in src/** (project source code):
  - Single quotes, no semicolons, tabs, no trailing commas
  - == not ===, else/catch on new lines

  Do NOT apply these style rules to:
  - Third-party code, vendor files, or node_modules
  - Generated files (e.g., package-lock.json, pnpm-lock.yaml)
  - Framework boilerplate or config files

  ## Review
  1. Does the changeset fulfill ADR requirements?
  2. Are there design concerns or missing pieces?
  3. Code style violations in project source code?

  Return: APPROVE or REJECT
  Then: Summary of findings (what's good, what needs work)
```

### On Complete (all gates pass + user approves)

Do all file changes first, then one commit, then push:

1. Mark criteria `[x]` on both ADR and PBI
2. Move `adr/active/PBI-XXX-ADR.md` to `adr/completed/`
3. Move `backlog/PBI-XXX.md` to `backlog/_completed/`
4. Clear state.json (mode=null, active_pbi=null)
5. Update Status.md
6. Stage everything and commit (single commit — code + state changes together)
7. Push:
   ```bash
   git push origin dev
   ```

---

## `/wag create [type] [app]` - Create or Initialize App

Works from any directory under `~/`. Detects the current state and does the right thing:

1. **cwd has `.wag/`** → already initialized, inform user
2. **cwd has `package.json` but no `.wag/`** → existing app, run `wag init`
3. **cwd is empty or has no app** → scaffold a new app:
   - If `[app]` name is provided → scaffold `[app]/` in cwd, cd into it, run `wag init`
   - If no app name → ask the user for one, then scaffold + init

### Scaffolding (when creating new):

1. Run framework scaffolder:
   ```bash
   pnpm create next-app@latest [app] \
     --typescript --tailwind --eslint --app --src-dir \
     --turbopack --import-alias "@/*" --use-pnpm --no-git --yes
   ```

2. cd into the new `[app]/` directory

3. Configure TypeScript rules (eslint.config.mjs, tsconfig.json)

4. Run `wag init`

---

## `/wag init` - Initialize Infrastructure

Operates on the current working directory. Reads the app name from the folder name.

1. Create `.wag/` directory structure
2. Create `state.json`: `{ "app_name": "[folder name]", "current_mode": null, "active_pbi": null }`
3. Create `Status.md`
4. Create `docs/` folder with playbook-informed templates:
   - `PRD.md` (see PRD template below)
   - `Architecture.md` (see Architecture template below)
   - `decisions.md` (empty decision log)
5. Create `backlog/` and `backlog/_completed/`
6. Create `adr/active/` and `adr/completed/`
7. Create `.claude/settings.local.json` with auto-approve permissions
8. Create `CLAUDE.md` with mandatory rules
9. Initialize git (main branch first, then dev)
10. Create README.md
11. Initial commit and push

### PRD Template

Generated by `wag init`. Sections pre-filled with playbook context where applicable.

```markdown
# [App Name] - Product Requirements Document

## Overview
[What the app does in 2-3 sentences.]

## Problem Statement
[Why this app exists. What pain does it solve.]

## Target Users
[Who uses this and how.]

## User Flow
[Step-by-step: what happens when the user interacts with the app.]

## UI Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Public landing page |
| `/sign-in` | Sign In | Email/password sign-in (invite-only, no self-registration) |
| `/reset-password` | Reset Password | Forced password reset on first login |
| `/dashboard` | Dashboard | Main authenticated view |
| `/settings` | Settings | User settings |
| `/admin` | Admin | Admin panel (role-gated) |

## Phased Development
[Phases with goals, deliverables, and success metrics. Each phase is independently demo-able.]

## Non-Goals
[What we're explicitly NOT building (yet).]

## Authentication
Invite-only via BetterAuth. Admin creates users, shares temporary credentials. Users must reset password on first login.

## Security Considerations
- Server actions validate auth + input on every call
- Middleware is a UX convenience redirect, not a security boundary
- No secrets in client code
- Environment variables for all credentials

## Success Metrics
[How we know it's working.]
```

### Architecture Template

Generated by `wag init`. Pre-populated with the standard stack and patterns from the SaaS playbook.

```markdown
# [App Name] - Architecture

## Overview
[One paragraph: what the app does and its core architectural pattern.]

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js (App Router) | Full-stack React. Server components, server actions, API routes, middleware. |
| **Language** | TypeScript | Every file is .ts or .tsx. |
| **Package Manager** | pnpm | Fast, disk-efficient, strict dependency resolution. |
| **Styling** | Tailwind CSS 4 | Utility-first. No custom CSS files unless absolutely necessary. |
| **Component Library** | ShadCN UI (canary) | Copy-paste components built on Radix primitives. You own the code. |
| **State Management** | MobX | Observable stores. Simple, reactive, no boilerplate. |
| **Forms** | React Hook Form + Zod | RHF handles form state, Zod validates. |
| **Validation** | Zod | Schema validation everywhere — forms, server actions, API boundaries. |
| **Database** | Turso (cloud SQLite) | Globally distributed SQLite. libsql client + Kysely query builder. |
| **Query Builder** | Kysely + kysely-libsql | Type-safe SQL. No ORM magic — you write queries, Kysely types them. |
| **Auth** | BetterAuth | Self-hosted auth with email/password, admin plugin, session management. |
| **Deployment** | Vercel | Git push = deploy. Branch-based environments. |
| **Unit Testing** | Vitest | Fast, native ESM, compatible with our stack. |
| **E2E Testing** | Playwright | Browser automation for critical user flows. |
| **Theming** | tweakcn + next-themes | tweakcn theme preset imported as dependency. next-themes handles light/dark toggle. |

## System Architecture — The Layer Cake

┌─────────────────────────────────────────────────────────┐
│  UI Layer (React Components + ShadCN)                   │
├─────────────────────────────────────────────────────────┤
│  State Layer (MobX Stores)                              │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Server Actions (Entry Point to Server)         │   │
│  │  - Authentication & Authorization               │   │
│  │  - Input validation (Zod)                       │   │
│  │  - Delegates to repositories                    │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Interface Layer (Repository Interfaces in types/)      │
├─────────────────────────────────────────────────────────┤
│  Infrastructure Layer (Turso repos, external APIs)      │
└─────────────────────────────────────────────────────────┘

## Architecture Patterns

1. **Interface-Based Design** — Define interfaces in types/, implement in infrastructure/. Business logic never touches Turso, Kysely, or any external service directly.
2. **Server Actions as Sole Write Path** — Every mutation goes through a server action in src/actions/. Components never call repositories directly.
3. **Server Actions Validate Internally** — Every server action validates input (Zod) and verifies session (BetterAuth) before doing anything.
4. **Technology Boundaries** — Business logic is technology-agnostic. If we swapped Turso for Postgres, only infrastructure/ changes.
5. **Repository Pattern** — All data access flows through repository interfaces. Factory functions in lib/repositories.ts construct concrete implementations.
6. **Action Wrapper Pattern** — authAction/adminAction wrappers handle auth, validation, and error handling consistently. Every action returns ActionResult<T>.

## Project Structure

src/
├── app/                          # Next.js App Router
│   ├── (public)/                 # Unauthenticated routes
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Landing page
│   │   └── sign-in/page.tsx
│   ├── (dashboard)/              # Authenticated routes
│   │   ├── layout.tsx            # Sidebar + header
│   │   ├── dashboard/page.tsx
│   │   ├── settings/page.tsx
│   │   └── admin/page.tsx
│   ├── reset-password/page.tsx   # Outside both route groups
│   ├── api/auth/[...all]/route.ts
│   ├── layout.tsx                # Root layout
│   └── globals.css
├── components/
│   ├── providers/                # ThemeProvider, StoreProvider
│   ├── dashboard/                # Sidebar, header, account dropdown
│   ├── features/                 # Business-specific components
│   └── ui/                       # ShadCN components (owned)
├── actions/                      # Server actions (sole write path)
├── stores/                       # MobX stores (root-store, feature stores)
├── types/                        # TypeScript interfaces (database, entities, repositories)
├── infrastructure/               # Concrete implementations (Turso repositories)
├── lib/
│   ├── action.ts                 # authAction/adminAction wrappers
│   ├── auth.ts                   # BetterAuth server config
│   ├── auth-client.ts            # BetterAuth client config
│   ├── db.ts                     # Turso/Kysely connection
│   ├── repositories.ts           # Repository factory functions
│   └── validations/              # Zod schemas per domain
├── hooks/                        # Custom React hooks
└── middleware.ts                  # Cookie check → redirect

## Database Schema
[Every table with CREATE TABLE statements and indexes.]

## Authentication
Invite-only via BetterAuth. Email/password with admin plugin. Session cookie cache (5 min). Forced password reset on first login. Middleware redirects unauthenticated users but is NOT a security boundary — server actions are.

## Environment Variables

| Variable | Description |
|----------|-------------|
| TURSO_APP_DATABASE_URL | Turso app database URL |
| TURSO_GROUP_AUTH_TOKEN | Shared auth token for Turso database group |
| BETTER_AUTH_SECRET | Random secret for BetterAuth sessions |
| BETTER_AUTH_URL | App URL (http://localhost:3000 in dev) |
| ADMIN_EMAIL | Email for seed admin account |

## Git Configuration
[Remote URL, user config.]

## References
- [PRD](./PRD.md)
- [Decision Log](./decisions.md)
```

---

## Context Header

Every response starts with:
```
🔧 **WAG: [DOCS/ADR/DEV] ([App Name])**
📍 **Application:** [app-name]
📍 **Branch:** [branch]
🎯 **Context:** [what you're doing]
```

---

## Git Workflow

**Branches:**
- `main` - Production
- `dev` - Integration branch (gate-checked before commit+push)

**Commit format:**
```
[type]: [description]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Sam Freeman <sfreeman@pay-onward.com>
```

**AI cannot:**
- Commit during dev phase (all changes stay uncommitted until gate passes)
- Push to dev without passing gate
- Push directly to main
- Force push

---

## Success Criteria

WAG is working if:
- Dev works on dev branch, changes stay uncommitted during development
- User reviews each file change via Write tool diffs
- Gate check validates before commit (lint → tests → build → architect → user)
- All must approve before code is committed and pushed
- typescript-rules.md violations caught by lint
- No commits or pushes without your final approval
