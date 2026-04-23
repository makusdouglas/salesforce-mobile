import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

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
  ],
});
