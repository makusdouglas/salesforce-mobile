import { deriveAging } from './aging';
import type { DerivationInput, OrderItemRow, OrderRow, PaymentReceiptRow } from './types';

const MS_PER_DAY = 86_400_000;
const NOW = new Date(2026, 3, 25, 12).getTime(); // 25 Apr 2026

const PROTO: Omit<OrderRow, 'id' | 'sentAtMs' | 'createdAtMs'> = {
  clientId: 'c1',
  salespersonId: 'sp1',
  status: 'sent',
  discountAmount: 0,
  canceledAtMs: null,
};

function input(
  orders: OrderRow[],
  items: OrderItemRow[],
  receipts: PaymentReceiptRow[],
): DerivationInput {
  return {
    orders,
    items,
    receipts,
    clientNameById: new Map(),
    productNameById: new Map(),
    filter: {
      sellerId: 'sp1',
      month: '2026-04',
      trendFrom: '2025-05',
      trendTo: '2026-04',
    },
    nowMs: NOW,
  };
}

describe('deriveAging', () => {
  it('always returns 4 rows in fixed order', () => {
    const result = deriveAging(input([], [], []));
    expect(result.map((r) => r.label)).toEqual(['0-30', '31-60', '61-90', '>90']);
    for (const r of result) expect(r.totalPendente).toBe(0);
  });

  it('places exact-boundary days in the lower bucket', () => {
    // Day 30 → 0-30; Day 31 → 31-60; Day 60 → 31-60; Day 61 → 61-90; Day 90 → 61-90; Day 91 → >90
    const cases = [
      { id: 'a', age: 30, expected: '0-30' },
      { id: 'b', age: 31, expected: '31-60' },
      { id: 'c', age: 60, expected: '31-60' },
      { id: 'd', age: 61, expected: '61-90' },
      { id: 'e', age: 90, expected: '61-90' },
      { id: 'f', age: 91, expected: '>90' },
    ];
    const orders: OrderRow[] = cases.map((c) => ({
      ...PROTO,
      id: c.id,
      sentAtMs: NOW - c.age * MS_PER_DAY,
      createdAtMs: NOW - c.age * MS_PER_DAY,
    }));
    const items: OrderItemRow[] = orders.map((o, i) => ({
      id: `it-${i}`,
      orderId: o.id,
      productVariantId: 'v',
      productId: 'p',
      quantity: 1,
      unitPrice: 100,
      discountAmount: 0,
    }));
    const result = deriveAging(input(orders, items, []));
    expect(result.find((r) => r.label === '0-30')!.totalPendente).toBe(100);
    expect(result.find((r) => r.label === '31-60')!.totalPendente).toBe(200);
    expect(result.find((r) => r.label === '61-90')!.totalPendente).toBe(200);
    expect(result.find((r) => r.label === '>90')!.totalPendente).toBe(100);
  });

  it('excludes orders that are fully paid (pendente = 0)', () => {
    const o: OrderRow = {
      ...PROTO,
      id: 'paid',
      sentAtMs: NOW - 5 * MS_PER_DAY,
      createdAtMs: NOW - 5 * MS_PER_DAY,
    };
    const items: OrderItemRow[] = [
      { id: 'i', orderId: 'paid', productVariantId: 'v', productId: 'p', quantity: 1, unitPrice: 50, discountAmount: 0 },
    ];
    const receipts: PaymentReceiptRow[] = [
      { id: 'r', orderId: 'paid', amount: 50, receivedAtMs: NOW - 4 * MS_PER_DAY },
    ];
    const result = deriveAging(input([o], items, receipts));
    for (const r of result) expect(r.totalPendente).toBe(0);
  });

  it('excludes drafts and canceled orders', () => {
    const draft: OrderRow = {
      ...PROTO,
      id: 'd',
      status: 'draft',
      sentAtMs: null,
      createdAtMs: NOW - 10 * MS_PER_DAY,
    };
    const canceled: OrderRow = {
      ...PROTO,
      id: 'c',
      status: 'canceled',
      sentAtMs: NOW - 10 * MS_PER_DAY,
      createdAtMs: NOW - 10 * MS_PER_DAY,
    };
    const items: OrderItemRow[] = [
      { id: 'i1', orderId: 'd', productVariantId: 'v', productId: 'p', quantity: 1, unitPrice: 100, discountAmount: 0 },
      { id: 'i2', orderId: 'c', productVariantId: 'v', productId: 'p', quantity: 1, unitPrice: 100, discountAmount: 0 },
    ];
    const result = deriveAging(input([draft, canceled], items, []));
    for (const r of result) expect(r.totalPendente).toBe(0);
  });

  it('excludes orders sent in the future (negative age)', () => {
    const o: OrderRow = {
      ...PROTO,
      id: 'future',
      sentAtMs: NOW + 5 * MS_PER_DAY,
      createdAtMs: NOW,
    };
    const items: OrderItemRow[] = [
      { id: 'i', orderId: 'future', productVariantId: 'v', productId: 'p', quantity: 1, unitPrice: 100, discountAmount: 0 },
    ];
    const result = deriveAging(input([o], items, []));
    for (const r of result) expect(r.totalPendente).toBe(0);
  });
});
