# ADR-004: Layout Fixes - Sticky Header and Scrollable Message Area

## PBI
PBI-004: Fix Layout - Sticky Header and Scrollable Message Area

## Status
Approved

## Context
Users reported several layout issues:
1. Header scrolls away when viewing messages at the bottom
2. Auto-scroll (from PBI-003) not working - new messages don't auto-scroll into view
3. Entire page scrolls instead of just the message area
4. Need to support future sidebars

## Design Reference
See `docs/design/teams-chat-reference.png` for the target layout inspiration (Microsoft Teams chat).

## Problem Analysis

### Auto-scroll Bug
The `ScrollArea` component (shadcn/radix) doesn't forward refs to the scrollable element. The ref is attached to the Root element, but scrolling happens on the internal Viewport element.

```typescript
// Current (broken)
<ScrollArea className="flex-1" ref={scrollRef}>  // ref goes to Root, not Viewport
```

### Layout Issues
- Container uses `min-h-screen` which allows content to grow beyond viewport
- Header has no sticky/fixed positioning
- No explicit height constraint forces message area to use remaining space

## Decision

### Layout Structure
```
┌─────────────────────────────────────────────┐
│ Header (sticky, h-14)                       │
├─────────────────────────────────────────────┤
│ (optional error bar)                        │
├─────────────────────────────────────────────┤
│                                             │
│ Message Area (flex-1, overflow-y-auto)      │
│ - Scrolls independently                     │
│ - Auto-scrolls to bottom on new messages    │
│                                             │
└─────────────────────────────────────────────┘
```

### Changes

#### 1. page.tsx - Fix container height
```typescript
// Change from:
<div className="flex min-h-screen flex-col bg-background">

// To:
<div className="flex h-screen flex-col bg-background overflow-hidden">
```

#### 2. Header.tsx - Add sticky positioning
```typescript
// Change from:
<header className="border-b bg-background/95 backdrop-blur ...">

// To:
<header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur ...">
```

#### 3. MessageList.tsx - Fix auto-scroll with scrollIntoView
```typescript
// Keep ScrollArea, use scrollIntoView on bottom marker
const bottomRef = useRef<HTMLDivElement>(null)

useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
}, [messages])

return (
    <ScrollArea className="flex-1">
        <div className="p-4">
            {messages.map(...)}
            <div ref={bottomRef} />
        </div>
    </ScrollArea>
)
```

### Why scrollIntoView Instead of scrollTop?
- ScrollArea doesn't forward refs to the scrollable Viewport element
- Adding a marker div at the bottom and using `scrollIntoView` works reliably
- Preserves ScrollArea's custom scrollbar styling

### Future Sidebar Support
The flex-based layout naturally supports sidebars:
```
┌─────────────────────────────────────────────┐
│ Header (full width, sticky)                 │
├──────────┬─────────────────────┬────────────┤
│ Sidebar  │ Message Area        │ Sidebar    │
│ (future) │ (flex-1)            │ (future)   │
└──────────┴─────────────────────┴────────────┘
```

## Implementation Tasks

1. **Update page.tsx**
   - Change `min-h-screen` to `h-screen`
   - Add `overflow-hidden` to prevent page scroll

2. **Update Header.tsx**
   - Add `sticky top-0 z-50` classes

3. **Update MessageList.tsx**
   - Remove ScrollArea import
   - Use native div with `overflow-y-auto`
   - Keep existing ref and useEffect logic

## Testing

- [ ] Header stays visible when scrolling messages
- [ ] Message area scrolls independently
- [ ] Auto-scroll works when new messages arrive
- [ ] No page-level scrollbar appears
- [ ] Layout fills viewport height exactly

## Acceptance Criteria (from PBI)
- [x] Header stays fixed at top (sticky/fixed positioning)
- [x] Message area scrolls independently within its container
- [x] Auto-scroll to bottom works when new messages arrive
- [x] Layout supports future sidebars (flex-based structure)
- [x] Full viewport height utilized (no page-level scrolling)
- [ ] Tests written for new code
