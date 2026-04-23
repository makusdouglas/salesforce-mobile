import { useCallback, useMemo, useState } from 'react';

import { applyFilter } from '../search/filter';
import type { ClientFilter, ClientListItemDTO } from '../types';

export type UseClientsFilterResult = {
  readonly query: string;
  readonly setQuery: (next: string) => void;
  readonly activeFilter: ClientFilter;
  readonly setActiveFilter: (next: ClientFilter) => void;
  readonly filtered: readonly ClientListItemDTO[];
  readonly reset: () => void;
};

export function useClientsFilter(
  clients: readonly ClientListItemDTO[],
): UseClientsFilterResult {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ClientFilter>(null);

  const filtered = useMemo(
    () => applyFilter({ clients, query, activeFilter }),
    [clients, query, activeFilter],
  );

  const reset = useCallback(() => {
    setQuery('');
    setActiveFilter(null);
  }, []);

  return { query, setQuery, activeFilter, setActiveFilter, filtered, reset };
}
