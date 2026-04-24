import { appSchema, tableSchema } from '@nozbe/watermelondb';

// Only our custom sync-readiness columns are declared here. `_status` and
// `_changed` are WatermelonDB-reserved system columns — Watermelon adds them
// to every table automatically and declaring them in `tableSchema()` is a
// runtime error ("reserved by WatermelonDB"). FR-003's four sync-readiness
// fields are still satisfied: `server_id` + `updated_at` are ours (below),
// `_status` + `_changed` are managed end-to-end by Watermelon's sync machinery.
const syncColumns = [
  { name: 'server_id', type: 'string' as const, isOptional: true, isIndexed: true },
  { name: 'updated_at', type: 'number' as const },
];

export const schema = appSchema({
  version: 5,
  tables: [
    tableSchema({
      name: 'salespeople',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        ...syncColumns,
      ],
    }),
    tableSchema({
      name: 'clients',
      columns: [
        { name: 'salesperson_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'tax_id', type: 'string', isOptional: true },
        { name: 'phone', type: 'string', isOptional: true },
        { name: 'email', type: 'string', isOptional: true },
        { name: 'address_line', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        ...syncColumns,
      ],
    }),
    tableSchema({
      name: 'products',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'image_url', type: 'string', isOptional: true },
        { name: 'unit', type: 'string', isOptional: true },
        { name: 'category', type: 'string', isOptional: true, isIndexed: true },
        ...syncColumns,
      ],
    }),
    tableSchema({
      name: 'product_variants',
      columns: [
        { name: 'product_id', type: 'string', isIndexed: true },
        { name: 'label', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'barcode', type: 'string', isOptional: true },
        ...syncColumns,
      ],
    }),
    tableSchema({
      name: 'orders',
      columns: [
        { name: 'client_id', type: 'string', isIndexed: true },
        { name: 'salesperson_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'discount_amount', type: 'number' },
        // 009-order-assembly (schema v3). Interpreted together with
        // `discount_amount`: 'amount' → BRL; 'percent' → 0..100.
        { name: 'discount_mode', type: 'string' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_at_ms', type: 'number' },
        { name: 'sent_at_ms', type: 'number', isOptional: true },
        // 009-order-assembly (schema v3). Stamped on draft→canceled.
        { name: 'canceled_at_ms', type: 'number', isOptional: true },
        { name: 'pdf_uri', type: 'string', isOptional: true },
        // 011-order-email-delivery (schema v4). '#YYYY-NNNN' human-readable
        // order number. NULL until the salesperson taps Enviar por email.
        // Indexed so sync-time conflict reconciliation can query existing
        // numbers for the year cheaply.
        { name: 'order_number', type: 'string', isOptional: true, isIndexed: true },
        ...syncColumns,
      ],
    }),
    tableSchema({
      // 011-order-email-delivery (schema v4). Local-only per-year order
      // number allocator. NOT synced to Supabase (see plan.md R9). Watermelon
      // `id` is set to `String(year)` so findByYear is an O(1) collection.find.
      name: 'order_number_counters',
      columns: [
        { name: 'year', type: 'number' },
        { name: 'next_value', type: 'number' },
        ...syncColumns,
      ],
    }),
    tableSchema({
      name: 'order_items',
      columns: [
        { name: 'order_id', type: 'string', isIndexed: true },
        { name: 'product_variant_id', type: 'string', isIndexed: true },
        { name: 'quantity', type: 'number' },
        { name: 'unit_price', type: 'number' },
        { name: 'discount_amount', type: 'number' },
        // 009-order-assembly (schema v3). See `orders.discount_mode`.
        { name: 'discount_mode', type: 'string' },
        ...syncColumns,
      ],
    }),
    tableSchema({
      name: 'payment_receipts',
      columns: [
        { name: 'order_id', type: 'string', isIndexed: true },
        { name: 'amount', type: 'number' },
        { name: 'method', type: 'string' },
        { name: 'received_at_ms', type: 'number' },
        // 012-payment-receipts (schema v5). image_url is left in place as
        // dead storage — WatermelonDB migrations cannot rename columns.
        // New code reads/writes attachment_url instead; there are no v4
        // rows in the wild that carry a value here.
        { name: 'image_url', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        // 012-payment-receipts (schema v5). The six new columns below are
        // append-only metadata introduced for receipt attachments + the
        // correction-reference self-FK. See data-model.md for semantics.
        { name: 'attachment_url', type: 'string', isOptional: true },
        { name: 'attachment_local_path', type: 'string', isOptional: true },
        { name: 'attachment_mime_type', type: 'string', isOptional: true },
        { name: 'attachment_size_bytes', type: 'number', isOptional: true },
        { name: 'attachment_upload_state', type: 'string', isOptional: true },
        { name: 'correction_of_receipt_id', type: 'string', isOptional: true, isIndexed: true },
        ...syncColumns,
      ],
    }),
  ],
});
