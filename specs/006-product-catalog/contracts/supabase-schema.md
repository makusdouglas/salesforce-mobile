# Contract: Supabase-Side Operational Prerequisites

**Feature**: 006-product-catalog
**Audience**: the admin (operates the Supabase dashboard)
**Applies to**: Supabase project `<TBD — same project as 005>`

This feature introduces **two server-side changes** that the admin must apply via the Supabase dashboard. Neither is an app-level migration; both are operational.

---

## Change 1: Add `category` column to `products`

### SQL

Apply from the dashboard's **SQL Editor** (Project → SQL → New query), not via a local migration tool:

```sql
-- Safe to run multiple times thanks to IF NOT EXISTS.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text NULL;

CREATE INDEX IF NOT EXISTS products_category_idx
  ON public.products (category)
  WHERE category IS NOT NULL;

-- Optional: add a short admin-facing comment so the dashboard UI
-- renders a hint in the Table Editor.
COMMENT ON COLUMN public.products.category
  IS 'Admin-assigned category used as the primary tap filter in the salesperson app. Null for uncategorized products; the app hides the filter chip row when every product is null.';
```

### Why `text`, not a lookup table?

Per the plan's rejected alternatives, normalizing categories into their own table is deferred as a future enhancement. At MVP scale (hundreds of products, a handful of categories), admin-typed consistency is enforceable by the admin themselves; a join table adds operational weight without functional gain.

### Why `NULL` with a partial index?

- **NULL default**: existing rows stay valid; the admin categorizes over time.
- **Partial index on non-null values**: category-matched queries at sync-pull time use the index; null-categorized products skip indexing overhead.
- **No CHECK constraint** on the column value: the admin is free to use any string. The salesperson app dedupes and trims at the filter-chip layer.

### RLS

`products` has RLS already configured by earlier features; no change here. The new column is readable under the existing `SELECT` policy and writable under the existing admin-role `INSERT/UPDATE` policy.

### Verification

After running the ALTER, verify:

```sql
-- Should return one row with data_type = 'text' and is_nullable = 'YES'.
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name  = 'products'
   AND column_name = 'category';

-- Should return one row naming the index.
SELECT indexname FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename  = 'products'
   AND indexname  = 'products_category_idx';
```

---

## Change 2: Configure the `product-images` Storage bucket as public-read

### Dashboard path

**Storage** → **Policies** (or **Buckets** → `product-images` → **Policies** tab).

### Bucket creation (if not already present)

If the bucket doesn't exist:

1. **Storage** → **Create bucket**.
2. Name: `product-images`.
3. Public bucket: **enabled**.
4. File size limit: `5 MB` per upload (prevents runaway uploads; product images in MVP are ~100–300 KB).
5. Allowed MIME types: `image/jpeg, image/png, image/webp`.

### Policies

For the `product-images` bucket:

```sql
-- Allow anonymous public read.
CREATE POLICY "Public read access to product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Allow authenticated admin users to upload/overwrite.
-- (Adjust the role name to match your project's admin role convention.)
CREATE POLICY "Admin can write product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Admin can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "Admin can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');
```

### Why public-read?

See research R10. Product images are not secrets — every salesperson in the MVP sees the same catalog. Public-read simplifies the app's `download.ts` (no auth headers, no token refresh coupling) and matches the data's sensitivity class.

### Admin upload workflow (informational — the app does not touch this)

For each product in the dashboard Table Editor:

1. Open **Storage** → `product-images` bucket → **Upload file**.
2. Upload a JPEG/PNG (the bucket accepts `image/jpeg`, `image/png`, `image/webp`).
3. Copy the file's **public URL** (dashboard: right-click → Copy public URL).
4. Paste that URL into the row's `image_url` column in the `products` table.
5. Save.

The next sync pass on any salesperson's device will pull the new `image_url`; the catalog cache will fetch the bytes on first render (or on prefetch after sync completion, whichever comes first).

---

## Change 3: (No change to `updated_at` / `deleted_at` triggers)

The sync-readiness columns `updated_at` and `deleted_at` on `products` and `product_variants` were added by 005 (see `specs/005-sync-engine/contracts/supabase-schema.md`). This feature adds **only** the `category` column and the Storage bucket policy. No new triggers.

---

## Rollback

### Rolling back `category`

```sql
-- Step 1: clear the column from the app schema (requires shipping a new app version with schema version 3 that drops the column from the WatermelonDB schema).
-- This is not reversible at the Supabase level alone.

-- Step 2 (server): drop the index and column.
DROP INDEX IF EXISTS public.products_category_idx;
ALTER TABLE public.products DROP COLUMN IF EXISTS category;
```

**Rollback requires coordination**: the app's WatermelonDB schema version 2 contains the column, so shipping a version-3 app that removes it is a prerequisite. In practice, the column can be left in place (unused) with zero impact.

### Rolling back the Storage bucket policy

Just `DROP POLICY` on each of the four policies, or toggle the bucket from public to private in the dashboard. The app's `<CachedImage>` would then surface `status: 'missing'` for every previously-cached URL the OS hasn't kept; cached files on disk remain.

---

## Verification checklist

Before the salesperson app's v006 ships, the admin must confirm:

- [ ] `products.category` column exists (SQL above returned one row).
- [ ] `products_category_idx` exists.
- [ ] `product-images` bucket exists and is marked public.
- [ ] The four Storage policies exist and are enabled.
- [ ] At least one product row has a `category` populated (optional, but lets the chip row appear on first sync).
- [ ] At least one product row has an `image_url` pointing into the `product-images` bucket (optional, but lets the cache warmer do something on first sync).

These are manual checks in the dashboard. No automated check in the app because the app is intentionally tolerant of these being absent (empty state, hidden chip row, placeholder images).
