-- 011-order-email-delivery — adds the human-readable order number column.
--
-- Adds:
--   1. orders.order_number — text, nullable. Format: #YYYY-NNNN
--      (e.g. #2026-0042). Allocated by the app when the seller taps
--      "Enviar por email" (draft → sent). Remains NULL for drafts.
--   2. A partial UNIQUE index on non-null order_numbers so two devices
--      racing the allocator surface a unique-violation at push time,
--      which the sync engine catches and reconciles via
--      allocateNextNumber (see 011's plan.md).
--
-- The client-side `order_number_counters` table is intentionally NOT
-- mirrored here — it is a device-local allocator and would be meaningless
-- on another installation. See Watermelon migrations.ts v4 and 011's
-- plan.md for the contract.
--
-- Depends on: 0002_local_data_layer.sql, 0009_order_assembly.sql.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number text NULL;

-- Partial unique index: only enforced when order_number is set. Drafts
-- (order_number IS NULL) are unconstrained so two drafts can coexist.
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique_idx
  ON public.orders (order_number)
  WHERE order_number IS NOT NULL;

COMMENT ON COLUMN public.orders.order_number IS
  '011-order-email-delivery. Format: #YYYY-NNNN. Allocated by the client at '
  'draft → sent. Unique when non-null (partial unique index).';

COMMIT;
