// 010-repeat-last-order: drives the RepeatHeroCard on ClientProfileScreen.
//
// Observes `ordersRepository.observeLastSentForClient(clientId)` and, when
// an order exists, also observes its line items so the hero metadata
// (date label, item count, total) stays current if the admin edits the
// historical order from somewhere else (rare — orders are immutable once
// sent by D4 — but cheap).

import { useEffect, useState } from 'react';
import { of, switchMap, type Subscription } from 'rxjs';

import type Order from '@/data/models/Order';
import type OrderItem from '@/data/models/OrderItem';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { ordersRepository } from '@/data/repositories/ordersRepository';

export type LastSentOrderSummary = {
  readonly orderId: string;
  readonly dateLabel: string;
  readonly itemCount: number;
  readonly total: number;
};

const SHORT_MONTH_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

function formatShortDatePt(ms: number | null): string {
  if (ms === null) return '—';
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = SHORT_MONTH_PT[d.getMonth()] ?? '—';
  return `${day} ${month}`;
}

function deriveSummary(order: Order, items: OrderItem[]): LastSentOrderSummary {
  // Same derivation convention used by useClientOrderHistory —
  // see features/clients/orders/deriveOrderHistory.ts. We inline here
  // because the shape we need is slightly different (dateLabel instead of
  // createdAtMs) and we already have the line items observed.
  let linesSubtotal = 0;
  for (const line of items) {
    const gross = line.unitPrice * line.quantity;
    const discount = line.discountMode === 'percent'
      ? Math.min(gross, (gross * line.discountAmount) / 100)
      : Math.min(gross, line.discountAmount);
    linesSubtotal += Math.max(0, gross - discount);
  }
  const orderDiscount = order.discountMode === 'percent'
    ? Math.min(linesSubtotal, (linesSubtotal * order.discountAmount) / 100)
    : Math.min(linesSubtotal, order.discountAmount);
  const total = Math.max(0, linesSubtotal - orderDiscount);

  return {
    orderId: order.id,
    dateLabel: formatShortDatePt(order.sentAtMs ?? order.createdAtMs),
    itemCount: items.length,
    total,
  };
}

export function useLastSentOrderSummary(clientId: string): LastSentOrderSummary | null {
  const [summary, setSummary] = useState<LastSentOrderSummary | null>(null);

  useEffect(() => {
    let sub: Subscription | undefined;
    sub = ordersRepository
      .observeLastSentForClient(clientId)
      .pipe(
        switchMap((order) => {
          if (!order) return of(null);
          return orderItemsRepository
            .observeByOrder(order.id)
            .pipe(switchMap((items) => of(deriveSummary(order, items))));
        }),
      )
      .subscribe({
        next: (derived) => setSummary(derived),
        error: () => setSummary(null),
      });
    return () => sub?.unsubscribe();
  }, [clientId]);

  return summary;
}
