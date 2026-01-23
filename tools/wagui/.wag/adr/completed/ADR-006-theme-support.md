# ADR-006: Theme Support with tweakcn

## PBI
PBI-006: Theme Support with tweakcn

## Status
Approved

## Context
The user wants wagui to have a distinctive visual identity using the "Solar Dusk" theme from tweakcn.com. The theme should be easily swappable for future customization.

## Design Reference
Theme source: https://tweakcn.com/r/themes/solar-dusk.json

Solar Dusk features:
- Warm orange/amber primary colors
- Dark mode support
- oklch color space (Tailwind v4 compatible)
- Custom shadow variables

## Decision

### Approach: Replace CSS Variables in globals.css
Replace the current theme variables with Solar Dusk values. Keep Geist fonts (skip Oxanium/Merriweather/Fira Code custom fonts).

### Changes

#### 1. Update globals.css
Replace `:root`, `.dark`, and `@theme inline` blocks with Solar Dusk theme values.

**Key changes:**
- All color variables updated to Solar Dusk palette
- Shadow variables added for enhanced depth
- Keep `--font-sans: var(--font-geist-sans)` and `--font-mono: var(--font-geist-mono)`
- Radius changed from 0.625rem to 0.3rem

## Implementation Tasks

1. **Update globals.css with Solar Dusk theme**
   - Replace `:root` light mode variables
   - Replace `.dark` dark mode variables
   - Update `@theme inline` block with shadow variables
   - Keep font references to Geist

## Testing

- [ ] Light mode renders with warm orange/amber colors
- [ ] Dark mode renders correctly
- [ ] All existing components display properly
- [ ] Shadows render on cards/elements

## Acceptance Criteria (from PBI)
- [ ] Solar Dusk theme installed and applied
- [ ] Theme CSS variables properly integrated with Tailwind
- [ ] Dark/light mode toggle works with new theme
- [ ] Existing components render correctly with new colors
- [ ] Tests written for new code
