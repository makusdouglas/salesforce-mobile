// 017-revenue-dashboard — monthly trend derivation. Returns ONLY months
// that contain at least one relevant row (sparse months are gaps, not
// zero-fillers — see research R6).

import type { TrendPoint } from '../shared/types';

import {
  monthKeyFromMs,
  monthRangeFromKey,
  pendingForOrder,
  priorYearMonthKey,
  totalForOrder,
} from './_internal';
import type { DerivationInput } from './types';

export interface DeriveTrendOptions {
  /** 'current' = filter window. 'priorYear' = same window, one year back. */
  readonly includeYear?: 'current' | 'priorYear';
}

function trendForWindow(
  input: DerivationInput,
  fromKey: string,
  toKey: string,
): TrendPoint[] {
  const fromRange = monthRangeFromKey(fromKey);
  const toRange = monthRangeFromKey(toKey);
  const windowStart = fromRange.startMs;
  const windowEnd = toRange.endMs;

  const ordersInWindow = input.orders.filter(
    (o) =>
      (o.status === 'sent'
        ? o.sentAtMs !== null && o.sentAtMs >= windowStart && o.sentAtMs < windowEnd
        : o.createdAtMs >= windowStart && o.createdAtMs < windowEnd),
  );

  if (ordersInWindow.length === 0) return [];

  const buckets = new Map<string, { faturado: number; recebido: number; pendente: number }>();
  const ensure = (key: string) => {
    let row = buckets.get(key);
    if (!row) {
      row = { faturado: 0, recebido: 0, pendente: 0 };
      buckets.set(key, row);
    }
    return row;
  };

  // Faturado: every order's total bucketed by created_at month.
  for (const o of input.orders) {
    if (o.createdAtMs < windowStart || o.createdAtMs >= windowEnd) continue;
    const key = monthKeyFromMs(o.createdAtMs);
    ensure(key).faturado += totalForOrder(o, input.items);
  }

  // Recebido: receipts whose parent order was sent in this window,
  // bucketed by the parent's sent_at month (matches admin SQL).
  const sentOrders = input.orders.filter(
    (o): o is typeof o & { sentAtMs: number } =>
      o.status === 'sent' && o.sentAtMs !== null,
  );
  const sentByMonth = new Map<string, typeof sentOrders>();
  for (const o of sentOrders) {
    if (o.sentAtMs < windowStart || o.sentAtMs >= windowEnd) continue;
    const key = monthKeyFromMs(o.sentAtMs);
    let arr = sentByMonth.get(key);
    if (!arr) {
      arr = [];
      sentByMonth.set(key, arr);
    }
    arr.push(o);
  }
  for (const [key, sentList] of sentByMonth) {
    const orderIds = new Set(sentList.map((o) => o.id));
    let recebido = 0;
    let pendente = 0;
    for (const r of input.receipts) {
      if (orderIds.has(r.orderId)) recebido += r.amount;
    }
    for (const o of sentList) {
      pendente += pendingForOrder(o, input.items, input.receipts);
    }
    const row = ensure(key);
    row.recebido += recebido;
    row.pendente += pendente;
  }

  return Array.from(buckets.entries())
    .filter(([, v]) => v.faturado > 0 || v.recebido > 0 || v.pendente > 0)
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}

export function deriveTrend(
  input: DerivationInput,
  opts: DeriveTrendOptions = {},
): TrendPoint[] {
  const { includeYear = 'current' } = opts;
  if (includeYear === 'priorYear') {
    const fromPrior = priorYearMonthKey(input.filter.trendFrom);
    const toPrior = priorYearMonthKey(input.filter.trendTo);
    return trendForWindow(input, fromPrior, toPrior);
  }
  return trendForWindow(input, input.filter.trendFrom, input.filter.trendTo);
}
