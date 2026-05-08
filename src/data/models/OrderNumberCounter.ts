// 011-order-email-delivery: local-only per-year order-number allocator.
// Watermelon `id` convention: `id === String(year)` so findByYear(y) is an
// O(1) collection.find(String(y)). Never synced to Supabase (see plan.md R9).

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class OrderNumberCounter extends Model {
  static table = 'order_number_counters';

  @field('year') year!: number;
  @field('next_value') nextValue!: number;

  @field('server_id') serverId!: string | null;
  @field('updated_at') updatedAt!: number;
}
