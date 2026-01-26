# claude-memory-mcp

## Purpose

Claude sessions are stateless - every conversation starts fresh with no memory of previous sessions. This project solves that with ONE MCP server that gives Claude:

1. **Persistent Memory** - Remember things about the user across sessions:
   - Preferences and workflows
   - Hardware/device inventory
   - Projects and their status

2. **Desktop ↔ Code Coordination** - Two Claudes working together:
   - **Desktop** (Claude.ai) is good for chat, research, planning
   - **Code** (CLI) is good for implementation, file editing, running commands
   - Inbox and relay systems let them pass work to each other

**Example workflow:**
1. Chat with Desktop about a feature idea
2. Desktop sends a relay to Code with the spec
3. Code picks it up, implements it, sends status back
4. Desktop follows up with the user

**Two messaging systems in ONE server:**
- **Inbox**: Simple messages - source, target, title, content. Good for quick notes and status updates.
- **Relay**: Structured work packages with specs, context items, and task lists. Good for complex multi-step work.

Database is stored in ~/Dropbox/claude/ so it syncs across machines.

---

## Architecture

```
┌─────────────┐              ┌─────────────┐
│   Claude    │              │   Claude    │
│   Desktop   │              │    Code     │
│  (Windows)  │              │   (WSL2)    │
└──────┬──────┘              └──────┬──────┘
       │ MCP                        │ MCP
       ▼                            ▼
┌────────────────┐          ┌────────────────┐
│ claude-memory  │          │ claude-memory  │
│   -mcp         │          │   -mcp         │
└───────┬────────┘          └───────┬────────┘
        │                           │
        └─────────────┬─────────────┘
                      ▼
               ┌─────────────┐
               │   SQLite    │
               │  (shared)   │
               └─────────────┘
```

**Key points:**
- ONE MCP server (claude-memory-mcp), not two
- Each Claude client spawns its own MCP server process
- Both processes share the same SQLite database
- Desktop can't read files directly - it only sees what MCP tools expose
- SQLite with WAL mode handles concurrent reads fine
- Concurrent writes are rare in practice: the user directs writes, and you can only be in one conversation at a time

**Why better-sqlite3 (not sql.js)?**
- Consistent with other projects (samx uses it)
- Faster for heavy queries
- Requires build-essential once: `sudo apt-get install -y build-essential`

---

## Project Structure

```
claude-memory/
├── src/index.ts          # ALL functionality: memory + inbox + relay
├── package.json
├── tsconfig.json
└── README.md
```

**IMPORTANT: This is ONE server, not two. The handoff-mcp folder should be deleted after merging relay functionality into src/index.ts.**

## Setup Required

### 1. Install build tools (needed for better-sqlite3)

```bash
sudo apt-get update && sudo apt-get install -y build-essential
```

### 2. Install dependencies and build

```bash
cd ~/source/claude-memory
pnpm install
pnpm run build
```

### 3. Configure MCP server

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/home/samfr/source/claude-memory/dist/index.js"]
    }
  }
}
```

## Tools Reference

### Memory Tools
- `memory_read` - Read facts, hardware, or projects
- `memory_write` - Write facts, hardware, or projects
- `memory_search` - Search across all memory
- `memory_delete` - Delete a memory entry

### Inbox Tools (simple messages)
- `inbox_send` - Send a message to Desktop or Code
- `inbox_list` - List inbox items
- `inbox_read` - Read a specific inbox item
- `inbox_update` - Update status (pending → picked_up → done)
- `inbox_delete` - Delete an inbox item

### Relay Tools (structured work packages)
- `relay_create` - Create a relay with title and spec
- `relay_read` - Get relay with context and tasks
- `relay_list` - List relays by status
- `relay_update` - Update relay status or spec
- `relay_delete` - Delete relay and its context/tasks
- `context_add` - Add context (decision, note, file, code) to a relay
- `task_add` - Add a task to a relay
- `task_update` - Update task status or description

Database: `~/Dropbox/claude/memory.db`

## Code Style

Follow `/home/samfr/.claude/documents/typescript-rules.md`:
- Single quotes, no semicolons, tabs, no trailing commas
- `==` not `===`, else/catch on new lines
-