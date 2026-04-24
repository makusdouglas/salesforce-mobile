-- 002-local-data-layer — initial Postgres schema (v1 shape).
--
-- Creates the seven MVP tables from constitution R2 — salespeople,
-- clients, products, product_variants, orders, order_items,
-- payment_receipts — each carrying the sync-readiness columns
-- (updated_at timestamptz, deleted_at timestamptz) that feature 005
-- relies on.
--
-- This is the v1 shape only. Later features add columns (category in
-- 006, discount_mode + canceled_at_ms in 009, order_number in 011,
-- attachment_* + correction_of_receipt_id in 012). Apply the subsequent
-- migration files in order to reach the current schema.
--
-- Primary keys are UUIDs. The app generates them client-side via
-- expo-crypto.randomUUID() and pushes them into the id column on insert
-- (sync protocol requires local.id === server.id). The `default` only
-- fires if the client omits id, which the sync engine never does.

BEGIN;

-- Salespeople: one row per user of the app.
CREATE TABLE IF NOT EXISTS public.salespeople (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  email        text NOT NULL UNIQUE,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz NULL
);
CREATE INDEX IF NOT EXISTS salespeople_updated_at_idx ON public.salespeople (updated_at);
CREATE INDEX IF NOT EXISTS salespeople_deleted_at_idx
  ON public.salespeople (deleted_at) WHERE deleted_at IS NOT NULL;

-- Clients: retailers the salesperson visits.
CREATE TABLE IF NOT EXISTS public.clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesperson_id  uuid NOT NULL REFERENCES public.salespeople(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  tax_id          text NULL,
  phone           text NULL,
  email           text NULL,
  address_line    text NULL,
  notes           text NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);
CREATE INDEX IF NOT EXISTS clients_salesperson_id_idx ON public.clients (salesperson_id);
CREATE INDEX IF NOT EXISTS clients_updated_at_idx ON public.clients (updated_at);
CREATE INDEX IF NOT EXISTS clients_deleted_at_idx
  ON public.clients (deleted_at) WHERE deleted_at IS NOT NULL;

-- Products: catalog, read-only in the VENDEDOR app (D2).
CREATE TABLE IF NOT EXISTS public.products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text NULL,
  image_url     text NULL,
  unit          text NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz NULL
);
CREATE INDEX IF NOT EXISTS products_updated_at_idx ON public.products (updated_at);
CREATE INDEX IF NOT EXISTS products_deleted_at_idx
  ON public.products (deleted_at) WHERE deleted_at IS NOT NULL;

-- Product variants: concrete SKUs with prices.
CREATE TABLE IF NOT EXISTS public.product_variants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label       text NOT NULL,
  price       numeric(12, 2) NOT NULL DEFAULT 0,
  barcode     text NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL
);
CREATE INDEX IF NOT EXISTS product_variants_product_id_idx ON public.product_variants (product_id);
CREATE INDEX IF NOT EXISTS product_variants_updated_at_idx ON public.product_variants (updated_at);
CREATE INDEX IF NOT EXISTS product_variants_deleted_at_idx
  ON public.product_variants (deleted_at) WHERE deleted_at IS NOT NULL;

-- Orders: intent-orders assembled in the field.
CREATE TABLE IF NOT EXISTS public.orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  salesperson_id    uuid NOT NULL REFERENCES public.salespeople(id) ON DELETE RESTRICT,
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'canceled')),
  discount_amount   numeric(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  notes             text NULL,
  created_at_ms     bigint NOT NULL,
  sent_at_ms        bigint NULL,
  pdf_uri           text NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz NULL
);
CREATE INDEX IF NOT EXISTS orders_client_id_idx ON public.orders (client_id);
CREATE INDEX IF NOT EXISTS orders_salesperson_id_idx ON public.orders (salesperson_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status);
CREATE INDEX IF NOT EXISTS orders_updated_at_idx ON public.orders (updated_at);
CREATE INDEX IF NOT EXISTS orders_deleted_at_idx
  ON public.orders (deleted_at) WHERE deleted_at IS NOT NULL;

-- Order items: single lines on an order.
CREATE TABLE IF NOT EXISTS public.order_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_variant_id   uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity             numeric(12, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price           numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_amount      numeric(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz NULL
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_variant_id_idx
  ON public.order_items (product_variant_id);
CREATE INDEX IF NOT EXISTS order_items_updated_at_idx ON public.order_items (updated_at);
CREATE INDEX IF NOT EXISTS order_items_deleted_at_idx
  ON public.order_items (deleted_at) WHERE deleted_at IS NOT NULL;

-- Payment receipts: v1 shape. Method allow-list evolves in 012
-- (`card` → `check`). Image_url is renamed to attachment_url in 012.
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount            numeric(12, 2) NOT NULL CHECK (amount > 0),
  method            text NOT NULL
                    CONSTRAINT payment_receipts_method_check
                    CHECK (method IN ('cash', 'pix', 'transfer', 'card', 'other')),
  received_at_ms    bigint NOT NULL,
  image_url         text NULL,
  notes             text NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz NULL
);
CREATE INDEX IF NOT EXISTS payment_receipts_order_id_idx ON public.payment_receipts (order_id);
CREATE INDEX IF NOT EXISTS payment_receipts_updated_at_idx ON public.payment_receipts (updated_at);
CREATE INDEX IF NOT EXISTS payment_receipts_deleted_at_idx
  ON public.payment_receipts (deleted_at) WHERE deleted_at IS NOT NULL;

COMMIT;
