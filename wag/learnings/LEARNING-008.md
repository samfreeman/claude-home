# LEARNING-008: Payment-form data must use the processor's hosted form components, not your own DOM

**Source snag:** SNAG-001 from cmn-payonward-portal
**Applies to:** any project that accepts payment data (cards, bank accounts, or other PCI / PII payment fields). Card-only and ACH-only projects both apply. Provider-agnostic — Payabli, Stripe, Square, Authorize.net, Braintree, etc.

## Standard

All payment-related data — card data (PAN, CVV, expiry, holder name) and bank-account data (routing number, account number, holder name) — must be entered into form components hosted by the payment processor (iframe, embedded component, hosted page, or equivalent), never into `<input>` elements rendered by your own application. Your DOM, JS, and servers see only the opaque token the processor returns from its hosted-fields callback.

PCI SAQ-A is the most familiar framing, but the rule is broader. ACH routing + account numbers are not under PCI scope, but they carry comparable compliance and liability risk — NACHA rules, GLBA bank-customer-information handling, state breach-notification statutes, the bank's own contractual liability terms with the processor. Self-collecting bank-account PII for "pragmatic" reasons creates the same class of risk PCI SAQ-A was invented to retire for cards.

The constraint applies at the architectural-decision level — when the project chooses a payment processor, the corresponding decision about *how* payment data is collected is fixed at that moment. Form components are processor-provided; your form is a styled placeholder hosting the processor's surface. PBIs that scope payment-data input as your own form fields are wrong from authoring time; ADRs that design such forms are wrong by construction.

## Check

Three mechanical checks, runnable per project:

1. **Grep for forbidden fields in your own forms.** From the project root:

   ```
   grep -rnE '<input[^>]*name="(routingNumber|accountNumber|accountHolderName|cardNumber|cvv|cardCvv|cardExpiry|expirationDate|pan)"' src/
   ```

   Hits in your own components are violations. Hits inside the processor's SDK / vendored types are fine (the SDK declares the shape, not the rendering).

2. **Grep for raw payment-field types outside processor-provider directories.** Types like `ACHDetails`, `CardDetails`, `PaymentMethodRaw` with raw-field shapes (`routingNumber: string` etc.) on the module's public surface are violations. The public surface should carry tokens only.

   ```
   grep -rnE 'routingNumber:|accountNumber:|cardNumber:|cvv:' src/modules/ src/lib/ \
     | grep -v -- 'providers/'
   ```

   Hits outside the processor-provider directory are violations.

3. **ADR architectural-decision audit.** When an ADR designs a payment interface, the ADR's "What NOT to do" or "Open Questions" must explicitly name the hosted-fields requirement. If it doesn't, the ADR was authored without checking this learning — the reviewer flags it.

## Violations look like

```ts
// PBI deliverable: "ACHForm — routing number + account number + account-type, Zod-validated"
//
// schemas/ach.ts
export const achFormSchema = z.object({
    routingNumber: z.string().length(9).refine(isNachaChecksumValid),
    accountNumber: z.string().min(4).max(17).regex(/^\d+$/),
    accountType: z.enum(['checking', 'savings']),
    accountHolderName: z.string().min(1).max(50),
})

// components/ACHForm.tsx renders <input> for each field, collects values into
// store.formData.ach, then passes to the server action which calls Payabli.
```

The bug: routing / account / holder ride through *your* DOM, *your* JS heap, *your* server action — every one of those surfaces is now a potential exfiltration point and a compliance scope expansion. The processor's SDK accepts the raw fields, so it works; that's why the violation survives typecheck and runtime. It only fails the policy + audit.

## Fix pattern

1. **Strip raw-field inputs from your own components.** `ACHForm.tsx` (or `CardForm.tsx`) becomes a styled container that hosts the processor's surface — a `<div id="payabli-ach-fields">` (or processor-equivalent) where the processor injects its own iframe / embedded component. No `<input>` for payment fields in your own JSX.

2. **Change the public type shape.** `ACHDetails` (or `CardDetails`) on the module's public interface becomes a token shape — typically a branded opaque string (`type PayabliACHToken = string & { readonly __brand: 'PayabliACHToken' }`) returned by the processor's tokenize callback. The raw fields no longer exist in the module's public surface; if they exist anywhere in the codebase, they live inside the `providers/<processor>/` directory only.

3. **Change the call shape.** `PaymentSubmitInput.ach` (or `.card`) carries the token, not raw fields. The server action / RPC passes the token to the processor; the processor knows what the token unwraps to and what to charge.

4. **`accountLast4` (or `cardLast4`) sources from the processor's callback,** not from `accountNumber.slice(-4)` on raw data you collected. If the processor's tokenize callback doesn't surface a last-4 (rare but possible), the confirmation screen omits it.

5. **Audit the codebase.** Run the three checks above. Every hit either becomes a no-hit (delete the raw field) or moves into a processor-provider directory.

6. **ADR + PBI scope.** PBIs that scope payment-data input as your own forms must be rewritten. ADRs that designed such forms must be revised, deprecated, or annotated with a Known Deviations section + a forward-pointing PBI that does the remediation. SNAG-001 in cmn-payonward-portal is the canonical example.

## Scope of fix when a violation is caught

Depends on the project state:

- **Pre-implementation:** rewrite the PBI / ADR before code is written. No follow-up needed.
- **Implementation in flight:** halt the in-flight work, revise the ADR, restart implementation against the corrected design.
- **Already shipped (non-production):** capture a snag, document the deviation, author a remediation PBI with P0 priority and a "blocks production" deadline. The current shipping artifact may stay live in non-production (demo, qa) for the duration of the remediation, but must not reach production with the deviation in place.

## Embedded into

- **Commands:** pending — `/wag:adr` preflight could scan for raw payment-field schemas + `<input>` elements in components, and warn if the project takes payment but has no processor-provider directory; `/wag:review` could run the three grep checks listed above.
- **Templates:** pending — `~/.claude/wag/templates/architecture.md` "External dependencies" section could include a payment-processor row template that names the hosted-fields requirement upfront, so it's part of the doc skeleton rather than an afterthought.
- **Learnings:** `~/.claude/wag/learnings/LEARNING-008.md` (this file — portable baseline for cross-project reach).
