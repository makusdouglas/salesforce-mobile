import { Q } from '@nozbe/watermelondb';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { database } from '../database';
import Product from '../models/Product';

/**
 * READ-ONLY repository — catalog is registered by the admin via Supabase
 * dashboard (constitution D2). No `create`, `update`, or `softDelete` method
 * is exposed on the public surface.
 */

const collection = database.get<Product>('products');
const notDeleted = Q.where('_status', Q.notEq('deleted'));

export const productsRepository = {
  async findById(id: string): Promise<Product | null> {
    return collection.find(id).catch(() => null);
  },

  query() {
    return collection.query(notDeleted);
  },

  observe(id: string) {
    return collection.findAndObserve(id).pipe(catchError(() => of<Product | null>(null)));
  },

  observeAll() {
    return collection.query(notDeleted).observe();
  },
};
