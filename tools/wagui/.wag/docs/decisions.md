# WAGUI - Decision Log

## 2026-01-12: Initial Architecture

### Port Selection
- **Decision:** Use port 3098 for wagui, 3099 for wag-mcp SSE
- **Rationale:** Avoids conflict with apps being developed (typically 3000-3010)
- **Decided by:** User + Claude

### Tech Stack
- **Decision:** Next.js 15, Tailwind v4, shadcn @canary, better-sqlite3
- **Rationale:** Modern stack, good DX, consistent with other tools in repo
- **Decided by:** User + Claude

### SSE vs WebSockets
- **Decision:** Use SSE for real-time updates
- **Rationale:** Simpler, one-way communication sufficient, built-in reconnection
- **Decided by:** Claude (Architect role)

### Directory Location
- **Decision:** Place wagui in `tools/` not `mcp-servers/`
- **Rationale:** It's a standalone web app, not an MCP server
- **Decided by:** User
