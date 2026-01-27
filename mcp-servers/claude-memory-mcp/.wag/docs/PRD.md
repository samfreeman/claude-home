# claude-memory - Product Requirements Document

## Vision

Extend claude-memory MCP with **workstreams** - persistent topic buckets that consolidate scattered conversations into meaningful, related compartments.

## Problem Statement

Sam has 30+ chats across topics (TGW, hardware, methodology, etc.) with no single source of truth. Context gets lost, decisions repeated, same ground covered multiple times.

## Goals

1. **Consolidate context** - Group related conversations under named workstreams
2. **Track decisions** - Record decisions with rationale, support superseding old decisions
3. **Index conversations** - Register chats with synopsis and key outcomes
4. **Surface open questions** - Track unresolved questions per workstream

## Features

### Workstream Management
- Create, read, update, delete workstreams
- Each workstream has: name, summary, timestamps
- `workstream_read` is the key "catch me up" tool - returns decisions, questions, recent chats

### Decision Tracking
- Add decisions with rationale
- Supersede old decisions (link old → new)
- List decisions, optionally including superseded ones

### Conversation Index
- Register chats with URL, synopsis, key outcomes
- List recent chats per workstream

### Open Questions
- Add questions with context
- Resolve questions with resolution text
- List open/resolved/all questions

## Initial Workstreams (Seed Data)

| Name | Summary |
|------|---------|
| twg | VR tactical game "Training Gone Wrong". Master spec consolidated from 6 docs. 3-mission Kickstarter demo planned. Synty assets selected. IvanMurzak Unity MCP chosen. |
| hardware | Office setup: Samsung G9 57" + Mac Mini M4 Pro + Legion Pro 7. G9 KVM for switching. Comet Pro for remote. Yoga Book 9i for couch/travel. |
| claude-tools | MCP ecosystem development. claude-memory on Turso. MM agent spec drafted. WAG workflow for Claude Code. |
| methodology | Vision-to-Testable methodology for converting fuzzy requirements to executable specs. |
| raiders | Las Vegas Raiders 2026 NFL Draft tracking. |
| trading | Mean reversion stock app concept. Daily buy, sell winners. Backtesting architecture drafted. |

## Success Criteria

- [ ] Can create/read/update/delete workstreams
- [ ] Can add decisions and supersede them
- [ ] Can register and list chats
- [ ] Can add, resolve, and list questions
- [ ] Initial workstreams seeded
- [ ] `workstream_read` returns full context for any workstream
