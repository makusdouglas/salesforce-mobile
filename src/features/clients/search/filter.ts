import type { ClientFilter, ClientListItemDTO } from '../types';

import { matchesQuery } from './matches';
import { normalize } from './normalize';

export const RECENT_LIMIT = 10;

export type ApplyFilterInput = {
  readonly clients: readonly ClientListItemDTO[];
  readonly query: string;
  readonly activeFilter: ClientFilter;
};

export function applyFilter(input: ApplyFilterInput): readonly ClientListItemDTO[] {
  const nq = normalize(input.query);
  const filter = input.activeFilter;

  if (nq.length === 0 && filter === null) {
    return input.clients;
  }

  let working: readonly ClientListItemDTO[] = input.clients;

  if (filter !== null) {
    if (filter.kind === 'recent') {
      working = [...working]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, RECENT_LIMIT);
    } else if (filter.kind === 'letter') {
      const letterNorm = normalize(filter.value);
      working = working.filter((c) => {
        const first = normalize(c.name).charAt(0);
        return first === letterNorm;
      });
    }
  }

  if (nq.length > 0) {
    working = working.filter((c) => matchesQuery(c, nq));
  }

  return working;
}
