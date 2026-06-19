# Ubiquitous Language — one name per referent

The canonical statement of the project-vocabulary norm, referenced (not restated) by
`/wag:init`, `/wag:docs`, `/wag:adr`, `/wag:dev`, `/wag:rvw`, and `/wag:tri`. Changing
the norm = editing this one file.

## The principle

A project speaks **one** ubiquitous language: **one name per referent, everywhere** —
across the PRD, the Architecture, the contract/interfaces, the data model, and the
code (types, fields, columns, functions, files). A referent has exactly one name, used
identically at every layer. Where two names appear for one referent, one of them is
wrong — imported momentum (a generic library term, a stale synonym), not a real
distinction.

This is the naming counterpart of "every layer is the same information in a different
shape": the single decision keeps a single **name** at every layer too.

## Where it lives

**Architecture.md's `Ubiquitous language` section is the project's authority** — the
glossary of core domain terms, one name per referent. It is required content (the
Architecture template's manifest), so `/wag:adr` pre-flight checks it and `/wag:docs`
keeps it current. Every other surface *uses* the terms defined there; none invents its
own vocabulary.

## Don't introduce bounded contexts artificially

DDD's *bounded context* (a region with its own vocabulary, with "context maps"
translating one referent's different names across the boundary) earns its keep **only
when two real languages are FORCED to coexist**:

- multiple **non-converging teams**, each with an entrenched vocabulary;
- an **external / legacy system** whose model you must integrate but can't change;
- a **model too large to hold unified** in one team's head.

A project with one author (or one converging team), one system, a self-owned contract,
and no third party has **none** of these. Declaring bounded contexts there — and calling
apparent synonyms "context maps" — is imported ceremony that manufactures translation
work and invites drift. **Default to one language.** Reach for a bounded context only
when a forcing function genuinely appears, and name the forcing function when you do.

## A module seam is code, not vocabulary

A real one-way **module/import dependency** (e.g. a shared contract package a consumer
imports) is a genuine boundary — but it is enforced by the **import graph**, not by a
naming difference. Naming a field in the domain word does not weaken the seam; the seam
is the *import direction*. If the shared package is **owned by the project** (not a
neutral third-party interchange standard), it should speak the domain's own words.

> A package boundary must never be re-confused with a bounded-context boundary.

The only thing that would justify a second vocabulary at such a seam: the shared package
is meant to become a *neutral, multi-domain interchange standard* honored by unrelated
producers. That contradicts "the project owns it" — so until it's actually true, YAGNI.

## How each mode uses it

| Mode | Use |
|------|-----|
| **INIT** | Discovery (intake/grill) captures the domain vocabulary as terms surface — one name per referent, watch for synonyms. Architecture (Phase B) **defines** the `Ubiquitous language` section. |
| **DOCS** | Author PRD / Architecture / backlog *in* the established terms; when a new referent appears, name it once and add it to the section; flag synonym creep. |
| **ADR** | Design — decisions, interfaces, code examples — in the project's terms. A genuinely new referent extends Architecture's section (via `/wag:docs`); a synonym for an existing referent is a snag candidate. |
| **DEV** | Names in `src/` and `tests/` (types, fields, columns, functions) use the project's terms, one per referent. The Architect and CQ check naming against the section. |
| **RVW** | Reviews whether the code *speaks* the language — names match Architecture's section, no divergent synonyms, no artificially-introduced bounded context. |
| **TRI** | Naming drift is a defect class: reconcile the offending name to the one true term across docs/backlog/code, update the section, and disposition the fix (local / global / both). A synonym that slipped past is the snag. |

## The meta-lesson

When reconciling a naming defect, don't spotlight a single rename as "the fix" — the
norm is *all referents at once*. Docs should **speak** the language, not narrate the one
change; record renames evenly (a changelog line), never headlined as the one thing.
