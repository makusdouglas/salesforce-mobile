import { useCallback, useMemo, useState } from 'react';

import { applyFilter } from '../search/filter';
import { type ProductDisplayDTO } from '../types';

export type UseCatalogFilterResult = {
  readonly query: string;
  readonly setQuery: (q: string) => void;
  readonly activeCategory: string | null;
  readonly setActiveCategory: (c: string | null) => void;
  readonly filtered: readonly ProductDisplayDTO[];
  readonly reset: () => void;
};

export function useCatalogFilter(
  products: readonly ProductDisplayDTO[],
): UseCatalogFilterResult {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(
    () => applyFilter({ products, query, activeCategory }),
    [products, query, activeCategory],
  );

  const reset = useCallback(() => {
    setQuery('');
    setActiveCategory(null);
  }, []);

  return { query, setQuery, activeCategory, setActiveCategory, filtered, reset };
}
