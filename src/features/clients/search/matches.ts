import * as cnpj from '../cnpj/cnpj';
import type { ClientListItemDTO } from '../types';

import { normalize } from './normalize';

/**
 * Tests a client against a PRE-NORMALIZED query. Empty query returns true
 * (used when only a chip filter is active).
 *
 * Matches against:
 *   1. Normalized store name (substring).
 *   2. Digits-only CNPJ (substring) when `client.taxId !== null`.
 */
export function matchesQuery(
  client: ClientListItemDTO,
  normalizedQuery: string,
): boolean {
  if (normalizedQuery.length === 0) return true;

  const nameHit = normalize(client.name).includes(normalizedQuery);
  if (nameHit) return true;

  if (client.taxId !== null) {
    const digitsStored = cnpj.normalize(client.taxId);
    const digitsQuery = cnpj.normalize(normalizedQuery);
    if (digitsQuery.length > 0 && digitsStored.includes(digitsQuery)) {
      return true;
    }
  }

  return false;
}
