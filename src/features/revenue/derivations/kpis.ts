// 017-revenue-dashboard — KPI derivation (seller scope).
// Mirrors the SQL function admin_revenue_kpis. See contracts/seller-derivations.md §1.

import { computeDeltaDirection, computeDeltaPct } from '../shared/formatDelta';
import type { KpiBlock } from '../shared/types';

import {
  monthRangeFromKey,
  pendingForOrder,
  previousMonthKey,
  receiptSumForOrder,
  totalForOrder,
} from './_internal';
import type { DerivationInput, OrderRow, PaymentReceiptRow } from './types';

interface MonthAggregates {
  recebido: number;
  faturado: number;
  pendente: number;
  count: number;
}

function aggregatesForMonth(
  monthKey: string,
  input: DerivationInput,
): MonthAggregates {
  const range = monthRangeFromKey(monthKey);
  const sentInMonth = input.orders.filter(
    (o): o is OrderRow & { sentAtMs: number } =>
      o.status === 'sent' &&
      o.sentAtMs !== null &&
      o.sentAtMs >= range.startMs &&
      o.sentAtMs < range.endMs,
  );
  const createdInMonth = input.orders.filter(
    (o) => o.createdAtMs >= range.startMs && o.createdAtMs < range.endMs,
  );

  const sentOrderIds = new Set(sentInMonth.map((o) => o.id));
  const recebido = input.receipts
    .filter((r: PaymentReceiptRow) => sentOrderIds.has(r.orderId))
    .reduce((acc, r) => acc + r.amount, 0);

  const faturado = createdInMonth.reduce(
    (acc, o) => acc + totalForOrder(o, input.items),
    0,
  );

  const pendente = sentInMonth.reduce(
    (acc, o) => acc + pendingForOrder(o, input.items, input.receipts),
    0,
  );

  return {
    recebido,
    faturado,
    pendente,
    count: sentInMonth.length,
  };
}

function buildKpi(
  label: KpiBlock['label'],
  current: number,
  previous: number,
  hadPreviousData: boolean,
  currentCount: number,
  previousCount: number,
): KpiBlock {
  const previousValue = hadPreviousData ? previous : null;
  return {
    label,
    currentValue: current,
    previousValue,
    deltaPct: computeDeltaPct(current, previousValue),
    deltaDirection: computeDeltaDirection(current, previousValue),
    currentCount,
    previousCount,
  };
}

export function deriveKpis(input: DerivationInput): KpiBlock[] {
  const cur = aggregatesForMonth(input.filter.month, input);
  const prevKey = previousMonthKey(input.filter.month);
  const prev = aggregatesForMonth(prevKey, input);
  const prevHadAny =
    prev.recebido > 0 ||
    prev.faturado > 0 ||
    prev.pendente > 0 ||
    prev.count > 0;

  const ticketCurrent = cur.count > 0 ? cur.faturado / cur.count : 0;
  const ticketPrevious = prev.count > 0 ? prev.faturado / prev.count : 0;

  return [
    buildKpi('recebido', cur.recebido, prev.recebido, prevHadAny, cur.count, prev.count),
    buildKpi('faturado', cur.faturado, prev.faturado, prevHadAny, cur.count, prev.count),
    buildKpi('pendente', cur.pendente, prev.pendente, prevHadAny, cur.count, prev.count),
    buildKpi(
      'ticket_medio',
      ticketCurrent,
      ticketPrevious,
      prev.count > 0,
      cur.count,
      prev.count,
    ),
    buildKpi(
      'pedidos_enviados',
      cur.count,
      prev.count,
      prev.count > 0,
      cur.count,
      prev.count,
    ),
  ];
}

// Re-export so admin scope can use the same helpers when shaping its
// RPC payload into KpiBlock[].
export { receiptSumForOrder, totalForOrder };
