# ADR: PBI-001 - Workstreams Extension

## Status
DRAFT

## Context
Sam has 30+ scattered chats across topics with no single source of truth. Context gets lost, decisions repeated.

## Decision
Add workstreams feature to claude-memory MCP - persistent topic buckets that consolidate conversations.

## Implementation

### Schema (src/schema.ts)

Add 4 tables with `DATETIME DEFAULT CURRENT_TIMESTAMP`:

```sql
CREATE TABLE IF NOT EXISTS workstreams (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY,
  workstream_id INTEGER NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  decided_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  superseded_by INTEGER,
  FOREIGN KEY (workstream_id) REFERENCES workstreams(id)
);

CREATE TABLE IF NOT EXISTS chat_index (
  id INTEGER PRIMARY KEY,
  workstream_id INTEGER NOT NULL,
  chat_url TEXT,
  chat_date DATE,
  synopsis TEXT,
  key_outcomes TEXT,
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workstream_id) REFERENCES workstreams(id)
);

CREATE TABLE IF NOT EXISTS open_questions (
  id INTEGER PRIMARY KEY,
  workstream_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  context TEXT,
  raised_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  resolution TEXT,
  FOREIGN KEY (workstream_id) REFERENCES workstreams(id)
);
```

### Types (src/types.ts)

```typescript
export interface Workstream {
  id: number
  name: string
  summary: string | null
  created_at: string
  updated_at: string
}

export interface Decision {
  id: number
  workstream_id: number
  decision: string
  rationale: string | null
  decided_at: string
  superseded_by: number | null
}

export interface ChatIndex {
  id: number
  workstream_id: number
  chat_url: string | null
  chat_date: string | null
  synopsis: string | null
  key_outcomes: string | null
  indexed_at: string
}

export interface OpenQuestion {
  id: number
  workstream_id: number
  question: string
  context: string | null
  raised_at: string
  resolved_at: string | null
  resolution: string | null
}
```

### Tools (src/index.ts)

Register 13 new tools:
- `workstream_list`, `workstream_create`, `workstream_read`, `workstream_update`, `workstream_delete`
- `decision_add`, `decision_supersede`, `decision_list` (with `include_superseded` param, default false)
- `chat_register`, `chat_list`
- `question_add`, `question_resolve`, `question_list`

### Handlers (src/handlers/workstream.ts)

New file with all handler functions. Pattern matches existing handlers:
- Lookup workstream by name or id
- CASCADE delete removes related records
- `workstream_read` returns full context (details + decisions + questions + recent chats)

### Seed Data

On init, if workstreams table empty, seed 6 workstreams:
- twg, hardware, claude-tools, methodology, raiders, trading

## Testing

- [ ] Unit tests for each handler function
- [ ] Integration test: create workstream, add decision, supersede it, verify list
- [ ] Integration test: workstream_read returns all related data
- [ ] Integration test: delete cascades properly

## Acceptance Criteria

- [ ] Schema: 4 new tables created
- [ ] Tools: 5 workstream + 3 decision + 2 chat + 3 question = 13 tools
- [ ] Seed: 6 initial workstreams
- [ ] Tests: Coverage for all new code