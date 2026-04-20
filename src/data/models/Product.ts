import { Model, type Query } from '@nozbe/watermelondb';
import { children, field } from '@nozbe/watermelondb/decorators';

import type ProductVariant from './ProductVariant';

export default class Product extends Model {
  static table = 'products';

  static associations = {
    product_variants: { type: 'has_many' as const, foreignKey: 'product_id' },
  };

  @field('name') name!: string;
  @field('description') description!: string | null;
  @field('image_url') imageUrl!: string | null;
  @field('unit') unit!: string | null;

  @field('server_id') serverId!: string | null;
  @field('updated_at') updatedAt!: number;

  @children('product_variants') variants!: Query<ProductVariant>;
}
