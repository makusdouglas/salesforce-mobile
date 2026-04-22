import { type ProductDisplayDTO } from '../types';

import { matchesQuery } from './matches';
import { normalize } from './normalize';

export type FilterInput = {
  readonly products: readonly ProductDisplayDTO[];
  readonly query: string;
  readonly activeCategory: string | null;
};

export function applyFilter(input: FilterInput): readonly ProductDisplayDTO[] {
  const nq = normalize(input.query);
  const cat = input.activeCategory;
  if (nq.length === 0 && cat === null) return input.products;

  return input.products.filter((p) => {
    if (cat !== null && (p.category ?? '').trim() !== cat) return false;
    if (!matchesQuery(p, nq)) return false;
    return true;
  });
}
