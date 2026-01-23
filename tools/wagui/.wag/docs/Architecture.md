# WAGUI - Architecture

## System Overview

```
┌─────────────────┐     SSE      ┌─────────────────┐
│   wag-mcp       │─────────────▶│     wagui       │
│   (port 3099)   │              │   (port 3098)   │
└─────────────────┘              └─────────────────┘
        ▲                                │
        │ MCP tools                      │
        │                                ▼
┌─────────────────┐              ┌─────────────────┐
│  Claude Code    │              │    Browser      │
│  (WAGU workflow)│              │   (User view)   │
└─────────────────┘              └─────────────────┘
```

## Component Architecture

### Frontend (Next.js App Router)

```
src/
├── app/
│   ├── layout.tsx      # Root layout with fonts
│   ├── page.tsx        # Main page (client component)
│   └── globals.css     # Tailwind + shadcn styles
├── components/
│   ├── Header.tsx      # Status bar with mode/app/connection
│   ├── Message.tsx     # Individual message card
│   ├── MessageList.tsx # Scrollable message container
│   └── ui/             # shadcn components
├── hooks/
│   └── useSSE.ts       # SSE connection hook
└── lib/
    ├── types.ts        # Shared types (WagMessage, WagState, etc.)
    ├── db.ts           # SQLite persistence layer
    └── utils.ts        # shadcn utilities
```

### Data Flow

1. **SSE Connection** (`useSSE` hook)
   - Connects to `http://localhost:3099/events`
   - Listens for `message`, `state`, and `connected` events
   - Auto-reconnects on disconnect (3 second delay)
   - Maintains message array and current state

2. **Message Rendering**
   - Messages stored in React state
   - Rendered as cards with role-based colors
   - Auto-scrolls to bottom on new messages

3. **Persistence** (Future)
   - `db.ts` provides SQLite interface
   - Messages stored per-app in `data/{app}.db`
   - Can load history on page load

## Key Types

```typescript
type WagMode = 'DOCS' | 'ADR' | 'DEV' | null
type WagRole = 'user' | 'pm' | 'architect' | 'dev'
type MessageType = 'chat' | 'proposal' | 'review' | 'diff' | 'decision' | 'system'

interface WagMessage {
  id: string
  timestamp: number
  header: WagHeader
  role: WagRole
  type: MessageType
  content: string
  metadata?: { file?, task?, pbi?, approved? }
}

interface WagState {
  header: WagHeader
  activePbi?: string
  currentTask?: number
  totalTasks?: number
}
```

## Design Decisions

### Why SSE over WebSockets?
- Simpler server implementation
- One-way communication is sufficient (UI is read-only)
- Built-in browser reconnection support
- Works through proxies without special configuration

### Why SQLite for persistence?
- Zero configuration
- File-based (one DB per app)
- Good enough for local development use case
- No need for external database server

### Why fixed ports?
- 3098 for wagui avoids conflict with apps being developed (typically 3000)
- 3099 for SSE is adjacent and easy to remember
- Both defined in single place for consistency

## Future Considerations

### Sidebars
The layout should support optional sidebars for:
- File tree / project explorer
- Task list / TODO view
- Context panel (current PBI, ADR details)

Layout structure should use flex-based design to accommodate sidebars without major refactoring.
