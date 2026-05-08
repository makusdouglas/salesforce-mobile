# Tasks: Product Catalog

**Input**: Design documents from `/specs/006-product-catalog/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/catalog-service.md](./contracts/catalog-service.md), [contracts/image-cache.md](./contracts/image-cache.md), [contracts/search-filter.md](./contracts/search-filter.md), [contracts/responsive.md](./contracts/responsive.md), [contracts/supabase-schema.md](./contracts/supabase-schema.md), [quickstart.md](./quickstart.md), [design/screens.md](./design/screens.md)

**Tests**: Six unit-test files per constitution §9 and the plan's Testing section — `normalize`, `filter`, `imageCache`, `useCachedImage`, `useCatalog`, `catalogCacheWarmer`. No UI tests. No integration tests. Screen-level verification happens manually against the Pencil frames on phone + tablet simulators per UX5 and SC-005.

**Organization**: Tasks are grouped by the spec's four user stories in priority order (US1/US2 are P1; US3/US4 are P2). US2 extends the Catalog scaffolding from US1 (it replaces the grid branch with the empty-state branch in the same screen file). US3 and US4 are independently testable on top of US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Relative-to-repo-root file paths

## Path Conventions

- Source layout from [plan.md Project Structure](./plan.md#project-structure): `src/features/catalog/` owns the feature; three 002 files get the `category` column migration (`src/data/schema/tables.ts`, `src/data/schema/migrations.ts`, `src/data/models/Product.ts`); three navigation/home files get modified (`src/app/navigation/HomeStack.tsx`, `src/app/navigation/types.ts`, `src/features/home/screens/HomePlaceholderScreen.tsx`); `package.json` gets one new dependency (`expo-file-system`).
- All identifiers in English (constitution §9). UI copy in Portuguese — empty-state copy, search placeholder, filter chips, variant rows.
- Every create/edit cites the exact file path.
- `jest` + `ts-jest` + `jest.config.js` at repo root are already installed. **One new runtime dependency** in this block: `expo-file-system` (mandated by §3 R3).

---

## Phase 0: Design (UI features only) 🎨

**Status**: ✅ **Already complete.** The plan's Design Prerequisite gate is green — six Pencil frames cover three logical screens × two viewports, exported during `/speckit-pencil-design`:

| Screen | Phone frame | Tablet frame |
|--------|-------------|--------------|
| Catalog list | [catalog-phone.png](./design/catalog-phone.png) (`oE6Po`) | [catalog-tablet.png](./design/catalog-tablet.png) (`R70uK`) |
| Product detail | [product-detail-phone.png](./design/product-detail-phone.png) (`WCgvx`) | [product-detail-tablet.png](./design/product-detail-tablet.png) (`ow0Ma`) |
| Empty catalog | [catalog-empty-phone.png](./design/catalog-empty-phone.png) (`YkrkF`) | [catalog-empty-tablet.png](./design/catalog-empty-tablet.png) (`74wU8`) |

Design notes, rejected alternatives, and the tinted-placeholder vs. AI-image decision are recorded in [design/screens.md](./design/screens.md). No Phase 0 tasks remain.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the one new runtime dependency, scaffold the `src/features/catalog/` directory tree, and land the two operational prerequisites on the Supabase side so sync pulls meaningful data down once the schema bump reaches production.

- [ ] T001 Install `expo-file-system` as a runtime dependency: `pnpm add expo-file-system` at repo root. Confirm the installed version matches Expo SDK 55 (package manifest should pin `expo-file-system` to a `55.x` major, inferred by `expo install` semantics). Do NOT also install `expo-file-system/next` — the legacy API is what `contracts/image-cache.md` targets (research R1). Rebuild the dev client (`pnpm build:dev`) once locally so the native side has the new library.

- [ ] T002 [P] Create the directory skeleton under `src/features/catalog/`: `screens/`, `components/`, `hooks/`, `image-cache/`, `search/`, `responsive/`, `tests/`. No files yet — Phase 2 populates them.

- [ ] T003 Execute the Supabase-side schema prerequisite per [contracts/supabase-schema.md](./contracts/supabase-schema.md) §"Change 1" against the **dev** Supabase project via the dashboard SQL editor: (a) `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text NULL`; (b) `CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category) WHERE category IS NOT NULL`; (c) run the two verification queries from §"Verification" and attach output to the PR. Production receives the same treatment before this feature ships.

- [ ] T004 Execute the Supabase-side Storage prerequisite per [contracts/supabase-schema.md](./contracts/supabase-schema.md) §"Change 2" against the **dev** Supabase project: (a) create or confirm the `product-images` bucket with `Public: true`, `File size limit: 5 MB`, `Allowed MIME types: image/jpeg, image/png, image/webp`; (b) install the four Storage policies (`Public read access`, `Admin can write/update/delete product images`). Upload one sample JPEG and verify the public URL renders in a browser. Production receives the same treatment before this feature ships.

**Checkpoint**: `pnpm lint`, `pnpm typecheck`, `pnpm test` green on the pre-006 codebase. `package.json` contains `expo-file-system`. `src/features/catalog/` exists with the 7 empty subfolders. Dev Supabase has `products.category` + `product-images` bucket ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the `category` schema bump, the responsive primitives, and the image-cache infrastructure — all shared across US1/US2/US3/US4. The cache is foundational because US1, US3 both mount `<CachedImage>` and cannot render correctly without it. The responsive hook is foundational because every catalog screen reads it on every render.

**⚠️ CRITICAL**: No work in Phases 3–6 may begin until all Phase 2 tasks complete.

### Data layer (category column)

- [ ] T005 Bump the WatermelonDB schema version from `1` to `2` in `src/data/schema/tables.ts`: change `appSchema({ version: 1, ... })` to `version: 2`, and add `{ name: 'category', type: 'string', isOptional: true, isIndexed: true }` to the `products` table's `columns` array (place it after `unit`, before `...syncColumns`).

- [ ] T006 Append the v2 migration step to `src/data/schema/migrations.ts`. Follow Watermelon's migration format: `{ toVersion: 2, steps: [ addColumns({ table: 'products', columns: [{ name: 'category', type: 'string', isOptional: true, isIndexed: true }] }) ] }`. The file already contains the v1 migration scaffold from 002; append the new step to the existing `migrations` array.

- [ ] T007 Add the `category` field to the `Product` model in `src/data/models/Product.ts`: `@field('category') category!: string | null;`. Place it after `@field('unit') unit!: string | null;`, before the sync fields. Do not modify associations.

### Responsive primitives

- [ ] T008 [P] Create `src/features/catalog/responsive/breakpoints.ts` exporting the constant `TABLET_MIN_WIDTH = 768` with a JSDoc explaining the choice per [contracts/responsive.md](./contracts/responsive.md) §"Breakpoint constant".

- [ ] T009 [P] Create `src/features/catalog/hooks/useViewport.ts`: imports `useWindowDimensions` from `react-native` and `TABLET_MIN_WIDTH` from `../responsive/breakpoints`; exports the `Viewport` type (`'phone' | 'tablet'`) and the `useViewport()` hook that returns `width >= TABLET_MIN_WIDTH ? 'tablet' : 'phone'`. Matches contract's "Hook" section.

### Image cache

- [ ] T010 Create `src/features/catalog/image-cache/paths.ts` exporting: (a) `CACHE_DIR = FileSystem.documentDirectory + 'product-images/'`; (b) `mkPath(url: string): string` which computes `sha256(url)` via `expo-crypto.digestStringAsync(CryptoDigestAlgorithm.SHA256, url)` (note: async), takes the first 16 hex chars, parses the URL's last-path-segment extension (lowercased) via a regex (`/\.([a-z0-9]+)(?:\?.*)?$/i`), and returns `${CACHE_DIR}${hash}${ext ? '.' + ext : ''}`. Because `digestStringAsync` is async, `mkPath` is async and returns `Promise<string>`. See research R2 for the hashing rationale.

- [ ] T011 Create `src/features/catalog/image-cache/download.ts`: exports the internal `downloadOnce(url: string, dest: string, signal?: AbortSignal): Promise<void>` that wraps `FileSystem.downloadAsync(url, dest, { md5: false, cache: true })` inside a module-level single-flight `Map<string, Promise<void>>`. Also maintain the 5-second failed-URL cooldown in a `Map<string, number>` per [contracts/image-cache.md](./contracts/image-cache.md) §"Failed-URL cooldown". Honors `signal.aborted` before starting; if aborted mid-flight, rejects with an `AbortError`-shaped error.

- [ ] T012 Create `src/features/catalog/image-cache/cacheStore.ts`: module-level `Map<string, string>` for `(url → absoluteFilePath)`, plus an idempotent `ensureCacheDir(): Promise<void>` that calls `FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })` once, guarded by a `dirEnsured: boolean` flag so repeat calls short-circuit. **No bulk hydration** — each `getCachedUri(url)` call in T013 does a per-URL `getInfoAsync` on first encounter and populates the map lazily. This matches [contracts/image-cache.md](./contracts/image-cache.md) §"Public API → getCachedUri" and [research.md](./research.md) §R9.

- [ ] T013 Create `src/features/catalog/image-cache/imageCache.ts` exporting the singleton `imageCache` with the full public API from [contracts/image-cache.md](./contracts/image-cache.md) §"Public API": `getCachedUri(url)`, `prefetch(urls)` (parallel cap of 4), `evictOrphans(validUrls)`, `_reset()`. Uses `cacheStore` for the map and `download` for downloads.

  **`getCachedUri(url)` flow**: (1) `await cacheStore.ensureCacheDir()`; (2) if the URL is in the in-memory map AND `FileSystem.getInfoAsync(filePath).exists === true`, return `file://` + filePath; (3) otherwise compute `await mkPath(url)` and `getInfoAsync` that path — if it exists, insert into the map and return it (per-URL lazy hydration); (4) otherwise delegate to `downloadOnce` (T011) and insert on success.

  **`evictOrphans(validUrls)` flow**: compute the set of expected paths via `await Promise.all(validUrls.map(mkPath))`; run one `FileSystem.readDirectoryAsync(CACHE_DIR)`; for each on-disk filename NOT in the expected set, `FileSystem.deleteAsync(filePath, { idempotent: true })` and remove any map entry pointing at it. Skip any file whose URL is currently registered in the single-flight download map (deferred to the next pass).

  Maintains a module-level `AbortController` that `prefetch` respects and `evictOrphans` leaves alone. Errors surface as rejections; the caller translates them.

- [ ] T014 [P] Create `src/features/catalog/tests/imageCache.test.ts` covering the seven test scenarios from [contracts/image-cache.md](./contracts/image-cache.md) §"Test coverage": single-flight, prefetch no-op on hot entries, orphan eviction, eviction skips in-flight, failed-URL cooldown, failed-URL retry after cooldown, rebuild from disk. Mock `expo-file-system` via `jest.mock('expo-file-system')` returning in-memory file operations.

**Checkpoint**: `pnpm typecheck` green with the schema bump applied. `pnpm test -- src/features/catalog/tests/imageCache.test.ts` green. A debug call to `imageCache.getCachedUri('https://example.com/x.png')` returns a valid `file://` URI on successful mock download. `useViewport()` returns `'tablet'` at width 820 and `'phone'` at width 390 in a unit test stub.

---

## Phase 3: User Story 1 — Browse the catalog to find a product (Priority: P1) 🎯 MVP

**Goal**: The salesperson opens the catalog from the home screen and scans a grid of products. Each card shows a thumbnail (served from the local cache), name, base price, and a hint that variants exist. Tapping a card would navigate to detail — but that lives in US3. US1 completes when the grid renders on both viewports and the image cache serves thumbnails offline after one prior sync.

**Independent Test**: Seed the dev Supabase catalog per [quickstart.md](./quickstart.md) §(a). Run the app on a phone simulator; log in + unlock; tap **Ver catálogo** on the home screen. Verify (i) the grid renders immediately without a blocking spinner; (ii) two columns on phone, three on tablet; (iii) thumbnails appear within ~2 s of first render and persist in airplane mode on subsequent launches.

### Tests for User Story 1

- [ ] T015 [P] [US1] Create `src/features/catalog/tests/useCatalog.test.ts` covering the five scenarios in [contracts/catalog-service.md](./contracts/catalog-service.md) §"Hook contracts → useCatalog": products emit alphabetically by name, `hasAny` flips atomically, `hasEverSynced` resolves from the Watermelon cursor, derived DTOs carry `basePrice` (min of non-null variant prices) and `variantCount`, and `basePrice === null` when every variant price is null. Mock `productsRepository` and `productVariantsRepository` with in-memory observables.

- [ ] T016 [P] [US1] Create `src/features/catalog/tests/useCachedImage.test.ts` covering the state-machine cases from [contracts/catalog-service.md](./contracts/catalog-service.md) §"useCachedImage": `url === null` returns `{ uri: null, status: 'missing' }` synchronously; cold-cache mount transitions `loading → ready` on successful download; cold-cache mount transitions `loading → missing` on download failure; never throws. Mock `imageCache.getCachedUri`.

- [ ] T017 [P] [US1] Create `src/features/catalog/tests/catalogCacheWarmer.test.ts` covering [contracts/catalog-service.md](./contracts/catalog-service.md) §"useCatalogCacheWarmer": `syncing → in-sync` triggers one `imageCache.prefetch` + one `imageCache.evictOrphans`; `in-sync → in-sync` (spurious) does nothing; `in-sync → syncing` aborts the current prefetch. Mock `useSyncStatus` and `imageCache`.

### Implementation for User Story 1

- [ ] T018 [P] [US1] Create `src/features/catalog/hooks/useCachedImage.ts` per [contracts/catalog-service.md](./contracts/catalog-service.md) §"useCachedImage": returns `{ uri: string | null, status: 'loading' | 'ready' | 'missing' }`. Handles the null-URL case synchronously. Uses `useState` + `useEffect` to call `imageCache.getCachedUri(url)` and transition states; stays mounted-subscribed via an `isMounted` ref so unmounted updates don't leak.

- [ ] T019 [P] [US1] Create `src/features/catalog/components/CachedImage.tsx` per [contracts/catalog-service.md](./contracts/catalog-service.md) §"CachedImage": wraps `<Image>` in an outer `<View>` that applies the caller-supplied `style` so the frame's dimensions are identical whether the image is loading, ready, or missing — **no layout shift between states**. While `status !== 'ready'`, the wrapper has `backgroundColor: '#F5F5F5'` and renders a centered `inventory_2` Material Symbols icon at 50% of the frame's shorter edge, tinted `#A1A1AA` — matches the Pencil Card 6 placeholder. On `status === 'ready'`, the wrapper contains `<Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={resizeMode ?? 'cover'} />` filling it. Accessibility label defaults to `'Imagem do produto'`.

- [ ] T020 [US1] Create `src/features/catalog/hooks/useCatalog.ts` per [contracts/catalog-service.md](./contracts/catalog-service.md) §"useCatalog" and [data-model.md](./data-model.md) §3: subscribes to `productsRepository.observeAll()`; for each product, fetches variant counts + min price via `productVariantsRepository.observeByProduct(id)` composed with `combineLatest`; derives `ProductDisplayDTO[]`, sorted by `name` with `'pt-BR'` locale. Exposes `{ products, hasAny, hasEverSynced }`. `hasEverSynced` is resolved once on mount by reading `database.adapter.getLocal('__watermelon_last_pulled_at')` and cached in local state; treated as `false` until resolved (~50 ms flicker is acceptable).

- [ ] T021 [US1] Create `src/features/catalog/hooks/useCatalogCacheWarmer.ts` per [contracts/catalog-service.md](./contracts/catalog-service.md) §"useCatalogCacheWarmer": subscribes to `useSyncStatus()` from `@/features/sync`; tracks the previous status in a ref; on every re-render, if `prev === 'syncing' && curr === 'in-sync'`, enqueues a prefetch pass: read `productsRepository.query().fetch()` (one-shot), collect non-null `imageUrl`s, call `imageCache.prefetch(urls)`, then `imageCache.evictOrphans(urls)`. Maintains a module-level `AbortController` for cancellation when `'in-sync' → 'syncing'` occurs.

- [ ] T022 [P] [US1] Create `src/features/catalog/components/ProductCard.tsx`: vertical frame, corner radius 12, `#FFFFFF` fill, 1px `#E4E4E7` border. Image area uses `aspectRatio: 1.6` so the frame matches the Pencil phone frame (~180×110 pt ≈ 1.64) and scales proportionally on the tablet's wider 3-column cards — height follows width, no squat thumbnails: `<CachedImage source={product.imageUrl} style={{ width: '100%', aspectRatio: 1.6 }} />`. Below the image: name (13 pt, weight 500, `#0A0A0A`, truncated with ellipsis), base price (15 pt, weight 600, `#0A0A0A`, formatted `R$ {price.toFixed(2).replace('.', ',')}`), variant-count hint (11 pt, `#71717A`, plural-aware: `"1 variação"` vs `"{n} variações"`). Props: `{ product: ProductDisplayDTO; onPress: (id: string) => void; viewport: Viewport }`. The whole card is a `<Pressable>` calling `onPress(product.id)` with the card-press opacity effect matching the auth screens.

- [ ] T023 [US1] Create `src/features/catalog/components/ProductGrid.tsx`: wraps a RN `FlatList<ProductDisplayDTO>` with `numColumns={viewport === 'tablet' ? 3 : 2}`, `keyExtractor={(p) => p.id}`, `removeClippedSubviews={true}`, `initialNumToRender={8}`, `windowSize={5}`, `renderItem` returning `<ProductCard product={item} onPress={onProductPress} viewport={viewport} />`. Applies gap via `ItemSeparatorComponent` + a `columnWrapperStyle` with horizontal gap per `contracts/responsive.md` (`12` phone, `16` tablet). Props: `{ products: ReadonlyArray<ProductDisplayDTO>; onProductPress: (id: string) => void; viewport: Viewport }`.

- [ ] T024 [US1] Create `src/features/catalog/screens/CatalogScreen.tsx` — **US1 scope only**: top bar (`<SafeAreaView>` + horizontal row with back chevron via `navigation.goBack()`, "Catálogo" title, inline `<SyncStatusIndicator />` from `@/features/sync`); below the top bar, renders `<ProductGrid products={products} onProductPress={(id) => navigation.navigate('ProductDetail', { productId: id })} viewport={viewport} />` where `products` is `useCatalog().products`. Reads `useViewport()` once. DOES NOT render the empty-state branch in this task — that's T030 in US2. DOES NOT render search/filter — those are US4. While `useCatalog().products` is empty, renders a minimal placeholder `<View />` (will be replaced in US2). No blocking spinner. Calls `useCatalogCacheWarmer()` once on mount.

- [ ] T025 [US1] Create `src/features/catalog/components/CatalogProvider.tsx`: thin wrapper per [contracts/catalog-service.md](./contracts/catalog-service.md) §"CatalogProvider". `export function CatalogProvider({ children }: { children: ReactNode }) { useCatalogCacheWarmer(); return <>{children}</>; }`. Not a React Context.

- [ ] T026 [US1] Mount `<CatalogProvider>` in `src/app/providers/AppProviders.tsx` inside `<SyncProvider>` (per plan's composition order: `SessionProvider → LockProvider → SyncProvider → CatalogProvider → children`). Import from `@/features/catalog`.

- [ ] T027 [US1] Register the `Catalog` route in `src/app/navigation/HomeStack.tsx`: add `<Stack.Screen name="Catalog" component={CatalogScreen} options={{ title: 'Catálogo' }} />` after `HomePlaceholder`. Import `CatalogScreen` from `@/features/catalog`. Also add `Catalog: undefined` to `HomeStackParamList` in `src/app/navigation/types.ts`.

- [ ] T028 [US1] Extend `src/features/home/screens/HomePlaceholderScreen.tsx`: add a new primary `Pressable` labeled `Ver catálogo` above the inactivity-timeout settings block, styled like the existing primary button (`backgroundColor: colors.primary`, same padding / radius / label weight). `onPress` calls `navigation.navigate('Catalog')`. Place it after the `<Text style={styles.subtitle}>Sua base de vendas fica aqui.</Text>` line and before the `<View style={styles.settingsBlock}>`.

- [ ] T029 [US1] Create `src/features/catalog/index.ts` — initial public barrel per [contracts/catalog-service.md](./contracts/catalog-service.md) §"Exports". Export (US1 scope only): `CatalogScreen`, `CachedImage`, `CatalogProvider`, `useCatalog`, `useCachedImage`, and the types `ProductDisplayDTO`, `VariantDisplayDTO`, `CachedImageProps`, `CachedImageStatus`. US3, US4, and US2 will extend this barrel as their screens/components land.

**US1 simulator verification**: `pnpm start`, run on iOS simulator (iPhone 14, 390 × 844) and iPad simulator (iPad 11", 820 × 1180 portrait). After login + unlock + first sync, tap **Ver catálogo**. Cross-check against [design/catalog-phone.png](./design/catalog-phone.png) and [design/catalog-tablet.png](./design/catalog-tablet.png). Turn on airplane mode, force-close, reopen — thumbnails still render from cache (SC-002).

**Checkpoint**: At this point, US1 is fully functional and independently testable (except for the empty-state screen — while the catalog is empty the screen looks blank, which US2 fixes). All tests from Phase 2 + Phase 3 pass. No crashes on empty DB.

---

## Phase 4: User Story 2 — First-launch empty state guides to sync (Priority: P1)

**Goal**: When the local catalog is empty (fresh install or admin deleted everything), the Catalog screen shows a friendly, salesperson-language empty state with a primary `Sincronizar agora` CTA instead of a blank grid. Offline tap shows a plain-language alert.

**Independent Test**: Wipe the simulator storage (or run `_reset()` from a debug console). Log in + unlock + tap **Ver catálogo**. Verify (i) the empty state renders per [design/catalog-empty-phone.png](./design/catalog-empty-phone.png) / tablet; (ii) tapping `Sincronizar agora` while offline surfaces a plain-language alert; (iii) tapping while online transitions the indicator `offline → syncing → in-sync` and the empty state auto-replaces with the populated grid once products arrive.

### Implementation for User Story 2

- [ ] T030 [US2] Create `src/features/catalog/components/CatalogEmptyView.tsx`: vertical column centered in its parent (phone full-width with 32 pt horizontal padding; tablet `maxWidth: 460` centered). Renders (top to bottom): hero circle (`width/height = viewport === 'tablet' ? 160 : 128`, `cornerRadius: half-size`, `backgroundColor: '#F5F5F5'`, centered `inventory_2` Material Symbols icon `#71717A`, icon size `viewport === 'tablet' ? 72 : 56`); "Seu catálogo está vazio" heading (`20 pt / 26 pt`, weight 600, `#0A0A0A`, centered); "Ainda não baixamos os produtos neste aparelho. Toque em Sincronizar agora para carregar tudo." body (`14 pt / 15 pt`, `#52525B`, centered, lineHeight 1.45); primary `Pressable` CTA labeled **Sincronizar agora** with the `download-cloud` Feather icon and label text (dark button `#18181B`, white label `#FAFAFA`, 48/52 pt tall); footnote "Você precisa de internet só na primeira vez." (`12 pt / 13 pt`, `#71717A`, centered). Props: `{ onSyncPress: () => void; viewport: Viewport }`. Reads `useViewport()` internally only if needed — prefer receiving it as a prop for testability.

- [ ] T031 [US2] Implement the sync-CTA handler in `CatalogEmptyView` consumer (inside `CatalogScreen`): wrap `onPullToRefresh` from `@/features/sync` with offline awareness. Logic: read `useSyncStatus().status`; if status is `'offline'` at tap time, show `Alert.alert('Sem internet', 'Conecte-se à internet para carregar o catálogo pela primeira vez.', [{ text: 'OK' }])` — no call to `onPullToRefresh`. Otherwise, call `await onPullToRefresh()`. Lives inline in `CatalogScreen.tsx` (no new file).

- [ ] T032 [US2] Extend `src/features/catalog/screens/CatalogScreen.tsx` with the empty-state branch logic per [contracts/catalog-service.md](./contracts/catalog-service.md) §"CatalogScreen" Responsibility 3. Replace the US1 "minimal placeholder" with: `if (!hasAny) return <CatalogEmptyView onSyncPress={handleSyncPress} viewport={viewport} />`. The first-launch AND admin-cleared-catalog cases both render this branch (per the plan's rejected-alternative — same copy for both).

- [ ] T033 [US2] Export `CatalogEmptyView` from `src/features/catalog/index.ts`. Not strictly required for production — the catalog screen imports it internally — but keeping the test sub-barrel symmetric with other components helps future refactors.

**US2 simulator verification**: wipe simulator → log in → tap **Ver catálogo** → empty state renders. Turn off Wi-Fi, tap CTA → alert appears, no sync kicked off. Turn Wi-Fi on, tap CTA → sync runs → empty state auto-replaces with populated grid. Cross-check against both [design/catalog-empty-phone.png](./design/catalog-empty-phone.png) and [design/catalog-empty-tablet.png](./design/catalog-empty-tablet.png).

**Checkpoint**: US1 + US2 both functional. First-launch → populated catalog flow complete. The MVP slice (P1 + P1) is shippable.

---

## Phase 5: User Story 3 — View a product's detail and its variants (Priority: P2)

**Goal**: Tapping a product card opens a read-only detail screen showing the product's hero image, name, description, base-price label, and the full list of variants (each with distinguishing attributes and per-variant price). Read-only means no edit/delete/create controls anywhere.

**Independent Test**: With the catalog populated (from US1), tap any card with at least 2 variants. Verify (i) the detail screen renders per [design/product-detail-phone.png](./design/product-detail-phone.png) / tablet; (ii) all variants list with their attributes and per-variant prices; (iii) a variant with a null price shows "preço indisponível" (FR-010); (iv) no edit/delete affordance is visible anywhere; (v) phone uses stacked layout, tablet uses side-by-side split.

### Implementation for User Story 3

- [ ] T034 [US3] Create `src/features/catalog/components/VariantRow.tsx`: horizontal row, `fill_container` width, white background, corner radius 10, 1 px `#E4E4E7` border, padding (12 / 14 vertical, 14 / 16 horizontal by viewport). Left column (`flex: 1`, vertical gap 2): variant `label` (14 / 15 pt, weight 500, `#0A0A0A`) + optional `attributes` sub-label (12 / 13 pt, `#71717A`). Right column: price label (15 / 16 pt, weight 600, `#0A0A0A`) formatted as `R$ {price.toFixed(2).replace('.', ',')}` OR the literal string `"preço indisponível"` (`#71717A`, non-clickable) if `price === null` (FR-010). Props: `{ variant: VariantDisplayDTO; viewport: Viewport }`. Non-interactive — the whole detail screen is read-only.

- [ ] T035 [US3] Create `src/features/catalog/screens/ProductDetailScreen.tsx` per [contracts/catalog-service.md](./contracts/catalog-service.md) §"ProductDetailScreen". Route params: `{ productId: string }`. Local `useProduct(productId)` hook (inline — not exported): subscribes to `productsRepository.observe(productId)` and `productVariantsRepository.observeByProduct(productId)` via `combineLatest`, returns `{ product: ProductDisplayDTO | null, loading }`. Renders: top bar (back chevron + "Produto" title + `<SyncStatusIndicator />`); if `product === null` (product deleted between tap and mount), renders a minimal "Produto não disponível" view with a back CTA (does not throw). Otherwise, renders the viewport-conditional body from [contracts/responsive.md](./contracts/responsive.md) §"ProductDetailScreen": phone = stacked hero (`<CachedImage source={product.imageUrl} style={{ width: '100%', height: 260 }} resizeMode="cover" />`) + scrollable info panel; tablet = `<View style={{ flexDirection: 'row', padding: 28, gap: 28 }}>` with hero (360 × 420, `cornerRadius: 16`) left + info panel flex-1 right. Info panel: name (22 / 28 pt, 600, `#0A0A0A`), optional description (13 / 14 pt, `#71717A`, line-height 1.4–1.5), `"A partir de"` label + `R$ {basePrice}` (if `basePrice !== null`; otherwise hide the whole row), 1 px divider, `"Variações"` section header (13 / 14 pt, weight 600, `#52525B`, letter-spacing 0.5), then the variants rendered via `<VariantRow variant={v} viewport={viewport} />` sorted ascending by `label` case-insensitive.

- [ ] T036 [US3] Register the `ProductDetail` route in `src/app/navigation/HomeStack.tsx`: `<Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Produto' }} />` after the `Catalog` route. Import from `@/features/catalog`. Add `ProductDetail: { productId: string }` to `HomeStackParamList` in `src/app/navigation/types.ts`. Verify `ProductCard`'s `onPress` from T022 correctly calls `navigation.navigate('ProductDetail', { productId })` — no code change needed, T022 wired this up in advance.

- [ ] T037 [US3] Export `ProductDetailScreen` and `VariantRow` from `src/features/catalog/index.ts`.

**US3 simulator verification**: tap any card with multiple variants → detail screen renders per [design/product-detail-phone.png](./design/product-detail-phone.png) / tablet. A product with one variant still shows the variant section (FR-009) — verify. A variant with null price shows "preço indisponível" (FR-010) — verify. Offline: tap a previously-opened product → hero image still renders from cache. Tap a product whose `image_url` is null → placeholder renders; detail content unaffected (FR-013).

**Checkpoint**: US1 + US2 + US3 all functional. Salesperson can browse catalog, hit empty state → sync, and drill into product details.

---

## Phase 6: User Story 4 — Search the catalog with tap-first filters (Priority: P2)

**Goal**: Narrow the catalog using tap-first filter chips (primary) and a text search field (fallback). Both compose as intersection (FR-016). Diacritic-insensitive text matching (FR-017). A "no matches" sub-state with a reset control (FR-018). Chip row hides when no product has a category (graceful degradation per spec Assumptions).

**Independent Test**: With a catalog containing products across multiple categories (from [quickstart.md](./quickstart.md) §(a)), open the catalog and (i) tap a category chip → list narrows; (ii) tap again / `Todos` → returns; (iii) type `cafe` in the search field → diacritic-insensitive match on "Café Torrado 500g"; (iv) compose chip + text → intersection applies; (v) query `xyz` → "no matches" state with reset CTA; (vi) on tablet, chip row shows more chips inline without horizontal scroll.

### Tests for User Story 4

- [ ] T038 [P] [US4] Create `src/features/catalog/tests/normalize.test.ts` covering the 8 properties in [contracts/search-filter.md](./contracts/search-filter.md) §1: `"Café" → "cafe"`, `"AÇAÍ" → "acai"`, `" Limão " → "limao"`, `"coração" → "coracao"`, preserves digits + spaces + punctuation, `normalize("") === ""`, idempotence.

- [ ] T039 [P] [US4] Create `src/features/catalog/tests/filter.test.ts` covering the 10 properties in [contracts/search-filter.md](./contracts/search-filter.md) §"Test coverage": compose query + category, empty-both, category-only, query-only, reference-preserving no-op, null-category handling, whitespace-trimmed category match, diacritic-insensitive query, variant-label match when variants populated, no-matches returns `[]`.

### Implementation for User Story 4

- [ ] T040 [P] [US4] Create `src/features/catalog/search/normalize.ts` per [contracts/search-filter.md](./contracts/search-filter.md) §1: `export function normalize(input: string): string { return input.normalize('NFD').replace(/\p{Mn}/gu, '').toLocaleLowerCase('pt-BR').trim(); }`.

- [ ] T041 [P] [US4] Create `src/features/catalog/search/matches.ts` per [contracts/search-filter.md](./contracts/search-filter.md) §2: `matchesQuery(product: ProductDisplayDTO, normalizedQuery: string): boolean`. Empty query → `true`. Otherwise, builds a haystack `normalize(product.name) + ' ' + product.variants.map(v => normalize(v.label)).join(' ')` and does `haystack.includes(normalizedQuery)`.

- [ ] T042 [P] [US4] Create `src/features/catalog/search/filter.ts` per [contracts/search-filter.md](./contracts/search-filter.md) §3: `applyFilter({ products, query, activeCategory }): ProductDisplayDTO[]`. Returns `input.products` by reference when both filters are empty (for `FlatList` prop stability). Otherwise filters by `activeCategory === null || (p.category ?? '').trim() === activeCategory` AND `matchesQuery(p, normalize(query))`.

- [ ] T043 [US4] Create `src/features/catalog/hooks/useCatalogFilter.ts` per [contracts/search-filter.md](./contracts/search-filter.md) §"Composition with React": local state `{ query, activeCategory }`, memoized `filtered` via `useMemo(() => applyFilter(...), [products, query, activeCategory])`, `reset()` callback. Exports `{ query, setQuery, activeCategory, setActiveCategory, filtered, reset }`. Accepts `products: ReadonlyArray<ProductDisplayDTO>` as input.

- [ ] T044 [P] [US4] Create `src/features/catalog/components/SearchBar.tsx`: bordered rounded rectangle (40 / 46 pt tall, `cornerRadius: 8 / 10`, white background, 1 px `#E4E4E7` border). Left: Feather `search` icon 16 / 18 pt, `#71717A`. Middle: `<TextInput>` with `placeholder: 'Buscar produto'` (`#71717A`), `fontSize: 14 / 15`, no underline, `autoCorrect={false}`, `autoCapitalize="none"`. Right: conditional Feather `x` clear button (when `value.length > 0`) that calls `onChangeText('')`. Props: `{ value: string; onChangeText: (v: string) => void; viewport: Viewport }`.

- [ ] T045 [P] [US4] Create `src/features/catalog/components/FilterChipRow.tsx`: horizontal row of chips. Categories sourced per [contracts/search-filter.md](./contracts/search-filter.md) §"Category sourcing": dedupe + trim + drop empty, sort by frequency desc then alphabetically case-insensitive. If `categorySet.size === 0`, **returns `null`** (hides the whole row). Otherwise renders a `FlatList` with `horizontal={true}`, `showsHorizontalScrollIndicator={false}`, `data={['Todos', ...categories]}`. Each chip: 32 / 36 pt tall, `cornerRadius: 16 / 18`, horizontal padding 12 / 16. Active chip (matches `activeCategory`, or the `'Todos'` chip when `activeCategory === null`) has `backgroundColor: '#18181B'` + white label; inactive: white background + 1 px `#E4E4E7` border + `#0A0A0A` label. Tap handler: `'Todos'` → `onChange(null)`; other → `onChange(label)` (or back to `null` if the tapped chip is already active). Props: `{ products: ReadonlyArray<ProductDisplayDTO>; activeCategory: string | null; onChange: (next: string | null) => void; viewport: Viewport }`.

- [ ] T046 [P] [US4] Create `src/features/catalog/components/CatalogNoMatchesView.tsx`: vertical centered column, neutral visual weight (smaller than `CatalogEmptyView`). Material Symbols `search_off` icon (40 pt, `#A1A1AA`); "Nenhum produto encontrado" heading (16 / 18 pt, weight 600, `#0A0A0A`); "Tente outra busca ou remova os filtros ativos." body (13 / 14 pt, `#71717A`, centered); secondary outline button "Limpar filtros" (`borderColor: '#E4E4E7'`, transparent bg, `#0A0A0A` label) → calls `onReset`. Props: `{ onReset: () => void; viewport: Viewport }`.

- [ ] T047 [US4] Extend `src/features/catalog/screens/CatalogScreen.tsx` with the search + filter + no-matches wiring. Add `const filter = useCatalogFilter(products)` after `useCatalog()`. Render (between the top bar and the grid, when `hasAny`): `<SearchBar value={filter.query} onChangeText={filter.setQuery} viewport={viewport} />` and `<FilterChipRow products={products} activeCategory={filter.activeCategory} onChange={filter.setActiveCategory} viewport={viewport} />`. Replace the US1 grid branch with: `if (filter.filtered.length === 0 && (filter.query !== '' || filter.activeCategory !== null)) return <CatalogNoMatchesView onReset={filter.reset} viewport={viewport} />`. Otherwise pass `filter.filtered` to `<ProductGrid>`. The empty-state branch from US2 (`!hasAny`) stays at the top of the decision tree unchanged.

- [ ] T048 [US4] Export `SearchBar`, `FilterChipRow`, `CatalogNoMatchesView` from `src/features/catalog/index.ts` (test sub-barrel — keep production surface small per [contracts/catalog-service.md](./contracts/catalog-service.md) §"Non-exports"; these should live in a test-only sub-barrel `index.test.ts` if the production barrel minimization rule matters; otherwise include in the main barrel). Decision deferred to reviewer preference; default to main barrel.

**US4 simulator verification**: type `cafe` → only Café Torrado matches. Tap `Bebidas` chip + type `refri` → intersection narrows to Refri Cola. Type `xyzzy` → no-matches view shows, tap reset → full list. Tap the `inventory_2` product (category `null`) in dashboard and clear every other product's category; sync; observe chip row hides entirely. On tablet, verify more chips fit inline without horizontal scroll.

**Checkpoint**: All four user stories functional. The full product catalog feature is feature-complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: final sweeps that span all stories.

- [ ] T049 [P] Run `pnpm lint` and `pnpm format:check`. Fix any violations introduced by the feature. No new lint rules are added in this feature; the existing `eslint-config-expo` + `prettier` defaults apply.

- [ ] T050 [P] Run `pnpm typecheck`. All catalog-feature files must pass `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` with zero errors. Particular attention to nullable access on `product.imageUrl`, `product.category`, `variant.price`, and `variant.barcode` given the data-model-wide nullable-string columns.

- [ ] T051 [P] Run `pnpm test` (full suite). Confirm all six new catalog test files pass AND none of the prior 002/003/004/005 tests regressed. New total test count should grow by ~30–40 cases.

- [ ] T052 Execute the [quickstart.md](./quickstart.md) §(c) Happy-Path walkthrough end-to-end on **both** iPhone and iPad simulators, verifying each of the four user stories against its Pencil frame. Document any visual delta (acceptable wiggle: ±2 pt spacing / minor font-weight rendering differences) in the PR description.

- [ ] T053 Execute the [quickstart.md](./quickstart.md) §(d) Cache-behavior verification: hot cache across force-close, orphan eviction after admin deletion + sync, cold-start hydration with no network requests. Attach a sandbox file listing (`Documents/product-images/`) before and after eviction to the PR.

- [ ] T054 Execute the [quickstart.md](./quickstart.md) §(f) test + smoke commands one final time. Confirm the test suite runs in < 10 s.

- [ ] T055 Update the `Current active plan` pointer in `CLAUDE.md` to remain `specs/006-product-catalog/plan.md` until this feature ships, at which point the next feature's `/speckit-plan` will overwrite it. (No file change needed unless the pointer has drifted during implementation — verify.)

- [ ] T056 Manually verify SC-001, SC-002, SC-006, SC-007 against the acceptance scenarios in [spec.md](./spec.md): (a) first-fold render under 500 ms on both viewports; (b) ≥ 95% of thumbnails cache-served offline after first sync; (c) no blocking full-screen spinner on any catalog screen at any point; (d) zero create/edit/delete affordances on products or variants (UI + code walkthrough).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Design (Phase 0)**: already complete. ✅
- **Setup (Phase 1)**: depends on Phase 0 (passed). Can start immediately.
- **Foundational (Phase 2)**: depends on Phase 1 completion. **BLOCKS** all user stories.
- **User Story 1 (Phase 3)**: depends on Foundational. Independently testable (plus empty DB caveat fixed by US2).
- **User Story 2 (Phase 4)**: depends on US1 (extends `CatalogScreen`). Independently testable once US1's scaffold exists.
- **User Story 3 (Phase 5)**: depends on US1 (tap-through from `ProductCard`). Independently testable.
- **User Story 4 (Phase 6)**: depends on US1 (extends `CatalogScreen` with search+filter). Independent of US2 and US3.
- **Polish (Phase 7)**: depends on all desired user stories being complete. Partial polish OK after MVP (US1 + US2).

### User Story Dependencies

- **US1 (P1, MVP)**: starts after Foundational. No upstream story.
- **US2 (P1, MVP gate)**: extends US1's `CatalogScreen`. Blocking for a shippable MVP even though the mechanical dependency is small (one branch + one view).
- **US3 (P2)**: independent of US2 and US4. Can be staffed concurrently with either if a second developer picks it up.
- **US4 (P2)**: independent of US2 and US3. Can be staffed concurrently.

### Within Each User Story

- Tests (where listed) MUST be written + failing before the implementation they test.
- Hooks + pure functions before the components that consume them.
- Components before screens.
- Screen + navigation + home-button before simulator verification.
- Story simulator verification before moving to the next story's implementation (constitution §5 UX5).

### Parallel Opportunities

- **Within Phase 1**: T002 (scaffold dir), T003 (Supabase SQL), T004 (Supabase bucket) are independent of T001 (package install) after T001 completes. T003 and T004 are admin-side and can happen in the dashboard concurrently while T002 runs locally.
- **Within Phase 2**: T008 (`breakpoints.ts`) and T009 (`useViewport.ts`) are parallel once T008 is done. T014 (imageCache tests) runs against T010–T013 and can be started concurrently with T010 by a second developer.
- **Within Phase 3 (US1)**: T015–T017 (three test files) all in parallel. T018 + T019 (hook + component for CachedImage) in parallel. T022 (ProductCard) runs in parallel with T021 (warmer) once T020 (useCatalog) is in.
- **Within Phase 6 (US4)**: T038–T039 (tests) parallel; T040–T042 (three pure functions) fully parallel; T044–T046 (three components) parallel once T043 (filter hook) is in.
- **Across stories**: US3 and US4 can run on separate branches by separate developers after US1 is merged. US2 is small enough (~4 tasks) that it's usually finished by the same developer who landed US1.

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests in parallel (can be staffed independently):
Task: "Create src/features/catalog/tests/useCatalog.test.ts"
Task: "Create src/features/catalog/tests/useCachedImage.test.ts"
Task: "Create src/features/catalog/tests/catalogCacheWarmer.test.ts"

# Launch image-related implementation in parallel:
Task: "Create src/features/catalog/hooks/useCachedImage.ts"
Task: "Create src/features/catalog/components/CachedImage.tsx"

# Once useCatalog lands, launch UI pieces in parallel:
Task: "Create src/features/catalog/components/ProductCard.tsx"
Task: "Create src/features/catalog/components/ProductGrid.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 0 — already complete ✅
2. Phase 1 — Setup (T001–T004, ~1 h counting Supabase dashboard work).
3. Phase 2 — Foundational (T005–T014, ~4 h with tests).
4. Phase 3 — US1 (T015–T029, ~6 h with tests + simulator verification).
5. **STOP, VALIDATE US1**: run simulator verification; confirm SC-002 offline behavior.
6. Phase 4 — US2 (T030–T033, ~2 h).
7. **STOP, VALIDATE US1 + US2 as MVP**: catalog opens, empty state works, sync CTA works online and offline. Shippable.

### Incremental Delivery

1. MVP (above) → demo / deploy.
2. Phase 5 — US3 (T034–T037, ~4 h) → demo / deploy.
3. Phase 6 — US4 (T038–T048, ~6 h with tests) → demo / deploy.
4. Phase 7 — Polish (T049–T056, ~2 h).

### Parallel Team Strategy

With two developers after Phase 2 completes:

- Developer A: US1 (Phase 3) → US2 (Phase 4).
- Developer B: US3 (Phase 5) starting in parallel with US1 once Foundational lands (reading the same `useCatalog`, `CachedImage`, `useViewport` primitives).
- Merge order: US1 → US2 → US3 (US3 can merge before US2 if needed — `ProductDetail` route is independent of the empty state). US4 takes whichever developer is free first.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps each task to its user story for traceability.
- Each user story is independently completable and testable (US2/US3/US4 all require US1's scaffold but do not require each other).
- Verify tests fail before implementing (TDD is encouraged but not required).
- Commit after each task or logical group. Conventional Commits: `feat(006): T015 add useCatalog hook`.
- Stop at any checkpoint to validate on a phone AND tablet simulator (UX5 is a hard gate per task).
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
