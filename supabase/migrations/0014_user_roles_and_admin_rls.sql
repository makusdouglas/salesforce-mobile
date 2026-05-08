-- 0014_user_roles_and_admin_rls.sql
-- Feature: 014-admin-products-crud
--
-- Introduces:
--   1. public.user_roles — the first role foundation (D7). Each user may
--      carry multiple rows (dual-role support per UX6).
--   2. public.is_admin() — a SECURITY DEFINER helper used by every
--      admin-gated RLS policy.
--   3. products.barcode + a partial unique index scoped to live rows so
--      soft-deleted barcodes can be reused.
--   4. products.base_price, with a backfill from the minimum live variant
--      price so existing catalogues do not regress to R$ 0,00.
--   5. RLS policies on products and product_variants that preserve the
--      seller read path (feature 5 sync relies on it) and restrict all
--      writes to admins.
--
-- The first-admin seed lives at supabase/seeds/0014_first_admin.sql.
-- Applying it manually is part of the quickstart.

BEGIN;

-- 1. user_roles ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin', 'seller')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policy: clients cannot mutate roles.
-- Role writes happen via migrations / seeds / dashboard (service_role).

-- 2. is_admin() helper --------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = auth.uid()
       AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3. products columns + index ------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode    text,
  ADD COLUMN IF NOT EXISTS base_price numeric(12, 2) NOT NULL DEFAULT 0;

-- Backfill base_price with the minimum live variant price so existing
-- catalogues keep meaningful values right after the migration.
UPDATE public.products AS p
   SET base_price = sub.min_price
  FROM (
        SELECT product_id,
               MIN(price) AS min_price
          FROM public.product_variants
         WHERE deleted_at IS NULL
         GROUP BY product_id
       ) AS sub
 WHERE p.id = sub.product_id
   AND p.deleted_at IS NULL
   AND p.base_price = 0;

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_live_idx
  ON public.products (barcode)
  WHERE deleted_at IS NULL AND barcode IS NOT NULL;

-- 4. RLS on products ----------------------------------------------------

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_select_authed ON public.products;
DROP POLICY IF EXISTS products_admin_insert  ON public.products;
DROP POLICY IF EXISTS products_admin_update  ON public.products;
DROP POLICY IF EXISTS products_admin_delete  ON public.products;

CREATE POLICY products_select_authed
  ON public.products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY products_admin_insert
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY products_admin_update
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY products_admin_delete
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 5. RLS on product_variants -------------------------------------------

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_variants_select_authed ON public.product_variants;
DROP POLICY IF EXISTS product_variants_admin_insert  ON public.product_variants;
DROP POLICY IF EXISTS product_variants_admin_update  ON public.product_variants;
DROP POLICY IF EXISTS product_variants_admin_delete  ON public.product_variants;

CREATE POLICY product_variants_select_authed
  ON public.product_variants
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY product_variants_admin_insert
  ON public.product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY product_variants_admin_update
  ON public.product_variants
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY product_variants_admin_delete
  ON public.product_variants
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 6. Storage bucket policy ---------------------------------------------
-- The product-images bucket itself is created via the Supabase dashboard
-- or `supabase storage create product-images --public` (see quickstart).
-- The admin-write policy is declared here so every environment carries
-- the same rule.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS storage_product_images_admin_write ON storage.objects';
    EXECUTE $pol$
      CREATE POLICY storage_product_images_admin_write
        ON storage.objects
        FOR ALL
        TO authenticated
        USING (bucket_id = 'product-images' AND public.is_admin())
        WITH CHECK (bucket_id = 'product-images' AND public.is_admin())
    $pol$;
  END IF;
END
$$;

COMMIT;
