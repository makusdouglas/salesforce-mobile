-- 009-order-assembly — schema widenings for discount mode + cancellation.
--
-- Adds:
--   1. orders.discount_mode — interpreted together with discount_amount:
--      'amount' means BRL, 'percent' means 0..100.
--   2. orders.canceled_at_ms — stamped on draft → canceled, mirroring
--      sent_at_ms (draft → sent).
--   3. order_items.discount_mode — same semantics as orders.discount_mode.
--
-- Backfill is a no-op: 001–008 never shipped production rows in these
-- tables. New rows are always written by ordersService with explicit
-- defaults, so rows missing discount_mode in practice should not exist.
-- Every column gets a DEFAULT anyway so the ADD COLUMN itself does not
-- break pre-existing rows.
--
-- Depends on: 0002_local_data_layer.sql.

BEGIN;

-- orders: discount_mode + canceled_at_ms
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_mode text NOT NULL DEFAULT 'amount'
    CHECK (discount_mode IN ('amount', 'percent'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS canceled_at_ms bigint NULL;

-- order_items: discount_mode
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS discount_mode text NOT NULL DEFAULT 'amount'
    CHECK (discount_mode IN ('amount', 'percent'));

COMMENT ON COLUMN public.orders.discount_mode IS
  '009-order-assembly. Interpreted with discount_amount: amount → BRL, percent → 0..100.';

COMMENT ON COLUMN public.order_items.discount_mode IS
  '009-order-assembly. Interpreted with discount_amount: amount → BRL, percent → 0..100.';

COMMENT ON COLUMN public.orders.canceled_at_ms IS
  '009-order-assembly. Stamped when status transitions to canceled. Mirrors sent_at_ms.';

COMMIT;
