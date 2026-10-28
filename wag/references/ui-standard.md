# UI Standard — the house quality bar for web apps

The canonical statement of how a WAG web app looks and moves, referenced (not restated)
by `/wag:init`, `/wag:docs`, `/wag:adr`, `/wag:dev`, and `/wag:rvw`. Changing the
standard = editing this one file.

It has two parts. **Landing pages** are specified in full below. **Signed-in pages** are
held to the same quality bar, but how that bar is met there is still being worked out
(see the last section).

## Where it lives in a project

**Architecture.md's `Design direction` section** is the project's statement of how it
meets this standard. It is required content (the Architecture template's manifest), so
`/wag:adr` pre-flight checks it and `/wag:docs` keeps it current. The section says:

- that the project builds to this standard;
- the project's own **brand** — its primary and accent colors, chosen as a tweakcn theme;
- any **deliberate departure** and why (e.g. "more restrained — the audience is
  enterprise buyers": slower motion, no particles, quieter accent).

It does not restate the standard. A project with no web UI answers "n/a".

## Foundation (every page)

**Components are shadcn/ui.** Owned components under `src/components/ui/`, lucide-react
for icons. Build from shadcn primitives before writing custom markup.

**One theme, light and dark.** Colors come from the shadcn/tweakcn theme tokens that
`/wag:add-theme` installs — `--background`, `--foreground`, `--card`, `--primary`,
`--accent`, `--muted-foreground`, `--border`, `--ring`. Pages never hardcode colors and
never keep a second, landing-only palette; the landing page and the signed-in app share
the theme, and both modes are designed, not one derived from the other.

**Theme follows the user.** First visit follows the browser's `prefers-color-scheme`;
a visible toggle (in the navbar, and in the signed-in app's chrome) lets the user choose
light or dark, and that choice is remembered. With next-themes that is
`defaultTheme="system"` + `enableSystem`, and a toggle calling `setTheme` — next-themes
persists the choice. No flash of the wrong theme on load.

**Motion respects the user.** Everything that animates checks
`prefers-reduced-motion: reduce` and renders its final state instantly when it is set.

**Responsive.** 1 column on mobile, 2 on tablet (`md`), 3 on desktop (`lg`). No
horizontal scroll at any width.

## Landing pages

The landing page should **reward scrolling**. Each section reveals with intentional
timing, and the hero tells a micro-story — not a static headline.

### Layout

Section-based, in this order (optional sections may be dropped, not reordered):

1. **Navbar** — fixed; gains a background/blur once the page scrolls; collapses to a
   shadcn `Sheet` on mobile; carries the theme toggle.
2. **Status badge** — small pill with a pulsing dot (`animate-pulse`) and a short live
   claim ("Now in beta", "Live on …"), monospace text.
3. **Hero** — `min-h-screen`, centred, headline `text-5xl md:text-7xl font-bold
   tracking-tight leading-[1.05]`, part of the headline in gradient or `--primary`
   text; subtext `text-lg md:text-xl` in `--muted-foreground`, `max-w-2xl`; CTAs; a
   "scroll" cue at the bottom.
4. **Stats row** — three or four key numbers.
5. **How it works / Features** — card grid.
6. **Pricing** — optional.
7. **Trust / FAQ** — optional.
8. **Final CTA** — repeats the primary call to action.
9. **Footer**.

Sections are `py-24 px-6`, content `max-w-7xl mx-auto` (hero `max-w-5xl`). Each section
heading has a monospace uppercase eyebrow label above it (`text-xs font-mono
tracking-widest uppercase` in `--primary`).

### Visual identity

- **Ground:** near-black in dark mode (`#0a0a0f` range); a clean near-white in light
  mode. Both come from the theme's `--background`.
- **Gradient text:** `--primary` → `--accent` via `background-clip: text` on one phrase
  of the headline and on key figures.
- **Glass cards:** `rounded-xl border` with a translucent fill (`bg-card/40`), hovering
  to a stronger fill and a `--primary`-tinted border (`hover:border-primary/40
  hover:bg-card/80`), `transition-all duration-300`. Icon tiles inside cards:
  `bg-primary/10 border-primary/20`.
- **Monospace labels** for badges, eyebrows, pricing figures and chart callouts — the
  technical feel.

### CTAs

- **Primary:** filled `--primary` (or a primary→accent gradient), `h-12 px-8 text-base
  font-semibold`, with a soft glow (`box-shadow` in the primary color).
- **Secondary:** shadcn `outline` / ghost variant, same size.
- Both lift on hover (slight `translate-y` + shadow growth), 0.2–0.3s.

### Motion

- **Hero entrance:** content fades and settles in (`scale 1.04 → 1`, `opacity 0 → 1`,
  ~1.2s, `power3.out` / `cubic-bezier(0.22, 1, 0.36, 1)`), headline rises 40px ~0.3s
  later, then subtext, then CTAs — a staged sequence, not everything at once.
- **Micro-story (rich hero):** an orchestrated timeline that shows the product doing its
  thing — a chart drawing, callouts appearing in turn — with the subtext and CTAs cued
  off it, and a replay control. Use when the product has a story to show.
- **Scroll reveals:** section headings rise 30px and fade in when the section reaches
  ~75% of the viewport; cards rise 40px and fade in at ~85%, **staggered 0.08s**, ~0.6s
  each, once only.
- **Ambient:** optional floating particles (~30, slow `float-up` drift over 10–25s,
  random delays), the pulsing badge dot, CTA glow.
- **Transitions** elsewhere 0.2–0.3s ease.

### Picking the tooling

| Page | Animation | Why |
|------|-----------|-----|
| Simple — staged hero, scroll reveals | CSS keyframes with `animation-delay` + IntersectionObserver | No dependency; enough for most pages |
| Rich — choreographed micro-story | GSAP (`@gsap/react` `useGSAP`, `ScrollTrigger` with `once: true`) | Timeline control, callbacks, replay |

## Signed-in pages

**Same quality bar as the landing page; how it is met is not settled yet.** What is
decided:

- Built from **shadcn/ui** components, on the same theme tokens — so light/dark, the
  toggle and the brand carry over unchanged.
- **Restrained motion.** No scroll choreography, particles or staged reveals — just
  0.2–0.3s transitions on hover, focus, open/close and route changes.
- Same responsive rules and reduced-motion rule as every page.

Open, to be worked through (record decisions here as they're made): page layout and
navigation chrome, density, how cards/tables/forms look, empty and loading states, and
which landing-page traits (glass cards, monospace labels, gradient accents) carry over.
Until then, a project's `Design direction` states its own choices for these, and a
project that settles one well is the input for settling it here.

## How each mode uses it

| Mode | Use |
|------|-----|
| **INIT** | Phase B2 **writes** the `Design direction` section (builds to this standard, names the brand as a tweakcn theme, states departures) and then **builds the mockups to it** (`~/.claude/wag/references/mockups.md`): the chosen signed-in look and the landing page per this spec. Theming ships in the baseline for any web app with a UI. |
| **DOCS** | Keeps `Design direction` current; a new departure is recorded there with its reason. |
| **ADR** | A UI PBI's design names the sections/components it builds and how they meet the standard; a departure not already in `Design direction` is raised, not slipped in. |
| **DEV** | Builds to the standard — theme tokens only, shadcn first, reduced-motion respected, both modes checked. |
| **RVW** | Reviews UI against this standard and the project's `Design direction`: hardcoded colors, a broken mode, missing reduced-motion handling, or motion on signed-in pages are findings. |
