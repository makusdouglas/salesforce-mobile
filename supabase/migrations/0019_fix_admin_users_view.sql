-- 0019_fix_admin_users_view.sql
-- Feature: 016-product-lifecycle-roles (post-deploy fix)
--
-- 0018 created `public.admin_users_view` with `security_invoker = true`,
-- which makes the view run with the caller's permissions. The caller
-- (role `authenticated`) does NOT have GRANT SELECT on `auth.users`, so
-- the view returned empty / "permission denied" for every authenticated
-- user — including superusers.
--
-- Fix: recreate the view WITHOUT `security_invoker`, so it runs with
-- the view owner's privileges (definer behavior — postgres can read
-- auth.users). Add a `WHERE public.is_superuser()` row filter so
-- non-superusers get an empty result set rather than a leak. The
-- `is_superuser()` helper is SECURITY DEFINER and reads `auth.uid()`,
-- so the per-caller check still happens correctly.
--
-- This pattern is the recommended Supabase approach for views that
-- need to surface auth.users data behind an admin gate.

BEGIN;

DROP VIEW IF EXISTS public.admin_users_view;

CREATE VIEW public.admin_users_view AS
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
      AND s.deleted_at IS NULL
WHERE public.is_superuser();

GRANT SELECT ON public.admin_users_view TO authenticated;

COMMIT;
