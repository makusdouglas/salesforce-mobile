// 017-revenue-dashboard — fetches the active-seller list for the
// vendedor filter sheet. Cached per-mount via state; refetch happens
// when the sheet remounts.

import { useEffect, useState } from 'react';

import { supabase } from '@/data/supabase';

export interface ActiveSeller {
  readonly id: string;
  readonly name: string;
}

export interface UseActiveSellersResult {
  readonly sellers: readonly ActiveSeller[];
  readonly loading: boolean;
  readonly error: string | null;
}

export function useActiveSellersForFilter(): UseActiveSellersResult {
  const [state, setState] = useState<UseActiveSellersResult>({
    sellers: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('salespeople')
        .select('id, name')
        .is('deleted_at', null)
        .order('name', { ascending: true });
      if (cancelled) return;
      if (error) {
        setState({ sellers: [], loading: false, error: error.message });
        return;
      }
      const rows = (data ?? []) as readonly { id: string; name: string }[];
      setState({ sellers: rows, loading: false, error: null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
