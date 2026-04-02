---
description: Add BetterAuth authentication to an existing Next.js project (requires database)
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Add Auth (BetterAuth)

Add BetterAuth authentication to an existing Next.js project. This sets up invite-only email/password auth with admin management, forced password reset, session caching, and route groups.

## Context Header

Every response starts with:
```
🔧 **WAG: ADD-AUTH**
🎯 **Context:** [what you're doing]
```

---

## Critical Rules

1. **All file changes** → Use Write tool (user sees diff)
2. **All code** → Follow `~/.claude/documents/typescript-rules.md`
3. **No hardcoded paths** → Use `~` or relative paths

---

## Step 1: Check Prerequisites

1. Verify `package.json` exists in the working directory. If not, stop and tell the user: "This doesn't appear to be a Next.js project. Run /wag:init first."
2. Verify `src/lib/db.ts` exists. If not, stop and tell the user: "Auth requires database. Run /wag:add-db first."

---

## Step 2: Install Dependencies

```bash
pnpm add better-auth
```

---

## Step 3: Create Auth Files

### `src/lib/auth.ts` — BetterAuth server config

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

### `src/lib/auth-client.ts` — BetterAuth client config

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

### `src/app/api/auth/[...all]/route.ts` — Auth catch-all route

```typescript
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

### `src/middleware.ts` — Cookie check redirect

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

### `scripts/seed-admin.ts` — Bootstrap first admin account

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

---

## Step 4: Update `src/lib/action.ts`

Replace the entire file with the auth-aware version that includes `authAction` and `adminAction` wrappers:

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

---

## Step 5: Create Route Groups

Create the route group structure with layouts and placeholder pages.

### `src/app/(public)/layout.tsx` — Public layout (no sidebar, no auth)

```typescript
export default function PublicLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen">
			{children}
		</div>
	)
}
```

### `src/app/(public)/page.tsx` — Landing page

```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4">
			<h1 className="text-4xl font-bold">Welcome</h1>
			<p className="text-muted-foreground">Get started by signing in.</p>
			<Button asChild>
				<Link href="/sign-in">Sign In</Link>
			</Button>
		</div>
	)
}
```

### `src/app/(public)/sign-in/page.tsx` — Sign-in page

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignInPage() {
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError('')
		setLoading(true)

		const result = await authClient.signIn.email({
			email,
			password
		})

		if (result.error) {
			setError(result.error.message ?? 'Sign in failed')
			setLoading(false)
			return
		}

		// Check if user needs to reset password
		if (result.data?.user?.mustResetPassword)
			router.push('/reset-password')
		else
			router.push('/dashboard')
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Sign In</CardTitle>
					<CardDescription>Enter your credentials to continue</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								value={email}
								onChange={e => setEmail(e.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={e => setPassword(e.target.value)}
								required
							/>
						</div>
						{error && <p className="text-sm text-destructive">{error}</p>}
						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? 'Signing in...' : 'Sign In'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}
```

### `src/app/(dashboard)/layout.tsx` — Dashboard layout (sidebar + header, auth required)

```typescript
import { SidebarProvider } from '@/components/ui/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	return (
		<SidebarProvider>
			<div className="flex min-h-screen w-full">
				{/* Add AppSidebar component here */}
				<main className="flex-1 p-6">
					{children}
				</main>
			</div>
		</SidebarProvider>
	)
}
```

### `src/app/(dashboard)/dashboard/page.tsx` — Dashboard page

```typescript
export default function DashboardPage() {
	return (
		<div>
			<h1 className="text-2xl font-bold">Dashboard</h1>
			<p className="text-muted-foreground">Welcome to your dashboard.</p>
		</div>
	)
}
```

### `src/app/(dashboard)/settings/page.tsx` — Settings page

```typescript
export default function SettingsPage() {
	return (
		<div>
			<h1 className="text-2xl font-bold">Settings</h1>
			<p className="text-muted-foreground">Manage your account settings.</p>
		</div>
	)
}
```

### `src/app/(dashboard)/admin/page.tsx` — Admin page (role-gated)

```typescript
export default function AdminPage() {
	return (
		<div>
			<h1 className="text-2xl font-bold">Admin</h1>
			<p className="text-muted-foreground">Manage users and system settings.</p>
		</div>
	)
}
```

### `src/app/reset-password/page.tsx` — Reset password page (outside both route groups)

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResetPasswordPage() {
	const router = useRouter()
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError('')

		if (newPassword != confirmPassword) {
			setError('Passwords do not match')
			return
		}

		setLoading(true)

		const result = await authClient.changePassword({
			newPassword,
			currentPassword: '',
			revokeSessions: false
		})

		if (result.error) {
			setError(result.error.message ?? 'Password reset failed')
			setLoading(false)
			return
		}

		router.push('/dashboard')
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Reset Password</CardTitle>
					<CardDescription>You must set a new password before continuing</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="newPassword">New Password</Label>
							<Input
								id="newPassword"
								type="password"
								value={newPassword}
								onChange={e => setNewPassword(e.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="confirmPassword">Confirm Password</Label>
							<Input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={e => setConfirmPassword(e.target.value)}
								required
							/>
						</div>
						{error && <p className="text-sm text-destructive">{error}</p>}
						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? 'Resetting...' : 'Set New Password'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}
```

---

## Step 6: Add Environment Variables

Append to `.env.local` (create if it doesn't exist). Generate a random secret for `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Add these variables:

```
BETTER_AUTH_SECRET=[generated random string]
BETTER_AUTH_URL=http://localhost:3000
ADMIN_EMAIL=
```

---

## Step 7: Add Scripts

Add to `package.json` scripts:

```json
{
    "scripts": {
        "db:seed-admin": "tsx scripts/seed-admin.ts"
    }
}
```

---

## Step 8: Summary

After completing all steps, show the user:

```
Auth setup complete.

Files created:
  src/lib/auth.ts            — BetterAuth server config
  src/lib/auth-client.ts     — BetterAuth client config
  src/app/api/auth/[...all]/route.ts — Auth API route
  src/middleware.ts           — Cookie check redirect
  scripts/seed-admin.ts      — Admin seed script
  src/app/(public)/layout.tsx
  src/app/(public)/page.tsx
  src/app/(public)/sign-in/page.tsx
  src/app/(dashboard)/layout.tsx
  src/app/(dashboard)/dashboard/page.tsx
  src/app/(dashboard)/settings/page.tsx
  src/app/(dashboard)/admin/page.tsx
  src/app/reset-password/page.tsx

Files updated:
  src/lib/action.ts          — Added authAction + adminAction wrappers
  .env.local                 — Added BETTER_AUTH_SECRET, BETTER_AUTH_URL, ADMIN_EMAIL
  package.json               — Added db:seed-admin script

Next steps:
  1. Set ADMIN_EMAIL in .env.local
  2. Run: pnpm db:seed-admin
  3. Save the generated password
```
