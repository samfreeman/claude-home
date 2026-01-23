# ADR: PBI-028 - App Registry & Selection

## Status

Implemented

## Context

wagui needs to track which app/tool is being worked on to:
1. Filter messages by app
2. Derive transcript path for polling (PBI-029)
3. Support switching between apps

Currently `wag_set_state` only takes an app name. We need the full path to derive the transcript location.

## Decisions

### 1. Apps Table

Store app details in SQLite:

```sql
CREATE TABLE apps (
    name TEXT PRIMARY KEY,
    app_root TEXT NOT NULL,
    repo_root TEXT,
    last_used INTEGER NOT NULL
)
```

### 2. Expand wag_set_state

Add `appRoot` (required) and `repo` (optional) parameters:

```typescript
wag_set_state({
  app: "samx",                                    // required
  appRoot: "/home/samf/source/claude/tools/samx", // NEW - required
  repo: "/home/samf/source/claude",               // NEW - optional
  mode: "DEV",
  branch: "dev",
  context: "...",
  pbi: "PBI-028",
  task: 1,
  totalTasks: 5
})
```

When called, upsert into `apps` table.

### 3. Bidirectional App Selection

Single source of truth: server's `selectedApp`

Two ways to change it:
- **CLI**: `wag_set_state(app: "samx", appRoot: "...")`
- **UI**: `POST /api/v1/select { app: "samx" }`

Either triggers:
1. Update `selectedApp` in server memory
2. Broadcast `app-changed` event via SSE
3. (Future) Switch transcript watching to new app

### 4. New API Endpoints

**GET /api/v1/apps**

Returns known apps from database:

```json
{
  "success": true,
  "apps": [
    {
      "name": "samx",
      "appRoot": "/home/samf/source/claude/tools/samx",
      "repoRoot": "/home/samf/source/claude",
      "lastUsed": 1737556800000
    }
  ]
}
```

**POST /api/v1/select**

Switch active app from UI:

```json
{ "app": "samx" }
```

Server looks up `appRoot` from `apps` table, updates state, broadcasts.

## Implementation Plan

### Task 1: Database schema

File: `server/db.ts`
- Add `apps` table creation in `initDb()`
- Add `upsertApp(name, appRoot, repoRoot)` function
- Add `getApps()` function
- Add `getApp(name)` function

### Task 2: Update wag_set_state handler

File: `server/index.ts`
- Accept `appRoot` and `repo` in POST /api/v1/state
- Call `upsertApp()` when state is set
- Store `selectedApp` with full details in memory

### Task 3: Add /api/v1/apps endpoint

File: `server/index.ts`
- GET handler returns `getApps()`

### Task 4: Add /api/v1/select endpoint

File: `server/index.ts`
- POST handler looks up app, updates state, broadcasts

### Task 5: Update wag-mcp tool definition

File: `mcp-servers/wag-mcp/src/index.ts`
- Add `appRoot` (required) and `repo` (optional) to wag_set_state schema

### Task 6: Update wagu command

File: `.claude/commands/wagu.md`
- Document that appRoot must be passed
- Show how to derive from cwd

### Task 7: Tests

File: `server/__tests__/apps.test.ts`
- Test upsertApp, getApps, getApp
- Test /api/v1/apps endpoint
- Test /api/v1/select endpoint
- Test state broadcast on app change

## Testing

- Unit tests for database functions
- Unit tests for new endpoints
- Integration: wag_set_state upserts app
- Integration: UI select switches app and broadcasts

## Acceptance Criteria

- [x] `apps` table in SQLite
- [x] `wag_set_state` expanded with `appRoot` and `repo` parameters
- [x] Calling `wag_set_state` upserts into apps table
- [x] `GET /api/v1/apps` returns list of known apps
- [x] `POST /api/v1/select` switches active app by name
- [x] Selecting app broadcasts state change to UI via SSE
- [x] wag-mcp tool definition updated for new parameters
- [x] wagu command updated to pass appRoot/repo
- [x] Tests written for new functionality
