# Contract: Image Cache (`src/features/catalog/image-cache/`)

**Feature**: 006-product-catalog
**Module**: `imageCache` singleton
**Backing dependency**: `expo-file-system` (legacy API), `expo-crypto` (for SHA-256)

This contract fixes the exact public shape of the cache module and the invariants the rest of the feature relies on. Changing any of these invariants requires a plan-level revision.

---

## Directory layout

```
FileSystem.documentDirectory
└── product-images/
    ├── a7c42b83f19d5eea.jpg
    ├── 3f9e4a1c7b8e0d42.png
    ├── ...
```

- **Base directory**: `FileSystem.documentDirectory + 'product-images/'` — trailing slash intentional.
- **File name format**: `<sha256-16>.<ext>` where `<sha256-16>` is the first 16 hex chars of the SHA-256 of the URL (lowercased), and `<ext>` is the URL path's last extension lowercased (or omitted if absent). Examples:
  - `https://xyz.supabase.co/storage/v1/object/public/product-images/cola-2l.jpg?v=3` → `a7c42b83f19d5eea.jpg`
  - `https://xyz.supabase.co/...bare-url-no-extension` → `3f9e4a1c7b8e0d42`
- **Directory is created on demand** at first `getCachedUri` call via `FileSystem.makeDirectoryAsync(dir, { intermediates: true })`. Idempotent.
- **Directory MUST NOT contain subdirectories**. Flat layout; easier to enumerate.

---

## Public API

```typescript
// src/features/catalog/image-cache/imageCache.ts
export const imageCache = {
  getCachedUri(url: string): Promise<string>;
  prefetch(urls: ReadonlyArray<string>): Promise<void>;
  evictOrphans(validUrls: ReadonlyArray<string>): Promise<number>;
  _reset(): Promise<void>;  // test-only; nukes the cache
};
```

### `getCachedUri(url: string): Promise<string>`

Returns a `file://` URI suitable for `<Image source={{ uri }} />`.

**Behavior**:

1. Lazy-hydrate the module-level `Map<url, filePath>` on first call (research R9).
2. If the URL is in the map AND `FileSystem.getInfoAsync(filePath).exists === true`, resolve immediately with `file://` + filePath.
3. If the URL is in the single-flight map (in-flight download), await that promise and resolve with its result.
4. Otherwise, register a new single-flight entry and call `download.downloadOnce(url, dest)`. On success, insert into `Map`, resolve. On failure, remove the single-flight entry, reject with `CacheError('DOWNLOAD_FAILED', url)`.

**Concurrency**:

- N simultaneous callers with the same URL share one download.
- N simultaneous callers with distinct URLs all run in parallel (no semaphore).
- Single-flight state is cleaned up when the underlying promise settles (success or failure).

**Error cases**:

- Network failure (4xx / 5xx / DNS / timeout): rejected. The hook surfaces `status: 'missing'`. No retry inside this call.
- Filesystem write error (disk full, permission): rejected. Same surface. Extremely rare; console-warned in `__DEV__`.

**Rejection does not poison the cache**: a subsequent call for the same URL re-attempts (after a 5-second cooldown, see "Failed-URL cooldown" below).

### `prefetch(urls: ReadonlyArray<string>): Promise<void>`

Triggers `getCachedUri` for each URL in parallel with a concurrency cap of **4** (one network-bound worker per typical device CPU). Resolves when all per-URL promises settle (resolve or reject — prefetch never rejects the whole call).

**Behavior**:

- Deduplicates URLs before dispatch.
- URLs already cached (in the map + on disk) short-circuit instantly — no `getInfoAsync` per URL.
- Partial failure: per-URL rejections are isolated. A 404 on one product does not affect others.
- Respects a single, module-level `AbortController` — if the warmer calls `prefetch()` and then the sync transitions back to `syncing` mid-way, the warmer will call `_abortPrefetch()` and the in-flight downloads are cancelled; already-completed ones are kept.

**Concurrency cap rationale**: Expo's underlying `downloadAsync` opens one HTTP connection per call. Four parallel connections saturates typical 3G / LTE without starving other app traffic (sync, RN bridge). Higher caps showed no speed improvement in the research benchmark.

### `evictOrphans(validUrls: ReadonlyArray<string>): Promise<number>`

Removes files (and their map entries) whose URL is NOT in `validUrls`. Returns the number of files removed.

**Behavior**:

1. Compute `toRemove = [...map.keys()].filter((u) => !validUrls.includes(u))`.
2. For each URL in `toRemove`:
   - If the URL is currently in the single-flight download map, skip it (will be revisited on the next eviction pass).
   - Otherwise: `FileSystem.deleteAsync(filePath, { idempotent: true })`, delete the map entry.
3. Return the removed count.

**Safety**: `idempotent: true` means already-deleted files do not throw. The operation is fully recoverable from partial failure — the next pass will pick up whatever was left.

### `_reset(): Promise<void>`

**Test-only**. Deletes the entire cache directory and clears the in-memory map. Jest test setup / `afterEach` calls this to reset state between tests.

---

## Single-flight contract (`download.ts`)

```typescript
// Private to the image-cache module.
export async function downloadOnce(
  url: string,
  dest: string,
  signal?: AbortSignal,
): Promise<void>;
```

- **Exactly one** download per URL at any time, regardless of caller count.
- Implemented as a module-level `Map<url, Promise<void>>`. Entry added on first call, removed when the promise settles.
- The underlying `FileSystem.downloadAsync` receives the URL, destination path, and `{ md5: false, cache: true }` options. Supabase Storage serves `Cache-Control: public, max-age=3600` headers; we respect them via the native HTTP cache (so a failed download that is later retried within the CDN TTL comes from the OS cache, not the origin).
- Cancellation via `AbortController`: if `signal.aborted` before the download starts, reject immediately with `AbortError`; if aborted mid-flight, `FileSystem.downloadAsync`'s pending promise is cancelled via its native bridge (no temp file left behind; Expo handles cleanup).

### Failed-URL cooldown

A URL whose download failed is recorded in `failedUrlsAt: Map<string, number>` with the timestamp of the failure. Subsequent `getCachedUri` calls within **5 seconds** of the failure short-circuit to a rejection without hitting the network. After 5 seconds, the entry is pruned on next access and the URL is retried.

**Rationale**: prevents a mounted `<FlatList>` with N cards all rendering at once from triggering N failed downloads per second if the image server is down. 5 seconds is short enough that a user-visible retry is imperceptible and long enough to slot between successive list renders.

---

## Invariants

1. **No orphan map entries**: every `(url, filePath)` pair in the map MUST have `filePath` existing on disk at the time the entry was inserted.
2. **No orphan files during normal operation**: files that don't correspond to a `validUrl` are evicted at the next `evictOrphans` pass (typically within 1–60 s of the admin deleting a product).
3. **No concurrent downloads per URL**: enforced by the single-flight map.
4. **No throw surfaces to React**: all errors are promise rejections; `<CachedImage>` translates rejection to placeholder.
5. **Cache survives app restart**: files are on `documentDirectory`, not `cacheDirectory`. The OS cannot evict them.
6. **Cache survives sync failures**: if a sync pass fails mid-pull, `evictOrphans` is not called (warmer is gated on `syncing → in-sync`, not `* → in-sync`). Cached images remain available for the user to see offline.

---

## Test coverage (from `tests/imageCache.test.ts`)

1. **Single-flight**: two concurrent `getCachedUri(X)` calls → one `FileSystem.downloadAsync` invocation, both callers receive the same URI.
2. **Prefetch no-op on hot entries**: calling `prefetch([X])` after a successful `getCachedUri(X)` does not re-invoke `downloadAsync`.
3. **Orphan eviction**: `getCachedUri(X)` → `evictOrphans(['Y'])` → `X`'s file is deleted, map entry removed, `getCachedUri(X)` after re-downloads.
4. **Eviction skips in-flight**: start `getCachedUri(X)` (keep promise unresolved via a mocked download), call `evictOrphans(['Y'])` → `X`'s file is NOT deleted; after the download settles, `X` is in map; next `evictOrphans(['Y'])` evicts `X`.
5. **Failed-URL cooldown**: two `getCachedUri(X)` calls within 5 s of a failure → second call rejects without invoking `downloadAsync`.
6. **Failed-URL retry after cooldown**: third `getCachedUri(X)` call 6 s after failure → new `downloadAsync` invocation.
7. **Rebuild from disk**: after `_reset()` creates a file outside the map, the next `getCachedUri(X)` hydrates the map from disk and does not re-download.

---

## Non-functional properties

| Property | Target | How |
|----------|--------|-----|
| Time to serve a hot-cache URI | < 10 ms | Map lookup + `getInfoAsync` (async but OS-cached); `<Image>` render not counted. |
| Time to serve a cold-cache URI | < 2 s on 10 Mbps | `downloadAsync` of a ~100 KB thumbnail; parallel-4 cap means a 500-image prefetch completes in ~50 s. Not on the critical path of any UI interaction. |
| Memory footprint | O(N) where N = cached URLs (~200 strings + ~200 file paths ~= ~30 KB) | |
| Disk footprint | ~20 MB at MVP scale (200 products × ~100 KB avg) | Well within per-app storage budgets on iOS/Android. |
| Cold-start hydration | < 50 ms on 200 files | `readDirectoryAsync` + hashing 200 URLs at call time. |
