# ADR-001: SQLite Persistence via Server-Side HTTP API

## Status
Approved - Implementation Complete

## Context
wagui receives messages via SSE from wag-mcp but originally did not persist them. When the page refreshed or reconnected, all message history was lost. We needed a persistence layer that would survive page reloads and reconnections.

## Decision
Use **server-side SQLite persistence** with HTTP API endpoints.

### Why Server-Side HTTP API over Server Actions
- wagui server (`server/index.ts`) already handles SSE connections
- Centralizes persistence at message creation time (not on client receipt)
- Server broadcasts messages AND persists them in one operation
- SSE `/events` endpoint sends history on new client connections
- No client-side persistence calls needed - handled automatically

## Implementation

### Architecture
```
wag-mcp → HTTP POST → wagui server → saveMessage() → SQLite
                           ↓
                      broadcast() → SSE → clients
                           ↓
           (on connect) → getMessages() → send history
```

### Task 1: Database Module
**File:** `server/db.ts`

Extracted database operations into a dedicated module:
- `initDb(dbPath?)` - Initialize database, supports `:memory:` for tests
- `saveMessage(message)` - Persist message to SQLite
- `getMessages(limit)` - Retrieve messages ordered by timestamp
- `clearMessages()` - Delete all messages
- `resetDb()` - Close connection (for test isolation)

### Task 2: Server Integration
**File:** `server/index.ts`

The server:
1. Calls `initDb()` on startup
2. On POST `/api/v1/messages` - saves message and broadcasts to SSE clients
3. On GET `/api/v1/messages` - returns message history
4. On DELETE `/api/v1/messages` - clears all messages
5. On SSE connect (`/events`) - sends last 50 messages as history

### Task 3: Client Hydration
The SSE connection handler in `handleEvents()` automatically sends message history when a client connects:

```typescript
const history = getMessages(50)
for (const msg of history) {
    res.write(`event: message\n`)
    res.write(`data: ${JSON.stringify(msg)}\n\n`)
}
```

### Task 4: Tests
**File:** `server/__tests__/db.test.ts`

Unit tests using in-memory SQLite (`:memory:`):
- Save/retrieve messages
- All fields persist correctly
- Handles missing metadata
- ID-based upsert (INSERT OR REPLACE)
- Timestamp ordering
- Limit parameter
- Clear functionality

## File Changes Summary

| File | Change |
|------|--------|
| `server/db.ts` | NEW - Database operations module |
| `server/index.ts` | MODIFY - Import from db.ts, call initDb() |
| `server/__tests__/db.test.ts` | NEW - Unit tests |
| `package.json` | MODIFY - Add vitest for testing |

## Testing
- [x] Messages persist to SQLite on arrival
- [x] Page refresh loads historical messages (via SSE reconnect)
- [x] No duplicate messages on reconnect (server controls history)
- [x] API endpoints for fetching history
- [x] Tests pass (11 tests)

## Acceptance Criteria (from PBI-001)
- [x] Messages saved to SQLite as they arrive via SSE
- [x] On page load, fetch existing messages from database
- [x] Messages deduplicated by ID (no duplicates on reconnect)
- [x] API route for fetching history (or server action) ✓ HTTP API
- [x] Tests written for new code
