# ADR-003: Teams-Style Chat Bubble Layout

## PBI
PBI-003: Teams-Style Chat Bubble Layout

## Status
Approved

## Context
The current message display uses Card components with colored backgrounds per role. This creates visual noise and takes up excessive vertical space. Users want a compact, chat-style layout similar to Microsoft Teams.

## Decision

### Layout Structure
```
Left-aligned (PM, Architect, Dev):
┌──────────────────────────────────────────────────┐
│ [Avatar] Role Name                    12:34:56   │
│          ┌─────────────────────────────────────┐ │
│          │ Message content here...             │ │
│          │ 💬 chat                             │ │
│          └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘

Right-aligned (User):
┌──────────────────────────────────────────────────┐
│                           12:34:56   Role Name   │
│ ┌─────────────────────────────────────┐          │
│ │ Message content here...             │          │
│ │ 💬 chat                             │          │
│ └─────────────────────────────────────┘          │
└──────────────────────────────────────────────────┘
```

### Avatar Colors (only colored element)
- **User:** `bg-purple-600`
- **PM:** `bg-purple-400`
- **Architect:** `bg-amber-500`
- **Dev:** `bg-green-600`

### Avatar Initials
- User: "U"
- PM: "PM"
- Architect: "A"
- Dev: "D"

### Bubble Styling
- Background: `bg-zinc-800` (uniform for all roles)
- Border radius: `rounded-lg`
- Padding: `px-3 py-2`
- Max width: constrained to ~80% of container

### Spacing
- Between messages: `mb-2` (8px) instead of current `mb-3` (12px)
- Internal padding: minimal

### Metadata Display
- Timestamp: inline with role name, muted color
- Type emoji: at end of message content, small
- PBI/File badges: small badges below content when present
- Approve/Reject: inline badge after content for review messages

## Implementation Tasks

1. **Rewrite Message.tsx**
   - Remove Card/CardHeader/CardContent imports
   - Add Avatar component (circle with initials)
   - Implement conditional left/right alignment
   - New bubble styling with uniform dark background

2. **Update helper functions**
   - `getAvatarColor(role)` - returns Tailwind bg class
   - `getRoleInitials(role)` - returns initials string
   - Keep `getTypeBadge()` and `formatTimestamp()`
   - Remove `getRoleColor()` and `getRoleBadgeVariant()`

3. **Verify auto-scroll**
   - Confirm MessageList.tsx auto-scroll works with new layout

## Testing

- [ ] Visual verification of left/right alignment
- [ ] Avatar colors match specification
- [ ] Uniform bubble color (no role-based coloring)
- [ ] Compact spacing compared to current
- [ ] Auto-scroll works on new messages
- [ ] Metadata displays correctly (PBI, file, approve/reject)

## Acceptance Criteria (from PBI)
- [x] User messages right-aligned
- [x] Other roles (PM, Architect, Dev) left-aligned with avatar/initials
- [x] Role name displayed above message bubble
- [x] Uniform dark bubble color for all messages (not colored by role)
- [x] Only avatar circle is color-coded by role
- [x] Compact vertical spacing between messages
- [x] Timestamp displayed inline (not in separate header)
- [x] Message type indicator (emoji) inline with content
- [x] Approve/Reject badges inline for review messages
- [x] Auto-scroll to bottom when new messages arrive
- [ ] Tests written for new code
