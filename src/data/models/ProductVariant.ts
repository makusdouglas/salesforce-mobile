import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { children, field, relation } from '@nozbe/watermelondb/decorators';

import type OrderItem from './OrderItem';
import type Product from './Product';

export default class ProductVariant extends Model {
  static table = 'product_variants';

  static associations = {
    products: { type: 'belongs_to' as const, key: 'product_id' },
    order_items: { type: 'has_many' as const, foreignKey: 'product_variant_id' },
  };

  @field('product_id') productId!: string;
  @field('label') label!: string;
  @field('price') price!: number;
  @field('barcode') barcode!: string | null;

  @field('server_id') serverId!: string | null;
  @field('updated_at') updatedAt!: number;

  @relation('products', 'product_id') product!: Relation<Product>;
  @children('order_items') orderItems!: Query<OrderItem>;
}
