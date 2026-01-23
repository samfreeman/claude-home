# ADR: PBI-023 - Context Divider Overflow Protection

## Status
Active

## Context
The `ContextDivider` component uses `whitespace-nowrap` CSS which prevents text wrapping. When a long context message is displayed, it forces the container to expand horizontally, breaking the layout for the entire message feed.

## Decision
Two-part fix to prevent layout expansion from long content:

### Part 1: ContextDivider truncation
1. Remove `whitespace-nowrap`
2. Add `max-w-[60%]` to limit text width
3. Add `truncate` class for ellipsis overflow
4. Add `title={content}` for hover tooltip

### Part 2: Container overflow protection
Add `overflow-hidden` to MessageList content wrapper to prevent ANY long content from expanding the ScrollArea.

## Implementation

### File 1: `src/components/ContextDivider.tsx`

**Current (line 12):**
```tsx
<span className="text-xs text-muted-foreground whitespace-nowrap">
```

**Proposed:**
```tsx
<span
	className="text-xs text-muted-foreground max-w-[60%] truncate"
	title={content}
>
```

### File 2: `src/components/MessageList.tsx`

**Current (line 33):**
```tsx
<div className="p-4">
```

**Proposed:**
```tsx
<div className="p-4 overflow-hidden">
```

## Testing
Visual verification - no automated tests needed for CSS-only change.

## Acceptance Criteria
- [x] Long context messages don't break layout
- [x] Content truncates with ellipsis when too long
- [x] User can see full content via hover tooltip
- [x] Layout width based on viewport, not content
