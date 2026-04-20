import { Model, type Relation } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

import type Order from './Order';
import type ProductVariant from './ProductVariant';

export default class OrderItem extends Model {
  static table = 'order_items';

  static associations = {
    orders: { type: 'belongs_to' as const, key: 'order_id' },
    product_variants: { type: 'belongs_to' as const, key: 'product_variant_id' },
  };

  @field('order_id') orderId!: string;
  @field('product_variant_id') productVariantId!: string;
  @field('quantity') quantity!: number;
  @field('unit_price') unitPrice!: number;
  @field('discount_amount') discountAmount!: number;

  @field('server_id') serverId!: string | null;
  @field('updated_at') updatedAt!: number;

  @relation('orders', 'order_id') order!: Relation<Order>;
  @relation('product_variants', 'product_variant_id') variant!: Relation<ProductVariant>;
}
