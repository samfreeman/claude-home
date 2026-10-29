<!--
REQUIRED CONTENT — the conformance manifest. This is the single definition of a valid Architecture doc.
An Architecture doc conforms when every item below is ANSWERED SOMEWHERE in the doc — any headings, prose fine.
Checked at authoring (/wag:init, /wag:docs) and at /wag:adr pre-flight. Never copied into project docs.

1. Tech stack — what it's built with (languages, frameworks, key dependencies) and why. A web app starts from the house default in the suggested `Tech stack` section below and records each departure with its reason. `/wag:create-nextjs` installs exactly what this section states.
2. App structure — how the application is organized (modules, layers, hosts)
3. Data model & storage — what the data is and where it lives
4. Key decisions — the load-bearing choices, alternatives considered, rationale
5. Open questions / risks
6. Ubiquitous language — the project's core domain terms, one name per referent (the glossary every layer and the code follow). See `~/.claude/wag/references/ubiquitous-language.md`.
7. Validation policy (only if the project adopts a runtime schema library — Zod, effect.Schema, valibot, io-ts, yup) — stated as a **trust boundary, not a venue list**: every value that arrives from outside the process and is given a typed identity runs through the schema's `safeParse` (mount boundary, form inputs, service responses, decoded JWT/SAML/JWS payloads, parsed webhook bodies, deserialised cache reads, IPC messages). Enumerating three or four venues and trusting everything else is the classic leak — `signed != shape-valid`. Projects with no runtime schema library answer "n/a".
8. Design direction — how the app meets the house UI standard (`~/.claude/wag/references/ui-standard.md`): that it builds to the standard, its brand (the tweakcn theme — primary and accent), and any deliberate departure with its reason. States the project's choices, never restates the standard. Projects with no web UI answer "n/a".

The headings below are a suggested starting shape for new projects — NOT a conformance requirement.
-->
# Architecture — {{PROJECT_NAME}}

**Created:** {{DATE}}
**Version:** 1.0
**Derived from:** [PRD.md](./PRD.md) + [RESEARCH.md](./RESEARCH.md)

## Ubiquitous language

One name per referent, everywhere — these docs, the contract/interfaces, the data model, and the code. See `~/.claude/wag/references/ubiquitous-language.md`. Don't introduce bounded contexts without a forcing function.

| Term | Meaning |
|------|---------|
| {{TERM}} | {{ONE_LINE_MEANING}} |

## Tech stack

The house default for a web app, pre-filled. Keep what applies, change a row only for a reason found in research (and say so in its Rationale), drop the optional rows this project doesn't need, and add project-specific rows. `/wag:create-nextjs` scaffolds exactly what this table says: baseline rows always, optional rows only when listed.

| Layer | Choice | Baseline / optional | Rationale |
|-------|--------|---------------------|-----------|
| Runtime | Node 24 LTS, pnpm | baseline | House default; the test toolchain needs Node 22+ |
| Framework | Next.js (App Router, `src/`, Turbopack), TypeScript | baseline | House default; Server Components, one language end to end |
| UI | Tailwind v4, shadcn/ui, lucide-react | baseline | Owned components, not a library dependency; the house UI standard builds on them |
| State | MobX (`mobx-react-lite`) | baseline | Observable client state with little boilerplate |
| Validation | Zod | baseline | One schema per trust boundary (see Validation policy) |
| Forms | react-hook-form + `@hookform/resolvers` | baseline | Zod-backed forms |
| Tests | Vitest (jsdom, Testing Library), Playwright | baseline | Fast unit tests plus real-browser end-to-end |
| Hosting | Vercel | baseline | House default |
| Database | Turso (libSQL) + Kysely — `/wag:add-db` | optional | Type-safe SQL without ORM codegen; seed and reset for dev/QA |
| Auth | BetterAuth — `/wag:add-auth` (needs Database) | optional | Self-hosted, no vendor lock-in |
| Theme | tweakcn + next-themes, light/dark toggle — `/wag:add-theme` | optional — ships for any web app with a UI | The house UI standard's theme and toggle depend on it |
| {{LAYER}} | {{TECHNOLOGY}} | {{BASELINE_OR_OPTIONAL}} | {{WHY_FROM_RESEARCH}} |

## High-level architecture

{{ARCHITECTURE_DESCRIPTION}}

## Directory structure

```
{{DIRECTORY_TREE}}
```

## Key decisions

| # | Decision | Alternatives considered | Why this choice |
|---|----------|------------------------|-----------------|
| 1 | {{DECISION}} | {{ALTERNATIVES}} | {{RATIONALE}} |

## Design direction

Builds to the house UI standard — `~/.claude/wag/references/ui-standard.md`. The standard governs; this section records only the project's own choices.

- **Brand:** {{TWEAKCN_THEME}} — primary {{PRIMARY}}, accent {{ACCENT}}
- **Departures:** {{DEPARTURES_AND_WHY}}

## Data model

{{DATA_MODEL}}

## External dependencies

| Dependency | Purpose | Risk |
|------------|---------|------|
| {{DEPENDENCY}} | {{PURPOSE}} | {{RISK}} |

## Open questions

{{OPEN_QUESTIONS}}
