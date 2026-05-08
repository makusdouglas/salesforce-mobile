// 017-revenue-dashboard — top 3 clients by Recebido in the active
// filter window. Tie-break by client name ascending (FR-025).

import type { TopClient } from '../shared/types';

import { monthRangeFromKey } from './_internal';
import type { DerivationInput } from './types';

export function deriveTopClients(input: DerivationInput): TopClient[] {
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

  const orderIdToClientId = new Map(sentInWindow.map((o) => [o.id, o.clientId]));
  const orderIds = new Set(orderIdToClientId.keys());
  const totalsByClient = new Map<string, number>();
  for (const r of input.receipts) {
    if (!orderIds.has(r.orderId)) continue;
    const clientId = orderIdToClientId.get(r.orderId);
    if (!clientId) continue;
    totalsByClient.set(clientId, (totalsByClient.get(clientId) ?? 0) + r.amount);
  }

  const rows: TopClient[] = [];
  for (const [clientId, recebido] of totalsByClient) {
    if (recebido <= 0) continue;
    rows.push({
      clientId,
      clientName: input.clientNameById.get(clientId) ?? clientId,
      recebido,
    });
  }
  rows.sort((a, b) =>
    b.recebido !== a.recebido
      ? b.recebido - a.recebido
      : a.clientName.localeCompare(b.clientName, 'pt-BR'),
  );
  return rows.slice(0, 3);
}
