-- 0015_admin_sellers_rls.sql — contract tests for feature 015.
--
-- Run against a fresh dev database after applying migrations up to 0015.
-- Uses Supabase's built-in `auth.users` and a minimal seed of one admin +
-- one seller. Each test either raises on failure or reports a label.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/0015_admin_sellers_rls.sql
--
-- Exit code reflects pg error status; a plain grep on the output for
-- 'FAIL' is enough to fail CI.

BEGIN;

-- ---------- Setup ----------

CREATE TEMP TABLE _t (label text, ok boolean);

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
SELECT '00000000-0000-0000-0000-0000000000a1', 'admin@test', 'x', now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@test');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
SELECT '00000000-0000-0000-0000-0000000000b1', 'seller@test', 'x', now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'seller@test');

INSERT INTO public.user_roles (user_id, role)
SELECT '00000000-0000-0000-0000-0000000000a1', 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT '00000000-0000-0000-0000-0000000000b1', 'seller'
ON CONFLICT DO NOTHING;

INSERT INTO public.salespeople (id, name, email, auth_user_id, active)
SELECT gen_random_uuid(), 'Seller One', 'seller@test',
       '00000000-0000-0000-0000-0000000000b1', true
WHERE NOT EXISTS (SELECT 1 FROM public.salespeople WHERE email = 'seller@test');

-- ---------- Helper to run a check as a specific user ----------

-- We cannot truly impersonate via RLS in a pure SQL test — instead we
-- set the `request.jwt.claim.sub` GUC that Supabase's auth.uid() reads
-- when there's no real JWT. This mirrors the approach used by
-- supabase/tests/0014_barcode_unique.sql.

CREATE OR REPLACE FUNCTION _as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END
$$;

-- ---------- Tests ----------

-- 1. anon cannot read salespeople
PERFORM set_config('role', 'anon', true);
INSERT INTO _t VALUES (
  '1_anon_cannot_read_salespeople',
  (SELECT count(*) = 0 FROM public.salespeople)
);

-- 5. admin sees all salespeople rows
PERFORM _as('00000000-0000-0000-0000-0000000000a1');
INSERT INTO _t VALUES (
  '5_admin_sees_all_salespeople',
  (SELECT count(*) >= 1 FROM public.salespeople)
);

-- 6. admin can flip active
PERFORM _as('00000000-0000-0000-0000-0000000000a1');
UPDATE public.salespeople SET active = false
 WHERE auth_user_id = '00000000-0000-0000-0000-0000000000b1';
INSERT INTO _t VALUES (
  '6_admin_can_update_active',
  (SELECT NOT active FROM public.salespeople
    WHERE auth_user_id = '00000000-0000-0000-0000-0000000000b1')
);
UPDATE public.salespeople SET active = true
 WHERE auth_user_id = '00000000-0000-0000-0000-0000000000b1';

-- 7. DELETE is forbidden for everyone (even admin)
PERFORM _as('00000000-0000-0000-0000-0000000000a1');
BEGIN
  DELETE FROM public.salespeople WHERE email = 'seller@test';
  INSERT INTO _t VALUES ('7_admin_cannot_delete_salespeople', false);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _t VALUES ('7_admin_cannot_delete_salespeople', true);
END;

-- 8. seller cannot self-promote to admin
PERFORM _as('00000000-0000-0000-0000-0000000000b1');
BEGIN
  INSERT INTO public.user_roles (user_id, role)
    VALUES ('00000000-0000-0000-0000-0000000000b1', 'admin');
  INSERT INTO _t VALUES ('8_seller_cannot_self_promote', false);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _t VALUES ('8_seller_cannot_self_promote', true);
END;

-- 9. admin can insert a 'seller' role
PERFORM _as('00000000-0000-0000-0000-0000000000a1');
DELETE FROM public.user_roles
 WHERE user_id = '00000000-0000-0000-0000-0000000000b1' AND role = 'seller';
INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-0000000000b1', 'seller');
INSERT INTO _t VALUES (
  '9_admin_can_insert_seller_role',
  (SELECT count(*) = 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-0000-0000-0000000000b1' AND role = 'seller')
);

-- 10. admin cannot delete an 'admin' role via feature 015 policies
PERFORM _as('00000000-0000-0000-0000-0000000000a1');
BEGIN
  DELETE FROM public.user_roles
   WHERE user_id = '00000000-0000-0000-0000-0000000000a1' AND role = 'admin';
  INSERT INTO _t VALUES ('10_admin_cannot_delete_admin_role', false);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _t VALUES ('10_admin_cannot_delete_admin_role', true);
END;

-- 11. admin cannot self-deactivate via deactivate_seller()
PERFORM _as('00000000-0000-0000-0000-0000000000a1');
BEGIN
  PERFORM public.deactivate_seller('00000000-0000-0000-0000-0000000000a1');
  INSERT INTO _t VALUES ('11_cannot_deactivate_self', false);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _t VALUES ('11_cannot_deactivate_self', true);
END;

-- ---------- Report ----------

SELECT label,
       CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result
  FROM _t
 ORDER BY label;

DO $$
DECLARE
  failed int;
BEGIN
  SELECT count(*) INTO failed FROM _t WHERE NOT ok;
  IF failed > 0 THEN
    RAISE EXCEPTION '% test(s) FAILED', failed;
  END IF;
END
$$;

ROLLBACK;
