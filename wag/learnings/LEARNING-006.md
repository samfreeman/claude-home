# LEARNING-006: PBI deliverables describe observable outcomes, not exported identifiers

**Source snag:** SNAG-007 from chatr
**Applies to:** all (any WAG project with numbered PBIs and ADRs)

## Standard

PBI Deliverables and Acceptance Criteria describe *observable outcomes* — what the slice must do — not the specific exported identifiers, call signatures, or API shape. Each WAG phase owns a distinct specificity level:

- **docs** (`PRD.md`, `Architecture.md`) say *what the product is* and what its parts are.
- **PBI** says *what a specific slice delivers*, expressed as observable behaviour.
- **ADR** says *how* that slice is implemented — API surface, exported identifiers, call signatures, mechanism choice.
- **dev** says *code*.

A PBI that prescribes function names (`"exports makeEnvelope<T>(...)"` in Deliverables) is reaching one phase past its own territory into the ADR's. The defect is invisible at authoring time but surfaces the moment the ADR grill produces a cleaner surface — the PBI's AC becomes unachievable-as-written against the shipped code, even though the shipped code satisfies every outcome the PBI actually needed.

Outcome language is stable across grill. Signature language isn't. This is not a stylistic preference; it is a scope discipline. The PBI has no domain over technical surface, so sentences that claim to lock surface carry no real authority — they just create future drift.

## Check

Linear scan of each PBI's **Deliverables** and **Acceptance Criteria** sections:

1. Read each bullet.
2. Flag any bullet that contains:
   - A parenthesised-then-arrow type signature: `` `foo(x: T) → U` ``
   - A declared identifier as the lead subject: `` `fooSchema` — validates … ``
   - Method-call syntax on a proposed export: `` `fooSchema.parse` ``
3. Distinguish from acceptable uses: referencing an *existing* library export (`` `Schema.decodeUnknown` from `effect` ``) or a Technical Notes citation of an identifier for context is fine — what is flagged is *declaring* a new identifier as part of the shipped surface.

Mechanical grep shape:

```
grep -En "^- \`[A-Za-z_][A-Za-z0-9_]*(\([^)]*\)|<[^>]*>)?[^\`]*\`[[:space:]]*(—|-)" <PBI-file>
```

Any hit inside a `## Deliverables` or `## Acceptance Criteria` section is an over-specification candidate.

## Violations look like

```markdown
## Deliverables
- `EnvelopeSchema` — validates the envelope shape (type-agnostic; caller supplies payload schema for full validation)
- `makeEnvelope<T>(type, payload, { aggregateId, sequence }) → Envelope<T>` — constructs with current timestamp
- `parseEnvelope(input: unknown) → Effect<Envelope, ParseError>` — native `Schema.decodeUnknown(EnvelopeSchema)`; returns Schema's built-in `ParseError`

## Acceptance Criteria
- [ ] `EnvelopeSchema` validates a well-formed envelope and rejects missing / wrong-typed fields
- [ ] `makeEnvelope` produces an envelope that passes `EnvelopeSchema.parse`
- [ ] `parseEnvelope` returns a `ParseError` (not throws) for malformed input
```

Every bullet commits the PBI to specific exported identifiers. When the ADR grill lands on a cleaner design — e.g., a single `defineEvent(tag, payloadSchema)` factory with `.create` attached, and no separate `EnvelopeSchema` / `makeEnvelope` / `parseEnvelope` — the PBI's bullets are simultaneously stale *and* unachievable-as-written, even though the shipped code satisfies every outcome the PBI actually needed.

This is the canonical shape of the violation: the PBI reads like a type-signature list rather than a behaviour list.

## Fix pattern

1. **Rewrite Deliverables as outcomes.** "The package exposes a schema factory that produces fully-typed, strict-by-default Schemas per event with a constructor attached for ergonomic value construction." — not "the package exports `defineEvent(tag, payloadSchema)`." The outcome is stable across grill; the signature isn't.
2. **Rewrite Acceptance Criteria as behavioural assertions.** "A consumer-side union over two or more factory-produced Schemas auto-discriminates on the envelope's `type` field." — not "`Schema.Union` over Schemas produced by `defineEvent` auto-discriminates." Behaviour is verifiable against any API shape that achieves it.
3. **Let the ADR own surface.** The ADR's *Interfaces* and *Architecture Decisions* sections are the right home for specific identifiers, call signatures, and API shape.
4. **Technical Notes may reference existing library exports.** Quoting `Schema.decodeUnknown` from `effect` in a PBI's Technical Notes is fine — that's naming a known external identifier for context, not declaring a new shipped export.

## Scope of fix when a violation is caught

Per the precedent resolution of SNAG-007 (ChatR, 2026-04-21): when a violation is discovered after the ADR has diverged, the fix lands in the template and as a learning — *not* as a PBI amendment. The PBI has no domain over surface, so the offending bullets are authoring drift that never carried binding weight. The ADR extracts the outcomes the PBI needs and owns the how. The PBI text stands as historical artifact.

This preserves the PBI's role (outcome capture) without forcing ceremonial rewrites every time the ADR grill produces a better surface than the PBI guessed at.

## Embedded into

- **Commands:** pending — `/wag:docs` and `/wag:adr` could both gain a preflight scan that flags signature-shaped bullets in PBI Deliverables / AC using the grep above. Mechanical, cheap, cuts drift off at authoring time. Not embedded yet; defer to a future embedding cycle.
- **Templates:** `~/.claude/wag/templates/backlog-pbi.md` — Deliverables placeholder rewritten to require outcome language and explicitly exclude identifier / signature / API-shape decisions; Authoring rules list gains rule #5 "Outcomes, not signatures."
- **Learnings:** `~/.claude/wag/learnings/LEARNING-006.md` (this file — portable baseline for cross-project reach).
