-- 0018_product_lifecycle_and_granular_roles.down.sql
-- Companion rollback for 0018. Reverses Part B (role enum, policies,
-- trigger, helpers, view) to the 0015-era state. Part A columns on
-- products are kept in place as harmless no-ops to avoid data loss.

BEGIN;

-- Drop the view.
DROP VIEW IF EXISTS public.admin_users_view;

-- Drop the single-superuser trigger + its function.
DROP TRIGGER  IF EXISTS user_roles_single_superuser        ON public.user_roles;
DROP FUNCTION IF EXISTS public.enforce_at_least_one_superuser();

-- Revert user_roles policies to the 0015 state (admin can INSERT/DELETE
-- role='seller' only; SELECT self; no update policy).
DROP POLICY IF EXISTS user_roles_insert_superuser      ON public.user_roles;
DROP POLICY IF EXISTS user_roles_update_superuser      ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete_superuser      ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_self_or_admin  ON public.user_roles;

CREATE POLICY user_roles_select_own
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_roles_admin_insert_seller
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND role = 'seller');

CREATE POLICY user_roles_admin_delete_seller
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.is_admin() AND role = 'seller');

-- Revert products / product_variants / salespeople / clients policies to
-- the 0014/0015 is_admin() predicate.
DROP POLICY IF EXISTS products_admin_insert  ON public.products;
DROP POLICY IF EXISTS products_admin_update  ON public.products;
DROP POLICY IF EXISTS products_admin_delete  ON public.products;

CREATE POLICY products_admin_insert
  ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY products_admin_update
  ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY products_admin_delete
  ON public.products
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS product_variants_admin_insert  ON public.product_variants;
DROP POLICY IF EXISTS product_variants_admin_update  ON public.product_variants;
DROP POLICY IF EXISTS product_variants_admin_delete  ON public.product_variants;

CREATE POLICY product_variants_admin_insert
  ON public.product_variants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY product_variants_admin_update
  ON public.product_variants
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY product_variants_admin_delete
  ON public.product_variants
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS salespeople_admin_insert ON public.salespeople;
CREATE POLICY salespeople_admin_insert
  ON public.salespeople
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS salespeople_admin_update ON public.salespeople;
CREATE POLICY salespeople_admin_update
  ON public.salespeople
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS clients_admin_insert ON public.clients;
DROP POLICY IF EXISTS clients_admin_update ON public.clients;
DROP POLICY IF EXISTS clients_admin_delete ON public.clients;
-- Feature 5's `clients_dev_all` permissive policy is untouched by the
-- forward migration, so no restore is needed here.

-- Per-role helpers: drop.
DROP FUNCTION IF EXISTS public.is_superuser();
DROP FUNCTION IF EXISTS public.is_manage_products();
DROP FUNCTION IF EXISTS public.is_manage_salespersons();
DROP FUNCTION IF EXISTS public.is_manage_clients();
DROP FUNCTION IF EXISTS public.is_seller();

-- Rewrite 'superuser' rows back to 'admin' before shrinking the CHECK.
UPDATE public.user_roles
   SET role = 'admin'
 WHERE role = 'superuser';

-- Tighten CHECK back to the 0014 enum.
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'seller'));

-- Restore is_admin() to the 0014 body (direct lookup against role='admin').
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Part A columns on products are INTENTIONALLY kept — dropping them
-- would lose admin-chosen deactivation state. Re-applying 0018 is a
-- no-op for columns.

COMMIT;
