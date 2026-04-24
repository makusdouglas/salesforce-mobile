-- 006-product-catalog — server-side prerequisites for the seller catalog.
--
-- Adds:
--   1. products.category — admin-assigned category used as the primary tap
--      filter in the seller app. Null for uncategorized products.
--   2. Storage bucket `product-images` (PUBLIC) with 4 policies.
--
-- Public-read is deliberate: product images are not secrets, and a public
-- bucket lets the app render them via plain <Image src> without bearer
-- tokens or signed-URL refresh. See 006's research R10 for the full
-- justification.
--
-- Depends on: 0002_local_data_layer.sql, 0005_sync_engine.sql.

BEGIN;

-- ============================================================================
-- 1. products.category
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text NULL;

CREATE INDEX IF NOT EXISTS products_category_idx
  ON public.products (category)
  WHERE category IS NOT NULL;

COMMENT ON COLUMN public.products.category IS
  'Admin-assigned category used as the primary tap filter in the salesperson '
  'app. Null for uncategorized products; the app hides the filter chip row '
  'when every product is null.';

-- ============================================================================
-- 2. Storage bucket `product-images` (public)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ============================================================================
-- 3. Storage policies (4)
-- ============================================================================

-- Public read: the salesperson app downloads images without a bearer token.
DROP POLICY IF EXISTS "Public read access to product images" ON storage.objects;
CREATE POLICY "Public read access to product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Authenticated writes: today any authenticated user can upload; 013 will
-- tighten this to the `admin` role specifically.
DROP POLICY IF EXISTS "Admin can write product images" ON storage.objects;
CREATE POLICY "Admin can write product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admin can update product images" ON storage.objects;
CREATE POLICY "Admin can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admin can delete product images" ON storage.objects;
CREATE POLICY "Admin can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');

COMMIT;
