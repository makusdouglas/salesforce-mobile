// 017-revenue-dashboard — top 3 products by units sold in the active
// filter window. Tie-break by product name ascending.

import type { TopProduct } from '../shared/types';

import { monthRangeFromKey } from './_internal';
import type { DerivationInput } from './types';

export function deriveTopProducts(input: DerivationInput): TopProduct[] {
  const fromRange = monthRangeFromKey(input.filter.trendFrom);
  const toRange = monthRangeFromKey(input.filter.trendTo);
  const windowStart = fromRange.startMs;
  const windowEnd = toRange.endMs;

  const sentInWindow = input.orders.filter(
    (o) =>
      o.status === 'sent' &&
      o.sentAtMs !== null &&
      o.sentAtMs >= windowStart &&
      o.sentAtMs < windowEnd,
  );
  if (sentInWindow.length === 0) return [];

  const orderIds = new Set(sentInWindow.map((o) => o.id));
  const unitsByProduct = new Map<string, number>();
  for (const it of input.items) {
    if (!orderIds.has(it.orderId)) continue;
    unitsByProduct.set(it.productId, (unitsByProduct.get(it.productId) ?? 0) + it.quantity);
  }

  const rows: TopProduct[] = [];
  for (const [productId, units] of unitsByProduct) {
    if (units <= 0) continue;
    rows.push({
      productId,
      productName: input.productNameById.get(productId) ?? productId,
      units,
    });
  }
  rows.sort((a, b) =>
    b.units !== a.units
      ? b.units - a.units
      : a.productName.localeCompare(b.productName, 'pt-BR'),
  );
  return rows.slice(0, 3);
}
