import { useEffect, useState } from 'react';
import { combineLatest, of, type Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { database } from '@/data/database';
import { productsRepository } from '@/data/repositories/productsRepository';
import { productVariantsRepository } from '@/data/repositories/productVariantsRepository';
import Product from '@/data/models/Product';
import ProductVariant from '@/data/models/ProductVariant';

import {
  deriveProductDTO,
  type ProductDisplayDTO,
  sortProducts,
  type VariantDisplayDTO,
} from '../types';

export function toVariantDTO(v: ProductVariant): VariantDisplayDTO {
  return {
    id: v.id,
    label: v.label,
    price: v.price,
    barcode: v.barcode,
    attributes: v.label,
  };
}

type UseCatalogResult = {
  readonly products: readonly ProductDisplayDTO[];
  readonly hasAny: boolean;
  readonly hasEverSynced: boolean;
};

export function useCatalog(): UseCatalogResult {
  const [products, setProducts] = useState<readonly ProductDisplayDTO[]>([]);
  const [hasEverSynced, setHasEverSynced] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const value = await (database.adapter as unknown as {
          getLocal(key: string): Promise<string | null>;
        }).getLocal('__watermelon_last_pulled_at');
        if (active && value !== null) setHasEverSynced(true);
      } catch {
        // swallow — absence of the key means never synced, which is the default
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let sub: Subscription | null = null;
    sub = productsRepository
      .observeAll()
      .pipe(
        switchMap((list: Product[]) => {
          if (list.length === 0) return of<ProductDisplayDTO[]>([]);
          return combineLatest(
            list.map((p) =>
              productVariantsRepository
                .observeByProduct(p.id)
                .pipe(
                  switchMap((variants: ProductVariant[]) =>
                    of(
                      deriveProductDTO(
                        {
                          id: p.id,
                          name: p.name,
                          description: p.description,
                          imageUrl: p.imageUrl,
                          unit: p.unit,
                          category: p.category,
                        },
                        variants.map(toVariantDTO),
                      ),
                    ),
                  ),
                ),
            ),
          );
        }),
      )
      .subscribe({
        next: (derived) => setProducts(sortProducts(derived)),
        error: () => setProducts([]),
      });
    return () => sub?.unsubscribe();
  }, []);

  return {
    products,
    hasAny: products.length > 0,
    hasEverSynced,
  };
}
