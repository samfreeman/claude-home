---
description: Generate (and refresh) the in-app Project Plan and Status page — scaffolds route + content components, synthesizes Updates entry, statically bakes PRD/Architecture/Backlog into TSX
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG Gendocs — In-app Project Plan and Status page generator

Produces a static, themed Project Plan and Status page inside a Next.js + ShadCN + Tailwind app. The page surfaces the project's PRD, Architecture, Backlog, and an accumulating Updates history. Markdown sources in `.wag/` stay authoritative — `gendocs` reads them, synthesizes a new Updates entry, and bakes everything into TSX components that the app renders without any request-time markdown processing.

Run this before each QA push. One command does the whole thing — scaffold (if needed), synthesize Updates, render all four content components, wire `page.tsx`.

## What this command produces

In the target app:

- `<plan_status_page_path>/page.tsx` — composition. Page header + a single ShadCN Accordion with four items: What's New / PRD / Architecture / Backlog. Each item's `AccordionContent` carries whatever fixed header bar that content needs (see Phase 4).
- `<plan_status_page_path>/prd-content.tsx` — generated from `.wag/docs/PRD.md`.
- `<plan_status_page_path>/architecture-content.tsx` — generated from `.wag/docs/Architecture.md`.
- `<plan_status_page_path>/backlog-content.tsx` — generated from `.wag/backlog/` (client component for filter + search).
- `<plan_status_page_path>/updates-content.tsx` — generated from `.wag/docs/Updates.md`.

And in the WAG planning surface:

- `.wag/docs/Updates.md` — prepended-to. New dated entry synthesizing changes since the last entry.

No `react-markdown`, no `MarkdownRenderer`, no `actions/docs.ts`, no `remark-gfm`. Content is statically baked into the TSX at generation time. The app reads nothing at request time.

## Styling — match `/wag:html-*` visual quality

Components written by `gendocs` must render at the same level of polish as the standalone HTML produced by `/wag:html-*`. Every prose element gets explicit Tailwind utility classes — **do not** wrap content in `<div className="prose">`. The typography plugin's defaults don't produce the html-* h2 accent, table polish, or details/warn/diagram styling. Apply the Visual treatment reference below to every element.

Theme flows through Tailwind variants that reference `globals.css` tokens (`bg-background`, `text-foreground`, `bg-card`, `text-primary`, `text-muted-foreground`, `border-border`, `bg-muted`, `bg-destructive/10`, …). **Do not** extract tokens into a `<style>` block or inline `style` props — that's the html-* mechanism, not gendocs'.

Custom Tailwind for layout, spacing, or structural concerns beyond the reference is fine — just don't hardcode colour values, and never bypass the table below for prose-style elements.

### Visual treatment reference — prose elements

| Element | Tailwind class chain |
|---|---|
| `<h2>` | `mt-10 mb-3 text-xl font-semibold leading-tight text-foreground border-l-4 border-primary pl-3 pb-1 border-b border-border scroll-mt-24` |
| `<h3>` | `mt-7 mb-2 text-base font-semibold text-primary leading-tight scroll-mt-24` |
| `<h4>` | `mt-5 mb-2 text-sm font-semibold` |
| `<p>` | `my-3 leading-relaxed` |
| `<a>` | `text-primary hover:underline` |
| `<ul>` | `my-3 ml-6 space-y-1 list-disc` |
| `<ol>` | `my-3 ml-6 space-y-1 list-decimal` |
| `<hr>` | `my-10 border-border` |
| `<blockquote>` | `my-4 pl-4 border-l-4 border-border text-muted-foreground` |
| inline `<code>` | `font-mono text-[0.85em] bg-muted/70 text-primary px-1.5 py-0.5 rounded` |
| `<pre>` (standalone) | `my-4 bg-muted/60 border border-border rounded-lg p-4 overflow-x-auto text-sm font-mono leading-relaxed` |
| `<pre><code>` (nested) | `font-mono text-inherit bg-transparent p-0 text-foreground` |

### Visual treatment reference — tables

| Element | Class chain |
|---|---|
| `<table>` | `w-full my-4 border-collapse text-sm` |
| `<th>` | `border border-border bg-primary/10 px-3 py-2 text-left font-semibold text-foreground` |
| `<td>` | `border border-border px-3 py-2` |
| `<tr>` (body) | `even:bg-muted/40` |

### Collapsible code blocks (`<details>`)

Long code snippets — TypeScript blocks > ~10 lines, full SQL DDL, directory trees, env-var lists — go into native `<details>` with a kind chip in the summary. Mirrors `/wag:html-*`:

```tsx
<details className="group my-4 rounded-lg border border-border bg-muted/35 overflow-hidden">
  <summary className="cursor-pointer px-3.5 py-2 text-sm font-semibold text-foreground select-none flex items-center gap-2 hover:text-primary [&::-webkit-details-marker]:hidden">
    <span aria-hidden className="text-primary text-xs leading-none transition-transform group-open:rotate-90">▸</span>
    <Badge variant="default" className="font-mono text-[0.66rem] tracking-wider px-1.5 py-0">TS</Badge>
    <span>Caption text</span>
  </summary>
  <pre className="m-0 rounded-none border-0 border-t border-border bg-muted/60 p-4 overflow-x-auto text-sm font-mono leading-relaxed">
    <code className="font-mono bg-transparent p-0 text-foreground">{`// code here`}</code>
  </pre>
</details>
```

Kind chips by content type (mirrors html-*):

| Kind | When | Badge |
|---|---|---|
| `TS` | TypeScript / JavaScript snippets | `<Badge variant="default">` |
| `SQL` | DDL / migrations | `<Badge variant="default">` |
| `TREE` | Directory trees | `<Badge variant="secondary">` |
| `ENV` | Environment-variable lists | `<Badge variant="secondary">` |

### Invariant callouts (replaces html-* `<div class="warn">`)

For "INVARIANT" / "Never do X" blocks in the source (typically prefixed with ⛔ or "INVARIANT:"):

```tsx
<div className="my-6 rounded-r-lg border border-destructive border-l-[5px] bg-destructive/10 p-4 text-destructive">
  <strong className="block mb-2 text-base font-bold">Invariant title</strong>
  <p className="m-0 text-destructive">Body text. Links use <a href="..." className="text-destructive underline">underlined destructive colour</a>.</p>
</div>
```

### Diagrams — inline SVG, never ASCII

Hand-author inline SVG, matching the SVG geometry of the corresponding `/wag:html-*` render. ASCII-art fallbacks in `<pre>` are **not acceptable** for layer stacks, sequence diagrams, data flows, or ERDs — the source `.md` ASCII is there for plain-text readability; the rendered TSX must produce the same SVG diagram the html-* render does.

When a corresponding `/wag:html-*` rendering exists for the same document (`.wag/docs/PRD.html`, `Architecture.html`, etc.), treat its inline SVG as the visual spec. Translate the inline CSS classes (`.d-box`, `.d-edge`, …) into Tailwind classes per the mappings below, preserving viewBox, geometry, and labels.

SVG container:

```tsx
<div className="my-6">
  <svg viewBox="0 0 720 446" role="img" aria-label="..."
       className="block w-full h-auto bg-muted/55 border border-border rounded-xl p-3.5">
    <defs>
      <marker id="ah-..." viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" className="fill-primary" />
      </marker>
    </defs>
    {/* shapes per the class mapping below */}
  </svg>
</div>
```

Shape class mappings (apply with `className` on each SVG element):

| html-* class | Tailwind on the SVG element |
|---|---|
| `.d-band` | `fill-primary/[0.07] stroke-border` + attr `strokeWidth={1.5}` |
| `.d-box` | `fill-card stroke-border` + attr `strokeWidth={1.5}` |
| `.d-box-accent` | `fill-primary/15 stroke-primary` + attr `strokeWidth={1.5}` |
| `.d-edge` (solid) | `stroke-primary fill-none` + attr `strokeWidth={1.6}` |
| `.d-edge-dash` (dashed) | add `[stroke-dasharray:5_4]` |
| `.d-life` (lifeline) | `stroke-border [stroke-dasharray:3_4]` + attr `strokeWidth={1.5}` |
| `.d-label` (small mono caps) | `fill-muted-foreground [font-family:var(--font-mono)] text-[10.5px] tracking-[0.07em]` |
| `.d-title` | `fill-foreground text-[13px] font-bold` |
| `.d-strong` | `fill-foreground text-[12px] font-semibold` |
| `.d-sub` | `fill-muted-foreground text-[11px]` |
| `.d-msg` | `fill-muted-foreground text-[10.5px]` |

### ERD-specific class mappings

For entity-relationship diagrams, on top of the `.d-*` table above:

| html-* class | Tailwind |
|---|---|
| `.erd-region` | `fill-primary/[0.05] stroke-border` + `strokeWidth={1.5}` |
| `.erd-region-label` | `fill-foreground [font-family:var(--font-mono)] text-[11px] font-bold tracking-[0.07em]` |
| `.erd-region-sub` | `fill-muted-foreground [font-family:var(--font-mono)] text-[9.5px]` |
| `.erd-head` (table header band) | `fill-primary/[0.16]` + attr `stroke="none"` |
| `.erd-tname` | `fill-foreground text-[12px] font-bold [font-family:var(--font-mono)]` |
| `.erd-col` | `fill-foreground text-[10px] [font-family:var(--font-mono)]` |
| `.erd-type` | `fill-muted-foreground text-[9px] [font-family:var(--font-mono)]` |
| `.erd-rowline` | `stroke-border` + `strokeWidth={0.75}` |
| `.erd-pk` (filled dot) | `fill-primary` |
| `.erd-fk` (outlined dot) | `fill-none stroke-primary` + `strokeWidth={1.5}` |
| `.erd-ref` (soft-ref dot) | `fill-none stroke-muted-foreground [stroke-dasharray:1.5_1.5]` + `strokeWidth={1.25}` |
| `.erd-rel` | `stroke-primary fill-none` + `strokeWidth={1.5}` |
| `.erd-rel-key` (heavy routing line) | `stroke-primary fill-none` + `strokeWidth={2.6}` |

ERD legend (rendered below the diagram, not inside the SVG):

```tsx
<div className="mt-2.5 mx-0.5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
  <span className="inline-flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
    primary key
  </span>
  <span className="inline-flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-primary inline-block" />
    foreign key
  </span>
  <span className="inline-flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-dotted border-muted-foreground inline-block" />
    soft reference
  </span>
</div>
```

### When in doubt, mirror html-*

If a `/wag:html-*` rendering exists for the same `.wag/docs/*.md` source, treat its HTML as the visual specification. Translate `<style>`-block CSS classes → Tailwind class chains using the tables above, preserving SVG geometry, viewBoxes, container wrapping, and layout exactly.

## Preconditions

- Target app uses Next.js App Router, TypeScript, ShadCN, Tailwind.
- ShadCN components installed: `Accordion`, `Badge`, `Card`, `Tabs`, `Input`. If any are missing, surface to the user and offer the `npx shadcn add` command — don't run it automatically.

## Phase 1: Path resolution

1. Read `.wag/state.json` for `plan_status_page_path`.
2. **If set:** show it. *"Project Plan and Status page path is `<value>`. Use this path?"* User confirms or redirects. Always confirm — never silently mount.
3. **If unset (or user redirected):**
   - Scan `src/app/` for route groups (folders matching `(*)`).
   - **Exactly one candidate** → propose `src/app/<group>/project-plan-status` and ask.
   - **Multiple candidates** → list them and ask which (or "none / put at root").
   - **No candidates** → propose `src/app/project-plan-status` and ask.
4. Save the chosen path to `.wag/state.json` `plan_status_page_path` (full path from project root, e.g., `"src/app/(dashboard)/project-plan-status"`).

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

Server component (no `'use client'`). Each `## ` section becomes a sub-section. Render prose semantically using the **Visual treatment reference** in the Styling section — apply Tailwind class chains element-by-element to every `<h2>`, `<h3>`, `<p>`, `<ul>`, `<table>`, etc. **Do not** wrap in `<div className="prose">`. Long code snippets go into the polished `<details>` collapsible pattern with a `<Badge>` chip. Any diagrams in the PRD are hand-authored inline SVG using the `.d-*` Tailwind mappings — never ASCII fallbacks.

### `architecture-content.tsx` — from `.wag/docs/Architecture.md`

Same shape as PRD content — apply the **Visual treatment reference** explicitly to every element; no `prose` wrapper. Architecture is heavier on diagrams (layer stacks, sequence diagrams, ERDs) — each is hand-authored inline SVG matching the geometry of the corresponding `/wag:html-*` render, using the `.d-*` and `.erd-*` Tailwind mappings. **Never** drop ASCII text in a `<pre>` for a diagram. Long type definitions, SQL DDL, and implementation snippets go into `<details>` collapsibles with `<Badge>` chips (`TS`, `SQL`, `TREE`, `ENV`). Invariant callouts (⛔ / "INVARIANT") use the warn pattern from the styling reference. Tech-stack tables follow the table class chain in the styling reference.

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
- **Fixed header bar** — the first child of the `BacklogContent` root element. Holds `<Tabs>` with three tabs (Active / Completed / All), `<Input type="search">`, and the stats line ("N open, N done across N epics"). This bar matches the role of the `.backlog-controls` strip at the top of the standalone `/wag:html-backlog` render. It stays pinned to the top of the accordion content while the epic list below it scrolls — use `sticky top-0 z-10 bg-card border-b border-border` plus appropriate padding so it sits flush against the AccordionContent edge and the epic accordions slide under it. Other content types (PRD, Architecture, Updates) don't need a fixed header — only Backlog does.
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

Sort: special buckets last — `epic-000-general`, then any `200+` bucket like `epic-501-future` (they're ongoing buckets, not features); other epics by number. Within each epic, PBIs by local number.

Walk the new-scheme structure throughout — `epic-NNN-word/` folders, `PBI-PPP.md` files inside, `_completed/` mirrors. Projects on the legacy scheme need `/wag:migrate-backlog` first.

### `updates-content.tsx` — from `.wag/docs/Updates.md`

Server component. Each dated entry renders as a sub-section with the date as the heading. Features / Fixes / Internal become `<h3>` headers. Apply the **Visual treatment reference** to headings, paragraphs, and lists — no `prose` wrapper.

Always regenerate — the source just changed in Phase 3.

## Phase 5: Wire `page.tsx`

Generate or replace `<plan_status_page_path>/page.tsx` with this composition. One Card, no `CardHeader` — page `<h1>` already labels the page. Inside the Card, a single `Accordion` with four items: What's New / PRD / Architecture / Backlog.

```tsx
import { Card, CardContent } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { PrdContent } from './prd-content'
import { ArchitectureContent } from './architecture-content'
import { BacklogContent } from './backlog-content'
import { UpdatesContent } from './updates-content'

export default function ProjectPlanAndStatusPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Project Plan and Status</h1>
        <p className="text-muted-foreground">PRD, architecture, backlog, and what's new</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Accordion type="single" collapsible>
            <AccordionItem value="updates">
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">New</Badge>
                  <span className="font-medium">What's New</span>
                </div>
              </AccordionTrigger>
              <AccordionContent><UpdatesContent /></AccordionContent>
            </AccordionItem>
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

Notes:
- `CardContent` gets `pt-6` because there's no `CardHeader` providing top padding (ShadCN's `CardContent` ships with `pt-0` for the headered case).
- No `defaultValue` on the `Accordion` — all four items start closed.
- The Backlog accordion item's content (`<BacklogContent />`) carries its own sticky control bar per Phase 4; nothing extra is needed here.

If `page.tsx` already exists and looks like a previously generated WAG Project Plan and Status page (detectable by the imports of the `*-content` files), regenerate without asking. If it looks user-customized, ask before overwriting and offer to back up as `page.tsx.backup`.

## Phase 6: Finish

No post-run summary. The user browses to the generated route in the running app to see the result. If anything needs adjusting, they ask the LLM in a follow-up turn.

Don't commit. The user runs `/push` when ready.

## Key rules

1. **Static at generation time.** Content is baked into TSX. No request-time markdown parsing.
2. **Source of truth stays in `.wag/`.** PRD.md, Architecture.md, the backlog tree, Updates.md are authoritative. The TSX components are renders.
3. **Date-based Updates baseline.** Top date in `Updates.md` marks the conceptual boundary. Robust to in-file edits.
4. **Diff-driven content renders.** PRD/Architecture/Backlog components preserve stable sections from prior generations; only changed sections are re-rendered. Updates always regenerates.
5. **Styling matches `/wag:html-*`.** Apply the Visual treatment reference's Tailwind class chains explicitly per element — no `prose` wrapper, no `<style>` blocks, no inline `style` props for theme. Diagrams are hand-authored inline SVG (matching the html-* render's geometry); never ASCII text in a `<pre>`. Custom Tailwind for layout is fine.
6. **No auth, no env gating, no link wiring.** The app drives all of that.
7. **Always confirm the path.** Even when stored.
8. **New backlog scheme only.** Walks `epic-NNN-word/` folders. Legacy projects need `/wag:migrate-backlog` first.
