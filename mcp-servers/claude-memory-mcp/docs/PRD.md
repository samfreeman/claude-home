# PRD: Claude Memory MCP

## Vision
Shared persistent memory between Claude Desktop and Claude Code, enabling seamless context handoffs without repeating information.

## Problem
- Each Claude interface starts fresh with no knowledge of other sessions
- Anthropic's userMemories are read-only, not always accurate, and unavailable in Claude Code
- Users repeat themselves constantly across interfaces

## Solution
SQLite-backed MCP server with structured storage for facts, hardware, projects, and async messaging (inbox/relays).

## Current State (v2.1.0)
- **Facts**: Key-value by category (background, personal, system, convention)
- **Hardware**: Inventory with location (office/couch/floating) and purpose
- **Projects**: Status tracking (active/paused/done)
- **Inbox**: Async message passing between Desktop ↔ Code
- **Relays**: Structured project coordination with context and tasks
- **Search**: OR word matching across all tables (just fixed)

## User Stories
1. User tells Desktop about hardware → Code can reference it
2. Desktop sends task to Code via inbox → Code picks it up
3. User asks "what car do I drive" → Either interface finds "Mustang Mach-E"

## Success Metrics
- Cross-interface queries return consistent results
- No "not in memory" when data exists
- Natural language queries find relevant facts

## Backlog
- Vector/semantic search if OR matching hits limits
- Auto-cleanup of old inbox items
- Memory sync status visibility

## Out of Scope (for now)
- Conversation history storage
- Document/file indexing
- Multi-user support
