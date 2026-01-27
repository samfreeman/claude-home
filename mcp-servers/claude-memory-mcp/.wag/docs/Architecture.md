# claude-memory - Architecture

## Overview

Workstreams extend the existing claude-memory MCP server. Same database (Turso/libSQL), same patterns as existing tools.

## Current Source Structure

```
src/
├── index.ts              # MCP server + tool registrations
├── schema.ts             # SQL schema definitions
├── db.ts                 # Database connection (libSQL/Turso)
├── types.ts              # TypeScript interfaces
└── handlers/
    ├── memory.ts         # memory_* tool handlers
    ├── inbox.ts          # inbox_* tool handlers
    └── relay.ts          # relay_* + context_* + task_* handlers
```

## Database Schema

### New Tables (to add to schema.ts)

```sql
CREATE TABLE workstreams (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE decisions (
  id INTEGER PRIMARY KEY,
  workstream_id INTEGER NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  decided_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  superseded_by INTEGER,
  FOREIGN KEY (workstream_id) REFERENCES workstreams(id)
);

CREATE TABLE chat_index (
  id INTEGER PRIMARY KEY,
  workstream_id INTEGER NOT NULL,
  chat_url TEXT,
  chat_date DATE,
  synopsis TEXT,
  key_outcomes TEXT,
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workstream_id) REFERENCES workstreams(id)
);

CREATE TABLE open_questions (
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

## MCP Tools

### Workstream Tools

| Tool | Parameters | Description |
|------|------------|-------------|
| `workstream_list` | (none) | List all workstreams |
| `workstream_create` | name, summary? | Create workstream |
| `workstream_read` | name or id | Full context: details + decisions + questions + chats |
| `workstream_update` | name or id, summary | Update summary |
| `workstream_delete` | name or id | Delete with cascade |

### Decision Tools

| Tool | Parameters | Description |
|------|------------|-------------|
| `decision_add` | workstream, decision, rationale? | Add decision |
| `decision_supersede` | decision_id, new_decision, new_rationale? | Replace decision |
| `decision_list` | workstream, include_superseded? | List decisions (default: active only) |

### Chat Index Tools

| Tool | Parameters | Description |
|------|------------|-------------|
| `chat_register` | workstream, chat_url, synopsis, key_outcomes?, chat_date? | Index a chat |
| `chat_list` | workstream, limit? | List indexed chats |

### Question Tools

| Tool | Parameters | Description |
|------|------------|-------------|
| `question_add` | workstream, question, context? | Add question |
| `question_resolve` | question_id, resolution | Resolve question |
| `question_list` | workstream, status? | List questions (open/resolved/all) |

## Implementation Changes

### Files to Modify
- `src/schema.ts` - Add 4 new tables
- `src/types.ts` - Add Workstream, Decision, ChatIndex, OpenQuestion interfaces
- `src/index.ts` - Register 13 new tools

### Files to Create
- `src/handlers/workstream.ts` - All workstream tool handlers

## Integration Notes

- Workstream lookup by name or id (like relay tools)
- CASCADE delete on workstream removes decisions, chats, questions
- `workstream_read` is the main entry point - call at conversation start
- Seed data runs once on schema init (check if workstreams table empty)