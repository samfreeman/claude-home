# ADR: PBI-029 Transcript Polling & Display

## Status
DRAFT

## Context

Currently wagui shows only what Claude explicitly sends via `wag_send_message`. This is unreliable:
- Claude forgets to forward messages
- User messages are often missing
- Interruptions aren't captured
- The feed is incomplete

Claude Code writes everything to a transcript file. We should read from that instead.

## Decision

### 1. Transcript Path Derivation

Given an `appRoot` from the app registry (PBI-028):

```
appRoot: /home/samf/source/claude/tools/samx
    ↓
Encode: replace / with -
    ↓
~/.claude/projects/-home-samf-source-claude-tools-samx/
    ↓
Find most recent .jsonl file by mtime
```

**Implementation:**
```typescript
function getTranscriptDir(appRoot: string): string {
    const encoded = appRoot.replace(/\//g, '-')
    return path.join(os.homedir(), '.claude', 'projects', encoded)
}

function findLatestTranscript(dir: string): string | null {
    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
    return files[0]?.name ? path.join(dir, files[0].name) : null
}
```

### 2. Database Schema Addition

New table in `db.ts`:

```sql
CREATE TABLE IF NOT EXISTS transcript_offsets (
    app TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    byte_offset INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
)
```

**Functions:**
- `getTranscriptOffset(app)` → `{ filePath, byteOffset } | null`
- `setTranscriptOffset(app, filePath, byteOffset)` → void

### 3. Transcript Entry Parsing

**Input format (JSONL):**
```json
{
  "type": "user",
  "message": { "content": [{"type": "text", "text": "hello"}] },
  "uuid": "abc123",
  "timestamp": "2026-01-22T10:30:00.000Z"
}
```

**Normalization to WagMessage:**

| Transcript | WagMessage |
|------------|------------|
| `type: "user"` | `role: "user"`, `type: "chat"` |
| `type: "assistant"` + text content | `role: "dev"`, `type: "chat"` |
| `type: "assistant"` + tool_use | Skip (or optional display) |
| `uuid` | `id` |
| `timestamp` (ISO) | `timestamp` (ms) |

**New field:** `source: "transcript" | "wag"` to distinguish origin.

**Parser function:**
```typescript
interface TranscriptEntry {
    type: 'user' | 'assistant' | 'progress' | string
    message?: { content: Array<{ type: string; text?: string }> }
    uuid: string
    timestamp: string
}

function parseTranscriptEntry(entry: TranscriptEntry, app: string): WagMessage | null {
    // Skip non-message types
    if (!['user', 'assistant'].includes(entry.type)) return null
    if (!entry.message?.content) return null

    // Extract text content
    const textBlocks = entry.message.content.filter(c => c.type == 'text')
    if (textBlocks.length == 0) return null

    const content = textBlocks.map(b => b.text).join('\n')

    return {
        id: entry.uuid,
        timestamp: new Date(entry.timestamp).getTime(),
        header: {
            mode: null,
            app,
            branch: 'dev',
            context: 'From transcript'
        },
        role: entry.type == 'user' ? 'user' : 'dev',
        type: 'chat',
        content,
        metadata: { source: 'transcript' }
    }
}
```

### 4. Polling Engine

**New file:** `server/transcript.ts`

```typescript
let pollInterval: NodeJS.Timeout | null = null
let currentApp: string | null = null

export function startPolling(app: string, appRoot: string, onMessage: (msg: WagMessage) => void) {
    stopPolling()
    currentApp = app

    const transcriptDir = getTranscriptDir(appRoot)

    pollInterval = setInterval(() => {
        const filePath = findLatestTranscript(transcriptDir)
        if (!filePath) return

        const offset = getTranscriptOffset(app)

        // Check if file changed (new session)
        if (offset && offset.filePath != filePath) {
            setTranscriptOffset(app, filePath, 0)
        }

        const currentOffset = offset?.filePath == filePath ? offset.byteOffset : 0
        const newMessages = readNewEntries(filePath, currentOffset)

        for (const entry of newMessages.entries) {
            const msg = parseTranscriptEntry(entry, app)
            if (msg) onMessage(msg)
        }

        setTranscriptOffset(app, filePath, newMessages.newOffset)
    }, 500)
}

export function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
    }
    currentApp = null
}

function readNewEntries(filePath: string, offset: number): { entries: TranscriptEntry[], newOffset: number } {
    const fd = fs.openSync(filePath, 'r')
    const stats = fs.fstatSync(fd)

    if (stats.size <= offset) {
        fs.closeSync(fd)
        return { entries: [], newOffset: offset }
    }

    const buffer = Buffer.alloc(stats.size - offset)
    fs.readSync(fd, buffer, 0, buffer.length, offset)
    fs.closeSync(fd)

    const lines = buffer.toString('utf8').split('\n').filter(l => l.trim())
    const entries: TranscriptEntry[] = []

    for (const line of lines) {
        try {
            entries.push(JSON.parse(line))
        } catch {
            // Incomplete line, will retry next poll
        }
    }

    return { entries, newOffset: stats.size }
}
```

### 5. Server Integration

In `server/index.ts`:

**On app selection or state update with appRoot:**
```typescript
import { startPolling, stopPolling } from './transcript'

// In handleState (when appRoot provided):
if (appRoot) {
    startPolling(app, appRoot, (msg) => {
        // Dedupe check
        const existing = getMessageById(msg.id)
        if (!existing) {
            saveMessage(msg)
            broadcast('message', msg)
        }
    })
}

// In handleSelect:
const app = getApp(body.app)
if (app) {
    startPolling(app.name, app.appRoot, ...)
}

// On server shutdown:
process.on('SIGTERM', () => stopPolling())
```

**New DB function for dedup:**
```typescript
export function getMessageById(id: string): WagMessage | null {
    return db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as WagMessage | null
}
```

### 6. Message Ordering

Messages from both sources (transcript + wag_send_message) are stored in the same `messages` table and sorted by `timestamp`. The existing `getMessages()` already orders by timestamp ASC.

### 7. UI Indicator (Optional)

Add visual indicator for transcript-sourced messages:
- Small icon or badge showing "📜" or "transcript"
- Helps user distinguish auto-captured vs manually sent messages

## Tasks

1. Add `transcript_offsets` table to `db.ts`
2. Add `getMessageById()` function to `db.ts`
3. Create `server/transcript.ts` with polling engine
4. Integrate polling into `server/index.ts` state/select handlers
5. Update `WagMessage` type to include optional `source` field
6. Add transcript source indicator to Message component (optional)
7. Write tests for transcript parsing

## Acceptance Criteria

- [ ] Server derives transcript path from app's appRoot
- [ ] Server polls transcript file for new content
- [ ] File offset tracked to avoid re-reading (transcript_offsets table)
- [ ] Messages deduped by UUID before insert
- [ ] Transcript entries normalized to WagMessage format
- [ ] User messages (`type: "user"`) displayed
- [ ] Assistant text (`type: "assistant"`, content.type: "text") displayed
- [ ] Tool calls optionally shown (toggle in UI) - DEFERRED
- [ ] Interruptions captured and displayed
- [ ] Switching apps switches transcript watching
- [ ] Messages sorted chronologically (transcript + wag_send_message interleaved)
- [ ] Tests written for transcript parsing

## Risks

1. **File locking**: Claude Code may have file locked during writes. Mitigation: read-only open, handle EBUSY gracefully.
2. **Large transcripts**: Long sessions could have huge files. Mitigation: offset tracking ensures we only read new content.
3. **Session switching**: User starts new Claude session = new .jsonl file. Mitigation: always check for most recent file by mtime.

## Dependencies

- PBI-028 (App Registry) ✅ Completed - provides appRoot
