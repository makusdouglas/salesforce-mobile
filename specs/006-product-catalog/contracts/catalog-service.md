# Contract: Catalog Feature — Public Surface

**Feature**: 006-product-catalog
**Barrel**: `src/features/catalog/index.ts`

This contract describes everything the catalog feature exports. Anything not listed here is internal and MUST NOT be imported from outside `src/features/catalog/`.

---

## Exports

```typescript
// Screens — consumed by navigation
export { CatalogScreen } from './screens/CatalogScreen';
export { ProductDetailScreen } from './screens/ProductDetailScreen';

// Component — consumed only inside the feature; also exported for test convenience
export { CachedImage } from './components/CachedImage';

// Hooks — consumed by screens/components inside the feature; exported for future features
export { useCatalog } from './hooks/useCatalog';
export { useCachedImage } from './hooks/useCachedImage';

// Types
export type { ProductDisplayDTO, VariantDisplayDTO } from './hooks/useCatalog';
export type { CachedImageProps } from './components/CachedImage';
export type { CachedImageStatus } from './hooks/useCachedImage';

// Warmer — mounted once, implicitly via <CatalogProvider> (see below)
export { CatalogProvider } from './components/CatalogProvider';
```

No mutation verbs (`create*`, `update*`, `delete*`) appear anywhere in this surface. This is enforced by ESLint at review time via a simple name-pattern check (lint rule lives in `eslint.config.js` as part of this feature's PR).

---

## Screen contracts

### `CatalogScreen`

Route: `Catalog` on `HomeStack`. No route params.

Responsibilities:

1. Renders the top bar with page title "Catálogo", a back chevron, and an inline `<SyncStatusIndicator>` from `@/features/sync`.
2. Reads the catalog via `useCatalog()` → `{ products, hasAny, hasEverSynced }`.
3. Branches on state:
   - `hasAny === false && hasEverSynced === false` → renders `<CatalogEmptyView />` (first-launch empty state).
   - `hasAny === false && hasEverSynced === true` → renders `<CatalogEmptyView />` (same copy; per plan rejected-alternatives analysis, US2 Acceptance Scenario 4 confirms this).
   - `hasAny === true && filtered.length === 0` → renders `<CatalogNoMatchesView />` + `onReset={catalogFilter.reset}` (FR-018).
   - otherwise → renders `<SearchBar />`, `<FilterChipRow />` (hidden if no product has a category — see `contracts/search-filter.md` §Category sourcing), and `<ProductGrid products={filtered} />`.
4. Reads `useViewport()` → determines `numColumns` in the grid (2 / 3).
5. Tapping a `ProductCard` navigates to `ProductDetail` with `{ productId }`.
6. Mounts the image-cache warmer once on first render via `useCatalogCacheWarmer()`.

**Invariants**:

- NO blocking spinner. Rendering is synchronous from local state.
- NO network calls from this component (only the warmer and the `CatalogEmptyView`'s CTA can produce network effects, and both delegate to 005).
- NO direct WatermelonDB imports; all data flows through `useCatalog`.

### `ProductDetailScreen`

Route: `ProductDetail` on `HomeStack`. Route params: `{ productId: string }`.

Responsibilities:

1. Reads the product via `productsRepository.observe(productId)` + `productVariantsRepository.observeByProduct(productId)` (composed inside a small `useProduct(productId)` hook local to the screen file).
2. Renders top bar with "Produto" title + back chevron + `<SyncStatusIndicator>`.
3. Renders `<CachedImage source={product.imageUrl} />` as the hero.
4. Renders name, description (if any), base-price label "A partir de {price}" (or hidden if all variants lack prices), divider, "Variações" section header.
5. Renders one `<VariantRow variant={v} />` per variant in display order (by `label` ascending case-insensitive to keep it deterministic across devices).
6. Viewport branch: phone stacks hero above info; tablet splits hero left (360 pt), info right (flex fill). Implemented inline via `useViewport()`.

**Invariants**:

- If `productId` resolves to `null` (race: product deleted between tap and mount), the screen renders a minimal `<CatalogNoMatchesView />` variant with "Produto não disponível" message and a back-button CTA. **Does not crash, does not throw.**
- No edit/delete/create controls visible anywhere.

---

## Hook contracts

### `useCatalog(): { products, hasAny, hasEverSynced }`

Returns:

```typescript
{
  products: ReadonlyArray<ProductDisplayDTO>;  // sorted alphabetically by name (locale 'pt-BR')
  hasAny: boolean;                              // products.length > 0
  hasEverSynced: boolean;                       // resolves from WatermelonDB's internal last-pulled-at cursor, cached in hook state after first read
}
```

Behavior:

- Subscribes to `productsRepository.observeAll()` and for each product, derives `basePrice` and `variantCount` via a child query. Re-emits on any change to products or variants.
- `hasEverSynced` resolves asynchronously on mount; until resolved, it's treated as `false` to show the first-launch copy — an acceptable cold-start flicker (~50 ms on the benchmark device).
- Cleanup unsubscribes on unmount.

### `useCachedImage(url: string | null): { uri, status }`

Returns:

```typescript
{
  uri: string | null;                    // file:// URI when ready; null otherwise
  status: 'loading' | 'ready' | 'missing';  // 'missing' is terminal for this URL until app relaunch or prefetch retries
}
```

Behavior:

- Calling with `url = null` returns `{ uri: null, status: 'missing' }` synchronously without scheduling any work.
- On mount with a non-null URL, calls `imageCache.getCachedUri(url)`; if the promise resolves, transitions to `'ready'`; on rejection, transitions to `'missing'`.
- The hook never throws. Download failures surface as `status: 'missing'` only.
- Multiple mounts with the same URL share a single in-flight download (single-flight in `imageCache`); the hooks independently transition states from their own promise instance.

### `useCatalogCacheWarmer(): void`

Side-effect-only hook. Subscribes to `useSyncStatus()` from `@/features/sync`. On the transition `syncing → in-sync`:

1. Collects `validUrls` by enumerating the current products (via a short `productsRepository.query().fetch()` call — one-shot, not observed).
2. Calls `imageCache.prefetch(validUrls)`.
3. After prefetch settles (resolves or fails per-URL), calls `imageCache.evictOrphans(validUrls)`.

On `in-sync → syncing`: cancels the current prefetch via an `AbortController` (download.ts accepts one).

Multiple mounts of this hook are allowed but noop on subsequent mounts — internal guard in `cacheStore`.

---

## Component contracts

### `<CachedImage>`

Props:

```typescript
export type CachedImageProps = {
  source: string | null;                         // URL; null renders placeholder
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'center';  // default 'cover'
  placeholderTestID?: string;                    // test hook
  imageTestID?: string;                          // test hook
  accessibilityLabel?: string;                   // Portuguese; default "Imagem do produto"
};
```

Behavior:

- Calls `useCachedImage(source)`. While `status === 'loading'` renders a neutral placeholder frame. On `'ready'` renders `<Image source={{ uri }} />`. On `'missing'` renders the same neutral placeholder (FR-012).
- The placeholder **inherits the caller's `style`** (including `width`, `height`, `aspectRatio`) so the frame's dimensions are identical whether the image is loading, ready, or missing — no layout shift across states. Inside the wrapper, `backgroundColor: '#F5F5F5'` and a centered `inventory_2` Material Symbols icon at 50% of the frame's shorter edge, tinted `#A1A1AA`. Exact match to the design's Card 6 / missing-image state.
- Transitions from placeholder to loaded image without a fade — discrete swap. P1 says no artificial delays; a fade adds perceived latency.

### `<CatalogProvider>`

A thin wrapper that mounts `useCatalogCacheWarmer()` once. Not a React Context.

```typescript
export function CatalogProvider({ children }: { children: ReactNode }) {
  useCatalogCacheWarmer();
  return <>{children}</>;
}
```

Mounted in `AppProviders.tsx` **inside** `<SyncProvider>` (the warmer depends on sync status) and **inside** `<LockProvider>` (the warmer shouldn't run while locked, and `LockProvider` is already inside `SyncProvider` per 005's composition order). Composition order, outer → inner: `SessionProvider → LockProvider → SyncProvider → CatalogProvider → children`.

---

## Non-exports — internal modules explicitly NOT exported

- `imageCache`, `cacheStore`, `paths`, `download` — internal to `image-cache/`.
- `normalize`, `matches`, `filter` — internal to `search/`.
- `useCatalogFilter`, `useViewport` — internal hooks; future features can import if needed via a later barrel-export decision.
- `ProductCard`, `ProductGrid`, `SearchBar`, `FilterChipRow`, `VariantRow`, `CatalogEmptyView`, `CatalogNoMatchesView` — internal components.

This minimization keeps the feature's public surface small (about 10 symbols) and localizes future refactors.

---

## Test hooks

Public exports needed for tests:

- `useCatalog`, `useCachedImage`, `CachedImage` — already in the public list.
- `CatalogEmptyView`, `CatalogNoMatchesView`, `ProductCard` — **exported at a test-only sub-barrel** `src/features/catalog/index.test.ts` that is not bundled in production (Jest's `testEnvironment` picks it up; Expo's bundler doesn't). This avoids expanding the production surface just to expose components for snapshot tests.

---

## Error modes

| Trigger | Surface | Behavior |
|---------|---------|----------|
| `productsRepository.observe(id)` resolves to `null` | `ProductDetailScreen` | Renders "Produto não disponível" + back CTA. No throw. |
| Image download fails (network / 404) | `<CachedImage>` | Renders neutral placeholder. Surfaces `status: 'missing'` to the hook caller. |
| WatermelonDB adapter rejection (I/O fault) | `useCatalog` | Hook emits `{ products: [], hasAny: false, hasEverSynced: true }` and logs to console in `__DEV__`. The empty state renders; no crash. (Extreme edge case — not practically reachable.) |
| `imageCache.prefetch` partial failure | Warmer | Per-URL failures are isolated; other prefetches complete. Eviction runs regardless. |

No path in this feature raises an uncaught exception to React. All failure modes map to a visible empty/placeholder state.
