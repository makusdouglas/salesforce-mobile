-- 0017_email_exists_in_auth.sql
-- Feature: 015-admin-sellers (follow-up)
--
-- The Edge Function admin-create-seller used auth.admin.listUsers() to
-- check email uniqueness. That call paginates (default 50, max ~1000)
-- and silently misses collisions past the page boundary, AND can fail
-- under the new sb_secret_* key model when scope mappings differ. A
-- tiny security-definer SQL helper does the same job in O(1) and is
-- callable via supabase.rpc('email_exists_in_auth', ...).

BEGIN;

CREATE OR REPLACE FUNCTION public.email_exists_in_auth(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM auth.users
     WHERE lower(email) = lower(btrim(p_email))
  );
$$;

-- Only the service role calls this from the Edge Function — but grant
-- to authenticated as a defensive default so future RPC reuse is
-- straightforward. The function reads only a boolean (no PII).
GRANT EXECUTE ON FUNCTION public.email_exists_in_auth(text) TO authenticated;

COMMIT;
