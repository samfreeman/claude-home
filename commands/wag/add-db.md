---
description: Add Turso/Kysely database layer to an existing Next.js project
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Add Database (Turso/Kysely)

Add a Turso/Kysely database layer to an existing Next.js project, including connections, types, repositories, test helpers, and migration tooling.

## Context Header

Every response starts with:
```
🔧 **WAG: ADD-DB**
📍 **Application:** [app-name from package.json]
🎯 **Context:** Adding Turso/Kysely database layer
```

---

## Critical Rules

1. **All file changes** → Use Write tool (user sees diff)
2. **All code** → Follow `~/.claude/documents/typescript-rules.md`
3. **No hardcoded paths** → Use `~` or relative paths, never `/home/...`

---

## Step 1: Check Prerequisites

Verify this is a Next.js project:

1. Check `package.json` exists in the working directory
2. Confirm `next` is listed as a dependency or devDependency
3. If not a Next.js project, inform the user and stop

Read `package.json` to get the app name (use the `name` field).

---

## Step 2: Install Dependencies

```bash
pnpm add @libsql/client kysely kysely-libsql
pnpm add -D concurrently
```

---

## Step 3: Turso Setup

Check if Turso CLI is installed and authenticated:

```bash
which turso && turso auth status
```

### Option A: Cloud setup (recommended for production)

If Turso CLI is available and authenticated, create the group and initial app DB:

```bash
turso group create [app-name]
turso db create [app-name]-app --group [app-name]
turso group tokens create [app-name]
```

Get the app DB URL:

```bash
turso db show [app-name]-app --url
```

Write connection info to `.env.local` (gitignored):

```
TURSO_APP_DATABASE_URL=[url from above]
TURSO_GROUP_AUTH_TOKEN=[token from above]
```

### Option B: Local development with turso dev

If the user wants to skip cloud setup but has Turso CLI installed, use `turso dev`. This runs a local libsql server on port 8080 with full feature parity — including vector indexes and all Turso-specific extensions.

Write `.env.local`:

```
TURSO_APP_DATABASE_URL=http://127.0.0.1:8080
TURSO_GROUP_AUTH_TOKEN=
```

The `dev` script (configured in Step 5) will start `turso dev` automatically alongside Next.js — no separate terminal needed.

### Option C: Bare SQLite fallback

If Turso CLI is not available at all, fall back to a local SQLite file:

```
TURSO_APP_DATABASE_URL=file:./local.db
TURSO_GROUP_AUTH_TOKEN=
```

**Warn the user:** This is plain SQLite without libsql extensions. Vector indexes and other Turso-specific features will not work locally. Install the Turso CLI and use `turso dev` for full feature parity.

---

## Step 4: Create Files

Create ALL of the following files with the exact code shown.

**`src/lib/db.ts`** — Turso/Kysely connections (multi-database pattern):

```typescript
import { createClient } from '@libsql/client'
import { Kysely } from 'kysely'
import { LibsqlDialect } from 'kysely-libsql'
import type { AppDatabase } from '@/types/database'

// App DB — auth tables, system config. Singleton.
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

// Per-user DB — data isolation. Creates connection on demand.
// All databases in the same Turso group share TURSO_GROUP_AUTH_TOKEN.
const userDbs = new Map<string, Kysely<AppDatabase>>()

export function getUserDb(userId: string): Kysely<AppDatabase> {
	let db = userDbs.get(userId)
	if (!db) {
		db = new Kysely<AppDatabase>({
			dialect: new LibsqlDialect({
				client: createClient({
					url: `libsql://${userId}-[app-name]-[org].turso.io`,
					authToken: process.env.TURSO_GROUP_AUTH_TOKEN
				})
			})
		})
		userDbs.set(userId, db)
	}
	return db
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

```bash
mkdir -p src/infrastructure
```

**`tests/helpers/test-db.ts`** — In-memory SQLite test helper:

```typescript
import { createClient, type Client } from '@libsql/client'
import { Kysely } from 'kysely'
import { LibsqlDialect } from 'kysely-libsql'
import type { AppDatabase } from '@/types/database'

// :memory: uses plain SQLite — no vector indexes or libsql extensions.
// That's fine for unit tests which don't exercise vector ops.
// For integration tests needing full libsql features, use turso dev.

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

```bash
mkdir -p migrations
```

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

---

## Step 5: Add Scripts

Update `package.json` scripts. Read the existing `package.json`, merge these changes, and write it back.

Add the `db:deploy` script:

```json
{
    "scripts": {
        "db:deploy": "tsx scripts/deploy-schema.ts"
    }
}
```

If the user chose Option B (turso dev), also update the `dev` script to start both Next.js and turso dev together:

```json
{
    "scripts": {
        "dev": "concurrently --names next,turso --prefix-colors blue,yellow \"next dev --turbopack\" \"turso dev\"",
        "dev:next": "next dev --turbopack"
    }
}
```

This runs both processes with `pnpm dev`. The `dev:next` script is kept as an escape hatch to run Next.js alone (e.g. when pointing at a cloud DB).

---

## Completion

After all steps, summarize what was created:

```
✅ Database layer added:
   - src/lib/db.ts (Turso/Kysely connections)
   - src/lib/repositories.ts (repository factory)
   - src/types/database.ts (table type definitions)
   - src/types/repositories.ts (repository interfaces)
   - src/infrastructure/ (concrete implementations dir)
   - tests/helpers/test-db.ts (in-memory test helper)
   - migrations/ (SQL migration files dir)
   - scripts/deploy-schema.ts (migration runner)
   - .env.local (connection credentials)
   - package.json (db:deploy script added, dev script updated)
```
