# Sam's Claude Code Home (~/.claude)

This is the configuration folder for Claude Code CLI. Here's what's available:

---

## Slash Commands (`/commands/`)

Commands that Claude Code can run:

| Command | Description |
|---------|-------------|
| `/wag` | Product development workflow: DOCS → ADR → DEV with gate checks |
| `/wagu` | Same as wag but with real-time UI broadcasting |
| `/save` | Save conversation context for later |
| `/load` | Load a previously saved context |
| `/pw` | Playwright browser control |

---

## Documents (`/documents/`)

Reference docs Claude Code follows:

- **typescript-rules.md** - Code style rules (single quotes, no semicolons, tabs, no trailing commas, == not ===)
- **wsl2-setup.md** - WSL2 environment setup notes

---

## Agents (`/agents/`)

Specialized sub-agents:

- **architect.md** - Gate-check reviewer that evaluates changesets before commit (returns APPROVE/REJECT)

---

## MCP Servers (`/mcp-servers/`)

- **claude-memory-mcp** - Persistent memory and Desktop ↔ Code coordination
- **wag-mcp** - Broadcasts WAG workflow state to wagui frontend
- **playwright-mcp** - Browser automation and testing

---

## Tools (`/tools/`)

- **wagui** - Real-time UI for WAG workflow (React frontend + Express backend)

---

## Key Files

- **CLAUDE.md** - Global rules (Write tool for diffs, TypeScript style, git commit format)
- **settings.json** - Permissions (auto-approve for tests, builds, git operations)
- **memory.db** - SQLite database for claude-memory-mcp

---

## claude-memory-mcp

One MCP server providing:

### Memory
- `memory_read`, `memory_write`, `memory_search`, `memory_delete`
- Facts (preferences, workflows)
- Hardware inventory
- Projects tracking

### Inbox (simple messages)
- `inbox_send`, `inbox_list`, `inbox_read`, `inbox_update`, `inbox_delete`
- Quick notes and status updates between Desktop and Code

### Relay (structured work packages)
- `relay_create`, `relay_read`, `relay_list`, `relay_update`, `relay_delete`
- `context_add`, `task_add`, `task_update`
- Complex multi-step work with specs, context, and task lists

---

## Workflow: Desktop → Code

1. **Desktop** brainstorms/plans with user
2. Desktop creates relay: `relay_create(title, spec)`
3. Desktop adds tasks: `task_add(relay_id, description, assigned_to: "code")`
4. **Code** picks up: `relay_list()` → `relay_read(id)`
5. Code implements, updates tasks: `task_update(id, status: "complete")`
6. Desktop checks status: `relay_read(id)`
