# claude-memory-mcp

Persistent memory and Desktop↔Code coordination for Claude.

## What This Does

- **Memory**: Store facts, hardware inventory, and projects across sessions
- **Inbox**: Simple messages between Claude Desktop and Claude Code
- **Relay**: Structured work packages with specs, context, and tasks

## Development

### Prerequisites

```bash
sudo apt-get update && sudo apt-get install -y build-essential
```

### Build

```bash
cd ~/source/claude-memory
pnpm install
pnpm run build
```

### Deploy

```bash
cp -r dist ~/.claude/mcp-servers/claude-memory-mcp/
```

## Configuration

### Claude Desktop (Windows)

Add to `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "wsl",
      "args": ["-e", "node", "/home/samfr/.claude/mcp-servers/claude-memory-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop.

### Claude Code (WSL2)

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/home/samfr/.claude/mcp-servers/claude-memory-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### Memory
- `memory_read`, `memory_write`, `memory_search`, `memory_delete`

### Inbox
- `inbox_send`, `inbox_list`, `inbox_read`, `inbox_update`, `inbox_delete`

### Relay
- `relay_create`, `relay_read`, `relay_list`, `relay_update`, `relay_delete`
- `context_add`, `task_add`, `task_update`

## Database

`~/.claude/memory.db`