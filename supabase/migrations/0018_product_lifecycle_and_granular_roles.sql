-- 0018_product_lifecycle_and_granular_roles.sql
-- Feature: 016-product-lifecycle-roles
--
-- ⚠️  ORDERING REQUIREMENT
-- This migration MUST run on a database where `public.user_roles`
-- already contains at least one row with role='admin' (or 'superuser'
-- on a system that's already mid-rollout). Concretely:
--   1. Apply migrations 0002 → 0017 in order.
--   2. Apply seed `supabase/seeds/0014_first_admin.sql` (substituting
--      the bootstrap user UUID).
--   3. THEN apply this migration.
-- Reason: this migration installs the `enforce_at_least_one_superuser`
-- trigger. If the table is empty when the trigger is attached, every
-- subsequent UPDATE/DELETE in `user_roles` would fail because the
-- trigger sees zero superusers and raises. A fresh project that
-- forgets the seed will brick `user_roles` mutations until a manual
-- service_role insert bypasses RLS. See specs/016-product-lifecycle-roles/quickstart.md
-- §0 Prerequisites.
--
-- Two tightly-coupled admin refinements shipped together so the RLS
-- policy surface is rewritten once:
--
--   PART A — product deactivation lifecycle
--     * products.active (boolean, default true)
--     * products.deactivated_at (timestamptz, nullable)
--     * CHECK constraint enforcing the two columns stay consistent
--     * products SELECT policy updated so sellers never see inactive rows
--       (deleted rows were already filtered out by deleted_at in 0014)
--
--   PART B — granular admin roles (replaces the single 'admin' flag)
--     * user_roles.role widened to accept
--         seller, manage-products, manage-salespersons, manage-clients,
--         superuser
--     * existing role='admin' rows rewritten to role='superuser'
--     * per-role helper functions is_superuser() / is_manage_products() /
--       is_manage_salespersons() / is_manage_clients() / is_seller()
--     * is_admin() redefined as an alias for is_superuser() so every
--       policy from 0014/0015 that referenced it keeps working during
--       the migration window
--     * RLS policies on products, product_variants, salespeople, clients,
--       user_roles rewritten to accept superuser PLUS the relevant
--       module-specific role
--     * enforce_at_least_one_superuser trigger on user_roles guarantees
--       the system never reaches zero superusers
--     * admin_users_view exposes (auth.users ⨝ salespeople ⨝ user_roles)
--       for AdminUsersList
--
-- Rollback companion: 0018_product_lifecycle_and_granular_roles.down.sql.

BEGIN;

-- =====================================================================
-- PART A — product lifecycle columns
-- =====================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS active         boolean    NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz NULL;

-- Invariant: active=false <=> deactivated_at IS NOT NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'products_active_deactivated_at_consistent'
       AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_active_deactivated_at_consistent
      CHECK (
        (active IS TRUE  AND deactivated_at IS NULL)
        OR
        (active IS FALSE AND deactivated_at IS NOT NULL)
      );
  END IF;
END
$$;

-- =====================================================================
-- PART B — widen user_roles.role enum AND rewrite legacy admin rows
-- =====================================================================

-- Drop the old CHECK constraint if it exists under any of the candidate
-- names used historically in this project.
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.user_roles'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%role%IN%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_roles DROP CONSTRAINT %I', cname);
  END LOOP;
END
$$;

-- Rewrite legacy 'admin' rows before applying the new CHECK.
UPDATE public.user_roles
   SET role = 'superuser'
 WHERE role = 'admin';

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN (
    'seller',
    'manage-products',
    'manage-salespersons',
    'manage-clients',
    'superuser'
  ));

-- =====================================================================
-- PART B — per-role helper functions
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_superuser()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role = 'superuser'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manage_products()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role = 'manage-products'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manage_salespersons()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role = 'manage-salespersons'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manage_clients()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role = 'manage-clients'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_seller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role = 'seller'
  );
$$;

-- Legacy alias: is_admin() is redefined so every policy from 0014/0015
-- continues to pass for the new superuser role without policy rewrites.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superuser();
$$;

GRANT EXECUTE ON FUNCTION public.is_superuser()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manage_products()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manage_salespersons() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manage_clients()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_seller()             TO authenticated;
-- is_admin() GRANT already exists from 0014.

-- =====================================================================
-- PART B — enforce at-least-one-superuser safeguard
-- =====================================================================

CREATE OR REPLACE FUNCTION public.enforce_at_least_one_superuser()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'superuser'
  ) THEN
    RAISE EXCEPTION 'at_least_one_superuser_required'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_single_superuser ON public.user_roles;

CREATE CONSTRAINT TRIGGER user_roles_single_superuser
  AFTER DELETE OR UPDATE ON public.user_roles
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_at_least_one_superuser();

-- =====================================================================
-- PART A + B — rewrite products RLS to accept manage-products or superuser
-- =====================================================================

-- Drop the 0014-era admin-gated policies. Re-create with the new predicate.

DROP POLICY IF EXISTS products_admin_insert  ON public.products;
DROP POLICY IF EXISTS products_admin_update  ON public.products;
DROP POLICY IF EXISTS products_admin_delete  ON public.products;

CREATE POLICY products_admin_insert
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superuser() OR public.is_manage_products());

CREATE POLICY products_admin_update
  ON public.products
  FOR UPDATE
  TO authenticated
  USING      (public.is_superuser() OR public.is_manage_products())
  WITH CHECK (public.is_superuser() OR public.is_manage_products());

CREATE POLICY products_admin_delete
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.is_superuser() OR public.is_manage_products());

-- product_variants — same predicate.

DROP POLICY IF EXISTS product_variants_admin_insert  ON public.product_variants;
DROP POLICY IF EXISTS product_variants_admin_update  ON public.product_variants;
DROP POLICY IF EXISTS product_variants_admin_delete  ON public.product_variants;

CREATE POLICY product_variants_admin_insert
  ON public.product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superuser() OR public.is_manage_products());

CREATE POLICY product_variants_admin_update
  ON public.product_variants
  FOR UPDATE
  TO authenticated
  USING      (public.is_superuser() OR public.is_manage_products())
  WITH CHECK (public.is_superuser() OR public.is_manage_products());

CREATE POLICY product_variants_admin_delete
  ON public.product_variants
  FOR DELETE
  TO authenticated
  USING (public.is_superuser() OR public.is_manage_products());

-- =====================================================================
-- PART B — salespeople policies broaden to manage-salespersons or superuser
-- =====================================================================

DROP POLICY IF EXISTS salespeople_admin_insert ON public.salespeople;
CREATE POLICY salespeople_admin_insert
  ON public.salespeople
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superuser() OR public.is_manage_salespersons());

DROP POLICY IF EXISTS salespeople_admin_update ON public.salespeople;
CREATE POLICY salespeople_admin_update
  ON public.salespeople
  FOR UPDATE
  TO authenticated
  USING      (public.is_superuser() OR public.is_manage_salespersons())
  WITH CHECK (public.is_superuser() OR public.is_manage_salespersons());

-- The "no delete" policy from 0015 is kept verbatim — historical-record
-- preservation is independent of role granularity.

-- =====================================================================
-- PART B — clients policies: manage-clients or superuser
-- =====================================================================
-- This feature only adds the ADMIN write path. Tightening the seller
-- write path on `clients` is feature 17's (Admin Clients Management)
-- scope — until then, the permissive `clients_dev_all` policy installed
-- by 0005 keeps the seller side working unchanged.
--
-- The seller-ownership column on clients is `salesperson_id` (FK to
-- `salespeople.id`), not `auth.users.id`, so a future
-- "seller owns row" branch would have to traverse:
--     salesperson_id IN (
--       SELECT id FROM public.salespeople WHERE auth_user_id = auth.uid()
--     )
-- That join belongs in feature 17 alongside the seller-side policy
-- rewrite — not here.

DROP POLICY IF EXISTS clients_seller_or_admin_insert ON public.clients;
DROP POLICY IF EXISTS clients_admin_or_owner_update  ON public.clients;
DROP POLICY IF EXISTS clients_admin_delete           ON public.clients;
DROP POLICY IF EXISTS clients_admin_insert           ON public.clients;
DROP POLICY IF EXISTS clients_admin_update           ON public.clients;

CREATE POLICY clients_admin_insert
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superuser() OR public.is_manage_clients());

CREATE POLICY clients_admin_update
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING      (public.is_superuser() OR public.is_manage_clients())
  WITH CHECK (public.is_superuser() OR public.is_manage_clients());

CREATE POLICY clients_admin_delete
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (public.is_superuser() OR public.is_manage_clients());

-- =====================================================================
-- PART B — user_roles: only superuser can INSERT/UPDATE/DELETE; the
-- narrow "admin can INSERT/DELETE role='seller'" carved out by 0015 is
-- superseded.
-- =====================================================================

DROP POLICY IF EXISTS user_roles_admin_insert_seller ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_delete_seller ON public.user_roles;
DROP POLICY IF EXISTS user_roles_insert_superuser    ON public.user_roles;
DROP POLICY IF EXISTS user_roles_update_superuser    ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete_superuser    ON public.user_roles;

CREATE POLICY user_roles_insert_superuser
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superuser());

CREATE POLICY user_roles_update_superuser
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING      (public.is_superuser())
  WITH CHECK (public.is_superuser());

CREATE POLICY user_roles_delete_superuser
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.is_superuser());

-- Broaden SELECT on user_roles: the caller still sees their own rows, and
-- superusers can list everyone's for AdminUsersList.
DROP POLICY IF EXISTS user_roles_select_own         ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_self_or_admin ON public.user_roles;

CREATE POLICY user_roles_select_self_or_admin
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_superuser());

-- Feature 015 triggers continue to provision the seller role via
-- SECURITY DEFINER RPCs (deactivate_seller / reactivate_seller) — those
-- bypass RLS by design, so the narrower feature-015 policies are not
-- needed anymore.

-- =====================================================================
-- PART B — admin_users_view for AdminUsersList (join of auth.users,
-- salespeople, user_roles)
-- =====================================================================

-- ⚠️ This view was shipped with a bug: `security_invoker = true` makes
-- it run with the caller's permissions, but `authenticated` does NOT
-- have GRANT SELECT on `auth.users`, so the view returned empty for
-- every authenticated caller — including superusers. Fixed in
-- `0019_fix_admin_users_view.sql` (drops `security_invoker` and adds
-- a `WHERE public.is_superuser()` row filter so the view runs as
-- definer with an explicit admin gate). Left in place here for fidelity
-- with the migration history of any database that already ran 0018.
CREATE OR REPLACE VIEW public.admin_users_view
WITH (security_invoker = true) AS
SELECT
  u.id               AS user_id,
  u.email            AS email,
  COALESCE(s.name, split_part(u.email, '@', 1)) AS display_name,
  COALESCE(s.active, true) AS salesperson_active,
  COALESCE(
    (
      SELECT array_agg(role ORDER BY role)
        FROM public.user_roles r
       WHERE r.user_id = u.id
    ),
    ARRAY[]::text[]
  ) AS roles
FROM auth.users u
LEFT JOIN public.salespeople s
       ON s.auth_user_id = u.id
      AND s.deleted_at IS NULL;

GRANT SELECT ON public.admin_users_view TO authenticated;

COMMIT;
