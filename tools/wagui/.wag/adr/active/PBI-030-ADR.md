# ADR: PBI-030 - Configurable Transcript Filter List

## Status
Approved

## Context

Transcript filtering is hardcoded in `server/transcript.ts`. New noise patterns (like command file expansions) require code changes to filter.

## Decision

Create `.wag/filters.json` config file with filter patterns.

### Filter Config Structure

```json
{
  "skipIfStartsWith": [
    "<command-message>",
    "<command-name>",
    "<ide_opened_file>",
    "# WAGU",
    "# WAG -"
  ],
  "skipIfContains": [
    "ARGUMENTS:",
    "This session is being continued from a previous conversation"
  ],
  "stripPatterns": [
    "<system-reminder>[\\s\\S]*?</system-reminder>"
  ],
  "transformations": {
    "This session is being continued": "[Session resumed]"
  }
}
```

### Implementation

1. Add `loadFilters(appRoot)` function to transcript.ts
2. Call on server startup when app is selected
3. Apply filters in `parseTranscriptEntry`:
   - `skipIfStartsWith` → return null
   - `skipIfContains` → return null
   - `transformations` → replace text
   - `stripPatterns` → regex remove

### Files Changed

- `server/transcript.ts` - add filter loading and application
- `.wag/filters.json` - new config file

## Testing

- [ ] Filter loading from JSON
- [ ] skipIfStartsWith filtering
- [ ] skipIfContains filtering
- [ ] stripPatterns regex removal
- [ ] transformations text replacement
- [ ] Fallback when no config file

## Acceptance Criteria

- [ ] Create `.wag/filters.json` with default patterns
- [ ] Load filter config on app selection
- [ ] Apply all filter types in parseTranscriptEntry
- [ ] Existing hardcoded filters moved to config
- [ ] Tests for filter logic