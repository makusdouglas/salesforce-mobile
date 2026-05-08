-- 0015_admin_sellers.sql
-- Feature: 015-admin-sellers
--
-- Introduces:
--   1. salespeople.active boolean column (default true).
--   2. salespeople.auth_user_id FK to auth.users so deactivation can
--      target an auth user directly (nullable for legacy rows from 0002).
--   3. salespeople.name NOT-EMPTY check constraint.
--   4. public.deactivate_seller(p_auth_user_id)  — security-definer RPC
--      that atomically revokes the 'seller' role and flips active=false.
--      Refuses self-deactivation (FR-014).
--   5. public.reactivate_seller(p_auth_user_id)  — mirror of the above
--      without touching credentials.
--   6. RLS policies on public.salespeople and public.user_roles so
--      admins can read+write seller rows and flip role assignments
--      scoped to role='seller' (role='admin' management is deferred
--      to feature 016).

BEGIN;

-- 1. salespeople column additions -------------------------------------

ALTER TABLE public.salespeople
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.salespeople
  ADD COLUMN IF NOT EXISTS auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS salespeople_auth_user_id_live_idx
  ON public.salespeople (auth_user_id)
  WHERE deleted_at IS NULL AND auth_user_id IS NOT NULL;

-- 2. Name non-empty check --------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'salespeople_name_not_empty'
       AND conrelid = 'public.salespeople'::regclass
  ) THEN
    ALTER TABLE public.salespeople
      ADD CONSTRAINT salespeople_name_not_empty
      CHECK (length(btrim(name)) > 0);
  END IF;
END
$$;

-- 3. deactivate_seller / reactivate_seller ----------------------------

CREATE OR REPLACE FUNCTION public.deactivate_seller(p_auth_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'permission_denied'
      USING ERRCODE = '42501';
  END IF;

  IF p_auth_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_deactivate_self'
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.user_roles
   WHERE user_id = p_auth_user_id
     AND role    = 'seller';

  UPDATE public.salespeople
     SET active     = false,
         updated_at = now()
   WHERE auth_user_id = p_auth_user_id;

  -- Ban at the Auth layer so the user cannot sign in or refresh tokens
  -- (FR-012). Far-future ban_until expresses "indefinite" without
  -- requiring NULLability semantics that GoTrue interprets as active.
  UPDATE auth.users
     SET banned_until = 'infinity'::timestamptz
   WHERE id = p_auth_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_seller(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reactivate_seller(p_auth_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'permission_denied'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
       VALUES (p_auth_user_id, 'seller')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.salespeople
     SET active     = true,
         updated_at = now()
   WHERE auth_user_id = p_auth_user_id;

  -- Lift the Auth-layer ban so the user can sign in again.
  UPDATE auth.users
     SET banned_until = NULL
   WHERE id = p_auth_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivate_seller(uuid) TO authenticated;

-- 4. RLS on salespeople -----------------------------------------------
--
-- Seller-side sync (feature 005) already reads salespeople to attribute
-- orders. The existing SELECT policy from 0005 MUST keep working for
-- every authenticated user. We only *add* admin-friendly policies here;
-- we do NOT drop the seller-visible SELECT.

ALTER TABLE public.salespeople ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salespeople_admin_insert ON public.salespeople;
CREATE POLICY salespeople_admin_insert
  ON public.salespeople
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS salespeople_admin_update ON public.salespeople;
CREATE POLICY salespeople_admin_update
  ON public.salespeople
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS salespeople_no_delete ON public.salespeople;
CREATE POLICY salespeople_no_delete
  ON public.salespeople
  FOR DELETE
  TO authenticated
  USING (false);

-- 5. RLS on user_roles (seller-scoped writes) -------------------------
--
-- 0014 defined SELECT-own. This migration adds INSERT/DELETE but only
-- for role='seller' so admins can provision/deactivate sellers.
-- Managing the 'admin' role is intentionally out of scope here — that
-- lands in feature 016 (admin-roles) which will amend D7.

DROP POLICY IF EXISTS user_roles_admin_insert_seller ON public.user_roles;
CREATE POLICY user_roles_admin_insert_seller
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND role = 'seller');

DROP POLICY IF EXISTS user_roles_admin_delete_seller ON public.user_roles;
CREATE POLICY user_roles_admin_delete_seller
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.is_admin() AND role = 'seller');

COMMIT;
