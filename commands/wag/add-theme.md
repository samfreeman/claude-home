---
description: Add tweakcn theming, dark mode and a light/dark toggle to an existing Next.js project
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Add Theming (tweakcn + next-themes)

Add dark mode and theme customisation to an existing Next.js project using tweakcn presets and next-themes, with the toggle the house UI standard requires (`~/.claude/wag/references/ui-standard.md`): first visit follows the browser's preference, then the user's choice is remembered.

## Step 1: Check Prerequisites

Verify this is a Next.js project:

1. Confirm `package.json` exists in the working directory.
2. Confirm `next` appears in dependencies or devDependencies.
3. If either check fails, stop and tell the user this command requires an existing Next.js project.

## Step 2: Install Dependencies

```bash
pnpm add next-themes lucide-react
```

## Step 3: Theme Selection

Ask the user:

> Browse [tweakcn.com](https://tweakcn.com/editor/theme) and pick a theme you like. Click "Code", then give me the preset name from the install command (e.g. `claude`, `catppuccin`, `rose-pine`).

Wait for the user's response before continuing.

## Step 4: Install Theme

Install the theme via shadcn's registry. This updates the CSS variables in `globals.css`:

```bash
pnpm dlx shadcn@latest add https://tweakcn.com/r/themes/[chosen-preset].json
```

Replace `[chosen-preset]` with the preset name the user provided.

## Step 5: Create Theme Provider

Create `src/components/providers/theme-provider.tsx`:

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

## Step 6: Wrap Root Layout

Open the root layout file (typically `src/app/layout.tsx`).

1. Add the import at the top:
   ```typescript
   import { ThemeProvider } from '@/components/providers/theme-provider'
   ```

2. Wrap the `{children}` inside the `<body>` tag with `<ThemeProvider>`:
   ```typescript
   <body>
       <ThemeProvider>
           {children}
       </ThemeProvider>
   </body>
   ```

   Preserve any existing classes, attributes, or other providers already on the `<body>` tag. Nest `ThemeProvider` as the innermost wrapper if other providers already exist.

3. Add `suppressHydrationWarning` to the `<html>` tag. next-themes sets the theme class on `<html>` before React hydrates, so without it React warns about the mismatch:
   ```typescript
   <html lang="en" suppressHydrationWarning>
   ```

## Step 7: Create Theme Toggle

The toggle needs the shadcn `Button`. If `src/components/ui/button.tsx` doesn't exist, add it:

```bash
pnpm dlx shadcn@latest add button
```

Create `src/components/providers/theme-toggle.tsx`:

```typescript
'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Flips between light and dark from whatever is showing now — resolvedTheme, so it
// works under defaultTheme="system". next-themes persists the choice. Both icons render
// and CSS picks one, so server and client markup match before the theme is known.
export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme()

	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label="Toggle light or dark mode"
			onClick={() => setTheme(resolvedTheme == 'dark' ? 'light' : 'dark')}
		>
			<Sun className="size-4 hidden dark:block" />
			<Moon className="size-4 dark:hidden" />
		</Button>
	)
}
```

## Step 8: Place the Toggle

The UI standard puts the toggle in the landing page's navbar and in the signed-in app's header. Find the existing navbar/header component(s) and render `<ThemeToggle />` at the trailing end of each. If the project has no navbar or header yet, don't create one — tell the user where the toggle should go when it's built.

## Done

Tell the user:
- Theming is installed. First visit follows the browser's light/dark preference; the toggle switches mode and next-themes remembers the choice.
- Where the toggle was placed (or where it should go, if there was no navbar/header yet).
