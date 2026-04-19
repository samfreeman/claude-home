# LEARNING-002: Turbo `test` task depends on `^typecheck`, not `^build`

**Source snag:** SNAG-002 from chatr
**Applies to:** all (any TS monorepo where tests consume source directly)

## Standard
In a TypeScript monorepo where tests consume source (`moduleResolution: "bundler"` + `allowImportingTsExtensions: true`, or a Vitest alias to `src/`), the Turbo `test` task must not depend on `^build`. Use `^typecheck` instead — it preserves the upstream-correctness signal (dependent tests fail fast on upstream API breakage) without forcing a `dist/` artifact tests never consume. `^build` re-introduces the compile phase the source-consumption decision was chosen to avoid.

## Check
- Read `tsconfig.base.json` (or equivalent). Confirm `moduleResolution: "bundler"` and `allowImportingTsExtensions: true`, OR read Vitest config for a source alias.
- If source-consumption pattern is in use, read `turbo.json`. Flag `test.dependsOn` entries that include `^build`.

## Violations look like
```json
// turbo.json
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],   // ← forces upstream dist build
      "outputs": [],
      "cache": false
    }
  }
}
```
Invisible at 0 workspaces (Turbo short-circuits). Surfaces the moment a second workspace imports from a first — dependent `test` waits on upstream `build` despite Vitest needing only source.

## Fix pattern
1. `turbo.json`: change `test.dependsOn` from `["^build"]` to `["^typecheck"]`.
2. Update ADR rationale: explicitly tie `test`'s upstream contract back to the source-consumption decision. Without the note, the next reviewer re-introduces `^build` thinking it's the "safe" default.
3. Verify: `turbo run test --dry-run` should not schedule upstream `build` tasks.

## Template patch
```markdown
### Decision N: Turbo Pipeline — test task upstream contract

\`\`\`json
"test": {
  "dependsOn": ["^typecheck"],
  "outputs": [],
  "cache": false
}
\`\`\`

Rationale: because Decision M commits to tests consuming TypeScript source directly (bundler resolution + `allowImportingTsExtensions`), `test` does not need upstream `build` artifacts. `^typecheck` keeps the cross-workspace API-breakage signal (upstream must typecheck clean before a dependent's tests run against its source) without forcing a `dist/` the tests never consume. Do not change this to `^build` — that re-introduces the compile phase Decision M was designed to avoid.
```
