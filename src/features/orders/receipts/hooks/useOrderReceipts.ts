// 012-payment-receipts: observe an order's receipts + derive totals.
//
// Mirrors the shape of 009's useOrderItems + useOrderTotals: one hook
// subscribes to the observable, another (pure) derives totals. Kept
// inline here because the derivation is tiny and the consumer count is
// still 1 (OrderReceiptsScreen).

import { useEffect, useState } from 'react';

import type Order from '@/data/models/Order';
import type OrderItem from '@/data/models/OrderItem';
import type PaymentReceipt from '@/data/models/PaymentReceipt';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { ordersRepository } from '@/data/repositories/ordersRepository';
import { paymentReceiptsRepository } from '@/data/repositories/paymentReceiptsRepository';

import { computeOrderTotals } from '../../totals/computeOrderTotals';
import { toLineInput } from '../../hooks/useOrderTotals';
import {
  computeReceiptTotals,
  type ReceiptTotals,
} from '../totals/computeReceiptTotals';

export interface UseOrderReceiptsResult {
  readonly order: Order | null;
  readonly receipts: readonly PaymentReceipt[];
  readonly totals: ReceiptTotals;
  readonly loading: boolean;
}

const ZERO_TOTALS: ReceiptTotals = {
  total: 0,
  received: 0,
  outstanding: 0,
  hasOverpayment: false,
  hasNegativeBalance: false,
  progressRatio: 0,
};

// Newest-first: received_at_ms DESC, createdAt DESC tiebreak. 009 already
// stores received_at_ms; createdAt is WatermelonDB's internal `created_at`
// accessible via `record.createdAt`.
function sortReceipts(rows: readonly PaymentReceipt[]): readonly PaymentReceipt[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (b.receivedAtMs !== a.receivedAtMs) return b.receivedAtMs - a.receivedAtMs;
    const aCreated = (a as unknown as { createdAt: Date }).createdAt?.getTime?.() ?? 0;
    const bCreated = (b as unknown as { createdAt: Date }).createdAt?.getTime?.() ?? 0;
    return bCreated - aCreated;
  });
  return copy;
}

export function useOrderReceipts(orderId: string): UseOrderReceiptsResult {
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<readonly OrderItem[]>([]);
  const [receipts, setReceipts] = useState<readonly PaymentReceipt[]>([]);
  const [ready, setReady] = useState({ order: false, lines: false, receipts: false });

  useEffect(() => {
    const sub = ordersRepository.observe(orderId).subscribe({
      next: (row) => {
        setOrder(row);
        setReady((p) => ({ ...p, order: true }));
      },
    });
    return () => sub.unsubscribe();
  }, [orderId]);

  useEffect(() => {
    const sub = orderItemsRepository.observeByOrder(orderId).subscribe({
      next: (rows) => {
        setLines(rows);
        setReady((p) => ({ ...p, lines: true }));
      },
    });
    return () => sub.unsubscribe();
  }, [orderId]);

  useEffect(() => {
    const sub = paymentReceiptsRepository.observeByOrder(orderId).subscribe({
      next: (rows) => {
        setReceipts(sortReceipts(rows));
        setReady((p) => ({ ...p, receipts: true }));
      },
    });
    return () => sub.unsubscribe();
  }, [orderId]);

  const orderTotal =
    order === null
      ? 0
      : computeOrderTotals(
          { discount: { mode: order.discountMode, value: order.discountAmount } },
          lines.map(toLineInput),
        ).total;

  const totals =
    order === null
      ? ZERO_TOTALS
      : computeReceiptTotals({
          orderTotal,
          receipts: receipts.map((r) => ({ amount: r.amount })),
        });

  const loading = !ready.order || !ready.lines || !ready.receipts;

  return { order, receipts, totals, loading };
}
