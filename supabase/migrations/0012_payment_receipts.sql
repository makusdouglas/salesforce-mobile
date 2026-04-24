-- 012-payment-receipts — Postgres + Storage migration.
--
-- This file mirrors the client-side WatermelonDB migration v4 → v5
-- (see src/data/schema/migrations.ts). Apply via the Supabase dashboard
-- SQL editor or the supabase CLI before rolling out the app build.
--
-- What this migration does:
--   1. Renames payment_receipts.image_url → attachment_url. Client-side
--      cannot rename (WatermelonDB limitation); Postgres can and does.
--   2. Adds two sync-visible columns: attachment_url (shared via sync)
--      and correction_of_receipt_id (self-FK, shared via sync).
--   3. Rewrites any existing method = 'card' rows to 'check' and swaps
--      the table's method CHECK constraint to the new allow-list.
--   4. Creates the private Storage bucket `receipt-attachments` with two
--      RLS policies — SELECT + INSERT — gated by the parent order's
--      seller_id. No UPDATE or DELETE policies (append-only by omission).
--
-- Idempotent: every step uses IF NOT EXISTS / ON CONFLICT where possible
-- so a second run is safe.
--
-- Device-local attachment metadata columns (attachment_local_path,
-- attachment_mime_type, attachment_size_bytes, attachment_upload_state)
-- are intentionally NOT mirrored server-side. They describe local cache
-- state and upload progress and are excluded from the sync payload.

BEGIN;

-- ============================================================================
-- 1. payment_receipts column additions + rename + method constraint swap
-- ============================================================================

-- Step 1a: rename image_url → attachment_url (Postgres supports this;
-- Watermelon does not). Wrapped in a DO block so re-running is safe —
-- the second run sees image_url already gone and does nothing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_receipts'
      AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.payment_receipts RENAME COLUMN image_url TO attachment_url;
  END IF;
END $$;

-- Step 1b: add the correction-reference self-FK column. Type MUST be uuid
-- to match payment_receipts.id (the table's PK is a uuid, populated by
-- client-generated randomUUID()). Nullable because regular (non-correction)
-- receipts leave it NULL.
ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS correction_of_receipt_id uuid
    REFERENCES public.payment_receipts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payment_receipts_correction_of_idx
  ON public.payment_receipts (correction_of_receipt_id)
  WHERE correction_of_receipt_id IS NOT NULL;

-- Step 1c: rewrite any existing 'card' rows to 'check'. No production rows
-- are expected (002's dev fixtures are the only source), but the UPDATE is
-- harmless if none match.
UPDATE public.payment_receipts
  SET method = 'check'
  WHERE method = 'card';

-- Step 1d: swap the CHECK constraint. Drop by name if the original exists
-- under the standard naming, then add the new allow-list.
ALTER TABLE public.payment_receipts
  DROP CONSTRAINT IF EXISTS payment_receipts_method_check;

ALTER TABLE public.payment_receipts
  ADD CONSTRAINT payment_receipts_method_check
  CHECK (method IN ('cash', 'pix', 'transfer', 'check', 'other'));

-- ============================================================================
-- 2. Storage bucket `receipt-attachments` (private)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipt-attachments', 'receipt-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. Storage RLS policies
--
-- Path convention: <receipt-attachments>/<seller_id>/<receipt_id>.<ext>.
-- A policy passes when BOTH:
--   (a) the path prefix (storage.foldername(name)[1]) equals auth.uid(),
--   (b) there is a row in payment_receipts joined to an orders row whose
--       seller_id equals auth.uid() and whose id encodes the filename's
--       receipt_id segment (filename without extension).
-- The two checks are belt-and-braces: (a) is cheap and local to the Storage
-- row; (b) guarantees the authenticated user actually owns a receipt with
-- that ID via the business tables.
--
-- No UPDATE or DELETE policies — receipts (and their proofs) are append-only.
-- ============================================================================

-- Drop old policies if a prior attempt left them behind.
DROP POLICY IF EXISTS receipts_attachments_read  ON storage.objects;
DROP POLICY IF EXISTS receipts_attachments_insert ON storage.objects;

CREATE POLICY receipts_attachments_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipt-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.payment_receipts r
      JOIN public.orders o ON o.id = r.order_id
      WHERE o.salesperson_id = auth.uid()
        AND r.id::text = split_part(
          (storage.foldername(name))[2], '.', 1
        )
    )
  );

CREATE POLICY receipts_attachments_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipt-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.payment_receipts r
      JOIN public.orders o ON o.id = r.order_id
      WHERE o.salesperson_id = auth.uid()
        AND r.id::text = split_part(
          (storage.foldername(name))[2], '.', 1
        )
    )
  );

COMMIT;
