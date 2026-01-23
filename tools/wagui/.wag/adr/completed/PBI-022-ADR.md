# ADR: PBI-022 - Isolated Playwright Test Ports

## Status
APPROVED

## Context
Running Playwright e2e tests currently uses the same ports (3098/3099) as the dev instance. This means tests affect the dev monitoring screen (e.g., clearing messages) and can interfere with active development.

## Decision

### Approach
Configure Playwright tests to spin up isolated server and frontend on different ports:
- Test server: 3199 (instead of 3099)
- Test frontend: 3198 (instead of 3098)
- Test database: `:memory:` SQLite (no file persistence)

### Implementation

#### Task 1: Update server to accept PORT env var
- Change `const PORT = 3099` to `const PORT = parseInt(process.env.PORT || '3099')`
- Also accept `DB_PATH` env var for test database isolation

#### Task 2: Update playwright.config.ts
- Change webServer commands to use env vars:
  - `PORT=3199 DB_PATH=:memory: pnpm server`
  - `pnpm dev --port 3198`
- Update baseURL to `http://localhost:3198`
- Update server health check URL to `http://localhost:3199/health`

#### Task 3: Update tests to use configurable API_URL
- Change `const API_URL = 'http://localhost:3099'` to use the test port
- Can either hardcode 3199 or use env var

## Testing
- [x] E2E tests pass on isolated ports
- [x] Dev instance unaffected when tests run
- [x] Tests use in-memory database (no file created)

## Acceptance Criteria
- [x] Tests use separate server port (3199)
- [x] Tests use separate frontend port (3198)
- [x] Tests spin up isolated instances via playwright.config.ts
- [x] Dev instance remains unaffected when tests run
- [x] Tests use isolated SQLite database
- [x] Tests written for new code