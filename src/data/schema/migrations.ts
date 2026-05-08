import {
  addColumns,
  createTable,
  schemaMigrations,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

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
    {
      // 016-product-lifecycle-roles — adds `active` (boolean) and
      // `deactivated_at_ms` (nullable) to products. The invariant
      //   (active=true  AND deactivated_at_ms IS NULL)
      //   XOR
      //   (active=false AND deactivated_at_ms IS NOT NULL)
      // is enforced at the Postgres layer (see
      // supabase/migrations/0018_product_lifecycle_and_granular_roles.sql).
      // Watermelon cannot express a CHECK constraint, so the repository is
      // responsible for keeping both columns consistent on write. Existing
      // rows default to active=true via the productsRepository helper that
      // runs on first app open post-migration; sync pulls overwrite with
      // server state anyway.
      toVersion: 6,
      steps: [
        addColumns({
          table: 'products',
          columns: [
            { name: 'active', type: 'boolean', isIndexed: true },
            { name: 'deactivated_at_ms', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      // 016-product-lifecycle-roles — v6 added `active` via addColumns,
      // which leaves existing rows with NULL (SQLite ALTER TABLE ADD
      // COLUMN has no default). The seller catalog filter excludes NULL
      // rows in some Watermelon Q-builder paths, hiding the entire
      // legacy catalog until the next sync pull touches each row.
      //
      // Backfill any NULL → 1 (true) on devices that already migrated
      // through v6. Idempotent — running on a fresh v5→v7 device is a
      // no-op because v6's addColumns ran first in the same migration
      // pass and left rows NULL, then this step flips them to true.
      // SQLite stores booleans as integers; `1` matches Watermelon's
      // serialised representation for `true`.
      toVersion: 7,
      steps: [
        unsafeExecuteSql(
          'UPDATE products SET active = 1 WHERE active IS NULL;',
        ),
      ],
    },
  ],
});
