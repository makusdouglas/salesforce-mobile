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
  version: 1,
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
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_at_ms', type: 'number' },
        { name: 'sent_at_ms', type: 'number', isOptional: true },
        { name: 'pdf_uri', type: 'string', isOptional: true },
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
        { name: 'image_url', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        ...syncColumns,
      ],
    }),
  ],
});
