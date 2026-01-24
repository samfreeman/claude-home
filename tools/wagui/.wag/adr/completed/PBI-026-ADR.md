# ADR: PBI-026 - wag_cop Postcondition Enforcement

## Status

Proposed

## Context

AI drifts. It ignores instructions, forgets cleanup steps, and skips quality gates. The current WAG workflow relies on markdown instructions that AI may or may not follow. There's no enforcement mechanism - `wag_clear` can be called at any time, regardless of whether the work is actually complete.

We need a gate that physically prevents completion until postconditions are verified.

## Decision

Implement `wag_cop` - a deterministic validation tool that must pass before `wag_clear` is allowed.

### Architecture

```
wag-mcp (MCP server)
    └── wag_cop tool
            │
            ▼
wagui server (port 3099)
    └── POST /api/v1/cop
            │
            ├── Run file checks (ADR moved, PBI moved, criteria checked)
            ├── Run quality gates (lint, test)
            ├── Run git checks (status clean)
            │
            ▼
    └── cop_sessions table (tracks pass/fail per app)
```

### New MCP Tool: wag_cop

```typescript
{
    name: 'wag_cop',
    description: 'Validate postconditions before allowing wag_clear. Must pass before clear is allowed.',
    inputSchema: {
        type: 'object',
        properties: {
            pbi: {
                type: 'string',
                description: 'PBI being completed (e.g., PBI-026)'
            }
        },
        required: ['pbi']
    }
}
```

### New Endpoint: POST /api/v1/cop

**Request:**
```json
{
    "pbi": "PBI-026"
}
```

**Response (failure):**
```json
{
    "success": true,
    "passed": false,
    "failures": [
        "ADR not found in adr/completed/PBI-026-*.md",
        "PBI not found in backlog/_completed/PBI-026.md",
        "Acceptance criteria not complete: 2 of 5 unchecked",
        "Lint failed: 3 errors",
        "Git status not clean: 2 modified files"
    ],
    "sessionId": "abc123"
}
```

**Response (success):**
```json
{
    "success": true,
    "passed": true,
    "failures": [],
    "sessionId": "abc123"
}
```

### Database: cop_sessions table

```sql
CREATE TABLE cop_sessions (
    id TEXT PRIMARY KEY,
    app TEXT NOT NULL,
    pbi TEXT NOT NULL,
    passed INTEGER NOT NULL DEFAULT 0,
    failures TEXT,  -- JSON array of failure messages
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_cop_sessions_app_pbi ON cop_sessions(app, pbi);
```

### Modified: wag_clear

Before clearing, check that a passing cop session exists for the current app/PBI:

```typescript
function handleClear(req, res) {
    const { app, pbi } = state.header

    if (!pbi) {
        // No PBI active, allow clear (e.g., clearing after DOCS mode)
        return doClear()
    }

    const session = getLatestCopSession(app, pbi)

    if (!session || !session.passed) {
        return sendJson(res, {
            success: false,
            error: 'wag_cop must pass before wag_clear. Call wag_cop first.'
        }, 403)
    }

    // Clear the cop session after successful clear
    clearCopSession(app, pbi)
    return doClear()
}
```

### Cop Checks (Deterministic)

1. **ADR moved**: File exists in `{appRoot}/.wag/adr/completed/PBI-{N}*.md`
2. **PBI moved**: File exists in `{appRoot}/.wag/backlog/_completed/PBI-{N}.md`
3. **Criteria complete**: Parse PBI file, count `[ ]` vs `[x]`, all must be `[x]`
4. **Lint passes**: Run `cd {appRoot} && pnpm lint` (exit code 0)
5. **Tests pass**: Run `cd {appRoot} && pnpm test` (exit code 0)
6. **Git clean**: Run `git status --porcelain` in appRoot (empty output)

### Sequence Enforcement

```
1. AI does work in DEV mode
2. AI moves ADR to completed/
3. AI moves PBI to _completed/
4. AI marks criteria [x]
5. AI runs lint/test, fixes issues
6. AI commits and pushes
7. AI calls wag_cop(pbi: "PBI-026")
8. Server runs checks:
   - If any fail: return failures, AI must fix and retry
   - If all pass: record session as passed
9. AI calls wag_clear()
10. Server checks cop_sessions:
    - If no passing session: reject with 403
    - If passing session exists: allow clear, reset state
```

## Implementation Tasks

1. Add `cop_sessions` table to db.ts
2. Add `/api/v1/cop` endpoint to server/index.ts
3. Implement cop checks in new `server/cop.ts`
4. Modify DELETE /messages to check cop session
5. Add `wag_cop` tool to wag-mcp
6. Add tests for cop validation logic

## Consequences

### Positive
- AI cannot skip cleanup steps - server enforces
- Failures are specific and actionable
- Quality gates always run before completion
- Audit trail of cop attempts in database

### Negative
- Adds latency to completion (must run lint/test)
- Requires appRoot to be set correctly
- May need to handle edge cases (no PBI active, manual overrides)

### Risks
- Quality gate commands may vary by project (not all use pnpm)
- Git status check may be too strict (some files intentionally untracked)
- Need to handle timeouts for long-running tests

## Future Enhancements

- Configurable checks per app (some apps may not have tests)
- Max retry limit with fallback action (revert, escalate)
- Cop rules database that learns across projects