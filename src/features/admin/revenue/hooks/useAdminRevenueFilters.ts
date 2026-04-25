// 017-revenue-dashboard — admin filter state. Owned by the screen
// (no global store); a filter mutation invalidates the cache key in
// useAdminRevenue, triggering a refetch of all six RPCs.

import { useCallback, useMemo, useState } from 'react';

import {
  currentMonthKey,
  offsetMonthKey,
  type RevenueFilter,
} from '@/features/revenue';

export interface UseAdminRevenueFiltersResult {
  readonly filter: RevenueFilter;
  setSellerId: (sellerId: string | null) => void;
  setMonth: (monthKey: string) => void;
  /** Convenience: jump back to the current month + last 12 months. */
  resetPeriod: () => void;
}

export function useAdminRevenueFilters(): UseAdminRevenueFiltersResult {
  const initialMonth = useMemo(() => currentMonthKey(), []);
  const [sellerId, setSellerIdState] = useState<string | null>(null);
  const [month, setMonthState] = useState<string>(initialMonth);

  const filter = useMemo<RevenueFilter>(
    () => ({
      sellerId,
      month,
      trendFrom: offsetMonthKey(month, -11),
      trendTo: month,
    }),
    [sellerId, month],
  );

  const setSellerId = useCallback((id: string | null) => setSellerIdState(id), []);
  const setMonth = useCallback((m: string) => setMonthState(m), []);
  const resetPeriod = useCallback(() => setMonthState(currentMonthKey()), []);

  return { filter, setSellerId, setMonth, resetPeriod };
}
