# ADR: PBI-007 - Broadcast Clear Event to wagui

## Status
COMPLETED

## Context
When `wag_clear()` is called, the server clears SQLite and resets state, but wagui continues displaying old messages because:
1. Server broadcasts `state` event but no `clear` event
2. wagui has no listener for a `clear` event to reset the messages array

## Decision

### 1. Server Change (server/index.ts)
Add `broadcast('clear', {})` in the DELETE handler before the state broadcast:

```typescript
if (req.method == 'DELETE') {
    clearMessages()
    state = {
        header: {
            mode: null,
            app: '',
            branch: 'dev',
            context: ''
        }
    }
    broadcast('clear', {})  // ADD THIS
    broadcast('state', state)
    sendJson(res, { success: true, message: 'Messages cleared' })
    return
}
```

### 2. wagui Change (src/hooks/useSSE.ts)
Add event listener for `clear` in both `connect()` and `reconnect()` functions:

```typescript
eventSource.addEventListener('clear', () => {
    setMessages([])
})
```

## Implementation Plan

| Task | File | Change |
|------|------|--------|
| 1 | server/index.ts | Add `broadcast('clear', {})` on line ~195 |
| 2 | src/hooks/useSSE.ts | Add `clear` listener in `connect()` (~line 76) |
| 3 | src/hooks/useSSE.ts | Add `clear` listener in `reconnect()` (~line 134) |

## Testing

- [x] Manual test: Send messages, call `wag_clear()`, verify wagui clears immediately
- [x] Verify state header also resets in wagui
- [x] Verify no browser refresh needed

## Acceptance Criteria
- [x] wag-mcp broadcasts "clear" event when `clear()` is called
- [x] wagui listens for "clear" event and resets message state
- [x] wagui clears displayed messages immediately when event received
- [x] State header also resets in wagui
- [x] Tests written for new code
