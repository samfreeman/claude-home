# LEARNING-NNN: [short title — the rule as a one-line declarative sentence]

**Source snag:** SNAG-NNN from [project name]
**Applies to:** [`all` | `nextjs` | `cli` | `monorepo` | other category tags that downstream commands can filter on]

## Standard

[Prose description of the rule. Write it as a standard, not a suggestion — "X must do Y" rather than "X should consider Y." One or two paragraphs; longer only if nuance matters.]

## Check

[Mechanical detection — the test a command can run to verify compliance. Prefer grep patterns, file-existence checks, AST/import-graph probes, linear scans. The goal is scriptable: a command should be able to execute this check without interpretation.]

Example check shape:

1. [Read/grep/scan step]
2. [Comparison or assertion]
3. [Failure condition — what triggers the violation flag]

## Violations look like

```
[Concrete example of the wrong state — filename, line numbers, actual prose or code the check would flag]
```

[One-line commentary: what's wrong about it, for a reader who may not know yet.]

## Fix pattern

[How to fix — concrete, stepwise. Not a philosophy lecture; what does the author actually do?]

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Embedded into

[Track where this learning has landed across the three surfaces. Each line says: surface, path, short description of the embed. Updated as the learning is absorbed into WAG over time.]

- **Commands:** [e.g. `/wag:docs` end-of-authoring scan / pending]
- **Templates:** [e.g. `templates/backlog-pbi.md` now includes a "Dependencies must flow forward" note / pending]
- **Learnings:** `~/.claude/wag/learnings/LEARNING-NNN.md` (this file — always the baseline surface)
