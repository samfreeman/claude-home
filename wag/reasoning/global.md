# HWAG Global Reasoning

Cross-project design heuristics that an unattended `hadr` run consults **before** self-playing the grill, so it can resolve the *obvious* design calls itself instead of escalating them.

**Role in the loop:** `hadr` reads this (global) doc + the project-local reasoning doc at the start of every run. When a decision matches a heuristic here, the agent decides by rule and records `Source: [G-NNN]` in the decision log. The log-grill (a separate, on-demand `hadr` mode) is what *adds* and *sharpens* entries here — every rule below should trace to a real decision the user reviewed, except seeds.

**Scope discipline:** entries here must be **true across projects**. A rule that's only true in one app belongs in that project's `.wag/reasoning/local.md`, not here. (A correction that's a *checkable* standard rather than a reasoning heuristic doesn't belong in either doc — it gets embedded mechanically as a template authoring-rule or a command pre-flight check.)

**Precedence:** a project-local rule overrides a global heuristic when they conflict (the local doc knows the project; the global doc only knows defaults).

---

## Format

```
## G-NNN: <heuristic title>
**Applies to:** <design domain / situation this fires in>
**Heuristic:** <the rule — what to prefer, stated so an agent can act on it>
**Rationale:** <why — the principle behind it>
**Provenance:** <decision-log ref(s) that promoted this (PROJECT/RUN#D#), or "seed">
```

---

## G-001: Prefer fewer moving parts on a tie
**Applies to:** any decision where two designs satisfy the acceptance criteria roughly equally.
**Heuristic:** choose the option with fewer components, fewer files touched, and fewer new dependencies. A tie breaks toward the smaller surface.
**Rationale:** smaller surface = less to test, less to break, less to explain at review. Reversibility is cheaper.
**Provenance:** seed

## G-002: Push errors to the boundary
**Applies to:** error-handling decisions in any layered design.
**Heuristic:** let errors propagate to the outermost boundary that can act on them (request handler, command entry, UI error boundary); don't catch-and-swallow mid-stack.
**Rationale:** mid-stack catches hide failures and produce wrong-shape partial state. The boundary is where the user-facing decision lives.
**Provenance:** seed

## G-003: Don't introduce abstraction before the second caller
**Applies to:** "should I extract a shared X?" decisions during design.
**Heuristic:** inline it until a real second consumer exists. Design the seam, not the abstraction.
**Rationale:** speculative abstraction is the most common source of design-time over-engineering and the hardest to walk back.
**Provenance:** seed

## G-004: Prefer up-front correctness over deferral when it impacts future work
**Applies to:** any "fix it now vs defer it" call during design — a known gap, a shortcut, an under-specified edge the agent could punt on.
**Heuristic:** if deferring the issue would shape or constrain future PBIs/ADRs, get the design right now. Defer only when the issue is genuinely isolated and cheap to revisit later. When unsure whether it compounds, treat it as if it does.
**Rationale:** a deferred design defect compounds — later work builds on the wrong shape, and unwinding it costs far more than getting it right up front. This is the design-layer face of the same meta-preference that makes silenced lint warnings unacceptable: never trade long-term correctness for short-term ease when the shortcut compounds.
**Provenance:** seed (hwag design grill, 2026-05-29)
