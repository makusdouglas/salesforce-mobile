import { useCallback, useEffect, useState } from 'react';

import { listSellers, type ListSellersFilter, type SellerRecord } from '../service/sellersApi';
import { friendlyError } from './useFriendlyError';

export type SellersState =
  | { status: 'loading' }
  | { status: 'ready'; sellers: readonly SellerRecord[] }
  | { status: 'error'; message: string };

export function useSellers() {
  const [filter, setFilter] = useState<ListSellersFilter>('all');
  const [state, setState] = useState<SellersState>({ status: 'loading' });

  const reload = useCallback(async (nextFilter?: ListSellersFilter) => {
    const f = nextFilter ?? filter;
    setState({ status: 'loading' });
    try {
      const rows = await listSellers(f);
      setState({ status: 'ready', sellers: rows });
    } catch (err) {
      setState({ status: 'error', message: friendlyError(err) });
    }
  }, [filter]);

  useEffect(() => {
    void reload(filter);
  }, [filter, reload]);

  return { state, filter, setFilter, reload } as const;
}
