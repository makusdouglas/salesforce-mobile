import { Model, type Relation } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

import type { PaymentMethod } from '../types';
import type Order from './Order';

export default class PaymentReceipt extends Model {
  static table = 'payment_receipts';

  static associations = {
    orders: { type: 'belongs_to' as const, key: 'order_id' },
  };

  @field('order_id') orderId!: string;
  @field('amount') amount!: number;
  @field('method') method!: PaymentMethod;
  @field('received_at_ms') receivedAtMs!: number;
  @field('image_url') imageUrl!: string | null;
  @field('notes') notes!: string | null;

  @field('server_id') serverId!: string | null;
  @field('updated_at') updatedAt!: number;

  @relation('orders', 'order_id') order!: Relation<Order>;
}
