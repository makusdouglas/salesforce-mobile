import { useEffect, useState } from 'react';

import { productsRepository } from '@/data/repositories/productsRepository';
import type Product from '@/data/models/Product';

import { deriveCatalogSummary, type CatalogSummary } from './catalogSummary';

export function useCatalogSummary(): CatalogSummary {
  const [products, setProducts] = useState<readonly Product[]>([]);

  useEffect(() => {
    const subscription = productsRepository.observeAll().subscribe({
      next: (next) => {
        setProducts(next);
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return deriveCatalogSummary(products);
}
