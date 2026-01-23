# ADR: PBI-002 - Add Clear Messages Button

## Status
APPROVED

## Context
Users need a way to clear messages from the wagui UI to start fresh when testing or switching contexts. PBI-007 already implemented server-side clear with SSE broadcast - this adds the UI trigger.

## Decision

### Approach
Add a clear button to the Header component that:
1. Shows a confirmation dialog (using native `window.confirm`)
2. Calls DELETE `/api/v1/messages` on the wagui server
3. Server broadcasts 'clear' event via SSE (already implemented)
4. useSSE hook clears local message state (already implemented)

### UI Design
- Trash icon button in header, right side before mode badges
- Small, subtle styling to not distract
- Use lucide-react `Trash2` icon
- Tooltip: "Clear messages"

### Implementation

#### Task 1: Add clear button to Header
- Import `Trash2` from lucide-react
- Import `Button` from components/ui/button
- Add `onClear` callback prop to HeaderProps
- Add button with trash icon, calls `onClear`

#### Task 2: Wire up clear handler in page.tsx
- Add `handleClear` function that:
  - Shows `window.confirm('Clear all messages?')`
  - If confirmed, calls `fetch('http://localhost:3099/api/v1/messages', { method: 'DELETE' })`
- Pass `handleClear` as `onClear` prop to Header

#### Task 3: Add Playwright test
- Test that clicking clear button and confirming removes messages
- Test that canceling confirmation keeps messages

## Testing
- [x] Unit test: Header renders clear button
- [x] E2E test: Clear button with confirm removes messages
- [x] E2E test: Clear button with cancel keeps messages

## Acceptance Criteria
- [x] Clear button visible in header
- [x] Confirmation dialog before clearing (custom ConfirmDialog component)
- [x] Clears messages on confirm
- [x] Messages persist on cancel
- [x] Tests written for new code
