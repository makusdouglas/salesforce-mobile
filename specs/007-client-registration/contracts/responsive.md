# Contract: responsive layout primitives

**Status**: authoritative for 007 Client Management
**Files**:

- `src/features/clients/hooks/useViewport.ts`
- `src/features/clients/responsive/breakpoints.ts`

These two tiny modules are **deliberately duplicated** from the catalog feature (006). A shared extraction to `src/app/responsive/` is pre-approved once a third feature needs them (research R-008). The duplication is flagged with a one-line TODO in each file pointing at the catalog original.

## `TABLET_MIN_WIDTH` constant

```ts
// src/features/clients/responsive/breakpoints.ts

/** Width in dp at or above which `useViewport` classifies the device as a tablet. */
export const TABLET_MIN_WIDTH = 768;
```

Rationale: matches catalog. Fits iPad 11" portrait (820 pt) and all mid-range Android tablets; correctly classifies the largest modern phones (e.g., iPhone 14 Pro Max at 430 pt) as phones.

## `useViewport()` hook

```ts
// src/features/clients/hooks/useViewport.ts
import { useWindowDimensions } from 'react-native';
import { TABLET_MIN_WIDTH } from '../responsive/breakpoints';

export type Viewport = 'phone' | 'tablet';

export function useViewport(): Viewport {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH ? 'tablet' : 'phone';
}
```

- **Input**: none.
- **Output**: `'phone' | 'tablet'`.
- **Triggers re-render**: on every `useWindowDimensions` change. Since the MVP is portrait-only (UX5), this is essentially once per OS-level orientation ignore (no orientation change) or once per window resize on simulators / foldables.

## Per-screen layout-branch rules

Each screen reads `const viewport = useViewport()` once per render and branches inline. No `*.phone.tsx` / `*.tablet.tsx` files; the branches live in the same component, clearly named.

### `ClientsScreen`

| Aspect | Phone | Tablet |
|--------|-------|--------|
| Horizontal paddings | 16 pt | 28 pt |
| Vertical gap (search ↔ chips ↔ list) | 10 / 10 pt | 14 / 14 pt |
| Chip row max visible chips | 5 (horizontal scroll for more) | 8 (horizontal scroll for more) |
| Search field max width | full width | 520 pt, centered horizontally |
| List row height | 72 pt | 84 pt |

### `ClientFormScreen`

| Aspect | Phone | Tablet |
|--------|-------|--------|
| Field layout | single column, stacked | two columns on a row for `name` + `taxId` and `addressLine` + `contact`; `notes` full-width spanning both columns |
| Horizontal paddings | 20 pt | 48 pt (centers the form column at ~720 pt) |
| Save button width | full width | 240 pt, right-aligned |
| Cancel (ghost) button | below the Save button, full width | inline with Save, left of it |

### `ClientProfileScreen`

| Aspect | Phone | Tablet |
|--------|-------|--------|
| Overall layout | vertical stack: identity → history → CTA pinned to bottom | horizontal split: identity ≈ 45% left / history + CTA ≈ 55% right |
| CTA placement | sticky at bottom safe area | inline at the bottom of the right column |
| Identity field spacing | 12 pt | 16 pt |
| History row height | 64 pt | 72 pt |

### `NewOrderStubScreen`

| Aspect | Phone | Tablet |
|--------|-------|--------|
| Container | centered copy, full width, max 360 pt | centered copy, max 520 pt |
| Button | full-width bottom | centered, 240 pt |

## Portrait-only (UX5)

Landscape is out of scope. The app's `app.json` already locks orientation. No layout branch for landscape is authored. If the simulator is rotated anyway, the design falls back to whatever the stretched portrait layout produces — not a supported configuration.

## Testing approach

No unit tests for `useViewport` itself — a 3-line pure function over `useWindowDimensions`, nothing to exercise. Visual parity across viewports is verified by manual walkthrough on the phone simulator (390 × 844) and the iPad simulator (820 × 1180), per constitution UX5 and this feature's Design Prerequisite gate.
