---
description: Generate (and refresh) the in-app docs page — scaffolds route + content components, synthesizes Updates entry, statically bakes PRD/Architecture/Backlog into TSX
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG Gendocs — In-app docs page generator

Produces a static, themed docs page inside a Next.js + ShadCN + Tailwind app. The page surfaces the project's PRD, Architecture, Backlog, and an accumulating Updates history. Markdown sources in `.wag/` stay authoritative — `gendocs` reads them, synthesizes a new Updates entry, and bakes everything into TSX components that the app renders without any request-time markdown processing.

Run this before each QA push. One command does the whole thing — scaffold (if needed), synthesize Updates, render all four content components, wire `page.tsx`.

## What this command produces

In the target app:

- `<docs_page_path>/page.tsx` — composition. Header + Updates Card on top + ShadCN Accordion containing PRD / Architecture / Backlog sections.
- `<docs_page_path>/prd-content.tsx` — generated from `.wag/docs/PRD.md`.
- `<docs_page_path>/architecture-content.tsx` — generated from `.wag/docs/Architecture.md`.
- `<docs_page_path>/backlog-content.tsx` — generated from `.wag/backlog/` (client component for filter + search).
- `<docs_page_path>/updates-content.tsx` — generated from `.wag/docs/Updates.md`.

And in the WAG planning surface:

- `.wag/docs/Updates.md` — prepended-to. New dated entry synthesizing changes since the last entry.

No `react-markdown`, no `MarkdownRenderer`, no `actions/docs.ts`, no `remark-gfm`. Content is statically baked into the TSX at generation time. The app reads nothing at request time.

## Styling

Every component the command writes uses **standard Tailwind utility classes** referencing the CSS variables in the target app's `globals.css` — `bg-background`, `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, `text-primary`, etc. Theme flows through Tailwind automatically. **Do not** extract tokens, inline `style` props, or write `<style>` blocks — that's only how `/wag:html-*` does it for standalone files. Inline SVGs also use Tailwind utilities for fill/stroke (`fill-card`, `stroke-border`, `stroke-primary`).

Custom Tailwind for layout, spacing, or structural concerns is fine — just don't hardcode theme values.

## Preconditions

- Target app uses Next.js App Router, TypeScript, ShadCN, Tailwind.
- ShadCN components installed: `Accordion`, `Badge`, `Card`, `Tabs`, `Input`. If any are missing, surface to the user and offer the `npx shadcn add` command — don't run it automatically.

## Phase 1: Path resolution

1. Read `.wag/state.json` for `docs_page_path`.
2. **If set:** show it. *"Docs page path is `<value>`. Use this path?"* User confirms or redirects. Always confirm — never silently mount.
3. **If unset (or user redirected):**
   - Scan `src/app/` for route groups (folders matching `(*)`).
   - **Exactly one candidate** → propose `src/app/<group>/docs` and ask.
   - **Multiple candidates** → list them and ask which (or "none / put at root").
   - **No candidates** → propose `src/app/docs` and ask.
4. Save the chosen path to `.wag/state.json` `docs_page_path` (full path from project root, e.g., `"src/app/(dashboard)/docs"`).

## Phase 2: Verify ShadCN deps

For each ShadCN component listed in Preconditions, check whether the corresponding file exists in the app (typically `src/components/ui/<component>.tsx`). For any missing, halt and tell the user:

> "Missing ShadCN components: <list>. Install them with:
> `npx shadcn add <list>`
> Continue once installed."

## Phase 3: Synthesize the new Updates entry

The Updates baseline is **date-based** — robust to in-file edits.

1. Read `.wag/docs/Updates.md` if it exists. Parse the topmost `## YYYY-MM-DD` heading. That date is the baseline.
2. If `Updates.md` doesn't exist (first run on this project) or has no dated entries, use the file's git creation date as the baseline (`git log --diff-filter=A --format=%aI -- .wag/docs/Updates.md | tail -1`). If the file is brand new, fall back to the project's earliest commit date.
3. Gather everything since the baseline date:
   - **PRD changes** — parse `.wag/docs/PRD.md` Provenance/Changelog section for entries dated after the baseline.
   - **Architecture changes** — same for `.wag/docs/Architecture.md`.
   - **Completed ADRs** — for each `.wag/adr/completed/ADR-*.md`, find the commit that added it (`git log --diff-filter=A --format=%aI %h -- <path>`); keep those added after the baseline.
   - **Closed PBIs** — same logic for `.wag/backlog/_completed/epic-*/PBI-*.md`.
   - **Drained epics** — `epic.md` files in `_completed/` arriving after the baseline.
   - **Commits** — `git log --since=<baseline> --format='%s'`. Supporting evidence, not the primary signal.
4. Synthesize a user-facing dated entry:
   ```markdown
   ## YYYY-MM-DD

   ### Features
   - **Feature title** — User-facing description. No commit hashes. No developer jargon.

   ### Fixes
   - Brief description of fix.

   ### Internal
   - Architectural or process change worth noting.
   ```
   Omit any sub-section with no entries. Group related commits into single bullets. Prefer PRD/Architecture changelog entries and completed ADRs/PBIs over raw commit messages — those carry the curated framing.
5. **Prepend** the new entry into `.wag/docs/Updates.md`. The single `# What's New` (or `# Updates`) H1 stays at the top — never duplicated. Past entries stay below, separated by `---`.
6. **If the new entry would be empty** (no changes since baseline), tell the user and skip — don't write an empty `## YYYY-MM-DD` block.

## Phase 4: Render content components

Same rendering strategy as `/wag:html-*` — extract sections from the source, render prose semantically, author inline SVG for diagrams — but the output target is JSX with Tailwind/ShadCN instead of a standalone `.html` with custom CSS.

Diff-driven across regenerations. For each component, find the last commit that touched it:

```bash
git log -1 --format=%H -- <component-path>
```

Compare its source as it was at that commit against the current source. Stable sections (no prose change) are copied verbatim from the previous component file; changed sections are re-rendered. First runs render from scratch.

### `prd-content.tsx` — from `.wag/docs/PRD.md`

Server component (no `'use client'`). Each `## ` section becomes a sub-section. Prose wraps in `<div className="prose prose-sm dark:prose-invert max-w-none">`. Long code blocks in ShadCN-styled `<pre>` or inside an `<Accordion>` item with a `<Badge>` chip indicating language. Inline SVG diagrams use Tailwind classes for fill/stroke.

### `architecture-content.tsx` — from `.wag/docs/Architecture.md`

Same shape as PRD content. Heavier on diagrams (layer stacks, sequence, ERDs). Tech stack tables use ShadCN-styled `<table>` with `prose` classes. Long type definitions or implementation snippets in `<Accordion>` items with `<Badge>` chips.

### `backlog-content.tsx` — from `.wag/backlog/`

Client component (`'use client'`). Imports:

```tsx
'use client'

import { useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
```

State:

```tsx
const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active')
const [search, setSearch] = useState('')
```

Layout:
- Header row: `<Tabs>` with three tabs (Active / Completed / All), `<Input type="search">`, stats line ("N open, N done across N epics").
- Each epic is an `<AccordionItem>` showing epic ID, title, status `<Badge>`, PBI count. Inside: epic meta (Priority / Status / Depends on / Goal / Deliverables / Design Input / Non-goals) + a nested `<Accordion type="multiple">` of PBIs.
- Each PBI is an `<AccordionItem>` showing canonical ID, title, status `<Badge>`, priority. Inside: dependencies line + ADR link (if present) + Description / Deliverables / Acceptance Criteria / Testing Requirements / Technical Notes.

Backlog data is baked into the component at generation time as a typed const:

```tsx
const BACKLOG = {
  epics: [
    {
      id: 'epic-001-auth',
      number: '001',
      title: 'Auth',
      status: 'active' as const,
      priority: 'P1',
      goal: '...',
      deliverables: ['...'],
      designInput: '...',
      nonGoals: ['...'],
      pbis: [
        {
          id: 'PBI 001.003',
          localNumber: '003',
          title: 'Magic-link sign-in',
          status: 'open' as const,
          priority: 'P1',
          dependencies: 'PBI 001.001',
          description: '...',
          deliverables: '...',
          acceptanceCriteria: ['...'],
          testingRequirements: ['...'],
          technicalNotes: '...',
          searchKeywords: 'auth signin magic-link ...',
          adrLink: '../adr/active/ADR-001.003.md',  // or null
        },
      ],
    },
  ],
  stats: { open: 4, done: 3, epics: 1 },
}
```

Filter and search work via React state. Hide PBIs whose `status` doesn't match the active filter; further hide PBIs whose `searchKeywords` doesn't contain (case-insensitive) the search input. Hide epics whose visible-PBI count drops to zero while searching.

Sort: `epic-000-general` last (it's the bucket), other epics by number. Within each epic, PBIs by local number.

Walk the new-scheme structure throughout — `epic-NNN-word/` folders, `PBI-PPP.md` files inside, `_completed/` mirrors. Projects on the legacy scheme need `/wag:migrate-backlog` first.

### `updates-content.tsx` — from `.wag/docs/Updates.md`

Server component. Each dated entry renders as a sub-section with the date as the heading. Features / Fixes / Internal become small headers. Prose styled with `prose`.

Always regenerate — the source just changed in Phase 3.

## Phase 5: Wire `page.tsx`

Generate or replace `<docs_page_path>/page.tsx` with this composition:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { PrdContent } from './prd-content'
import { ArchitectureContent } from './architecture-content'
import { BacklogContent } from './backlog-content'
import { UpdatesContent } from './updates-content'

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Documentation</h1>
        <p className="text-muted-foreground">Project documentation and backlog status</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <UpdatesContent />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="prd">
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">PRD</Badge>
                  <span className="font-medium">Product Requirements</span>
                </div>
              </AccordionTrigger>
              <AccordionContent><PrdContent /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="architecture">
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">Arch</Badge>
                  <span className="font-medium">Architecture</span>
                </div>
              </AccordionTrigger>
              <AccordionContent><ArchitectureContent /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="backlog">
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">Backlog</Badge>
                  <span className="font-medium">Product Backlog</span>
                </div>
              </AccordionTrigger>
              <AccordionContent><BacklogContent /></AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
```

If `page.tsx` already exists and looks like a previously generated WAG docs page (detectable by the imports of the `*-content` files), regenerate without asking. If it looks user-customized, ask before overwriting and offer to back up as `page.tsx.backup`.

## Phase 6: Finish

No post-run summary. The user browses to `/docs` in the running app to see the result. If anything needs adjusting, they ask the LLM in a follow-up turn.

Don't commit. The user runs `/push` when ready.

## Key rules

1. **Static at generation time.** Content is baked into TSX. No request-time markdown parsing.
2. **Source of truth stays in `.wag/`.** PRD.md, Architecture.md, the backlog tree, Updates.md are authoritative. The TSX components are renders.
3. **Date-based Updates baseline.** Top date in `Updates.md` marks the conceptual boundary. Robust to in-file edits.
4. **Diff-driven content renders.** PRD/Architecture/Backlog components preserve stable sections from prior generations; only changed sections are re-rendered. Updates always regenerates.
5. **Styling is automatic.** Standard Tailwind utility classes; theme flows through the app's `globals.css`. No token extraction, no `<style>` blocks, no inline `style` props for theme values. Custom Tailwind for layout is fine.
6. **No auth, no env gating, no link wiring.** The app drives all of that.
7. **Always confirm the path.** Even when stored.
8. **New backlog scheme only.** Walks `epic-NNN-word/` folders. Legacy projects need `/wag:migrate-backlog` first.
