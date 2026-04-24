-- Smoke test for products_barcode_live_idx (partial unique index on live rows).
-- Run manually: psql "$SUPABASE_DB_URL" -f supabase/tests/0014_barcode_unique.sql
-- Expected output: two raised errors in the middle, then a clean
-- "TEST OK" NOTICE at the end. Ctrl+C / rollback on any other outcome.

BEGIN;

INSERT INTO public.products (name, barcode, base_price)
VALUES ('Produto teste A', '9999000000001', 10.00);

-- Second INSERT with the same live barcode MUST fail.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.products (name, barcode, base_price)
    VALUES ('Produto teste A duplicado', '9999000000001', 11.00);
    RAISE EXCEPTION 'FAIL: second INSERT should have been rejected by products_barcode_live_idx';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK: unique violation raised as expected.';
  END;
END
$$;

-- Soft-delete the first row and try again; the partial index excludes
-- soft-deleted rows so reuse MUST succeed.
UPDATE public.products
   SET deleted_at = now()
 WHERE barcode = '9999000000001' AND deleted_at IS NULL;

INSERT INTO public.products (name, barcode, base_price)
VALUES ('Produto teste A relançado', '9999000000001', 12.00);

-- And a second live row with that same barcode MUST now fail again.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.products (name, barcode, base_price)
    VALUES ('Produto teste A outro', '9999000000001', 13.00);
    RAISE EXCEPTION 'FAIL: live duplicate after relaunch should have been rejected';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK: second live duplicate also rejected.';
  END;
END
$$;

DO $$ BEGIN RAISE NOTICE 'TEST OK'; END $$;

ROLLBACK;
