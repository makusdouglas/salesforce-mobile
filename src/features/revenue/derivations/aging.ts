// 017-revenue-dashboard — receivables aging derivation. Always returns
// 4 rows in fixed order. The renderer collapses to an empty state when
// every row is zero (FR-029).

import type { AgingBucket } from '../shared/types';

import { pendingForOrder } from './_internal';
import type { DerivationInput } from './types';

const BUCKETS: readonly {
  readonly label: AgingBucket['label'];
  readonly daysMin: number;
  readonly daysMax: number | null;
}[] = [
  { label: '0-30', daysMin: 0, daysMax: 30 },
  { label: '31-60', daysMin: 31, daysMax: 60 },
  { label: '61-90', daysMin: 61, daysMax: 90 },
  { label: '>90', daysMin: 91, daysMax: null },
];

const MS_PER_DAY = 86_400_000;

export function deriveAging(input: DerivationInput): AgingBucket[] {
  const sentOrders = input.orders.filter(
    (o): o is typeof o & { sentAtMs: number } =>
      o.status === 'sent' &&
      o.sentAtMs !== null &&
      o.sentAtMs <= input.nowMs,
  );

  const totals: number[] = BUCKETS.map(() => 0);
  for (const o of sentOrders) {
    const ageDays = Math.floor((input.nowMs - o.sentAtMs) / MS_PER_DAY);
    if (ageDays < 0) continue;
    const pendente = pendingForOrder(o, input.items, input.receipts);
    if (pendente <= 0) continue;
    const bucketIdx = BUCKETS.findIndex(
      (b) =>
        ageDays >= b.daysMin && (b.daysMax === null || ageDays <= b.daysMax),
    );
    if (bucketIdx >= 0) {
      totals[bucketIdx] = (totals[bucketIdx] ?? 0) + pendente;
    }
  }

  return BUCKETS.map((b, i) => ({
    label: b.label,
    daysMin: b.daysMin,
    daysMax: b.daysMax,
    totalPendente: totals[i] ?? 0,
  }));
}
