# LEARNING-001: Root scripts uniformly delegate to the task runner

**Source snag:** SNAG-001 from chatr
**Applies to:** all (any monorepo with a task runner — turbo, nx, moon, etc.)

## Standard
Every script in the root `package.json` delegates to the task runner (`turbo run X` / `nx run-many -t X`). Direct tool invocations at the root (`vitest run`, `tsc -b`, `bun build`) bypass the runner's graph and cache, and silently break workspace aggregation as the repo grows. If an exception is genuinely needed, the ADR must explicitly justify it.

Corollary: every script listed in the Implementation Plan must have a matching task in the runner config. No Plan-Decision gaps.

## Check
- Read root `package.json` `scripts`. For each entry, confirm the value starts with `turbo run ` (or the equivalent runner invocation).
- Read `turbo.json` `tasks`. For each root script, confirm a matching task key exists.
- Flag any root script that invokes a tool binary directly (`vitest`, `tsc`, `eslint`, `vite`, `next`, `bun build`, etc.) without an ADR note.

## Violations look like
```json
// package.json (root)
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "vitest run --passWithNoTests",  // ← bypasses turbo
    "typecheck": "turbo run typecheck"
  }
}
```
Also: `turbo.json` defines tasks `build`/`dev`/`test`/`typecheck` but root `scripts` lists a `clean` script with no corresponding `clean` task in `turbo.json`.

## Fix pattern
1. For each root script that bypasses the runner, either:
   - Route it through the runner: `"test": "turbo run test"`, and add the task to `turbo.json` if missing.
   - OR add an ADR note explaining why the bypass is intentional.
2. For each root script without a matching task, add the task entry (shape depends on task — typically `cache: false, outputs: []` for non-artifact tasks like `clean`).
3. Empty-workspace sanity check: `turbo run <task>` with zero workspaces should exit 0.

## Template patch
```markdown
### Decision N: Task Runner Pipeline

Root `package.json` scripts delegate uniformly to the task runner:

\`\`\`json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules"
  }
}
\`\`\`

Every script above has a matching task in `turbo.json`. Direct tool invocation at the root is prohibited without explicit justification — it bypasses the runner's graph and cache, and breaks workspace aggregation as the repo grows.
```
