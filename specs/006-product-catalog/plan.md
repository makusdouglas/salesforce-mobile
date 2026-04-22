# Implementation Plan: Product Catalog

**Branch**: `006-product-catalog` | **Date**: 2026-04-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-product-catalog/spec.md`

## Summary

Ship the product catalog as a self-contained feature under `src/features/catalog/` that reads products and variants from the WatermelonDB data layer (block 002), renders them in a grid/list + detail view, and caches product image bytes on the device filesystem so the salesperson sees them offline after first sync (R3). The feature is **strictly read-only** in the app (D2): the existing read-only repositories from 002 (`productsRepository`, `productVariantsRepository`) already enforce this contract, and this feature adds no mutation surface.

Three screens are introduced: `Catalog`, `ProductDetail`, and the first-launch empty state (rendered inline on `Catalog` when the local catalog is empty). Each screen supports phone (390 × 844 pt) and tablet (820 × 1180 pt) portrait viewports (UX5) via `useWindowDimensions()` with a 768 pt breakpoint — phones render 2-column grid / stacked detail, tablets render 3-column grid / side-by-side detail. Pencil frames already exist ([design/screens.md](./design/screens.md)) and cover all six screen × viewport combinations.

Image caching is introduced as a new module `src/features/catalog/image-cache/`. It owns a single directory under `FileSystem.documentDirectory` (persistent, not OS-purgeable), stores files keyed by URL hash, and exposes a `<CachedImage>` component + `useCachedImage(url)` hook. A warmer hook `useCatalogCacheWarmer` subscribes to `useSyncStatus()` and, on every `syncing → in-sync` transition, prefetches any product/variant image whose URL is not yet on disk and evicts orphans (files whose product no longer exists). This is the first feature in the app to depend on `expo-file-system` — the library is mandated by constitution §3 specifically for R3 and is added with this feature.

Search and filter are two composable pure functions in `src/features/catalog/search/`. Text search is diacritic-insensitive (FR-017) via `normalize.ts` (`"café" → "cafe"`). Filter chips are tap-first (UX1); their primary dimension is **category**, which requires one WatermelonDB schema bump (version 1 → 2) to add a nullable `category` column to `products` and the mirrored Supabase-side column (admin applies via dashboard SQL, same operational pattern as 005's `contracts/supabase-schema.md`). When the admin leaves `category` null for every product, the chip row is hidden — the UI degrades gracefully to search-only, as the spec's Assumptions anticipate.

Entry into the module is through the existing `HomePlaceholderScreen`: a new `Ver catálogo` primary button and a new `Catalog` / `ProductDetail` pair of routes on `HomeStack`.

## Technical Context

**Language/Version**: TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (inherited from 001/002/003/004/005).

**Primary Dependencies**:

- `@nozbe/watermelondb` — **already installed** (002). Catalog reads via `productsRepository.observeAll()` and `productVariantsRepository.observeByProduct(id)` (both already exported).
- `@react-navigation/native-stack` — **already installed** (001). Two new screens register onto the existing `HomeStack`.
- `react-native` core `useWindowDimensions()` — **already in use** in auth/lock screens for responsive behavior; same convention inherited here.
- **`expo-file-system` — NEW.** Added by this feature. Constitution §3 lists it as the mandated library for R3 image caching; 005 did not touch it because the sync engine explicitly excluded image bytes from its scope. This feature is the first consumer; the library is pre-approved by the constitution and does not need a §3 "Allowed with justification" note.
- `@/features/sync` — **already in place** (005). The catalog cache warmer subscribes to `useSyncStatus()` read-only; no modifications to the sync feature's surface.
- `@/data` — existing `productsRepository`, `productVariantsRepository`, `database` from 002.
- Dev: existing Jest + ts-jest; no new dev tooling.

**Storage**:

- **Product rows** — WatermelonDB `products` table from 002. One schema bump in this feature: version 1 → 2, adds `category` column (nullable, indexed, string). Migration follows 002's `migrations.ts` append-only convention.
- **Product-variant rows** — WatermelonDB `product_variants` table from 002. No schema change.
- **Image bytes** — `FileSystem.documentDirectory + "product-images/"`, one file per unique image URL. Files are keyed by a truncated SHA-256 hash of the URL (16 hex chars + extension parsed from the URL's path). Persistent across app launches by virtue of `documentDirectory` (not `cacheDirectory` — the OS is not allowed to evict these at will; the spec's 95% offline-hit target in SC-002 demands persistence).
- **Image-cache index** — in-memory `Map<url, filePath>` rebuilt at app start by scanning the cache directory. No secondary index file. Rebuild cost is proportional to the number of cached images (low hundreds at MVP scale), which runs in a few ms at most on a cold start.
- **Supabase-side** — `products.category text NULL` column added by the admin via dashboard (operational, not an app migration). Verification SQL and the exact `ALTER TABLE` lives in [contracts/supabase-schema.md](./contracts/supabase-schema.md).

**Testing**: Constitution §9 — business-logic coverage first, UI does not need exhaustive tests in MVP. Ship unit tests for:

1. **Diacritic-insensitive search** (`normalize.test.ts`): `"café" === "cafe"`, `"açaí" === "acai"`, `"Limão" === "limao"`, casing-insensitive, punctuation preserved.
2. **Composable filter** (`filter.test.ts`): text query + category chips compose as intersection (FR-016); empty query + empty chips returns the full list; text-only and chip-only each filter independently; tie-breaking on equal match — alphabetical by name.
3. **Image cache single-flight** (`imageCache.test.ts`): two concurrent `getCachedUri(url)` calls result in exactly one download and both receive the same file URI; prefetch of an already-cached URL is a no-op; evicted orphans are removed from disk and the in-memory map; eviction of a URL currently being downloaded is deferred until the in-flight download completes.
4. **`useCachedImage` status machine** (`useCachedImage.test.ts`): states `loading → ready` on successful download, `loading → missing` on download failure, and never blocks rendering (returns `{ uri: null, status: 'loading' }` immediately).
5. **Empty-state decision** (`useCatalog.test.ts`): `hasAny` flips to `true` atomically when the first product lands in the local DB; `hasEverSynced` is a separate signal used for the first-launch branch of the empty state, so pulling an empty catalog keeps showing the first-launch copy (FR-019) rather than a "no products" state.
6. **Cache warmer** (`catalogCacheWarmer.test.ts`): `syncing → in-sync` transition enqueues a prefetch pass; `in-sync → in-sync` (no real transition) does not; `in-sync → syncing` cancels any in-flight prefetch; orphan eviction runs after the prefetch settles.

UI is verified by manual walkthrough against the Pencil frames and the acceptance scenarios in spec.md, on a phone simulator (390 × 844) and an iPad simulator (820 × 1180).

**Target Platform**: iOS 13+ and Android 7+ (inherited). `expo-file-system` supports these minimums.

**Project Type**: Mobile app — feature module addition on top of the 002 data layer, 003 auth scaffold, 004 lock gate, and 005 sync engine. No backend code (admin operates on Supabase dashboard directly per P4).

**Performance Goals**:

- First-fold render on the populated `Catalog` screen in under 500 ms after a cold launch, on both phone and tablet baseline viewports (SC-001). Achieved by reading from WatermelonDB (already indexed) and letting the grid virtualize via `FlatList` / `FlashList` (research decides).
- ≥ 95% of product thumbnails served from the local cache when the device is offline after at least one successful sync (SC-002). Achieved by prefetch-on-sync, not prefetch-on-scroll.
- A salesperson locates a known product in a 500-product catalog in under 10 seconds using only tap filters (SC-004) — design-level target; implementation responsibility is to make the chip row render within the first-fold budget and to update the list synchronously on tap (no async filter).
- No blocking full-screen spinner on any business screen at any point (SC-006, P1). The catalog list renders from whatever is already local, even if empty; "loading" is not a state this module owns.

**Constraints**:

- **Read-only contract (FR-001, FR-002, SC-007)**: no mutation API from the catalog feature surfaces — not imports, not re-exports from 002. The feature is free of `create`, `update`, `delete` verbs on product/variant data.
- **Offline-first (P1)**: rendering the `Catalog` and `ProductDetail` screens MUST NOT issue any network request. Image byte fetches go through the image cache, which serves from disk synchronously when hot and only downloads on demand from a mounted `<CachedImage>` or the warmer. The first `Catalog` mount after install shows the empty state and a `Sincronizar agora` button — no network is issued by the catalog screen itself; the button delegates to the sync feature's public trigger.
- **Portrait-only (UX5)**: landscape is out of scope; `app.json` already locks orientation (inherited).
- **Language (constitution §9)**: user-visible copy is Portuguese; identifiers are English. Empty-state and "no matches" copy taken verbatim from the Pencil frames / spec.md.

**Scale/Scope**:

- **~25 new source files + 6 unit-test files** under `src/features/catalog/`. Breakdown: 2 screen components (`CatalogScreen`, `ProductDetailScreen`), 7 presentational components (`CatalogEmptyView`, `CatalogNoMatchesView`, `ProductCard`, `ProductGrid`, `SearchBar`, `FilterChipRow`, `VariantRow`, `CachedImage`), 5 hooks (`useCatalog`, `useCatalogFilter`, `useCachedImage`, `useCatalogCacheWarmer`, `useViewport`), 4 image-cache modules (`imageCache`, `cacheStore`, `paths`, `download`), 3 search modules (`normalize`, `matches`, `filter`), 1 responsive breakpoints module, 1 barrel `index.ts`. Test files: `normalize.test.ts`, `filter.test.ts`, `imageCache.test.ts`, `useCachedImage.test.ts`, `useCatalog.test.ts`, `catalogCacheWarmer.test.ts`.
- **3 existing 002 files receive edits**: `src/data/schema/tables.ts` (bump version to 2, add `category` column to `products`), `src/data/schema/migrations.ts` (append migration step), `src/data/models/Product.ts` (add `@field('category') category!: string | null`).
- **3 navigation/home files receive edits**: `src/app/navigation/HomeStack.tsx` gains two routes, `src/app/navigation/types.ts` adds their param list entries, and `src/features/home/screens/HomePlaceholderScreen.tsx` gains a `Ver catálogo` primary button that calls `navigation.navigate('Catalog')`.
- **1 package change**: `expo-file-system` added to `dependencies` in `package.json`.
- **1 Supabase-side operational change** documented in `contracts/supabase-schema.md` (add `category text NULL` to `products`; configure `product-images` bucket public-read; admin executes via dashboard SQL + Storage UI).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | `Catalog` and `ProductDetail` read from WatermelonDB only; no blocking spinner (FR-004, SC-006). Image fetches are per-card, async, non-blocking, and degrade to a neutral placeholder (FR-013). The empty-state sync CTA delegates to 005's public trigger; the catalog never issues its own HTTP calls. |
| P2 Local DB is source of truth | ✅ | Pass | Catalog reads via 002's repositories; it does not hit Supabase at runtime. Sync owns server truth; catalog owns presentation. |
| P3 MVP simplicity | ✅ | Pass | No virtualization library beyond RN's `FlatList` unless research proves insufficient. No image-caching library (expo-image, react-native-fast-image) — a thin custom wrapper over `expo-file-system` + `<Image>` suffices, since caching semantics this module needs (persistent, URL-keyed, prefetch-on-sync) are idiosyncratic. Category is a simple nullable column, not a normalized join table. Cache eviction is orphan-cleanup only, no LRU. |
| P4 Reuse free tools | ✅ | Pass | Supabase dashboard populates `category` and image URLs (D2). No admin UI built. Supabase Storage hosts the images (R3). No SaaS image-CDN service integrated. |
| P5 Salesperson data is sacred | ✅ | Pass | Catalog is read-only and owns no user-generated data. Image cache misses never delete or corrupt product rows. Evicting an orphaned image does not delete the product row; products are only removed by sync (per D2, only the admin deletes products). |
| §3 Mandatory — Expo managed + dev client | ✅ | Pass | No new native module; `expo-file-system` is an Expo-hosted library already in the managed workflow. No dev-client change required beyond the existing one from 004. |
| §3 Mandatory — WatermelonDB | ✅ | Pass | Uses existing `products` and `product_variants` collections via the read-only repositories from 002. One schema bump (adds `category` column) follows 002's migration convention. |
| §3 Mandatory — Supabase | ✅ | Pass | Admin dashboard owns catalog CRUD (D2, P4). Supabase Storage hosts image bytes (R3). The app itself does not call Supabase at runtime within this feature — reads flow through 005's sync passes which already handle the `products`/`product_variants` tables. |
| §3 Mandatory — `expo-file-system` | ✅ | Pass | **This feature is the first consumer of §3's R3 dependency.** Installed with this plan. No "Allowed with justification" note needed: the constitution itself mandates the library. |
| §3 Mandatory — `expo-secure-store` | N/A | — | Catalog does not persist anything secret. |
| §3 Mandatory — `expo-local-authentication` | N/A | — | Unlock is 004's responsibility; catalog mounts inside `<LockGate>`. |
| §3 Forbidden — custom backend / Firebase / heavy state mgmt | ✅ | Pass | No backend. No Firebase. Filter and search are local React state + pure functions. Image-cache state is a module-level `Map` behind a small singleton surface — same pattern 005 uses for `syncStatusStore`. |
| §3 Forbidden — heavy UI libraries | ✅ | Pass | RN core components only. No UI kit. Chip row, search bar, cards, variant rows are all custom minimal components matching the Pencil frames (shadcn-neutral look already established in the existing auth/lock screens). |
| §3 Allowed with justification — dev-build native lib | N/A | — | `expo-file-system` runs in Expo Go; no dev-build-only native module added by this feature. |
| R1 WatermelonDB is the single client data layer | ✅ | Pass | Catalog reads exclusively from 002 repositories. No Supabase imports in this feature. |
| R2 Seven entities | ✅ | Pass | No new entity. The cache is a filesystem artifact (analogous to 005's in-memory sync-status singleton — neither is a "data model"). The `category` column is a new column on an existing entity, not a new entity. |
| R3 Images in Storage + local cache via expo-file-system | ✅ | Pass | **This feature is the first implementation of R3.** Image URLs are synced as string columns (already done by 005); the byte-level cache is owned here. `expo-file-system.documentDirectory + "product-images/"` is the persistent cache location. |
| R4 PDF local, email via share sheet | N/A | — | Not touched. |
| R5 Discounts on order, not catalog | ✅ | Pass | `ProductDetail` shows base prices only. No discount UI anywhere in the catalog feature. Discounts belong to the future orders feature, keyed off variant id at order time. |
| §5 UX1 Tap, not type | ✅ | Pass | Filter chips are the primary narrowing mechanism (FR-014); the text field is a secondary fallback (FR-015). Tap-to-open product detail. Grid cards are large tap targets. When `category` is unpopulated, chips hide and the UI degrades to search-only (spec Assumptions) — a conscious trade-off to ship something rather than block UX1 on admin operational readiness. |
| §5 UX2 Repeat previous order | N/A | — | Not touched. Future orders feature. |
| §5 UX3 Useful empty states | ✅ | Pass | Two distinct empty states shipped: (a) first-launch "Seu catálogo está vazio" with primary `Sincronizar agora` CTA (FR-019, FR-021, FR-022); (b) search `no matches` state with a reset control (FR-018). Neither uses system/developer jargon (FR-020). Copy and composition taken verbatim from the Pencil frames. |
| §5 UX4 Discreet sync feedback | ✅ | Pass | The catalog top bar includes the existing `<SyncStatusIndicator>` from 005 (inherited, not re-implemented). Never modal, never full-screen. |
| §5 UX5 Phone AND tablet layouts | ✅ | Pass | Pencil frames ship for all three logical screens × both viewports (6 frames total). The responsive strategy is documented in "Structure Decision" below and is implemented via `useViewport()` wrapping `useWindowDimensions()` at a 768 pt breakpoint. All frames are portrait-only. |
| §6 D1 Pull then push | N/A | — | Sync is 005's concern. Catalog triggers no sync passes itself except via 005's public `onPullToRefresh` from the empty-state CTA and the header pull-to-refresh gesture (inherited). |
| §6 D2 Catalog read-only in app | ✅ | Pass | **This feature is the implementation of D2.** FR-001 and FR-002 trace directly. The repositories from 002 already enforce this statically (no mutation methods on their public surface) — this plan does not introduce any local mutation either. SC-007 is a UI-walkthrough gate. |
| §6 D3 Admin-side merge | N/A | — | Catalog does not touch clients. |
| §6 D4 Simple order statuses | N/A | — | Not touched. |
| §7 D5 Online-one-time + offline-persistent | ✅ | Pass | Catalog does not perform auth work. Image downloads inherit the anonymous-public-URL contract of Supabase Storage — no bearer token is attached; RLS on the Storage bucket is configured to public-read for the `product-images` bucket (documented in `contracts/supabase-schema.md`). |
| §7 D6 Mandatory local lock | ✅ | Pass | `HomeStack` is gated by `<LockGate>` (inherited from 004). Catalog routes sit inside `HomeStack`; unlock is a precondition for any catalog screen to render. |
| §9 English identifiers | ✅ | Pass | All new file, type, function, and variable names in English. Portuguese appears only in the user-visible copy baked into `CatalogEmptyView`, `CatalogNoMatchesView`, `SearchBar` placeholder, and the `FilterChipRow` labels (which mirror admin-populated category names). |

**Gate status (pre-research)**: PASS. Zero violations. Zero justified deviations. The feature is a natural application of principles 002–005 already established.

## Design Prerequisite

*GATE: Must pass before any implementation task is generated.*

**Does this feature have a UI?** Yes — three logical screens (Catalog list, Product detail, Empty catalog), each with phone and tablet variants. Pencil frames for all six combinations were produced during `/speckit-pencil-design` and exported.

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | Three screens × two viewports = six frames. |
| `design/screens.md` exists | ✅ | [design/screens.md](./design/screens.md) |
| Phone frames cover all screens | ✅ | `Catalog / Phone` (`oE6Po`), `ProductDetail / Phone` (`WCgvx`), `CatalogEmpty / Phone` (`YkrkF`). |
| Tablet frames cover all screens | ✅ | `Catalog / Tablet` (`R70uK`), `ProductDetail / Tablet` (`ow0Ma`), `CatalogEmpty / Tablet` (`74wU8`). |
| Responsive strategy documented below | ✅ | `useViewport()` hook returns `'phone' \| 'tablet'` from `useWindowDimensions().width ≥ 768`; each screen has viewport-conditional layout branches inline (grid column count, detail split vs. stack, empty-state max-width). Same pattern already used by `LoginScreen`, `ReloginScreen`, `LockScreen`, `PinSetupScreen`, `PinRecoveryConfirmScreen` in the existing codebase. |

Design-level open items surfaced in `design/screens.md` do **not** block implementation:
- "No matches" sub-state will be hand-built in code from FR-018 + the shared catalog aesthetic (search icon + short message + reset button). It does not need its own Pencil frame because it's a state, not a screen — the host `Catalog` screen owns the layout.
- Sync-status color tokens (`#16A34A` / `#F59E0B`) used in the Pencil frames come from 005's `<SyncStatusIndicator>` palette; no duplication here.

**Design artifacts recorded for downstream skills**: [design.json](./design.json) lists all six frames and their screenshot paths.

## Project Structure

### Documentation (this feature)

```text
specs/006-product-catalog/
├── plan.md                                 # This file
├── research.md                             # Phase 0 — expo-file-system API choice, image hash strategy, FlatList vs FlashList, diacritic-normalize impl, breakpoint value, orphan-eviction trigger
├── data-model.md                           # Phase 1 — Product / ProductVariant read shapes, cache entry shape, filter state shape
├── quickstart.md                           # Phase 1 — "how Home mounts Catalog + how Catalog warms the cache after sync + how to seed the cache for a simulator demo"
├── contracts/
│   ├── catalog-service.md                  # Public surface of the feature barrel: screens, hook shapes, CachedImage props
│   ├── image-cache.md                      # imageCache singleton API, file path convention, eviction semantics, single-flight contract
│   ├── search-filter.md                    # normalize / matches / filter pure-function contracts, composition rules, tiebreakers
│   ├── responsive.md                       # useViewport hook, breakpoint, per-screen layout-branch rules
│   └── supabase-schema.md                  # Operational prerequisite: ALTER products ADD category text NULL; Storage bucket public-read policy
├── design/
│   ├── screens.md                          # Pencil design summary (already generated)
│   ├── catalog-phone.png, catalog-tablet.png
│   ├── product-detail-phone.png, product-detail-tablet.png
│   └── catalog-empty-phone.png, catalog-empty-tablet.png
├── design.json                             # Pointer to design artifacts (already generated)
├── checklists/
│   └── requirements.md                     # Spec quality checklist (from /speckit-specify)
└── tasks.md                                # Phase 2 — /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

The catalog feature sits as a peer of `src/features/auth/`, `src/features/lock/`, `src/features/sync/`, and `src/features/home/` under `src/features/`, exposed through a single barrel. Exactly three modules outside the feature folder reach into it: `src/app/navigation/HomeStack.tsx` (registers `Catalog` and `ProductDetail` routes), `src/app/navigation/types.ts` (adds route param types), and `src/features/home/screens/HomePlaceholderScreen.tsx` (adds one primary button). Three 002 files are modified for the `category` column migration.

```text
.
├── package.json                                       # MODIFIED — adds expo-file-system to dependencies
└── src/
    ├── app/
    │   └── navigation/
    │       ├── HomeStack.tsx                          # MODIFIED — registers 'Catalog' and 'ProductDetail' screens with Portuguese titles
    │       └── types.ts                               # MODIFIED — adds Catalog: undefined; ProductDetail: { productId: string } to HomeStackParamList
    ├── data/
    │   ├── schema/
    │   │   ├── tables.ts                              # MODIFIED — bump version 1→2; add { name: 'category', type: 'string', isOptional: true, isIndexed: true } to products
    │   │   └── migrations.ts                          # MODIFIED — append migration step for schema version 2 adding products.category
    │   └── models/
    │       └── Product.ts                             # MODIFIED — add @field('category') category!: string | null
    └── features/
        ├── home/
        │   └── screens/
        │       └── HomePlaceholderScreen.tsx          # MODIFIED — adds primary 'Ver catálogo' Pressable wired to navigation.navigate('Catalog')
        └── catalog/
            ├── index.ts                                # NEW — public barrel: CatalogScreen, ProductDetailScreen, types
            ├── screens/
            │   ├── CatalogScreen.tsx                  # NEW — top bar + search + chip row + grid OR empty state; branches by hasEverSynced + local count
            │   └── ProductDetailScreen.tsx            # NEW — top bar + hero image + name/description/base price + variants list; route param: productId
            ├── components/
            │   ├── CatalogEmptyView.tsx               # NEW — first-launch empty state with Sincronizar agora CTA (fires onPullToRefresh + offline-aware alert)
            │   ├── CatalogNoMatchesView.tsx           # NEW — zero-results state for search+chip; reset control
            │   ├── ProductCard.tsx                    # NEW — grid/list card: CachedImage + name + base price + variant count
            │   ├── ProductGrid.tsx                    # NEW — FlatList with numColumns={useViewport()==='tablet' ? 3 : 2}; renders ProductCard
            │   ├── SearchBar.tsx                      # NEW — text input with 'Buscar produto' placeholder and clear button
            │   ├── FilterChipRow.tsx                  # NEW — horizontal scroll of chips; first chip is 'Todos' (no filter); subsequent chips are unique categories observed in the local catalog; hides entirely if no product has a category
            │   ├── VariantRow.tsx                     # NEW — row used on detail: label + attributes + price (or 'preço indisponível' when price is null)
            │   └── CachedImage.tsx                    # NEW — wraps <Image>, resolves URL via useCachedImage, renders neutral placeholder until ready or on 'missing'
            ├── hooks/
            │   ├── useCatalog.ts                      # NEW — observes productsRepository.observeAll() joined with variants; returns { products, hasAny, hasEverSynced }
            │   ├── useCatalogFilter.ts                # NEW — local state { query, activeCategory }; returns filtered product array + reset()
            │   ├── useCachedImage.ts                  # NEW — { uri: string | null, status: 'loading' | 'ready' | 'missing' }; triggers download on mount if not cached
            │   ├── useCatalogCacheWarmer.ts          # NEW — effect: subscribes to useSyncStatus; on 'syncing' → 'in-sync' transition, runs imageCache.prefetch(allUrls) then imageCache.evictOrphans(validUrls)
            │   └── useViewport.ts                    # NEW — returns 'phone' | 'tablet' based on useWindowDimensions().width >= 768
            ├── image-cache/
            │   ├── imageCache.ts                     # NEW — public API: getCachedUri(url), prefetch(urls), evictOrphans(validUrls), _reset() [test only]
            │   ├── cacheStore.ts                     # NEW — module-level Map<url, filePath>; rebuilt on first access from disk
            │   ├── paths.ts                          # NEW — cacheDir constant, mkPath(url) → `${cacheDir}/${sha256(url).slice(0,16)}.${ext(url)}`
            │   └── download.ts                       # NEW — downloadOnce(url, dest) with a single-flight Map<url, Promise> deduplication
            ├── search/
            │   ├── normalize.ts                      # NEW — removeDiacritics + toLowerCase; pure
            │   ├── matches.ts                       # NEW — matchesQuery(product, q): name contains q AND/OR any variant.label contains q
            │   └── filter.ts                        # NEW — applyFilter({ products, query, categoryId }) → products[]; empty query + empty category = all
            ├── responsive/
            │   └── breakpoints.ts                   # NEW — TABLET_MIN_WIDTH = 768 (documented constant)
            └── tests/
                ├── normalize.test.ts                 # NEW — diacritic-insensitive, case-insensitive
                ├── filter.test.ts                    # NEW — compose query + category; empty inputs
                ├── imageCache.test.ts                # NEW — single-flight, prefetch no-op, orphan eviction
                ├── useCachedImage.test.ts            # NEW — status transitions
                ├── useCatalog.test.ts                # NEW — empty-state branches (hasAny, hasEverSynced)
                └── catalogCacheWarmer.test.ts       # NEW — syncing→in-sync triggers prefetch; other transitions do not
```

**Structure Decision**: The catalog feature is structured around four architectural levers that keep it well-bounded and match the patterns already established by 003/004/005:

1. **Three layers inside the feature**: presentation (`screens/`, `components/`), logic (`hooks/`, `search/`), and infrastructure (`image-cache/`, `responsive/`). `useCatalogCacheWarmer` is the only module that couples to another feature (it imports `useSyncStatus` from `@/features/sync`); all other imports are either local to the catalog feature or reach into `@/data` for repositories.

2. **Responsive strategy = viewport hook + inline layout branches**. `useViewport()` returns `'phone' | 'tablet'` by dividing `useWindowDimensions().width` at 768 pt. Each screen component reads the viewport once and branches its layout inline — two-column vs three-column grid on `CatalogScreen`, stacked vs side-by-side split on `ProductDetailScreen`, full-width vs 460 pt max-width centered column on `CatalogEmptyView`. No separate `*.phone.tsx` / `*.tablet.tsx` files; one component per screen with clearly-named viewport branches. This matches how `LoginScreen` etc. already handle it.

3. **Image cache is a module-level singleton, not a React Context**. The `imageCache` surface is three functions (`getCachedUri`, `prefetch`, `evictOrphans`) and their backing `Map` state. `useCachedImage(url)` subscribes to single-URL state via `useState` + `useEffect`; `useCatalogCacheWarmer` is a fire-and-forget effect that calls into the singleton on sync transitions. No Context = no re-render storms when many cards resolve at once.

4. **Catalog is read-only end-to-end**: screens and components accept `ProductDisplayDTO` (a derived shape combining product row + first-N variants), not `Product` models directly. This prevents components from calling `.update()` or other mutation methods even accidentally, and it simplifies snapshot-based tests. Repositories (`productsRepository`, `productVariantsRepository`) from 002 are the only modules that touch WatermelonDB objects in this feature.

**Rejected alternatives**:

- **A dedicated `<CatalogProvider>` with Context** — rejected in favor of reading directly from the 002 repositories (`useCatalog` / `useCatalogFilter` hooks compose observations + local state). A Context would add a middle layer with zero value: there is no cross-cutting catalog state, just a WatermelonDB observation and local filter state. Matches 005's choice to expose `useSyncStatus` over an explicit context.
- **react-native-fast-image or expo-image for caching** — rejected by P3 and R3. Both libraries ship their own memory + disk caches with opinionated invalidation. R3 explicitly names `expo-file-system` as the caching mechanism, and the semantics this feature needs (prefetch on sync, orphan eviction, URL-hashed filenames on documentDirectory) are simple enough that a 4-file custom module beats a third-party library's general-purpose cache.
- **Normalize `category` into its own table** — rejected by P3. At MVP scale (hundreds of products, a handful of categories), the nullable `category` string column is sufficient. If a category-renaming workflow emerges later, it can be normalized without breaking any caller because the filter layer already abstracts over a `categoryId: string | null` shape.
- **FlashList (Shopify) for the grid** — considered, deferred to research. If RN's `FlatList` meets SC-001 on both viewports with a 500-product synthetic dataset, FlashList is unnecessary overhead. Research will benchmark; if it wins, it'll need a §3 "Allowed with justification" note because it's not on the mandated list.
- **Prefetch images eagerly on mount instead of on sync completion** — rejected. Eager prefetch on catalog mount would blast the network every time the catalog screen opens, even when the data hasn't changed. Tying prefetch to `syncing → in-sync` transitions means the cache warms exactly when new data arrives, no more.
- **Category filter hidden behind a modal** — rejected by UX1. Chips inline are faster than a modal. A modal adds a navigation step and reduces the "tap, not type" advantage the chips are supposed to provide. If the chip row ever grows past the available width, horizontal scroll is the answer (already implemented in the Pencil frames).
- **Empty-state behavior that depends on admin-dashboard semantics** — e.g., showing a different message "Your catalog has no products" if sync succeeded but returned zero products. Rejected for the MVP: `hasEverSynced` is a device-level fact, not an admin-assertion fact. Until the admin pushes the first product, the first-launch copy is appropriate; after a successful sync that returns zero products, the same "empty" copy remains correct (the salesperson's action is still the same: wait for the admin to populate the catalog). The spec's US2 Acceptance Scenario 4 confirms this interpretation.
- **Category-less chip row that reads "Todos / Sem categoria"** — rejected. If no product has a category, the UI degrades to search-only (no chip row at all), per the spec Assumption. A one-chip row offering "Todos" is visual noise.
- **Sourcing the image URL from `product_variants` instead of `products`** — rejected. The `products` table already has `image_url` (one image per product, shared across variants). The variant-level override is not required by the spec and would inflate the cache size; if it's needed later, the cache layer already accepts arbitrary URLs — only the warmer's "collect all URLs" step would change.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified.**

None. Gate passed pre-research with zero violations.

## Phase 1 post-design re-check

After Phase 1 artifacts (research.md, data-model.md, contracts/, quickstart.md) were drafted, the Constitution Check table is re-evaluated. Items surfaced during Phase 1 and not moving the gate:

1. **Supabase Storage bucket policy** ([contracts/supabase-schema.md](./contracts/supabase-schema.md)): the `product-images` bucket MUST be configured for public read access. This is an operational change the admin applies in the Supabase dashboard (same pattern as 005's schema changes). Does not move the compliance needle on D5 (images are not secrets).
2. **Category column nullability is the day-one reality.** Chip row hides when every product has a null `category`. This is designed-in behavior, not a bug.
3. **`FlatList` vs `FlashList`** — research concluded `FlatList` meets SC-001 on the mid-range Android reference device at 500 products; `FlashList` is not adopted in this feature, keeping the P3 envelope.

**Gate status (post-design)**: PASS. Zero violations.
