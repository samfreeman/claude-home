<!--
REQUIRED CONTENT — the conformance manifest. This is the single definition of a valid Architecture doc.
An Architecture doc conforms when every item below is ANSWERED SOMEWHERE in the doc — any headings, prose fine.
Checked at authoring (/wag:init, /wag:docs) and at /wag:adr pre-flight. Never copied into project docs.

1. Tech stack — what it's built with (languages, frameworks, key dependencies) and why
2. App structure — how the application is organized (modules, layers, hosts)
3. Data model & storage — what the data is and where it lives
4. Key decisions — the load-bearing choices, alternatives considered, rationale
5. Open questions / risks
6. Ubiquitous language — the project's core domain terms, one name per referent (the glossary every layer and the code follow). See `~/.claude/wag/references/ubiquitous-language.md`.
7. Validation policy (only if the project adopts a runtime schema library — Zod, effect.Schema, valibot, io-ts, yup) — stated as a **trust boundary, not a venue list**: every value that arrives from outside the process and is given a typed identity runs through the schema's `safeParse` (mount boundary, form inputs, service responses, decoded JWT/SAML/JWS payloads, parsed webhook bodies, deserialised cache reads, IPC messages). Enumerating three or four venues and trusting everything else is the classic leak — `signed != shape-valid`. Projects with no runtime schema library answer "n/a".

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

| Layer | Choice | Rationale |
|-------|--------|-----------|
| {{LAYER}} | {{TECHNOLOGY}} | {{WHY_FROM_RESEARCH}} |

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

## Data model

{{DATA_MODEL}}

## External dependencies

| Dependency | Purpose | Risk |
|------------|---------|------|
| {{DEPENDENCY}} | {{PURPOSE}} | {{RISK}} |

## Open questions

{{OPEN_QUESTIONS}}
