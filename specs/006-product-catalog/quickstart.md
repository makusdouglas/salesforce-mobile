# Quickstart: Product Catalog

**Feature**: 006-product-catalog
**Audience**: developer implementing / reviewing / demoing the feature on a simulator

This document is a short, runnable sequence: bring up the app, get a catalog populated, verify each user story against the Pencil frames. Anything not in this file is covered by the other plan artifacts.

---

## (a) One-time server-side setup (admin, ~5 minutes)

1. Open `contracts/supabase-schema.md` in this spec and apply both changes:
   - Run the `ALTER TABLE public.products ADD COLUMN category …` SQL.
   - Create or verify the `product-images` Storage bucket (public read) and its four policies.
2. In the Supabase dashboard, **Table Editor → `products`**, insert at least **6 rows** with:
   - A meaningful `name` (e.g., `Refri Cola`, `Salgadinho Queijo`, `Sabonete Hidratante`, `Amaciante 500ml`, `Café Torrado 500g`, `Biscoito Recheado`)
   - A `category` (e.g., `Bebidas`, `Snacks`, `Higiene`, `Limpeza`, `Bebidas`, `Snacks`) — leave at least one row's `category` as NULL to see the filter-chip's graceful behavior.
   - An `image_url` pointing at a file you've uploaded into the `product-images` Storage bucket (upload a JPEG first, copy the public URL, paste it here). Leave one row's `image_url` NULL to see the neutral-placeholder fallback.
3. In the Table Editor → `product_variants`, insert **2–3 variants per product** with `product_id`, `label` (e.g., `Garrafa 2L`, `Lata 350ml`, `Pet 600ml`), `price`, and leave `price` NULL on exactly one variant to see the "preço indisponível" label.

Mark each product's `updated_at` as `now()` on insert (Supabase does this by default if the row has the `updated_at` column — which it does, from 005).

---

## (b) One-time app-side setup (developer, ~3 minutes)

1. Install the new dependency:
   ```bash
   pnpm add expo-file-system
   ```
2. Rebuild the dev client (only required once, since `expo-file-system` is an Expo-hosted library it actually works in Expo Go too; but the project uses a dev client for 004's biometrics, so keep using it):
   ```bash
   pnpm build:dev
   ```
3. Pull the branch, install:
   ```bash
   pnpm install
   ```

The WatermelonDB schema will migrate automatically on first launch via `migrations.ts` (version 1 → 2). No manual action needed on the device.

---

## (c) Happy path walkthrough

### US1 — Browse the catalog (P1)

1. Launch the app.
2. Log in with a salesperson account.
3. Unlock (biometric or PIN).
4. On the home screen, tap **Ver catálogo**.
5. Observe: no blocking spinner; grid renders from local DB.
6. First sync should have happened on login (per 005's `loginTrigger`). If the cache is cold, product thumbnails will fetch and render progressively within ~2 seconds.

**Verify against**: `design/catalog-phone.png` on a phone simulator; `design/catalog-tablet.png` on an iPad simulator.

Acceptance (spec US1):

- (1) List renders immediately from local data.
- (2) With airplane mode after at least one successful sync, thumbnails still render (cached).
- (3) Scrolling is smooth.
- (4/5) Grid uses 3 columns on iPad / 2 columns on phone.

### US2 — First-launch empty state (P1)

1. On a **fresh install** (or `_reset()`-ed simulator), log in.
2. While still on the login → home transition, quickly turn off Wi-Fi (or use the simulator's airplane mode) so the login's opportunistic sync fails.
3. Tap **Ver catálogo**.
4. Observe: empty state with "Seu catálogo está vazio", primary "Sincronizar agora" CTA.
5. Tap "Sincronizar agora" while offline — alert: "Você precisa de internet para carregar o catálogo pela primeira vez." Close it.
6. Turn Wi-Fi back on. Tap "Sincronizar agora" again. The sync indicator transitions `offline → syncing → in-sync`; the empty state replaces itself with the populated grid automatically (no navigation required).

**Verify against**: `design/catalog-empty-phone.png` / `design/catalog-empty-tablet.png`.

Acceptance (spec US2):

- (1) Empty state renders with salesperson language.
- (2) Sync CTA transitions to populated list without manual nav.
- (3) Offline tap shows a salesperson-language alert (not a jargon error).
- (4) Admin deleting all products also shows this state after sync.
- (5) Layout legible on both viewports.

### US3 — Product detail (P2)

1. From the populated catalog, tap any card.
2. Observe: detail screen with hero image, name, description, "A partir de {min price}", and every variant listed.
3. One variant has a null price (from step (a)) — it renders "preço indisponível".
4. A product with one variant still shows the variant section (not collapsed into the header).
5. Go offline. Open a previously-loaded product. The hero image still renders from cache.
6. Open a product whose `image_url` was NULL — the placeholder renders but the rest of the detail screen works normally.

**Verify against**: `design/product-detail-phone.png` / `design/product-detail-tablet.png`.

Acceptance (spec US3 1–5): all covered above.

### US4 — Tap-first search (P2)

1. On the catalog, tap the **Bebidas** chip. List narrows to Bebidas only.
2. Tap **Bebidas** again (or tap **Todos**). Full list returns.
3. Type `cola` in the search field. Live filter; only matching products remain.
4. Type `CAFÉ` (with diacritic). Same match result as `cafe` (diacritic-insensitive).
5. Combine: chip **Bebidas** + query `refri`. Only Bebidas matching "refri" remain.
6. Type `xyz` (no matches). The "no matches" state renders with a reset button. Tap it — both chip and query clear, full list returns.
7. Clear every product's `category` in the Supabase dashboard. Trigger sync. Observe: chip row hides entirely; only search field visible.

**Verify against**: catalog frames (the filter chip row is in `design/catalog-phone.png` / `tablet`).

Acceptance (spec US4 1–6): all covered above.

---

## (d) Cache behavior verification

### Hot cache

1. Open the catalog with Wi-Fi on.
2. Wait for all thumbnails to resolve.
3. Turn off Wi-Fi.
4. Force-close the app.
5. Reopen. Unlock. Open catalog.
6. **All thumbnails render immediately from disk** — SC-002 target.

### Orphan eviction

1. In the dashboard, delete one product.
2. On the device, pull-to-refresh on the home screen.
3. After sync completes (`in-sync`), inspect the app's sandbox:
   - iOS simulator: `xcrun simctl get_app_container booted <bundleId> data` → `Documents/product-images/`.
   - Android emulator: `adb exec-out run-as <packageId> ls /data/data/<packageId>/files/product-images`.
4. The deleted product's image file is **gone**.

### Cold-start hydration

1. Force-close the app (keep catalog populated).
2. Reopen.
3. Open catalog → thumbnails render from the filesystem without a re-download (verify via the Expo / Metro network tab: no HTTP requests from the image domain).

---

## (e) Common pitfalls

- **`expo-file-system/legacy` import not `/next`**: imports must be `from 'expo-file-system'`, not from a sub-path. The `/next` API is unavailable in the pinned SDK version.
- **Portrait-only**: if the simulator is in landscape, the tablet layout still renders correctly but will not match the Pencil frames. Rotate to portrait before screenshotting.
- **Schema migration didn't run**: if the app shows an error like "category column not found", the WatermelonDB migration didn't run — this typically means the local DB is from before the schema bump. In dev, uninstall/reinstall or wipe simulator storage; the migration runs on first open of the new build.
- **`hasEverSynced` flicker**: on first mount of `CatalogScreen`, the first-launch empty state may show for 50–100 ms before `hasEverSynced` resolves. This is acceptable for MVP. If it becomes annoying, the hook can be promoted to read from WatermelonDB synchronously via a memoized one-shot.
- **Chip row empty when it shouldn't be**: if the admin populated categories but chips don't appear, the products haven't synced yet. Check `<SyncStatusIndicator>` in the header.

---

## (f) Test and smoke commands

```bash
# Unit tests
pnpm test -- src/features/catalog/tests/

# Type check
pnpm typecheck

# Lint
pnpm lint

# Dev server
pnpm start
```

The test suite should run in ~5 seconds and include:

- `normalize.test.ts` — diacritic-insensitive search.
- `filter.test.ts` — category + query composition.
- `imageCache.test.ts` — single-flight, prefetch, eviction.
- `useCachedImage.test.ts` — hook state machine.
- `useCatalog.test.ts` — empty-state branches.
- `catalogCacheWarmer.test.ts` — sync-status transition handling.

---

## (g) Demo data seed (optional, for recording)

If you want a consistent demo state across devices, run this in the Supabase SQL editor after applying the schema changes:

```sql
INSERT INTO products (id, name, description, image_url, category, unit, updated_at)
VALUES
  (gen_random_uuid(), 'Refri Cola', 'Refrigerante sabor cola, três formatos.',
   'https://<your-project>.supabase.co/storage/v1/object/public/product-images/refri-cola.jpg',
   'Bebidas', NULL, now()),
  (gen_random_uuid(), 'Salgadinho Queijo', NULL,
   'https://<your-project>.supabase.co/storage/v1/object/public/product-images/salgadinho.jpg',
   'Snacks', NULL, now()),
  (gen_random_uuid(), 'Sabonete Hidratante', NULL,
   'https://<your-project>.supabase.co/storage/v1/object/public/product-images/sabonete.jpg',
   'Higiene', NULL, now()),
  (gen_random_uuid(), 'Amaciante 500ml', NULL,
   'https://<your-project>.supabase.co/storage/v1/object/public/product-images/amaciante.jpg',
   'Limpeza', NULL, now()),
  (gen_random_uuid(), 'Café Torrado 500g', NULL,
   'https://<your-project>.supabase.co/storage/v1/object/public/product-images/cafe.jpg',
   'Bebidas', NULL, now()),
  (gen_random_uuid(), 'Biscoito Recheado', NULL,
   NULL,                    -- no image, to exercise the placeholder
   NULL,                    -- no category, to exercise the chip-row degradation
   NULL, now());
```

Then add variants for each product (at least one with a null price to exercise FR-010).

---

Ready to implement. Run `/speckit-tasks` next.
