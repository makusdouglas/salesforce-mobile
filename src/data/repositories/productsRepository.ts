import { Q } from '@nozbe/watermelondb';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { database } from '../database';
import Product from '../models/Product';

/**
 * READ-ONLY repository — catalog is registered by the admin via Supabase
 * dashboard (constitution D2). No `create`, `update`, or `softDelete` method
 * is exposed on the public surface.
 *
 * 016-product-lifecycle-roles — seller-facing reads (query, observeAll)
 * filter out inactive rows. `findById` intentionally does NOT filter so
 * historical order lines (feature 13) + payment receipts (feature 12)
 * render discontinued products verbatim. Admin surfaces talk to Supabase
 * directly via productsApi, not through this repository.
 */

const collection = database.get<Product>('products');
const notDeleted = Q.where('_status', Q.notEq('deleted'));
// 016-product-lifecycle-roles. We treat undefined/null as "active"
// because rows that existed before schema v6 (the migration that added
// the column) carry no value until a sync pull rehydrates them. The
// only state that hides a product from sellers is an explicit
// `active = false` set by the admin via setProductActive — which the
// sync mapper now propagates (see src/features/sync/supabase/mappers.ts).
//
// SQL-NULL semantics matter: `WHERE active != false` evaluates to NULL
// (not TRUE) for rows where active is NULL, which excludes them. So
// the predicate must be an explicit OR.
const notInactive = Q.or(
  Q.where('active', true),
  Q.where('active', Q.eq(null)),
);

export const productsRepository = {
  /**
   * Historical-safe read. Returns the product even when `active = false`
   * so sent/canceled orders and payment receipts keep rendering the
   * original name and image.
   */
  async findById(id: string): Promise<Product | null> {
    return collection.find(id).catch(() => null);
  },

  /** Seller-catalog query — excludes inactive rows (FR-008). */
  query() {
    return collection.query(notDeleted, notInactive);
  },

  observe(id: string) {
    return collection.findAndObserve(id).pipe(catchError(() => of<Product | null>(null)));
  },

  /** Seller-catalog observable — excludes inactive rows (FR-008). */
  observeAll() {
    return collection.query(notDeleted, notInactive).observe();
  },

  /**
   * Detect discontinued products referenced by a draft's items.
   * Used by OrderDraftScreen on open (FR-010) and by RepeatLastOrder's
   * preview step (FR-012). Returns the subset of the input IDs that
   * currently have `active = false`.
   */
  async findInactiveIn(productIds: readonly string[]): Promise<Product[]> {
    if (productIds.length === 0) return [];
    return collection
      .query(notDeleted, Q.where('id', Q.oneOf([...productIds])), Q.where('active', false))
      .fetch();
  },
};
