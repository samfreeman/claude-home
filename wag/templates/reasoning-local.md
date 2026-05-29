# Project Reasoning — <project name>

Project-specific design conventions that an unattended `hadr` run consults **before** self-playing the grill. These are the calls that are "obvious" *in this codebase* but couldn't be inferred from the project docs alone.

**Role in the loop:** read alongside the global reasoning doc (`~/.claude/wag/reasoning/global.md`) at the start of every `hadr` run. A decision matching a rule here is decided by rule and logged with `Source: [L-NNN]`. The on-demand log-grill adds and sharpens entries here.

**Scope discipline:** rules here are true **only in this project**. A heuristic that would hold across your other projects belongs in the global doc, not here.

**Precedence:** a local rule here **overrides** a conflicting global heuristic — this doc knows the project; the global doc only knows defaults.

---

## Format

```
## L-NNN: <convention title>
**Applies to:** <where in this project this fires>
**Rule:** <the convention — stated so an agent can act on it>
**Rationale:** <why this project does it this way>
**Provenance:** <decision-log ref(s) (RUN#D#) that promoted this, or "seed">
```

---

<!-- Seed this section during /hadr setup or the first log-grill. Examples of the shape:

## L-001: Auth flows through the session module
**Applies to:** any feature that reads or mutates the authenticated user.
**Rule:** never touch the auth cookie/JWT directly; go through `src/server/session`. New protected routes wrap the existing `requireSession` guard.
**Rationale:** one audited entry point for auth; scattered token handling has bitten us before.
**Provenance:** seed
-->
