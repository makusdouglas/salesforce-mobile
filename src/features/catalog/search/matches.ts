import { type ProductDisplayDTO } from '../types';

import { normalize } from './normalize';

export function matchesQuery(
  product: ProductDisplayDTO,
  normalizedQuery: string,
): boolean {
  if (normalizedQuery.length === 0) return true;
  const parts = [normalize(product.name), ...product.variants.map((v) => normalize(v.label))];
  const haystack = parts.join(' ');
  return haystack.includes(normalizedQuery);
}
