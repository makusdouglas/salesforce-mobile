/**
 * 013-orders-overview T030b: cross-surface parity for the payment-status
 * derivation.
 *
 * SC-003 requires that OrdersOverview, OrderDetail, and the ClientProfile
 * history pipeline all produce the same payment status for the same
 * (status, total, received) tuple. Now that both surfaces consume
 * `derivePaymentStatus`, the parity reduces to a single-function check
 * — this test asserts that the old call site inside
 * `deriveOrderHistoryRow` (features/clients/...) and the direct helper
 * return identical values across 100 seeded random fixtures.
 */

import {
  deriveOrderHistoryRow,
  type OrderLike,
  type OrderItemLike,
  type ReceiptLike,
} from '../../clients/orders/deriveOrderHistory';
import {
  derivePaymentStatus,
  type OrderStatus,
} from './derivePaymentStatus';

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, xs: readonly T[]): T {
  const idx = Math.floor(rand() * xs.length);
  return xs[idx] as T;
}

describe('cross-surface parity — payment status', () => {
  it('derivePaymentStatus matches deriveOrderHistoryRow for 100 seeded fixtures', () => {
    const rand = mulberry32(12_345);
    const statuses: OrderStatus[] = ['draft', 'sent', 'canceled'];

    for (let i = 0; i < 100; i += 1) {
      const status = pick(rand, statuses);
      // Build items whose subtotal is in a reasonable range.
      const itemCount = Math.max(1, Math.floor(rand() * 4));
      const items: OrderItemLike[] = Array.from({ length: itemCount }, () => ({
        quantity: Math.max(1, Math.floor(rand() * 10)),
        unitPrice: Math.round(rand() * 30000) / 100, // 0..300 BRL, 2 decimals
        discountAmount: Math.round(rand() * 500) / 100, // 0..5 BRL
      }));
      const subtotal = items.reduce(
        (acc, it) => acc + (it.quantity * it.unitPrice - it.discountAmount),
        0,
      );
      const orderDiscount = Math.round(rand() * Math.min(subtotal, 50) * 100) / 100;
      const order: OrderLike = {
        id: `o${i}`,
        createdAtMs: 1_700_000_000_000 + i * 60_000,
        sentAtMs: status === 'sent' ? 1_700_000_000_000 + i * 60_001 : null,
        canceledAtMs: status === 'canceled' ? 1_700_000_000_000 + i * 60_002 : null,
        status,
        discountAmount: orderDiscount,
      };
      // Receipts range from underpay to overpay.
      const receiptCount = Math.floor(rand() * 4);
      const receipts: ReceiptLike[] = Array.from({ length: receiptCount }, () => ({
        amount: Math.round((rand() * 400 - 50) * 100) / 100, // -50..350 BRL
      }));

      const row = deriveOrderHistoryRow(order, items, receipts);
      const expected = derivePaymentStatus({
        status: order.status,
        total: row.total,
        received: row.received,
      });
      expect(row.paymentStatus).toBe(expected);
    }
  });
});
