// 017-revenue-dashboard — seller-scope filter state. Pinned to the
// signed-in seller; period defaults to current month for KPIs/aging
// and last 12 months for the trend chart. No mutator UI in v1.

import { useMemo } from 'react';

import type { RevenueFilter } from '../shared/types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function offsetMonthKey(monthKey: string, offset: number): string {
  const parts = monthKey.split('-');
  const yearStr = parts[0] ?? '1970';
  const monthStr = parts[1] ?? '01';
  const d = new Date(Number.parseInt(yearStr, 10), Number.parseInt(monthStr, 10) - 1, 1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function useSellerRevenueFilter(
  sellerId: string | null,
  nowMs?: number,
): RevenueFilter {
  return useMemo(() => {
    const now = nowMs !== undefined ? new Date(nowMs) : new Date();
    const month = currentMonthKey(now);
    return {
      sellerId,
      month,
      trendFrom: offsetMonthKey(month, -11),
      trendTo: month,
    };
  }, [sellerId, nowMs]);
}
