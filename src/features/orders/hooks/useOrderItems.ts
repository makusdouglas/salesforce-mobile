// 009-order-assembly: observe the lines of an order, joined with their
// product + variant for display. The join is done per-render by resolving
// the variant id through `productVariantsRepository.findById` and the
// product via variant.product relation. This is light — lines are capped
// in practice at < 50 per order (plan § Performance Goals).

import { useEffect, useState } from 'react';

import type OrderItem from '@/data/models/OrderItem';
import type Product from '@/data/models/Product';
import type ProductVariant from '@/data/models/ProductVariant';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { productsRepository } from '@/data/repositories/productsRepository';
import { productVariantsRepository } from '@/data/repositories/productVariantsRepository';

export interface OrderItemWithCatalog {
  readonly line: OrderItem;
  readonly variant: ProductVariant | null;
  readonly product: Product | null;
}

export function useOrderItems(orderId: string | null): OrderItemWithCatalog[] {
  const [rows, setRows] = useState<OrderItemWithCatalog[]>([]);

  useEffect(() => {
    if (orderId === null) {
      setRows([]);
      return;
    }
    let canceled = false;
    const sub = orderItemsRepository.observeByOrder(orderId).subscribe({
      next: (lines) => {
        void (async () => {
          const resolved = await Promise.all(
            lines.map(async (line) => {
              const variant = await productVariantsRepository.findById(line.productVariantId);
              const product = variant
                ? await productsRepository.findById(variant.productId)
                : null;
              return { line, variant, product };
            }),
          );
          if (!canceled) setRows(resolved);
        })();
      },
    });
    return () => {
      canceled = true;
      sub.unsubscribe();
    };
  }, [orderId]);

  return rows;
}
