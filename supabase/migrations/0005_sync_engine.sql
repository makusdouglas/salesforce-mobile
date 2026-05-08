-- 005-sync-engine — server-side prerequisites for the pull+push sync cycle.
--
-- Installs:
--   1. set_updated_at() trigger function that bumps updated_at on row updates.
--   2. <table>_set_updated_at triggers on all seven MVP tables.
--   3. sync_now_ms() RPC: returns the Postgres clock as bigint ms since epoch,
--      used by the app as the cursor for the next pull.
--   4. Permissive dev RLS — every authenticated user can do anything. Prod
--      MUST tighten this; see docs/bootstrap.md §9 Hardening.
--
-- Depends on: 0002_local_data_layer.sql.

BEGIN;

-- ============================================================================
-- 1. Trigger function + per-table triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'salespeople',
    'clients',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'payment_receipts'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================================
-- 2. Server-clock RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_now_ms()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT (extract(epoch FROM now()) * 1000)::bigint;
$$;

GRANT EXECUTE ON FUNCTION public.sync_now_ms() TO authenticated;

-- ============================================================================
-- 3. Permissive dev RLS
--
-- Dev only. Prod MUST replace these with per-salesperson scoping — see
-- docs/bootstrap.md §9. Applied in a loop so re-running stays safe.
-- ============================================================================

ALTER TABLE public.salespeople      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'salespeople',
    'clients',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'payment_receipts'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_dev_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_dev_all ON public.%I FOR ALL TO authenticated '
      'USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

COMMIT;
