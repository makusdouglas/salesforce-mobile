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
  @field('category') category!: string | null;

  // 016-product-lifecycle-roles. active=false hides the product from
  // seller catalogs (feature 6) and blocks additions to new drafts
  // (feature 9). deactivatedAtMs is set in the same write; the two
  // columns are kept consistent by productsRepository.setActive.
  @field('active') active!: boolean;
  @field('deactivated_at_ms') deactivatedAtMs!: number | null;

  @field('server_id') serverId!: string | null;
  @field('updated_at') updatedAt!: number;

  @children('product_variants') variants!: Query<ProductVariant>;
}
