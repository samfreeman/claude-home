# ADR-005: Context Dividers in Chat

## PBI
PBI-005: Context Dividers in Chat

## Status
Approved

## Context
The user wants visual indicators in the chat when context changes - such as when `wag_set_state` is called. These should be inline with messages but visually distinct (not chat bubbles).

Additionally:
- User messages are not consistently appearing in wagui because the wagu command doesn't make it explicit that ALL user messages must be forwarded via `wag_send_message`.
- When the user interrupts Claude mid-operation, there's no record of what was interrupted, making the conversation history confusing.

## Decision

### Approach: Context as a Message Type
Treat context changes as messages with `type: 'context'`. This keeps a single unified message stream with different visual rendering based on type.

### Changes

#### 1. wag-mcp (mcp-servers/wag-mcp)

**types.ts** - Add 'context' to MessageType:
```typescript
export type MessageType = 'chat' | 'proposal' | 'review' | 'diff' | 'decision' | 'system' | 'context'
```

**index.ts** - In `wag_set_state` handler, after updating state, add a context message:
```typescript
// After store.setState()
const contextContent = formatContextMessage(mode, pbi, task, totalTasks, context)
store.addMessage('dev', 'context', contextContent)
```

Helper function to format context:
```typescript
function formatContextMessage(
    mode: string | null,
    pbi?: string,
    task?: number,
    totalTasks?: number,
    context?: string
): string {
    const parts: string[] = []
    if (mode) parts.push(`Mode: ${mode}`)
    if (pbi) parts.push(pbi)
    if (task && totalTasks) parts.push(`Task ${task}/${totalTasks}`)
    if (context) parts.push(context)
    return parts.join(' | ')
}
```

#### 2. wagui (tools/wagui)

**lib/types.ts** - Add 'context' to MessageType:
```typescript
export type MessageType = 'chat' | 'proposal' | 'review' | 'diff' | 'decision' | 'system' | 'context'
```

**components/Message.tsx** - Render context messages as divider lines:
```typescript
export function Message({ message }: MessageProps) {
    if (message.type == 'context') {
        return <ContextDivider content={message.content} timestamp={message.timestamp} />
    }
    // ... existing bubble rendering
}
```

**components/ContextDivider.tsx** - New component:
```typescript
interface ContextDividerProps {
    content: string
    timestamp: number
}

export function ContextDivider({ content }: ContextDividerProps) {
    return (
        <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
                {content}
            </span>
            <div className="flex-1 h-px bg-border" />
        </div>
    )
}
```

#### 3. wagu.md Command (.claude/commands/wagu.md)

**A. Update "When to Send Messages" section** to make it explicit that ALL user messages must be forwarded:

```markdown
### When to Send Messages

**CRITICAL: Forward ALL User Messages**
Every time the user sends a message, you MUST call `wag_send_message` to forward it to wagui:
```
wag_send_message(role: "user", type: "chat", content: "[exact user message]")
```
This ensures the complete conversation appears in wagui. Missing user messages makes the conversation history confusing and incomplete.

**Role-specific messages:**
- **PM speaking:** `role: "pm"`, `type: "chat"` or `"proposal"`
- **Architect reviewing:** `role: "architect"`, `type: "review"`, include `approved`
- **Dev proposing code:** `role: "dev"`, `type: "diff"`, include `file`
- **Decisions:** `role: "pm"` or `"architect"`, `type: "decision"`
```

**B. Add new "Handling Interruptions" section** after "When to Send Messages":

```markdown
### Handling Interruptions

When you see `[Request interrupted by user]` in the conversation, the user stopped your previous operation mid-execution. You MUST:

1. Send a system message describing what was interrupted:
   ```
   wag_send_message(role: "dev", type: "system", content: "Interrupted while [describe what you were doing]")
   ```

2. Then forward the user's message and process their new request.

This provides context in wagui about what was happening when the interruption occurred.

**Examples:**
- "Interrupted while starting DEV mode for PBI-005"
- "Interrupted while waiting for architect review of task 3"
- "Interrupted while committing ADR changes"
```

## Implementation Tasks

1. **Update wag-mcp types** - Add 'context' to MessageType
2. **Update wag_set_state handler** - Emit context message on state change
3. **Update wagui types** - Add 'context' to MessageType
4. **Create ContextDivider component** - Render divider line with text
5. **Update Message component** - Conditionally render ContextDivider for context type
6. **Update wagu.md command** - Add explicit instruction about forwarding ALL user messages
7. **Update wagu.md command** - Add "Handling Interruptions" section
8. **Rebuild wag-mcp** - `npm run build` and restart Claude Code

## Testing

- [x] Call `wag_set_state` and verify context message appears in SSE stream
- [x] Verify wagui displays context as divider line (not bubble)
- [x] Verify context interleaves correctly with regular messages by timestamp
- [x] Verify different context scenarios display correctly (mode change, PBI change, task change)
- [x] Verify user messages appear in wagui when forwarded
- [x] Verify interruption handling logs what was interrupted

## Acceptance Criteria (from PBI)
- [x] Divider appears when mode changes (DOCS → ADR → DEV)
- [x] Divider appears when PBI is selected/changed
- [x] Divider shows relevant context (mode name, PBI number)
- [x] Dividers are visually distinct from messages
- [x] All user messages appear in wagui conversation history
- [x] Interruptions are logged with context about what was interrupted
- [x] Tests written for new code
