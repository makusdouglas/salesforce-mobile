// 017-revenue-dashboard — small WatermelonDB query helpers tuned for
// the seller dashboard's offline derivations. Keeps the seller-side
// derivation modules import-pure (no DB / no observer code).

import { Q } from '@nozbe/watermelondb';
import type { Observable } from 'rxjs';
import { of } from 'rxjs';

import { database } from '../database';
import type Order from '../models/Order';
import type ProductVariant from '../models/ProductVariant';

const orders = database.get<Order>('orders');
const productVariants = database.get<ProductVariant>('product_variants');
const notDeleted = Q.where('_status', Q.notEq('deleted'));

/**
 * Observe every non-deleted order belonging to the given salesperson.
 * The dashboard filters down to specific months in JS (typical seller
 * has < 1k orders, so the cost is negligible vs the architectural
 * benefit of a single observer).
 *
 * Re-emits whenever any of the columns the derivations read changes
 * (status / sent_at_ms / canceled_at_ms / created_at_ms / discount).
 */
export function observeOrdersForSalesperson(
  salespersonId: string,
): Observable<readonly Order[]> {
  if (!salespersonId) return of<readonly Order[]>([]);
  return orders
    .query(Q.where('salesperson_id', salespersonId), notDeleted)
    .observeWithColumns([
      'status',
      'sent_at_ms',
      'canceled_at_ms',
      'created_at_ms',
      'discount_amount',
      'updated_at',
    ]);
}

/**
 * Observe non-deleted product_variants in batches by id. Used to map
 * order_items.product_variant_id → products.id for the top-products
 * derivation.
 */
export function observeProductVariantsByIds(
  ids: readonly string[],
): Observable<readonly ProductVariant[]> {
  if (ids.length === 0) return of<readonly ProductVariant[]>([]);
  return productVariants
    .query(Q.where('id', Q.oneOf([...ids])), notDeleted)
    .observe();
}
