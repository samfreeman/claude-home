# ADR: PBI-028 - Transcript Message Filtering

## Status

Completed

## Context

Transcript polling shows infrastructure noise that clutters the chat display:

1. **Command invocation tags** - `<command-message>wagu</command-message>`
2. **Context compaction summaries** - "This session is being continued from a previous conversation..."
3. **System reminder tags** - `<system-reminder>` blocks embedded in messages
4. **IDE events** - `<ide_opened_file>` injected into user messages

Worse: system-injected content is being attributed to the user. If the user didn't type it, it's not theirs.

## Decision

### Layer 1: Filter known patterns

Skip or transform known system patterns:

| Pattern | Action |
|---------|--------|
| `<command-message>`, `<command-name>` | Skip message |
| `<ide_opened_file>` | Skip message |
| "This session is being continued..." | Transform to `[Session resumed]` |
| `<system-reminder>...</system-reminder>` | Strip from content |

### Layer 2: Fallback attribution

If a "user" type message starts with `<` (XML-style tag), it's system-injected, not user-typed:
- Either skip it
- Or attribute to "system" role, not "user"

```typescript
// If user message starts with < tag, it's system-injected
if (entry.type == 'user' && text.trimStart().startsWith('<'))
    return null  // or change role to 'system'
```

### Implementation

```typescript
export function parseTranscriptEntry(entry: TranscriptEntry, app: string): WagMessage | null {
    // ... existing extraction logic ...

    // Skip command/IDE tags
    if (text.startsWith('<command-message>') || text.startsWith('<command-name>'))
        return null
    if (text.startsWith('<ide_opened_file>'))
        return null

    // Transform context compaction to summary
    if (text.includes('This session is being continued from a previous conversation'))
        text = '[Session resumed]'

    // Strip system-reminder tags
    text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()

    // Fallback: user messages starting with < are system-injected
    if (entry.type == 'user' && text.trimStart().startsWith('<'))
        return null

    if (!text)
        return null

    // ... return message ...
}
```

## Testing

- `it('filters command-message tags')`
- `it('filters command-name tags')`
- `it('filters ide_opened_file tags')`
- `it('transforms context compaction to summary')`
- `it('strips system-reminder tags from content')`
- `it('filters user messages starting with XML tags')`
- `it('returns null when only system-reminder content')`

## Acceptance Criteria

- [x] Command invocation messages filtered out
- [x] IDE event messages filtered out
- [x] Context compaction transformed to brief summary
- [x] System reminder tags stripped from content
- [x] User messages with system-injected tags not attributed to user
- [x] Tests written for filtering logic

## Consequences

### Positive
- Clean chat display
- Correct attribution - user only sees what they typed
- Defense in depth with fallback filter

### Negative
- May filter legitimate messages starting with `<` (unlikely in chat)
- Need to maintain filter patterns as Claude Code evolves
