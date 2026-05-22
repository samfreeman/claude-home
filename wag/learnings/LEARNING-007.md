# LEARNING-007: Observable proxies must be unwrapped before crossing an RPC / Server-Action boundary

**Source snag:** none — inline catch during REVIEW-001.001-002 smoke test in `cmn-payonward-portal` (2026-05-22). MobX-observed input to a Next.js Server Action tripped React Flight's serializer in dev with `Only plain objects can be passed to Server Functions from the Client. Objects with symbol properties like mobx administration are not supported.` Test passed because Next.js recovers, but the call shape was wrong.

**Applies to:** any project that mixes a reactive-state library (MobX, Vue `reactive`/`ref`, Valtio, Proxy-based observables) with framework-level RPC (Next.js Server Actions, RSC props, `postMessage`, `Worker.postMessage`, `JSON.stringify` over the wire). Single-process React apps are unaffected.

## Standard

Any value that crosses out of a reactive store into an RPC / Server-Action / serialization boundary must be unwrapped to plain JavaScript first. Reactive libraries attach observation metadata to symbol-keyed properties of the wrapped object; that metadata does not survive serialization. The framework either drops it silently (wrong shape on the receiver) or throws (call fails). React Flight's behaviour in development is a console warning plus best-effort serialization; in production it may differ. Neither outcome is acceptable.

The unwrap must happen at the boundary, on the smallest fragment that crosses — not at observation time, and not on the whole store. Unwrapping early creates dead copies inside the store; unwrapping the whole store leaks irrelevant state across the boundary.

## Check

Grep the project for store methods that pass observable state into a Server-Action call, a `fetch` body, a `postMessage`, or `JSON.stringify`:

1. Find the set of "boundary call sites":
   - Next.js Server Actions: any `await <action>(arg)` where `<action>` is imported from a `'use server'` module.
   - `fetch(url, { body: JSON.stringify(arg) })`.
   - `worker.postMessage(arg)` / `iframe.contentWindow.postMessage(arg)`.
   - `JSON.stringify(arg)` where `arg` is a store field.
2. For each call site, walk the `arg` expression. Flag any branch that reads from an observable field — typed as `observable`, an instance method of a class that uses `makeObservable(this, {...})`, a Vue `ref`/`reactive` return, a Valtio `proxy`, etc. — without an explicit unwrap (`toJS()`, spread `{...x}`, `structuredClone()`, `JSON.parse(JSON.stringify(x))`).
3. The flag is mechanical: the unwrap must appear *between* the observable read and the boundary call.

Mechanical grep shape (MobX example, tighten per project):

```
grep -RnE "services\.[a-zA-Z]+\.[a-zA-Z]+\(\s*\{" src/ \
  | xargs -I{} grep -L "toJS\|\.\.\." {}
```

Any hit where the input object is built from `this.<observable>` paths without a visible unwrap is a candidate.

## Violations look like

```ts
// MobX store action calling a Next.js Server Action
async authorize() {
    const result = await this.services.payment.submit({
        orderId: this.orderId,
        donationCents: this.feeQuote.donationCents,
        totalCents: this.feeQuote.totalCents,
        rail: this.rail,
        ach: this.formData.ach,             // <-- observable proxy
        member: { id: this.member.id, name: this.member.name },
    })
    // dev console: "Only plain objects can be passed to Server Functions
    // from the Client. Objects with symbol properties like mobx
    // administration are not supported."
}
```

The bug is invisible at typecheck time (the static type of `this.formData.ach` is `ACHFormValues`, a plain object shape). It surfaces only at runtime when the boundary serializer encounters the symbol-keyed admin properties MobX attached to the proxy.

## Fix pattern

1. **Unwrap at the boundary.** Add the unwrap on the call expression itself, not at the store-write site:

   ```ts
   import { toJS } from 'mobx'

   ach: this.formData.ach ? toJS(this.formData.ach) : undefined,
   ```

2. **Pick the unwrap primitive by library:**
   - MobX: `toJS(value)`.
   - Vue: `toRaw(value)` for `reactive`, `unref(value)` for `ref`. For nested reactive trees, `JSON.parse(JSON.stringify(value))` or `structuredClone(value)`.
   - Valtio: `snapshot(value)` (returns the immutable plain copy) or `JSON.parse(JSON.stringify(value))`.
   - Generic proxy / unknown source: `structuredClone(value)` if you control runtime support, otherwise `JSON.parse(JSON.stringify(value))`.

3. **Scope the unwrap.** Unwrap the smallest fragment that crosses. Don't unwrap the whole store; don't unwrap fields that are already primitives. Primitives (number, string, boolean) and freshly-built object literals (`{ id: this.x.id, name: this.x.name }`) never carry symbol-keyed admin and don't need unwrapping.

4. **Add a comment at the unwrap site explaining why.** Future readers see a `toJS` and may "simplify" it away. A one-line WHY comment naming the boundary keeps the unwrap from getting refactored out:

   ```ts
   // Unwrap MobX observables to plain objects before crossing the
   // Server Action boundary — Next.js's flight serializer rejects
   // objects carrying MobX's symbol-based admin keys.
   ```

5. **Lock with a test if practical.** Pure-unit assertions on `Object.getOwnPropertySymbols(arg).length == 0` are cheap and lock the contract in tests that already mock the boundary.

## Scope of fix when a violation is caught

Inline. The unwrap is a one-line change at the call site; no architectural follow-up is needed. The pattern doesn't bind a PBI or ADR — it's a runtime hygiene rule that lands wherever the call site is.

If multiple boundary call sites exist across the codebase, a single audit pass (grep + the fix pattern above) handles all of them in one commit.

## Embedded into

- **Commands:** pending — `/wag:adr` could call this out when an ADR designs a Server Action / RPC that accepts data from a reactive store; `/wag:review` could grep the boundary call sites listed in the Check section above.
- **Templates:** pending — `~/.claude/wag/templates/architecture.md` "External dependencies" / "Data model" sections could mention the boundary-unwrap rule next to any reactive-state row.
- **Learnings:** `~/.claude/wag/learnings/LEARNING-007.md` (this file — portable baseline for cross-project reach).
