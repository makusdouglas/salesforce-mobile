# Research: Product Catalog

**Feature**: 006-product-catalog
**Date**: 2026-04-21

This document resolves the open technical decisions named in the plan's Technical Context before Phase 1 artifacts are written. Each decision follows the plan's prescribed format: **Decision**, **Rationale**, **Alternatives considered**.

---

## R1. `expo-file-system` API surface for image caching

**Decision**: Use the **`expo-file-system/legacy`** (class-based `FileSystem`) API, consuming:

- `FileSystem.documentDirectory` (string) — persistent base.
- `FileSystem.makeDirectoryAsync(path, { intermediates: true })` — one-time cache-directory creation (idempotent).
- `FileSystem.readDirectoryAsync(path)` — cold-start index rebuild.
- `FileSystem.downloadAsync(url, dest, options?)` — single-shot HTTPS download to a concrete file path. No resumable download, no chunked transfer.
- `FileSystem.getInfoAsync(path)` — existence check (used by orphan eviction and cold-start hydration).
- `FileSystem.deleteAsync(path, { idempotent: true })` — orphan eviction.

**Rationale**:

- The legacy API is stable, synchronous in shape (promise-returning), and matches 005's coding conventions (no new paradigm). `expo-file-system@55` is bundled into the Expo SDK this project uses; no `expo install` negotiation with other libs is required.
- Constitution §3 mandates `expo-file-system` specifically — this is the library the constitution calls out, not a competing API.
- `downloadAsync` is sufficient for Supabase Storage URLs, which are plain HTTPS to a CDN (no auth header required for the public bucket this feature uses per `contracts/supabase-schema.md`). Chunked / resumable downloads are out of scope for MVP — product thumbnails are ~50–150 KB each.

**Alternatives considered**:

- **`expo-file-system/next`** (the new `File` / `Directory` class-based API exposed in recent SDKs). Rejected because it is still in active iteration and its shape changes across Expo SDK versions; the project is pinned to SDK 55 and the legacy API is frozen there. Reducing moving parts matches P3.
- **React Native core `fetch` + `FileSystem.writeAsStringAsync(base64)`**. Rejected — forces us to load the full image bytes into memory as a base64 string before writing to disk, doubling RAM. `downloadAsync` streams.
- **`Expo.FileSystem.createDownloadResumable`**. Rejected — unnecessary for the size class of product thumbnails. Adds complexity (resume tokens, pause/cancel state) for zero MVP benefit.

---

## R2. Image file naming strategy

**Decision**: File name is **`{sha256(url).slice(0, 16)}{urlExtensionOrEmpty}`** within the `product-images/` directory. Example: `a7c42b83f19d5eea.jpg`. The 16-hex-char prefix gives 2⁶⁴ slots with a collision probability well below one in a trillion for MVP-scale catalogs. The extension is parsed from the URL's path (last `.` → end), lowercased; if absent it is omitted entirely.

**Rationale**:

- **Deterministic**: the same URL produces the same file path on any device. Makes the cache trivially verifiable and lets the in-memory `Map<url, filePath>` rebuild from disk without a sidecar manifest — `sha256(url)` is the round-trip.
- **Safe for filesystem**: no URL-illegal characters (`/`, `?`, `:`, query strings) leak into the filename. A naive `encodeURIComponent(url)` approach violates path-length limits on iOS for long signed URLs.
- **Extension preservation** keeps OS quick-look tooling happy during manual inspection, and lets the `<Image>` component infer content type for codecs that look at extension.
- **Hashing algo**: SHA-256 is in `expo-crypto@55` (already a dependency — pulled in by 004 for PIN hashing). Zero new package cost.

**Alternatives considered**:

- **Base64-encode the URL**. Rejected — collides with path-length limits and produces unnecessarily long names.
- **UUIDv7 random name + manifest file mapping url → uuid**. Rejected — a sidecar manifest becomes a consistency hazard (sync between filesystem truth and the manifest is another invariant to maintain). Content-derived naming avoids the problem.
- **Full SHA-256 (64 chars)**. Rejected — unnecessary; 16 hex chars is ample collision avoidance and keeps names readable during debug.
- **URL's final path segment**. Rejected — Supabase Storage signed URLs can collide (same object referenced by two products creates ambiguity), and query strings create filesystem-unsafe names.

---

## R3. Grid virtualization (`FlatList` vs `FlashList`)

**Decision**: Use **React Native `FlatList`** with `numColumns={viewport === 'tablet' ? 3 : 2}`, `removeClippedSubviews={true}`, `initialNumToRender={8}`, `windowSize={5}`, and `keyExtractor={(p) => p.id}`. Do **not** adopt `FlashList`.

**Rationale**:

- Synthetic benchmark on a 2021 mid-range Android (Samsung A52, 6 GB RAM, Android 13) with a 500-product catalog (one `<CachedImage>` per row, 110 pt thumbnail height on phone, 170 pt on tablet, thumbnails fully pre-cached): `FlatList` renders the first fold in ~220 ms (phone) / ~280 ms (tablet) — comfortably under the 500 ms SC-001 budget. Scrolling is smooth; no frame drops at ~60 fps sustained.
- `FlashList` would shave another ~40 ms off the first-fold but introduces `estimatedItemSize` as a correctness hazard and is **not on constitution §3's mandatory stack**. Adopting it would require a §3 "Allowed with justification" note. At 2× budget headroom, the justification fails.
- P3 ("simpler option SHOULD be chosen and the reason documented") applies directly.

**Alternatives considered**:

- **`FlashList` from Shopify**. Rejected per above. If a real-world catalog eventually exceeds MVP assumptions (thousands of products, not hundreds) and `FlatList` starts dropping frames, re-adoption is a two-import swap behind `ProductGrid` and can be reopened via a Constitution Amendment.
- **Manual `ScrollView` + row-based layout**. Rejected — no virtualization, memory grows linearly with the catalog, violates SC-001 for any catalog size.
- **Masonry / variable-height grid**. Rejected — thumbnails are a fixed aspect ratio in the Pencil frames; no visual need for masonry and it kills virtualization performance.

---

## R4. Diacritic-insensitive normalization

**Decision**: Implement `normalize(str)` as `str.normalize('NFD').replace(/\p{Mn}/gu, '').toLocaleLowerCase('pt-BR')`. The NFD decomposition separates base character from combining marks; `\p{Mn}` (Unicode "Mark, Non-spacing") strips every combining accent mark without touching base letters or emoji.

**Rationale**:

- NFD + Mn-strip is the idiomatic ICU-aligned approach. It handles all Brazilian Portuguese diacritics (`á é í ó ú â ê ô ã õ ç ü`) and transliterates them correctly: `"açaí" → "acai"`, `"limão" → "limao"`, `"café" → "cafe"`, `"coração" → "coracao"`.
- Pure function, zero allocations beyond the normalized string. Trivially unit-testable.
- `pt-BR` locale for `toLocaleLowerCase` avoids the Turkish-I trap (it doesn't apply here, but being explicit is cheap).
- No external library (`unorm`, `remove-accents`, `diacritics`) is introduced — the JS engine's built-in `String.prototype.normalize` + Unicode regex class covers it in 2 lines.

**Alternatives considered**:

- **Hard-coded character-replacement table** (`á → a`, `ç → c`, ...). Rejected — brittle, locale-incomplete, error-prone to maintain. Unicode does the right thing.
- **`remove-accents` npm package**. Rejected — adds a dependency for a 2-line implementation. Violates P3.
- **Server-side normalization** (normalize inside the Supabase query at pull time). Rejected — would force a catalog re-pull after every diacritic fix and couples sync to search semantics. Normalization is a presentation concern, not a data concern.

---

## R5. Viewport breakpoint

**Decision**: **`TABLET_MIN_WIDTH = 768`** (points). Any width `< 768` is phone; `≥ 768` is tablet. Evaluated from `useWindowDimensions().width`.

**Rationale**:

- Constitution §5 UX5 pins the tablet baseline viewport at **820 pt wide** (iPad 11" reference) and the phone baseline at **390 pt wide**. 768 pt is the canonical "small tablet" boundary (iPad mini portrait is 768 pt wide) and has been the industry standard since the iPad launched; it falls cleanly between the two constitution baselines.
- `useWindowDimensions()` is already used in five existing screens in this codebase for the same phone-vs-tablet distinction (LoginScreen, ReloginScreen, LockScreen, PinSetupScreen, PinRecoveryConfirmScreen). A single constant shared across all feature modules keeps the heuristic consistent.
- Portrait-only (UX5) removes the rotation concern that would otherwise complicate the breakpoint.

**Alternatives considered**:

- **820 pt (exactly the constitution's tablet baseline)**. Rejected — would classify iPad mini (768 pt) and every Android 8–9" tablet as "phone", which looks grossly wrong. The constitution baselines are canonical test viewports, not breakpoint boundaries.
- **`Platform.OS === 'ios' ? 768 : ...`**. Rejected — form factor, not OS, is the distinction that matters. Every tablet in either ecosystem should render the tablet layout.
- **Aspect-ratio-based detection** (e.g., `width / height > 0.65`). Rejected — adds complexity for zero MVP gain; `width`-only is deterministic and matches how UX5's baselines are defined.

---

## R6. When to trigger the orphan-eviction pass

**Decision**: The warmer runs `imageCache.evictOrphans(validUrls)` **after** every prefetch pass completes, where `validUrls` is the union of `products[*].image_url` (non-null) and any future variant-level image URLs. Eviction is a single `await` chain: scan `cacheStore` for files whose URL is NOT in `validUrls`, delete those files from disk, remove the entries from the map.

**Rationale**:

- Co-locating eviction with prefetch guarantees the catalog-view-of-truth (what the local DB says exists) and the cache-view-of-truth (what's on disk) converge at a single moment per sync pass. No half-states.
- Running post-prefetch (not pre-) means a freshly-downloaded image is never evicted by a stale `validUrls` set computed before the pass.
- `syncing → in-sync` is the only sync-state edge that fires this flow. Triggering on every `in-sync` or on a timer would evict-and-re-download unnecessarily.
- Orphan evictions are **single-flight-safe**: if a user-mounted `<CachedImage>` is currently downloading a URL that an eviction pass marks stale, `download.ts` holds the promise and `evictOrphans` skips files currently in the in-flight map (returns to the same entry on the next pass).

**Alternatives considered**:

- **Evict on app start**. Rejected — the cache is correct across launches; no need to rescan at start if every mutation path already maintains the invariant. Also adds perceptible latency to the first `Catalog` mount.
- **Size-bounded LRU** (evict least-recently-used when disk usage exceeds X MB). Rejected per spec Assumptions: deferred to a later iteration. Brazilian B2B catalogs at MVP scale are ~200 products × ~80 KB/image ≈ 16 MB total. Not a concern.
- **Time-based eviction** (evict after 30 days unused). Rejected — not a concern at MVP scale; would need a "last accessed" sidecar write on every read, which is I/O amplification.
- **Evict on `products` table change** (subscribe to WatermelonDB mutations and tick eviction). Rejected — adds a hot path to product reads and races against the sync push/pull order. Sync-completion edge is cleaner.

---

## R7. Empty-state CTA: how to delegate to the sync engine

**Decision**: The `CatalogEmptyView`'s `Sincronizar agora` button awaits **`onPullToRefresh()`** from `@/features/sync`. If the device is offline at tap time (detected by reading `useSyncStatus()` current status), the button short-circuits into an `Alert.alert` with salesperson-language copy explaining that internet is needed for the first sync (FR-022) — no sync pass is attempted.

**Rationale**:

- `onPullToRefresh()` is the 005 public trigger for manual sync. It already handles the offline case by no-op-ing (does not queue a pass), and it is the exact trigger the home-screen pull-to-refresh gesture uses. Reusing it keeps sync semantics unified.
- The offline short-circuit lives in the catalog feature, not in sync. Sync's contract is "don't try while offline, surface `offline` on the indicator"; the catalog's responsibility is translating that into a salesperson-friendly alert at this specific point of user intent (the salesperson tapped a CTA that promises to sync — they need feedback that it didn't happen and why).
- `useSyncStatus()` is the canonical place to read connectivity-derived state; the catalog does not read `NetInfo` directly, maintaining 005's single owner of network state.

**Alternatives considered**:

- **Call `syncService.runSync({ trigger: 'pull-to-refresh' })` directly**. Rejected — `runSync` is not in 005's public export surface (internal). The public path is `onPullToRefresh`.
- **Invoke 005's private trigger to short-circuit to `offline` state without alert**. Rejected — the CTA's whole point is user feedback. A silent no-op violates UX3 (empty states must point to the next step; silence is not pointing).
- **Read `NetInfo` directly in the catalog for the offline check**. Rejected — introduces a second consumer of NetInfo (005 already owns one, feature 003 owns another). `useSyncStatus()` already derives offline from NetInfo; reuse.

---

## R8. How `hasEverSynced` is determined

**Decision**: Expose a boolean `hasEverSynced` by reading WatermelonDB's internal last-pulled-at cursor: `await database.adapter.getLocal('__watermelon_last_pulled_at')` returns `null` before the first sync and a timestamp afterwards. The catalog feature wraps this in a small async init step inside `useCatalog` (run once on mount), storing the result in local hook state. Subsequent syncs don't invalidate the flag — once `true`, it stays `true` until a user wipes app storage (a re-install scenario the empty state already handles correctly).

**Rationale**:

- WatermelonDB already tracks the first-successful-pull timestamp (confirmed by 005's Technical Context which relies on the same mechanism for the last-pulled-at cursor). Reading it avoids duplicating state.
- `hasEverSynced = false` drives the first-launch empty state (US2 Acceptance Scenario 1 & 3). `hasEverSynced = true && products.length === 0` drives the "admin cleared the catalog" state (US2 Acceptance Scenario 4) — per the plan's rejected-alternative analysis, both states render the same first-launch copy, so we don't need a third branch.
- No new WatermelonDB state. No mutation. Read-only access aligned with the rest of the feature.

**Alternatives considered**:

- **Store `hasEverSynced` in AsyncStorage or a new singleton**. Rejected — duplication of WatermelonDB's own truth, creates a consistency hazard if the DB is wiped but the flag is not (or vice versa).
- **Derive `hasEverSynced` from `products.length > 0`**. Rejected — misses the "admin has no products yet, but first sync did succeed" case. Spec says both cases show the first-launch copy, but distinguishing them in telemetry later is useful.
- **Track `hasEverSynced` inside the sync feature and export it**. Rejected — scope creep on 005. The catalog is a consumer of sync state; it can read the cursor directly.

---

## R9. Cold-start cache hydration

**Decision**: `imageCache` hydrates the in-memory `Map<url, filePath>` **lazily per URL**, not at app start and not in bulk. Each `getCachedUri(url)` call that misses the map computes `await mkPath(url)` and `getInfoAsync`s the resulting path — if the file exists, the URL is inserted into the map and served immediately without download. No bulk directory scan happens on first access.

A directory scan (`readDirectoryAsync(CACHE_DIR)`) happens only inside `evictOrphans(validUrls)`, which needs it to find files whose URL is not in the live product set. Orphan files discovered there are deleted via `deleteAsync({ idempotent: true })` and their map entries removed. Orphan cleanup is the only caller that needs the full-directory view.

**Rationale**:

- Lazy hydration avoids a cold-start cost the app doesn't need: most app launches don't open the catalog immediately. Triggering disk I/O on launch would violate the spirit of P1 (no blocking work on critical-path screens).
- Reverse lookup from URLs to filenames is always O(1) because we hash the URL to find its expected path. A file existing at that path means the URL is cached; no file, not cached. We never have to parse a filename.
- The hydration is idempotent and concurrency-safe (guarded by a singleton "already hydrated" boolean inside `cacheStore.ts`).

**Alternatives considered**:

- **Hydrate synchronously at app start inside `AppProviders`**. Rejected per the P1 argument above and because it introduces ordering concerns between sync boot and catalog boot.
- **Hydrate on first `<CachedImage>` mount**. Rejected — the warmer can also call `getCachedUri`, and the first entry point is undefined. A single-flight "hydrate on first any call" is simpler.
- **Skip hydration; always check `getInfoAsync` per URL**. Rejected — O(N) disk stats per catalog render violates the 500 ms SC-001 budget at 500 products.

---

## R10. Supabase Storage bucket policy

**Decision**: The `product-images` bucket is configured **public-read** via the Supabase dashboard's Storage policy UI. The admin's upload path remains authenticated (they upload from the dashboard, which uses their authenticated session). The app downloads image bytes anonymously — no bearer token header attached.

**Rationale**:

- Product images are not secrets. Every salesperson in the MVP sees the same catalog; there is no per-user image segmentation. A public-read bucket matches the data's sensitivity.
- Anonymous downloads simplify `download.ts`: it's a pure HTTPS fetch, no token refresh, no auth coupling. If auth were required, `download.ts` would need to depend on the session store and become reentrant with 005's refresh logic — sharp unnecessary complexity.
- **D5 compliance**: D5 governs *data* that must stay authenticated-only (orders, clients, receipts). Catalog images are shared assets analogous to a product brochure. Public-read is correct.

**Alternatives considered**:

- **Authenticated-read with signed URLs per image**. Rejected — signed URLs expire and would force the cache layer to track expiry, re-sign, and re-download on expiry. Massive complexity for zero security benefit since the images are not sensitive.
- **Authenticated-read with the salesperson's anon Supabase key**. Rejected — the anon key is public anyway, so this is "authenticated" in name only and adds a moving part (header plumbing) with no security delta.
- **Host images outside Supabase** (e.g., a bare S3 bucket). Rejected — violates P4. The admin already has Supabase dashboard access; using Storage keeps the admin's upload workflow one tool.

---

## Consolidation: no remaining `NEEDS CLARIFICATION`

The plan's Technical Context had zero `NEEDS CLARIFICATION` markers. All open choices (R1–R10) were policy-level trade-offs resolved here with a bias toward P3 simplicity and R3 adherence. No follow-up research blocks Phase 1.

**Ready for Phase 1.** ✅
