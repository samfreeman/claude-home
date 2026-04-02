---
description: Add tweakcn theming and dark mode support to an existing Next.js project
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Add Theming (tweakcn + next-themes)

Add dark mode and theme customisation to an existing Next.js project using tweakcn presets and next-themes.

## Step 1: Check Prerequisites

Verify this is a Next.js project:

1. Confirm `package.json` exists in the working directory.
2. Confirm `next` appears in dependencies or devDependencies.
3. If either check fails, stop and tell the user this command requires an existing Next.js project.

## Step 2: Install Dependencies

```bash
pnpm add next-themes
```

## Step 3: Theme Selection

Ask the user:

> Browse [tweakcn.com](https://tweakcn.com/) and pick a theme preset you like. What is the preset name? (e.g. `catppuccin`, `rose-pine`, `tokyo-night`)

Wait for the user's response before continuing.

## Step 4: Add Theme Import

Open the project's `globals.css` (typically at `src/app/globals.css`). Add the tweakcn import near the top of the file, after any existing `@import` or `@tailwind` directives:

```css
@import 'tweakcn/themes/[chosen-preset]';
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

## Done

Tell the user:
- Theming is installed. The app will respect the user's system light/dark preference by default.
- To add a manual theme toggle, install a toggle component (e.g. from shadcn/ui) that calls `useTheme()` from `next-themes`.
