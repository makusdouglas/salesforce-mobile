# Contract: Responsive Layout (`src/features/catalog/responsive/`, `src/features/catalog/hooks/useViewport.ts`)

**Feature**: 006-product-catalog
**Traces to**: constitution §5 UX5, FR-023, FR-024, FR-025

Defines the single source of truth for phone-vs-tablet layout branching within the catalog feature. Matches conventions already established by `LoginScreen`, `ReloginScreen`, `LockScreen`, `PinSetupScreen`, `PinRecoveryConfirmScreen`.

---

## Breakpoint constant

```typescript
// src/features/catalog/responsive/breakpoints.ts

/**
 * Viewport classification threshold in density-independent points.
 * Widths ≥ this value are classified 'tablet'; widths < this value are 'phone'.
 *
 * Chosen as the canonical iPad mini portrait width (768 pt). Falls cleanly
 * between constitution UX5's baselines (phone 390 pt, tablet 820 pt) and
 * matches the historical industry standard.
 *
 * Portrait-only per UX5; landscape is out of scope in the MVP so rotation
 * does not influence this value.
 */
export const TABLET_MIN_WIDTH = 768;
```

**No other width thresholds** are introduced by this feature. Future features reuse this constant via `import { TABLET_MIN_WIDTH } from '@/features/catalog/responsive/breakpoints'` (or a later promotion to `src/app/responsive/` if a second feature needs the same breakpoint).

---

## `useViewport()` hook

```typescript
// src/features/catalog/hooks/useViewport.ts
import { useWindowDimensions } from 'react-native';
import { TABLET_MIN_WIDTH } from '../responsive/breakpoints';

export type Viewport = 'phone' | 'tablet';

export function useViewport(): Viewport {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH ? 'tablet' : 'phone';
}
```

**Properties**:

- Triggers a re-render if the device rotates or the window size changes (RN core behavior of `useWindowDimensions`). Safe because landscape is out of scope — in the MVP, this hook effectively never re-emits after mount.
- Returns a stable string value across renders when dimensions don't change — React's default equality check short-circuits downstream re-renders.
- **No component-internal caching**: consumers can call it multiple times per render without cost; `useWindowDimensions` is already memoized by RN.

---

## Per-screen layout branches

The catalog feature has three logical screens; each applies its viewport branch inline, not via separate files.

### 1. `CatalogScreen`

```typescript
const viewport = useViewport();
const numColumns = viewport === 'tablet' ? 3 : 2;
const horizontalPadding = viewport === 'tablet' ? 28 : 16;
const gridGap = viewport === 'tablet' ? 16 : 12;
```

- **Grid column count**: 2 on phone, 3 on tablet.
- **Horizontal padding**: 16 pt on phone, 28 pt on tablet (matches the Pencil frames).
- **Grid gap (between cards)**: 12 pt on phone, 16 pt on tablet.
- **Chip row, search field, and top bar all render identically** across viewports — they're flex containers that adapt automatically. Only the enclosing padding changes.

### 2. `ProductDetailScreen`

```typescript
const viewport = useViewport();
const isTablet = viewport === 'tablet';
```

Then:

- **Phone**: stacked layout.
  ```tsx
  <SafeAreaView>
    <TopBar />
    <ScrollView>
      <Hero height={260} />
      <Info>{name, description, basePrice, variants}</Info>
    </ScrollView>
  </SafeAreaView>
  ```

- **Tablet**: side-by-side split.
  ```tsx
  <SafeAreaView>
    <TopBar />
    <View style={{ flexDirection: 'row', padding: 28, gap: 28 }}>
      <Hero width={360} height={420} />
      <Info flex={1}>{name, description, basePrice, variants}</Info>
    </View>
  </SafeAreaView>
  ```

- **Typography scale**: name 22 pt phone / 28 pt tablet; description 13 pt / 14 pt; base price 24 pt / 28 pt; variant label 14 pt / 15 pt; variant sub-label 12 pt / 13 pt. Taken verbatim from the Pencil frames.

### 3. `CatalogEmptyView`

```typescript
const viewport = useViewport();
const contentMaxWidth = viewport === 'tablet' ? 460 : undefined;
const heroSize = viewport === 'tablet' ? 160 : 128;
const headingFontSize = viewport === 'tablet' ? 26 : 20;
```

- **Phone**: full-width column with 32 pt horizontal padding.
- **Tablet**: centered column with `maxWidth: 460`, same vertical composition. Hero circle scales from 128 pt to 160 pt.
- **Typography scale**: heading 20 pt / 26 pt, body 14 pt / 15 pt, CTA 15 pt / 16 pt, footnote 12 pt / 13 pt. From the Pencil frames.

---

## Invariants

1. **No stretched phone layouts on tablet** (FR-024): every screen MUST apply at least one layout or typography change when `viewport === 'tablet'`. Enforced by code review — reviewer checks that each new catalog screen file contains at least one `viewport === 'tablet'` or `isTablet` reference, and that the change is structural (not just a `maxWidth` cap).
2. **Same code serves both viewports** (Structure Decision in plan.md): no `*.phone.tsx` / `*.tablet.tsx` file splits. One component per screen, inline branches.
3. **Portrait only** (FR-025): `app.json` already locks orientation (inherited from 001). This feature does not test landscape and does not ship landscape layouts. If someone somehow rotates an iPad into landscape via a system override, the tablet layout still renders — but layout assumptions (360 pt hero, 460 pt empty-state column) may look misaligned. Acceptable edge case for MVP.

---

## Interaction with existing screens

The catalog mounts into `HomeStack`, which is already inside the root navigator. The existing top-level `<SafeAreaView>` / `<StatusBar>` setup applies unchanged. No modifications to `AppProviders`, `RootNavigator`, or theme.

---

## Testing

Responsive branching is tested in two ways:

1. **Unit (`useViewport.test.ts`)**: mock `useWindowDimensions` to return specific widths; assert `useViewport()` returns the expected value at boundary conditions (767, 768, 390, 820, 1024).
2. **Visual (manual)**: run the app on an iPhone simulator (390 × 844) and an iPad simulator (820 × 1180 portrait); walk each of the six screen-viewport combinations against the Pencil screenshots. This is a plan-level gate (SC-005).

No automated visual-regression testing in MVP. The Pencil screenshots serve as the reference.

---

## Non-goals

- **Landscape support** — out of scope per UX5.
- **Ultrawide tablet layouts** (iPad 13" = 1024 pt wide) — the tablet layout renders correctly at 1024 pt (nothing assumes exactly 820 pt); no separate "extra-wide" branch.
- **Fold/split-view support on Android foldables** — out of scope; they're not in the target platform set.
- **Dynamic type (user-enlarged system fonts)** — out of scope for this feature; addressed project-wide in a later accessibility pass.
