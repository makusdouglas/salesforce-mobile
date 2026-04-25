// 017-revenue-dashboard — admin scope orchestrator. Fans out the six
// RPCs in parallel, owns the screen-scoped in-memory cache, and drives
// the loading | ready | ready_stale | error state machine described
// in data-model.md §6.

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AgingBucket,
  KpiBlock,
  RankedSeller,
  RevenueFilter,
  RevenueSnapshot,
  TopClient,
  TopProduct,
  TrendPoint,
} from '@/features/revenue';

import {
  AdminRevenueError,
  fetchAdminAging,
  fetchAdminBySeller,
  fetchAdminKpis,
  fetchAdminMonthly,
  fetchAdminTopClients,
  fetchAdminTopProducts,
} from '../service/adminRevenueClient';

export type AdminRevenueState =
  | { kind: 'loading'; staleSnapshot?: RevenueSnapshot }
  | { kind: 'ready'; snapshot: RevenueSnapshot }
  | { kind: 'ready_stale'; snapshot: RevenueSnapshot; lastError: AdminRevenueErrorKind }
  | { kind: 'error'; lastError: AdminRevenueErrorKind };

export type AdminRevenueErrorKind = 'forbidden' | 'network' | 'unknown';

export interface UseAdminRevenueResult {
  readonly state: AdminRevenueState;
  readonly snapshot: RevenueSnapshot | null;
  readonly comparisonAvailable: boolean;
  /** Trigger a refetch of all six panels (uses current filter + comparisonEnabled). */
  refetch: () => void;
}

interface CachedSnapshot {
  readonly snapshot: RevenueSnapshot;
  readonly filterKey: string;
  readonly comparisonEnabled: boolean;
}

function filterKey(f: RevenueFilter, comparison: boolean): string {
  return `${f.sellerId ?? '__all__'}|${f.month}|${f.trendFrom}|${f.trendTo}|${comparison ? '+y' : '-y'}`;
}

function priorYearMonthKey(monthKey: string): string {
  const parts = monthKey.split('-');
  const yearStr = parts[0] ?? '1970';
  const monthStr = parts[1] ?? '01';
  const year = Number.parseInt(yearStr, 10) - 1;
  return `${year}-${monthStr}`;
}

function errorKindOf(err: unknown): AdminRevenueErrorKind {
  if (err instanceof AdminRevenueError) return err.kind;
  return 'unknown';
}

export function useAdminRevenue(params: {
  readonly filter: RevenueFilter;
  readonly comparisonEnabled: boolean;
}): UseAdminRevenueResult {
  const { filter, comparisonEnabled } = params;
  const cacheRef = useRef<CachedSnapshot | null>(null);
  const [state, setState] = useState<AdminRevenueState>({ kind: 'loading' });
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const key = filterKey(filter, comparisonEnabled);
    const cached = cacheRef.current;

    setState((prev) => {
      // If we already have a snapshot for this key, keep it visible
      // while we refetch in the background (admin "stale-while-revalidate").
      if (cached && cached.filterKey === key && prev.kind !== 'loading') {
        return { kind: 'loading', staleSnapshot: cached.snapshot };
      }
      return { kind: 'loading' };
    });

    const month = filter.month;
    const trendFrom = filter.trendFrom;
    const trendTo = filter.trendTo;
    const sellerId = filter.sellerId;

    const corePromises: [
      Promise<KpiBlock[]>,
      Promise<TrendPoint[]>,
      Promise<RankedSeller[]>,
      Promise<TopClient[]>,
      Promise<TopProduct[]>,
      Promise<AgingBucket[]>,
    ] = [
      fetchAdminKpis({ sellerId, month }),
      fetchAdminMonthly({ sellerId, from: trendFrom, to: trendTo }),
      fetchAdminBySeller({ month }),
      fetchAdminTopClients({ sellerId, monthFrom: trendFrom, monthTo: trendTo }),
      fetchAdminTopProducts({ sellerId, monthFrom: trendFrom, monthTo: trendTo }),
      fetchAdminAging({ sellerId, asOf: month }),
    ];
    const priorPromise: Promise<TrendPoint[] | undefined> = comparisonEnabled
      ? fetchAdminMonthly({
          sellerId,
          from: priorYearMonthKey(trendFrom),
          to: priorYearMonthKey(trendTo),
        })
      : Promise.resolve(undefined);

    Promise.all([...corePromises, priorPromise])
      .then((results) => {
        if (cancelled) return;
        const [kpis, trend, ranking, topClients, topProducts, aging, priorYearTrend] = results as [
          KpiBlock[],
          TrendPoint[],
          RankedSeller[],
          TopClient[],
          TopProduct[],
          AgingBucket[],
          TrendPoint[] | undefined,
        ];
        const base: RevenueSnapshot = {
          scope: 'admin',
          filter,
          fetchedAt: Date.now(),
          kpis,
          trend,
          sellerRanking: ranking,
          topClients,
          topProducts,
          aging,
        };
        const snapshot: RevenueSnapshot = priorYearTrend
          ? { ...base, priorYearTrend }
          : base;
        cacheRef.current = { snapshot, filterKey: key, comparisonEnabled };
        setState({ kind: 'ready', snapshot });
      })
      .catch((err) => {
        if (cancelled) return;
        const kind = errorKindOf(err);
        const cur = cacheRef.current;
        if (cur && cur.filterKey === key) {
          setState({ kind: 'ready_stale', snapshot: cur.snapshot, lastError: kind });
        } else {
          setState({ kind: 'error', lastError: kind });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filter, comparisonEnabled, tick]);

  const snapshot =
    state.kind === 'ready' || state.kind === 'ready_stale'
      ? state.snapshot
      : state.kind === 'loading'
        ? state.staleSnapshot ?? null
        : null;

  // Comparison toggle is "available" once we have a non-empty prior-year
  // trend cached. Until first fetch completes, keep it true so the UI
  // doesn't flash disabled.
  const comparisonAvailable =
    snapshot?.priorYearTrend === undefined ||
    (snapshot?.priorYearTrend?.length ?? 0) > 0 ||
    !comparisonEnabled;

  return { state, snapshot, comparisonAvailable, refetch };
}
