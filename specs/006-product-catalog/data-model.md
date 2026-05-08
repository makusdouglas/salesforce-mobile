# Data Model: Product Catalog

**Feature**: 006-product-catalog
**Date**: 2026-04-21

This feature reads from existing entities (002) and introduces **one column** on an existing entity plus **one non-persistent derived shape** for presentation. No new WatermelonDB tables. No new Supabase tables. Constitution R2's seven-entity ceiling is unchanged.

---

## 1. Existing entity: `Product` (from 002) — **one column added**

Declared in [src/data/schema/tables.ts](../../src/data/schema/tables.ts) and modeled in [src/data/models/Product.ts](../../src/data/models/Product.ts). All existing columns stay. Added by this feature:

| Column | Type | Nullable | Indexed | Purpose |
|--------|------|----------|---------|---------|
| `category` | string | yes | yes | Admin-assigned category used as the primary tap filter (UX1, FR-014). Null for products the admin has not categorized yet. |

**Model field** on `Product.ts`:

```typescript
@field('category') category!: string | null;
```

**Schema bump**: WatermelonDB schema `version: 1 → 2`. Migration appended to [src/data/schema/migrations.ts](../../src/data/schema/migrations.ts) using `addColumns` to `products` (Watermelon's standard migration step).

**Supabase-side mirror**: `products.category text NULL`. Applied by the admin via dashboard SQL, specified in [contracts/supabase-schema.md](./contracts/supabase-schema.md). Sync (005) picks it up automatically — the pull adapter reads `SELECT * FROM products WHERE updated_at > lastPulledAt` and the mapper in `src/features/sync/supabase/mappers.ts` passes unknown columns through unchanged.

**Validation rules** (enforced at UI / filter layer, not at DB level):

- `category` is treated as an opaque case-insensitive string at render time (the filter-chip row performs a deduplicated, sorted-by-frequency scan at render time to build its chip set — see `contracts/search-filter.md`). Trimming whitespace on read is the caller's responsibility.
- An empty string `""` is normalized to `null` at the filter layer (prevents a "(empty)" chip if the admin saves whitespace).

**State transitions**: none. Category is a plain attribute; it has no lifecycle.

---

## 2. Existing entity: `ProductVariant` (from 002) — **unchanged**

Declared in [src/data/schema/tables.ts](../../src/data/schema/tables.ts) with columns `product_id`, `label`, `price`, `barcode`, plus the sync-readiness columns. Modeled in [src/data/models/ProductVariant.ts](../../src/data/models/ProductVariant.ts).

The catalog feature reads variants via `productVariantsRepository.observeByProduct(productId)` (already exported from 002) for the `ProductDetailScreen`, and via `product.variants` (WatermelonDB `@children` association) for the "variant count" hint on catalog cards.

No column added. No column changed.

**Observed edge cases**:

- A variant with `price === null` is rendered with the "preço indisponível" label (FR-010). `null` is not treated as zero, is not sorted to the top or bottom — its presentation is purely a non-clickable marker.
- A product with exactly one variant still renders the variant explicitly in `ProductDetailScreen` (FR-009). This is a view-layer invariant; no DB shape change.

---

## 3. Derived shape: `ProductDisplayDTO` (non-persistent)

The catalog's screens and components consume a derived, read-only DTO instead of raw `Product` / `ProductVariant` models. This prevents any accidental mutation path and simplifies snapshot-based tests.

**Defined in** `src/features/catalog/hooks/useCatalog.ts` (plus type export through the feature barrel).

**Shape**:

```typescript
export type ProductDisplayDTO = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly unit: string | null;
  readonly category: string | null;
  readonly basePrice: number | null;    // cheapest variant price, or null if all variants are priceless
  readonly variantCount: number;
  readonly variants: ReadonlyArray<VariantDisplayDTO>;  // lazy — populated only when detail view requests it
};

export type VariantDisplayDTO = {
  readonly id: string;
  readonly label: string;
  readonly price: number | null;
  readonly barcode: string | null;
  readonly attributes: string | null;    // v1: same as `label`; future hook for structured attribute display
};
```

**Derivation rules**:

- `basePrice` is `min(variants[].price)` over non-null variant prices; `null` if every variant price is null.
- `variantCount` is `variants.length` of the associated variants (non-soft-deleted).
- `variants` is eagerly fetched for the detail screen, lazily empty (`[]`) for the list screen — the list only needs `variantCount`. This is a performance choice matched to SC-001.
- Diacritic-insensitive search operates on `normalize(name)` plus `normalize(variant.label)` for each variant (see `contracts/search-filter.md`).

**Lifecycle**: DTOs are produced freshly on every observation tick (WatermelonDB push). Components that memoize them on `id` avoid re-rendering unrelated cards.

---

## 4. Runtime-only shape: `CacheEntry` (in-memory)

The image cache's backing store is a `Map<string, string>` keyed by URL, valued by absolute filesystem path. Conceptually:

```typescript
type CacheEntry = {
  url: string;           // the map key
  filePath: string;      // FileSystem.documentDirectory + 'product-images/' + hash + ext
};
```

**Not persisted as a separate artifact** — the filesystem itself is the persistent truth. The in-memory `Map` is rebuilt lazily on first access by scanning the cache directory (see research R9). No JSON manifest, no SQLite table, no AsyncStorage key.

**Invariants**:

- Every entry in the map corresponds to a file that exists on disk.
- The reverse — every file on disk corresponds to an entry in the map — is **not** guaranteed mid-session. Orphan files are allowed to exist between the moment a product is removed and the next sync-completion eviction pass. This is intentional; evicting synchronously on every DB change would couple the cache to 005's push/pull lifecycle.

**Lifecycle states** for a given URL (state of the (Map + disk) pair):

```
 ┌────────────┐   getCachedUri(url)     ┌──────────────┐
 │  not-cached│ ───────────────────────▶│  downloading │
 └────────────┘                          └──────────────┘
        ▲                                       │
        │ evictOrphans                          │ (success)
        │                                       ▼
        │                                ┌──────────────┐
        └────────────────────────────────│    cached    │
                                         └──────────────┘
                                                │
                                                │ download failure
                                                ▼
                                         ┌──────────────┐
                                         │   missing    │
                                         └──────────────┘
```

- **not-cached**: no entry in map, no file at expected path. First `getCachedUri(url)` call promotes to `downloading`.
- **downloading**: in-flight download registered in the single-flight map. Calls to `getCachedUri(url)` during this state await the shared promise.
- **cached**: entry in map, file at expected path. `getCachedUri(url)` returns the file URI synchronously.
- **missing**: the download attempt failed (404 / network); the URL is recorded in a short-lived blacklist inside `download.ts` to prevent thundering-herd retries on every render; next successful sync retries.

**Eviction**: `evictOrphans(validUrls)` scans the map, computes the set difference (mapKeys \ validUrls), deletes those files and map entries in a single pass. In-flight downloads are skipped (deferred to the next pass).

---

## 5. Runtime-only shape: `CatalogFilterState`

Local React state inside `useCatalogFilter`, not persisted across sessions.

```typescript
type CatalogFilterState = {
  readonly query: string;                     // raw user input; trimmed before passed to matchers
  readonly activeCategory: string | null;     // null = no filter ("Todos" chip active)
};
```

**Transitions**:

- `setQuery(next)` replaces `query`. Empty string is a valid state (search field empty).
- `setCategory(next)` replaces `activeCategory`. `null` returns to the "Todos" chip.
- `reset()` sets both to the no-filter defaults; used by the `CatalogNoMatchesView` reset control (FR-018).

**Persistence**: none. Reopening the catalog screen resets the filters — behavior expected by the spec (no session-level memory of the last filter).

---

## 6. Sync-readiness columns (inherited from 002 + 005)

No change in this feature. Listed for completeness:

- `server_id` (string, nullable, indexed) — Supabase row ID.
- `updated_at` (number, ms timestamp) — last server write.
- `_status` (string, WatermelonDB-managed) — `created | updated | deleted | synced`.
- `_changed` (string, WatermelonDB-managed) — comma-separated column names pending push.

The catalog feature reads these transparently through the repositories and never writes to them (it has no push path by D2).

---

## Summary

| Artifact | Kind | Persistence | Ownership |
|----------|------|-------------|-----------|
| `products.category` | Column | SQLite (local) + Postgres (server) | 002 schema, bumped by this feature |
| `ProductDisplayDTO` | TypeScript type | In-memory per render | 006 `useCatalog` |
| `VariantDisplayDTO` | TypeScript type | In-memory per render | 006 `useCatalog` |
| `CacheEntry` (conceptual) | In-memory Map entry | Filesystem (truth) + memory (index) | 006 `imageCache` |
| `CatalogFilterState` | React state | In-memory per catalog-screen mount | 006 `useCatalogFilter` |

**Zero new entities**. One new column. One new filesystem directory. One new package (`expo-file-system`). The feature is boundary-respectful by design.
