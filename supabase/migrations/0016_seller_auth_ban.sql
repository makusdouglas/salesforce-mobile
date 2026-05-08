-- 0016_seller_auth_ban.sql
-- Feature: 015-admin-sellers (follow-up)
--
-- Patches the deactivate_seller / reactivate_seller functions from 0015
-- to also flip auth.users.banned_until. Without this, the GoTrue Auth
-- layer keeps accepting sign-ins from a "deactivated" seller — only the
-- app-side role gate stopped them, which is insufficient (FR-012,
-- SC-004).
--
-- Idempotent. Backfills auth.users.banned_until for any salespeople row
-- that was already inactive when this migration runs.

BEGIN;

CREATE OR REPLACE FUNCTION public.deactivate_seller(p_auth_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF p_auth_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_deactivate_self' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.user_roles
   WHERE user_id = p_auth_user_id
     AND role    = 'seller';

  UPDATE public.salespeople
     SET active     = false,
         updated_at = now()
   WHERE auth_user_id = p_auth_user_id;

  UPDATE auth.users
     SET banned_until = 'infinity'::timestamptz
   WHERE id = p_auth_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_seller(p_auth_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
       VALUES (p_auth_user_id, 'seller')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.salespeople
     SET active     = true,
         updated_at = now()
   WHERE auth_user_id = p_auth_user_id;

  UPDATE auth.users
     SET banned_until = NULL
   WHERE id = p_auth_user_id;
END;
$$;

-- Backfill: bane todos os vendedores ja desativados manualmente antes
-- deste patch, para que sign-ins atuais comecem a falhar.
UPDATE auth.users u
   SET banned_until = 'infinity'::timestamptz
  FROM public.salespeople s
 WHERE s.auth_user_id = u.id
   AND s.active = false
   AND u.banned_until IS NULL;

COMMIT;
