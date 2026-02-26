---
description: Initialize a new app — scaffold, install, configure WAG infrastructure
allowed-tools: Read, Write, Grep, Glob, TodoWrite, Bash, Task, AskUserQuestion
---

# WAG Init - App Initialization

One command to detect, scaffold, install, and initialize a WAG-managed app.

## Context Header

Every response starts with:
```
🔧 **WAG: INIT ([App Name])**
📍 **Application:** [app-name]
🎯 **Context:** [what you're doing]
```

---

## Critical Rules

1. **All file changes** → Use Write tool (user sees diff)
2. **All code** → Follow `~/.claude/documents/typescript-rules.md`
3. **No hardcoded paths** → Use `~` or relative paths, never `/home/...`

---

## State Contract

**File:** `.wag/state.json`
**Format:** `{ "app_name": string, "current_mode": string|null, "active_pbi": string|null }`

---

## Phase 1: Detection

Detect the current state of the working directory and branch accordingly:

1. **cwd has `.wag/`** → Already initialized. Inform user and stop.
2. **cwd has `package.json` with Next.js** → Existing Next.js app. Skip scaffold, proceed to Phase 3 (Baseline Install).
3. **Otherwise** → Need to scaffold. Proceed to Phase 2.

---

## Phase 2: Scaffold

Ask the user for an app name if not provided as an argument.

Show the full scaffold command and wait for approval before running:

```bash
pnpm create next-app@latest [app] \
    --typescript --tailwind --eslint --app --src-dir \
    --turbopack --import-alias "@/*" --use-pnpm --no-git --yes
```

After scaffold completes, cd into the new `[app]/` directory.

Configure TypeScript rules (eslint.config.mjs, tsconfig.json) per `~/.claude/documents/typescript-rules.md`.

---

## Phase 3: Baseline Install

These are always installed regardless of optional layer choices.

### Dependencies

```bash
# UI framework
pnpm dlx shadcn@canary init

# Base ShadCN components
pnpm dlx shadcn@canary add button card input label form \
    dropdown-menu sidebar sheet avatar badge separator \
    tooltip sonner

# State management
pnpm add mobx mobx-react-lite

# Validation
pnpm add zod

# Dev dependencies
pnpm add -D vitest @vitest/coverage-v8 @vitejs/plugin-react jsdom \
    @testing-library/react @testing-library/dom \
    @playwright/test tsx
```

### Scaffolded Code

Create these files with the baseline code (no auth variants yet):

**`src/lib/action.ts`** — Base action wrapper with Zod validation:

```typescript
'use server'

import { z } from 'zod'

export type ActionResult<T> =
	| { success: true; data: T }
	| { success: false; error: string }

export function action<TInput, TOutput>(
	schema: z.ZodType<TInput>,
	handler: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
	return async (input: TInput) => {
		const parsed = schema.safeParse(input)
		if (!parsed.success)
			return { success: false, error: parsed.error.issues[0].message }

		try {
			const data = await handler(parsed.data)
			return { success: true, data }
		}
		catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
```

**`src/stores/root-store.ts`** — Store composition root:

```typescript
export class RootStore {
	constructor() {
		// Add feature stores here as properties
	}

	async initialize() {
		// Initialize stores that need async setup
	}
}

let rootStore: RootStore | null = null

export function getRootStore(): RootStore {
	if (!rootStore)
		rootStore = new RootStore()
	return rootStore
}
```

**`src/components/providers/store-provider.tsx`** — MobX provider:

```typescript
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { RootStore, getRootStore } from '@/stores/root-store'

const StoreContext = createContext<RootStore | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
	const [store] = useState(() => getRootStore())
	const [isHydrated, setIsHydrated] = useState(false)

	useEffect(() => {
		store.initialize().then(() => setIsHydrated(true))
	}, [store])

	if (!isHydrated)
		return null

	return (
		<StoreContext.Provider value={store}>
			{children}
		</StoreContext.Provider>
	)
}

export function useRootStore() {
	const store = useContext(StoreContext)
	if (!store)
		throw new Error('useRootStore must be used within StoreProvider')
	return store
}
```

**`vitest.config.ts`**:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
		setupFiles: ['./tests/setup.ts']
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	}
})
```

**`tests/setup.ts`**:

```typescript
import '@testing-library/jest-dom/vitest'
```

**`playwright.config.ts`**:

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	use: {
		baseURL: 'http://localhost:3000'
	},
	webServer: {
		command: 'pnpm dev',
		url: 'http://localhost:3000',
		reuseExistingServer: !process.env.CI
	}
})
```

Add test scripts to `package.json`:

```json
{
    "scripts": {
        "test": "vitest run",
        "test:watch": "vitest",
        "test:coverage": "vitest run --coverage",
        "test:e2e": "playwright test"
    }
}
```

---

## Phase 4: Optional Layers

Use AskUserQuestion to ask which optional layers to install. Present as a multi-select:

**"Which optional layers do you want to add?"**

**Dependency rule:** Auth requires Database. If the user selects Auth without Database, auto-include Database and inform the user: "Auth (BetterAuth) uses Turso/Kysely as its backing store — Database has been auto-included."

### Option 1: Auth (BetterAuth)

Install:
```bash
pnpm add better-auth
```

Create files:

**`src/lib/auth.ts`** — BetterAuth server config:

```typescript
import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { LibsqlDialect } from 'kysely-libsql'

const trustedOrigins: string[] = []
if (process.env.VERCEL_URL)
	trustedOrigins.push(`https://${process.env.VERCEL_URL}`)
if (process.env.VERCEL_BRANCH_URL)
	trustedOrigins.push(`https://${process.env.VERCEL_BRANCH_URL}`)
if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
	trustedOrigins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)

export const auth = betterAuth({
	database: {
		dialect: new LibsqlDialect({
			url: process.env.TURSO_APP_DATABASE_URL!,
			authToken: process.env.TURSO_GROUP_AUTH_TOKEN
		}),
		type: 'sqlite'
	},
	trustedOrigins,
	emailAndPassword: {
		enabled: true,
		disableSignUp: true
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60
		}
	},
	user: {
		additionalFields: {
			mustResetPassword: {
				type: 'boolean',
				required: false,
				defaultValue: true,
				input: false
			}
		}
	},
	plugins: [
		admin(),
		nextCookies()
	]
})
```

**`src/lib/auth-client.ts`** — BetterAuth client config:

```typescript
'use client'

import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
	plugins: [
		inferAdditionalFields({
			user: {
				role: { type: 'string' },
				banned: { type: 'boolean' },
				mustResetPassword: { type: 'boolean' }
			}
		})
	]
})
```

**`src/app/api/auth/[...all]/route.ts`** — Auth catch-all:

```typescript
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

**`src/middleware.ts`** — Cookie check redirect:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export function middleware(request: NextRequest) {
	if (request.nextUrl.pathname == '/')
		return NextResponse.next()

	const session = getSessionCookie(request)
	if (!session)
		return NextResponse.redirect(new URL('/sign-in', request.url))
	return NextResponse.next()
}

export const config = {
	matcher: [
		'/((?!sign-in|reset-password|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).+)'
	]
}
```

Update `src/lib/action.ts` — Add `authAction` and `adminAction` variants:

```typescript
'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export type ActionResult<T> =
	| { success: true; data: T }
	| { success: false; error: string }

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

async function getSession(): Promise<Session> {
	const session = await auth.api.getSession({
		headers: await headers()
	})
	return session
}

export function action<TInput, TOutput>(
	schema: z.ZodType<TInput>,
	handler: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
	return async (input: TInput) => {
		const parsed = schema.safeParse(input)
		if (!parsed.success)
			return { success: false, error: parsed.error.issues[0].message }

		try {
			const data = await handler(parsed.data)
			return { success: true, data }
		}
		catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}

export function authAction<TInput, TOutput>(
	schema: z.ZodType<TInput>,
	handler: (input: TInput, session: NonNullable<Session>) => Promise<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
	return async (input: TInput) => {
		const session = await getSession()
		if (!session)
			return { success: false, error: 'Not authenticated' }

		const parsed = schema.safeParse(input)
		if (!parsed.success)
			return { success: false, error: parsed.error.issues[0].message }

		try {
			const data = await handler(parsed.data, session)
			return { success: true, data }
		}
		catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}

export function adminAction<TInput, TOutput>(
	schema: z.ZodType<TInput>,
	handler: (input: TInput, session: NonNullable<Session>) => Promise<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
	return async (input: TInput) => {
		const session = await getSession()
		if (!session)
			return { success: false, error: 'Not authenticated' }
		if (session.user.role != 'admin')
			return { success: false, error: 'Not authorized' }

		const parsed = schema.safeParse(input)
		if (!parsed.success)
			return { success: false, error: parsed.error.issues[0].message }

		try {
			const data = await handler(parsed.data, session)
			return { success: true, data }
		}
		catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
```

Create route groups `(public)/` and `(dashboard)/` with layouts.

Create `scripts/seed-admin.ts` — Bootstrap first admin account:

```typescript
import { auth } from '../src/lib/auth'
import { randomBytes } from 'crypto'

async function seedAdmin() {
	const email = process.env.ADMIN_EMAIL
	if (!email) {
		console.error('ADMIN_EMAIL not set')
		process.exit(1)
	}

	const password = randomBytes(16).toString('base64url')

	await auth.api.signUpEmail({
		body: { email, password, name: 'Admin' }
	})

	console.log(`Admin created: ${email}`)
	console.log(`Password: ${password}`)
	console.log('Save this password — it will not be shown again.')
}

seedAdmin().catch(console.error)
```

### Option 2: Database (Turso/Kysely)

Install:
```bash
pnpm add @libsql/client kysely kysely-libsql
```

Create files:

**`src/lib/db.ts`** — Turso/Kysely connection:

```typescript
import { createClient } from '@libsql/client'
import { Kysely } from 'kysely'
import { LibsqlDialect } from 'kysely-libsql'
import type { AppDatabase } from '@/types/database'

let appDb: Kysely<AppDatabase> | null = null

export function getDb(): Kysely<AppDatabase> {
	if (!appDb) {
		appDb = new Kysely<AppDatabase>({
			dialect: new LibsqlDialect({
				client: createClient({
					url: process.env.TURSO_APP_DATABASE_URL!,
					authToken: process.env.TURSO_GROUP_AUTH_TOKEN
				})
			})
		})
	}
	return appDb
}
```

**`src/lib/repositories.ts`** — Repository factory (empty, ready to add):

```typescript
import { getDb } from './db'

// Add factory functions as you create repositories:
// export function getUserRepository(): IUserRepository {
//     return new TursoUserRepository(getDb())
// }
```

**`src/types/database.ts`** — Kysely table types (starter):

```typescript
// Define your table types here. Example:
// import type { Generated } from 'kysely'
//
// export interface AppDatabase {
//     users: UsersTable
// }
//
// export interface UsersTable {
//     id: Generated<string>
//     email: string
//     created_at: Generated<string>
// }

export interface AppDatabase {
	// Add tables here
}
```

**`src/types/repositories.ts`** — Repository interfaces (starter):

```typescript
// Define repository interfaces here. Example:
// export interface IUserRepository {
//     findById(id: string): Promise<User | null>
//     findByEmail(email: string): Promise<User | null>
// }
```

**`src/infrastructure/`** — Create directory for concrete implementations.

**`tests/helpers/test-db.ts`** — In-memory SQLite test helper:

```typescript
import { createClient, type Client } from '@libsql/client'
import { Kysely } from 'kysely'
import { LibsqlDialect } from 'kysely-libsql'
import type { AppDatabase } from '@/types/database'

const SCHEMA = `
-- Add your CREATE TABLE statements here
`

export interface TestDb {
	db: Kysely<AppDatabase>
	client: Client
}

export async function createTestDb(): Promise<TestDb> {
	const client = createClient({ url: ':memory:' })

	for (const stmt of SCHEMA.split(';').filter(s => s.trim()))
		await client.execute(stmt)

	const db = new Kysely<AppDatabase>({
		dialect: new LibsqlDialect({ client })
	})

	return { db, client }
}

export async function destroyTestDb(testDb: TestDb): Promise<void> {
	await testDb.db.destroy()
	testDb.client.close()
}
```

**`migrations/`** — Create directory for numbered SQL migration files.

**`scripts/deploy-schema.ts`** — Migration runner:

```typescript
import { createClient } from '@libsql/client'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

async function deploySchema() {
	const client = createClient({
		url: process.env.TURSO_APP_DATABASE_URL!,
		authToken: process.env.TURSO_GROUP_AUTH_TOKEN
	})

	const migrationsDir = join(process.cwd(), 'migrations')
	const files = readdirSync(migrationsDir)
		.filter(f => f.endsWith('.sql'))
		.sort()

	for (const file of files) {
		console.log(`Applying ${file}...`)
		const sql = readFileSync(join(migrationsDir, file), 'utf-8')
		for (const stmt of sql.split(';').filter(s => s.trim()))
			await client.execute(stmt)
	}

	console.log('Schema deployed.')
	client.close()
}

deploySchema().catch(console.error)
```

Add scripts to `package.json`:

```json
{
    "scripts": {
        "db:deploy": "tsx scripts/deploy-schema.ts"
    }
}
```

### Option 3: Forms (React Hook Form)

Install:
```bash
pnpm add react-hook-form @hookform/resolvers
```

No scaffolded files — RHF integrates via ShadCN's form component (already installed in baseline).

### Option 4: Theming (tweakcn + next-themes)

Install:
```bash
pnpm add next-themes
```

Ask user to browse [tweakcn.com](https://tweakcn.com/) and pick a theme preset. Add to `globals.css`:

```css
@import 'tweakcn/themes/[chosen-preset]';
```

Create theme provider in `src/components/providers/theme-provider.tsx`:

```typescript
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
		>
			{children}
		</NextThemesProvider>
	)
}
```

---

## Phase 5: WAG Infrastructure

Create the `.wag/` directory structure and project files.

### Directory Structure

```
.wag/
├── state.json
├── Status.md
├── docs/
│   ├── PRD.md
│   ├── Architecture.md
│   └── decisions.md
├── backlog/
│   └── _completed/
└── adr/
    ├── active/
    └── completed/
```

### state.json

```json
{ "app_name": "[folder name]", "current_mode": null, "active_pbi": null }
```

### .claude/settings.local.json

Auto-approve permissions for the project:

```json
{
    "permissions": {
        "allow": [
            "Bash(pnpm test:*)",
            "Bash(pnpm lint:*)",
            "Bash(pnpm build:*)",
            "Bash(pnpm type-check:*)",
            "Bash(pnpm format:*)",
            "Bash(pnpm dev:*)",
            "Bash(git add:*)",
            "Bash(git push:*)",
            "Bash(git checkout:*)",
            "Bash(git pull:*)",
            "Bash(git status:*)",
            "Bash(git log:*)",
            "Bash(git diff:*)",
            "Bash(ls:*)",
            "Bash(tree:*)",
            "Edit(**/.wag/state.json)",
            "Write(**/.wag/state.json)",
            "Edit(**/.wag/Status.md)",
            "Write(**/.wag/Status.md)"
        ],
        "deny": [
            "Bash(git push --force*)",
            "Bash(git push -f*)",
            "Bash(git push*origin main*)",
            "Bash(git push*origin master*)",
            "Bash(git reset --hard*)"
        ]
    }
}
```

### CLAUDE.md

```markdown
# CLAUDE.md

## Project
**[app-name]** — [one-line description, to be filled in /docs mode]

## Mandatory Rules

### 1. All File Changes Require Diff Review
All file modifications must use the Write tool so the user can review diffs.

### 2. TypeScript/JavaScript Code Style
All .ts, .tsx, .js, .jsx files must follow `~/.claude/documents/typescript-rules.md`

Key rules:
- Single quotes for strings
- Tabs for indentation (4 spaces wide)
- No semicolons
- No trailing commas
- == instead of ===
- Single-statement blocks without braces
- else/catch on new line

### 3. Git Commit Authorship
All commits must include:

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: [user name] <[user email]>
```

> **Note to init:** Replace `[user name]` and `[user email]` with the values collected in Phase 6 Step 2.

### PRD Template

Create `.wag/docs/PRD.md`:

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

Generate the UI Pages table based on which optional layers were selected. The output must be a clean finished document — no conditionals or instructions in the generated PRD.

**Without Auth:**

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Public landing page |

**With Auth:**

| Route | Page | Description | Auth Required |
|-------|------|-------------|---------------|
| `/` | Landing | Public landing page | No |
| `/sign-in` | Sign In | Email/password sign-in (invite-only, no self-registration) | No |
| `/reset-password` | Reset Password | Forced password reset on first login | Yes |
| `/dashboard` | Dashboard | Main authenticated view | Yes |
| `/settings` | Settings | User settings | Yes |
| `/admin` | Admin | Admin panel (role-gated) | Yes (admin) |

## Phased Development
[Phases with goals, deliverables, and success metrics. Each phase is independently demo-able.]

## Non-Goals
[What we're explicitly NOT building (yet).]

## Security Considerations
- Server actions validate auth + input on every call
- No secrets in client code
- Environment variables for all credentials

**With Auth, also include:**

- Middleware is a UX convenience redirect, not a security boundary

## Authentication
*(Only include this section if Auth was selected)*

Invite-only via BetterAuth. Admin creates users and shares temporary credentials. Users must reset password on first login. Self-registration is disabled.

## Success Metrics
[How we know it's working.]
```

### Architecture Template

Create `.wag/docs/Architecture.md`. This is the **full catalog** of all patterns regardless of what was installed — the reference for what to reach for later.

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
| **Forms** | React Hook Form + Zod | RHF handles form state, Zod validates. @hookform/resolvers bridges them. |
| **Validation** | Zod | Schema validation everywhere — forms, server actions, API boundaries. |
| **Database** | Turso (cloud SQLite) | Globally distributed SQLite. libsql client + Kysely query builder. |
| **Query Builder** | Kysely + kysely-libsql | Type-safe SQL. No ORM magic — you write queries, Kysely types them. |
| **Auth** | BetterAuth | Self-hosted auth with email/password, admin plugin, session management. |
| **Deployment** | Vercel | Git push = deploy. Branch-based environments. |
| **Unit Testing** | Vitest | Fast, native ESM, compatible with our stack. |
| **E2E Testing** | Playwright | Browser automation for critical user flows. |
| **Theming** | tweakcn + next-themes | tweakcn theme preset imported as dependency. next-themes handles light/dark toggle. |

### What We Don't Use (and Why)

| Technology | Why Not |
|-----------|---------|
| Prisma | Too heavy. Kysely gives type-safe SQL without a query language on top of SQL. |
| Drizzle | Good, but still an ORM. Kysely is a query builder — closer to the SQL. |
| Supabase | Bundled platform. We prefer owning auth and database separately. |
| NextAuth / Auth.js | BetterAuth is simpler, self-hosted, with native Turso adapter via Kysely. |
| tRPC | Server actions are Next.js's built-in RPC. tRPC is a second type-safe layer we don't need. |
| Redux / Zustand | MobX is simpler at our scale. Observable stores with less boilerplate. |

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

### The Action Wrapper Pattern

Server actions follow a consistent pattern using wrapper functions:

- `action(schema, handler)` — No auth, just validation. For public endpoints.
- `authAction(schema, handler)` — Validates session + input. For authenticated users.
- `adminAction(schema, handler)` — Validates session + admin role + input. For admin-only.

Every action returns `ActionResult<T>` — either `{ success: true, data }` or `{ success: false, error }`. No thrown exceptions crossing the server/client boundary.

### The Repository Factory Pattern

Don't construct repositories in actions. Use factory functions:

```
// src/lib/repositories.ts
export function getUserRepository(): IUserRepository {
    return new TursoUserRepository(getDb())
}
```

Tests can swap implementations, and the concrete Turso dependency stays in one place.

### MobX Store Rules

- Stores are client-side only. They hold UI state and call server actions.
- Stores never import from infrastructure/ or lib/db.ts.
- Each store gets a convenience hook: useAuthStore(), useSettingsStore(), etc.
- RootStore is a singleton. getRootStore() ensures one instance.
- Add new stores as properties on RootStore. They compose, they don't inherit.

### Database Strategy

- Multiple databases in one Turso group sharing TURSO_GROUP_AUTH_TOKEN
- Auth tables isolated from business schema
- Unit tests: in-memory SQLite (`:memory:`)
- Local dev: local SQLite file (`file:./local.db`)
- QA: Turso cloud (via Vercel preview env vars)
- Production: Turso cloud (via Vercel production env vars)

### Authentication Pattern

Invite-only via BetterAuth:
1. Admin adds user email via admin panel
2. System generates random temporary password
3. Admin shares credentials manually (no email sending)
4. User signs in → forced password reset page
5. User sets own password → mustResetPassword flag clears
6. User enters dashboard

Middleware checks for session cookie, redirects if missing. NOT a security boundary — server actions are the real auth check.

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
│   ├── action.ts                 # action/authAction/adminAction wrappers
│   ├── auth.ts                   # BetterAuth server config
│   ├── auth-client.ts            # BetterAuth client config
│   ├── db.ts                     # Turso/Kysely connection
│   ├── repositories.ts           # Repository factory functions
│   └── validations/              # Zod schemas per domain
├── hooks/                        # Custom React hooks
└── middleware.ts                  # Cookie check → redirect

## Route Groups

- (public) — No sidebar, no auth. Landing page, sign-in.
- (dashboard) — Sidebar, header, auth required. All business pages.
- reset-password — Outside both groups. Accessible when authenticated but before dashboard.

## Database Schema
[Every table with CREATE TABLE statements and indexes.]

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

### decisions.md

Create `.wag/docs/decisions.md`:

```markdown
# Decision Log

Record significant architectural choices here.

Format:
### Decision: [Short title]
**Date:** YYYY-MM-DD
**Context:** Why we faced this decision.
**Decision:** What we chose.
**Consequences:** What follows from this choice.
```

### README.md

```markdown
# [App Name]

[One-line description]

## Getting Started

```bash
pnpm install
pnpm dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm lint` | Lint code |
```

---

## Phase 6: Git Init

### Step 1: Initialize repo

```bash
git init
```

### Step 2: Per-repo identity

Check for existing git identity:

```bash
git config user.name
git config user.email
```

If both are set, show them and ask the user to confirm: "Use these? (y/n)". If not set or user declines, ask for name and email.

Then set per-repo config (no `--global`):

```bash
git config user.name "[name]"
git config user.email "[email]"
```

These values are also used in Phase 5 (project CLAUDE.md co-author tags). Each project has its own identity in `.git/config`.

### Step 3: SSH key selection

List SSH keys from `~/.ssh/`:

```bash
ls ~/.ssh/*.pub
```

Show the available keys and ask the user which one to use for this project. Then configure per-repo:

```bash
git config core.sshCommand "ssh -i ~/.ssh/[chosen key]"
```

### Step 4: Remote URL

Ask the user for the remote URL (e.g., `git@github.com:user/repo.git`). If they don't have one yet, skip — they can add it later.

If provided:

```bash
git remote add origin [url]
```

### Step 5: Verify auth

If a remote was added, verify the SSH key works against the remote:

```bash
git ls-remote origin
```

If this fails, stop and help the user diagnose. Do not continue until auth works.

### Step 6: Branches, commit, push

```bash
git checkout -b main
git add .
git commit -m "Initial scaffold with WAG infrastructure"
git checkout -b qa
git checkout -b dev
```

If remote was added and auth verified:

```bash
git push origin main
git push origin qa
git push origin dev
```

### Vercel Configuration

Create `vercel.json`:

```json
{
    "git": {
        "deploymentEnabled": {
            "main": false,
            "dev": false
        }
    }
}
```

QA branch auto-deploys. Main and dev do not deploy automatically.

---

## Phase 7: Wrap Up

After all phases complete:

1. Update state.json: `current_mode = null`
2. Inform user: "App initialized. Run `/docs` to define product requirements."
