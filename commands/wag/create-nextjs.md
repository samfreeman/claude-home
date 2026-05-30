---
description: Create a new Next.js app with baseline deps, optional layers, and git setup
allowed-tools: Read, Write, Bash, Glob, Grep, Skill
---

# Create Next.js App

Scaffold a new Next.js app with baseline dependencies, optional layers, and git setup.

## Context Header

Every response starts with:
```
**WAG: CREATE-NEXTJS ([App Name])**
**Step:** [what you're doing]
```

---

## Critical Rules

1. **All file changes** -> Use Write tool (user sees diff)
2. **All code** -> Follow `~/.claude/documents/typescript-rules.md`
3. **No hardcoded paths** -> Use `~` or relative paths, never `/home/...`

---

## Phase 1: Detection

Detect the current state of the working directory:

1. **cwd has `package.json` with Next.js** -> Existing Next.js app. Skip scaffold, proceed to Phase 3 (Baseline Install).
2. **Otherwise** -> Need to scaffold. Proceed to Phase 2.

> **Note — the project root is often non-empty.** This command is usually run while implementing **PBI 0.1** (the infrastructure PBI), *after* `/wag:init` has already built the `.wag/` planning layer and the root git repo. `create-next-app` refuses to run in a non-empty directory, so Phase 2 always scaffolds into a fresh **subfolder** and then merges the result up into the project root. The cwd at the start of Phase 2 is the project root (it normally already contains `.wag/` and a `.git/`); it is **not** empty and must not be treated as the scaffold target directly.

---

## Phase 2: Scaffold into a subfolder, then merge up

Ask the user for an app name if not provided as an argument: `$ARGUMENTS`. The app name doubles as the temporary scaffold subfolder name.

**First, establish the git repo at the project root — before scaffolding.** The single repository lives at the root and tracks both the app and any `.wag/`. When run during PBI 0.1's dev cycle it already exists (init's Phase D ran `git init` once `.wag/` was built). Create it only if absent:

```bash
# only if the project root has no .git yet (standalone runs); a no-op otherwise
git init
```

Why first: with a repo already present at the root, `create-next-app` detects it's inside a git repo and typically skips creating its own `.git` in the subfolder — so there's nothing to discard. We exclude `.git` in the move regardless, so it's safe either way.

Show the full scaffold command and wait for approval before running. `create-next-app` creates and populates the `[app]/` subfolder, sidestepping the non-empty-root problem:

```bash
pnpm create next-app@latest [app] \
    --typescript --tailwind --eslint --app --src-dir \
    --turbopack --import-alias "@/*" --use-pnpm --yes
```

**Relocate to the project root immediately — before anything else is installed.** The baseline deps, optional layers, and shadcn components (Phase 3 onward) must all run at the project root inside the root git repo, not in the throwaway subfolder. So as soon as `create-next-app` finishes, move the scaffold up — everything **except** any `.git` the scaffold may have left behind — *then* continue.

Run these as separate steps (each is its own approval):

```bash
# 1. move everything from the subfolder up to the project root, skipping its .git
find [app] -mindepth 1 -maxdepth 1 -name .git -prune -o -exec mv -t . {} +
```

```bash
# 2. remove the leftover subfolder (empty, or holding only the skipped .git)
rm -rf [app]
```

The project root now contains the Next.js app alongside any pre-existing `.wag/`, sharing the single `.git` at the root. **Do not `cd` into `[app]/`** — it no longer exists. All remaining phases operate at the project root.

If the project root contained files that collide with the scaffold (it normally only holds `.wag/`, which never collides), stop and ask the user how to reconcile before moving anything.

**Fix the package name.** `create-next-app` sets the `name` field in `package.json` to the scaffold subfolder name (`[app]`). Now that the app lives at the project root, update `package.json`'s `name` to match the actual project (the project-root folder name, kebab-cased) so it isn't pinned to the throwaway subfolder name. Use the Edit tool — don't shell-edit the file.

Configure TypeScript rules (eslint.config.mjs, tsconfig.json) per `~/.claude/documents/typescript-rules.md`.

---

## Phase 3: Baseline Install

These are always installed regardless of optional layer choices.

### Dependencies

```bash
# UI framework (CLI v4 stable — supports Tailwind v4, no canary needed)
pnpm dlx shadcn@latest init -d -f

# Base ShadCN components
pnpm dlx shadcn@latest add button card input label form \
    dropdown-menu sidebar sheet avatar badge separator \
    tooltip sonner

# State management
pnpm add mobx mobx-react-lite

# Validation
pnpm add zod

# Forms
pnpm add react-hook-form @hookform/resolvers

# Dev dependencies
pnpm add -D vitest @vitest/coverage-v8 @vitejs/plugin-react jsdom \
    @testing-library/react @testing-library/dom \
    @playwright/test tsx
```

### Scaffolded Code

Create these files with the baseline code:

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

Ask the user which optional layers to install. Present as a multi-select:

**"Which optional layers do you want to add?"**

1. **Database** (Turso/Kysely)
2. **Auth** (BetterAuth) — requires Database, auto-includes it if selected
3. **Theming** (tweakcn + next-themes)

**Dependency rule:** Auth requires Database. If the user selects Auth without Database, auto-include Database and inform the user: "Auth (BetterAuth) uses Turso/Kysely as its backing store — Database has been auto-included."

**Execution order:** Layers must be applied in this order: Database -> Auth -> Theming. Regardless of the order the user lists them, always run them in this sequence.

For each selected layer, invoke the corresponding slash command using the Skill tool:

- **Database:** `/wag:add-db`
- **Auth:** `/wag:add-auth`
- **Theming:** `/wag:add-theme`

Wait for each command to complete before running the next one. They must run sequentially in the order above.

---

## Phase 5: Project Files

### CLAUDE.md

CLAUDE.md may already exist from the Next.js scaffold. Read it first if present, then overwrite with:

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

> **Note:** Replace `[user name]` and `[user email]` with the values collected in Phase 6 Step 2.

### README.md

README.md may already exist from the Next.js scaffold. Read it first if present, then overwrite with:

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

### .claude/settings.local.json

Create `.claude/settings.local.json` for auto-approve permissions:

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
            "Bash(tree:*)"
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

### vercel.json

Create `vercel.json` in the project root:

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

## Phase 6: Git Configuration

The single root-level repository was already established in Phase 2 (`git init` at the project root, before scaffolding), so there's no repo to create here — just configure it.

### Step 1: Per-repo identity

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

These values are also used in Phase 5 (project CLAUDE.md co-author tags). If Phase 5 was completed before these values were known, update CLAUDE.md now with the correct name and email.

### Step 2: SSH key selection

List SSH keys from `~/.ssh/`:

```bash
ls ~/.ssh/*.pub
```

Show the available keys and ask the user which one to use for this project. Then configure per-repo:

```bash
git config core.sshCommand "ssh -i ~/.ssh/[chosen key]"
```

### Step 3: Create or connect remote

Ask the user: "Create a new GitHub repo, connect to an existing one, or skip?"

**If create new:**

First check GitHub CLI auth:

```bash
gh auth status
```

If not authenticated, tell the user: "GitHub CLI not authenticated. Run `gh auth login` in another terminal, then tell me when done." Wait for confirmation and re-check. If still not authed, offer to skip remote setup.

If authenticated, create the repo:

```bash
gh repo create [app-name] --private --source . --remote origin
```

**If connect existing:**

Ask for the remote URL (e.g., `git@github.com:user/repo.git`):

```bash
git remote add origin [url]
```

**If skip:**

Continue without remote. They can add it later.

### Step 4: Verify auth

If a remote was added, verify it works:

```bash
git ls-remote origin
```

If this fails, stop and help the user diagnose. Do not continue until auth works.

### Step 5: Branches, commit, push

`git add .` stages the app **and** any `.wag/` infrastructure present at the root — the initial commit captures both.

```bash
git checkout -b main
git add .
git commit -m "Initial scaffold with baseline dependencies"
git checkout -b qa
git checkout -b dev
```

If remote was added and auth verified:

```bash
git push origin main
git push origin qa
git push origin dev
```

---

## Phase 7: Wrap Up

After all phases complete:

1. Ensure all dependencies are resolved after add-* commands, then verify everything compiles:

```bash
pnpm install
pnpm build
```

If the build fails, show the error and stop. Do not report success until the build passes.

2. Summarize what was created:
   - App name and location
   - Baseline dependencies installed
   - Which optional layers were added
   - Git branches created (main, qa, dev)
   - Remote status (connected or not)

3. Suggest the next step, depending on how this command was reached:
   - **`.wag/` already exists at the root** (this scaffold is PBI 0.1, run from the dev cycle): the planning infrastructure is already in place and this PBI is standing up its foundation. Once the scaffold is committed, the PBI 0.1 dev cycle continues — suggest finishing/closing PBI 0.1, then picking the next PBI (now unblocked) and running `/wag:adr`.
   - **No `.wag/` present** (standalone scaffold): suggest "Run `/wag:init` to add planning infrastructure (.wag/ directory, PRD, Architecture docs, backlog)."
