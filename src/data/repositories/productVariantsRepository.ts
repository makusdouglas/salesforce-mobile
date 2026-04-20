import { Q } from '@nozbe/watermelondb';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { database } from '../database';
import ProductVariant from '../models/ProductVariant';

/**
 * READ-ONLY repository — catalog is registered by the admin via Supabase
 * dashboard (constitution D2). No `create`, `update`, or `softDelete` method
 * is exposed on the public surface.
 */

const collection = database.get<ProductVariant>('product_variants');
const notDeleted = Q.where('_status', Q.notEq('deleted'));

export const productVariantsRepository = {
  async findById(id: string): Promise<ProductVariant | null> {
    return collection.find(id).catch(() => null);
  },

  query() {
    return collection.query(notDeleted);
  },

  observe(id: string) {
    return collection.findAndObserve(id).pipe(catchError(() => of<ProductVariant | null>(null)));
  },

  observeAll() {
    return collection.query(notDeleted).observe();
  },

  observeByProduct(productId: string) {
    return collection.query(Q.where('product_id', productId), notDeleted).observe();
  },
};
