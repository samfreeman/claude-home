# LEARNING-009: Runtime-schema policies must define the boundary, not enumerate venues — every untrusted→typed conversion runs through `safeParse`

**Source snag:** SNAG-003 from cmn-payonward-portal
**Applies to:** all (any WAG project that adopts a runtime schema library — Zod, effect.Schema, valibot, io-ts, yup — and consumes externally-supplied values, particularly signed JWT / SAML / JWS payloads, webhook bodies, deserialised cache reads, IPC messages)

## Standard

When a project adopts a runtime schema library, Architecture's validation policy must define the **trust boundary**, not enumerate venues. Every value that arrives from outside the process and gets converted to a typed shape runs through the schema's `safeParse` (or equivalent) call — including the module's mount boundary, form inputs, service responses, decoded JWT / SAML / JWS payloads, parsed webhook bodies, deserialised cache reads, IPC messages, and anything else where an opaque external value is being assigned a typed identity.

The common failure mode is enumerating three or four venues ("mount boundary, forms, service responses") and treating everything outside the enumeration as already-trusted. Signed-payload intake is the classic leak: `signed != shape-valid`. JWT verification confirms the issuer signed *something*; it says nothing about whether the payload matches the consumer's expected shape. Casting decoded claims via `as T` or `as unknown as T` lets a malformed-but-signed payload propagate downstream and crash three components deep instead of returning a 4xx at the boundary — exactly the failure mode the schema library was adopted to prevent.

Architecture documents must therefore write the policy as a principle (the boundary) and let the venue list be illustrative, not authoritative. Code reviewers must flag any `as T` cast on a value that arrived from outside the process as a finding. ADRs that introduce new external-payload intake (auth, webhooks, message queues, cross-process IPC) must explicitly state where `safeParse` runs.

## Check

A linear scan during ADR pre-flight and senior review:

1. Read Architecture's schema-validation section (typically a "Schema validation" stack-table row plus a Decision titled "Zod / effect.Schema / valibot for X"). Confirm the wording defines a boundary ("every trust boundary where an external value becomes a typed value") rather than enumerating a fixed venue list.
2. `grep -rn 'as [A-Z][A-Za-z]*\b' src/ | grep -v '.test.'` — collect every `as T` cast in non-test source. For each, ask: does the value on the left of the cast originate from outside the process (JWT decode, JSON.parse of an external body, `cookies().get()`, message-queue payload, IPC message, cache read)? If yes, flag it.
3. `grep -rn 'jwtVerify\|verify(.*),\s*await\|JSON.parse\|TextDecoder' src/` — anywhere a payload is decoded/verified/parsed, the next line(s) should run `safeParse` before the value is returned with a typed signature. If the function signature promises `Promise<TypedShape>` and the body returns the parsed value via `as`, that's the violation.
4. Look in tests: are there boundary tests that feed a signed-but-malformed payload through the verify function and assert a clear thrown error? If not, the boundary isn't enforced.

## Violations look like

```typescript
// src/lib/assertion.ts
export async function verifyAssertion(token: string): Promise<MemberContext> {
    const { payload } = await jwtVerify(token, await key(), { algorithms: ['HS256'], issuer: ISSUER })
    const full = payload as Record<string, unknown>
    const { iss, iat, exp, sub, ...rest } = full
    return rest as unknown as MemberContext
}
```

The function signature promises a `MemberContext`. JWT verification confirms the issuer signed *something*. The `as unknown as MemberContext` cast at the end pretends the shape was checked when it wasn't. A signed assertion missing `billingAddress` would return successfully and crash later when downstream code reads `member.billingAddress.line1`.

## Fix pattern

1. Import the schema (`MemberContextSchema`, `WebhookBodySchema`, etc.) into the verify/parse function.
2. After the decode/verify step, run `Schema.safeParse(<the decoded value>)`. For JWT payloads with reserved claims (`iss`, `iat`, `exp`, `sub`), destructure them out first and parse the remainder; for wrapped payloads (`{ member: ... }`) parse `payload.member`.
3. On `!parsed.success`, `throw new Error(\`Malformed <surface>: ${parsed.error.message}\`)` — name the surface in the message so the catch site can produce the right 4xx or redirect.
4. Drop the `as T` cast. Return `parsed.data`.
5. Add a boundary test that signs a malformed-but-otherwise-valid payload with the same key and asserts the verify call throws with the expected message.
6. Confirm the call sites (route handler, server component, action wrapper) already wrap the verify in try/catch and surface the throw as the right HTTP status — most do; check anyway.

## Embedded into

- **Commands:** pending — `/wag:adr` pre-flight check that scans Architecture's schema-validation section for boundary-vs-venue framing; senior-review prompt should list this as a learning to verify.
- **Templates:** pending — `templates/architecture.md` could include a boilerplate Schema validation row that uses the boundary framing by default, so new projects don't repeat the leak.
- **Learnings:** `~/.claude/wag/learnings/LEARNING-009.md` (this file — always the baseline surface).
