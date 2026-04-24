import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'products',
          columns: [{ name: 'category', type: 'string', isOptional: true, isIndexed: true }],
        }),
      ],
    },
    {
      // 009-order-assembly — adds discount_mode to orders and order_items
      // so the stored discount can be interpreted as a % or R$. Also stamps
      // canceled_at_ms on orders for the draft→canceled transition, mirroring
      // sent_at_ms. Backfill is a no-op: 001–008 never shipped rows in these
      // tables. New rows are always written by ordersService with explicit
      // defaults, so rows missing discount_mode in practice should not exist.
      toVersion: 3,
      steps: [
        addColumns({
          table: 'orders',
          columns: [
            { name: 'discount_mode', type: 'string' },
            { name: 'canceled_at_ms', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'order_items',
          columns: [{ name: 'discount_mode', type: 'string' }],
        }),
      ],
    },
    {
      // 011-order-email-delivery: adds order_number to orders and creates
      // the local-only order_number_counters table for the per-year
      // human-readable #YYYY-NNNN allocator. pdf_uri already exists from
      // v3; this feature populates it on send.
      toVersion: 4,
      steps: [
        addColumns({
          table: 'orders',
          columns: [{ name: 'order_number', type: 'string', isOptional: true, isIndexed: true }],
        }),
        createTable({
          name: 'order_number_counters',
          columns: [
            { name: 'year', type: 'number' },
            { name: 'next_value', type: 'number' },
            { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // 012-payment-receipts — widens payment_receipts with attachment
      // metadata (4 cols) + the correction-reference self-FK.
      // image_url is kept as legacy dead storage: WatermelonDB cannot
      // rename columns, so this feature adds `attachment_url` alongside
      // and stops reading the old column. Supabase-side renames properly
      // (see supabase/migrations/0012_payment_receipts.sql).
      //
      // The PaymentMethod enum value 'card' → 'check' rewrite needs no
      // client step: enum values are stored as plain strings with no
      // Watermelon-enforced CHECK, and dev-fixture rows are refreshed on
      // install. The Postgres-side migration UPDATEs existing rows and
      // swaps the table constraint.
      //
      // received_at_ms intentionally stays un-indexed — MVP row counts
      // are small (< 5 per order) and observeByOrder sorts in-memory.
      toVersion: 5,
      steps: [
        addColumns({
          table: 'payment_receipts',
          columns: [
            { name: 'attachment_url', type: 'string', isOptional: true },
            { name: 'attachment_local_path', type: 'string', isOptional: true },
            { name: 'attachment_mime_type', type: 'string', isOptional: true },
            { name: 'attachment_size_bytes', type: 'number', isOptional: true },
            { name: 'attachment_upload_state', type: 'string', isOptional: true },
            {
              name: 'correction_of_receipt_id',
              type: 'string',
              isOptional: true,
              isIndexed: true,
            },
          ],
        }),
      ],
    },
  ],
});
