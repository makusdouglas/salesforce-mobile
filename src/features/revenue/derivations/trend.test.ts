import { deriveTrend } from './trend';
import type { DerivationInput, OrderRow, OrderItemRow, PaymentReceiptRow } from './types';

function ms(year: number, month: number, day = 15): number {
  return new Date(year, month - 1, day, 12).getTime();
}

const ORDER_PROTO: Omit<OrderRow, 'id' | 'status' | 'sentAtMs' | 'createdAtMs'> = {
  clientId: 'c1',
  salespersonId: 'sp1',
  discountAmount: 0,
  canceledAtMs: null,
};

function makeInput(args: {
  orders: OrderRow[];
  items?: OrderItemRow[];
  receipts?: PaymentReceiptRow[];
  trendFrom?: string;
  trendTo?: string;
}): DerivationInput {
  return {
    orders: args.orders,
    items: args.items ?? [],
    receipts: args.receipts ?? [],
    clientNameById: new Map(),
    productNameById: new Map(),
    filter: {
      sellerId: 'sp1',
      month: '2026-04',
      trendFrom: args.trendFrom ?? '2025-05',
      trendTo: args.trendTo ?? '2026-04',
    },
    nowMs: ms(2026, 4, 25),
  };
}

describe('deriveTrend', () => {
  it('returns [] when there is no data in the window', () => {
    expect(deriveTrend(makeInput({ orders: [] }))).toEqual([]);
  });

  it('omits months that have no relevant rows (gaps, not zero fillers)', () => {
    const orders: OrderRow[] = [
      { ...ORDER_PROTO, id: 'a', status: 'sent', sentAtMs: ms(2025, 6), createdAtMs: ms(2025, 6) },
      { ...ORDER_PROTO, id: 'b', status: 'sent', sentAtMs: ms(2026, 4), createdAtMs: ms(2026, 4) },
    ];
    const items: OrderItemRow[] = [
      { id: 'i1', orderId: 'a', productVariantId: 'v', productId: 'p', quantity: 1, unitPrice: 10, discountAmount: 0 },
      { id: 'i2', orderId: 'b', productVariantId: 'v', productId: 'p', quantity: 2, unitPrice: 20, discountAmount: 0 },
    ];
    const result = deriveTrend(makeInput({ orders, items }));
    // Two months populated, no zero-filler months in between.
    expect(result.map((p) => p.month)).toEqual(['2025-06', '2026-04']);
  });

  it('rolls Faturado, Recebido, Pendente per month', () => {
    const orders: OrderRow[] = [
      { ...ORDER_PROTO, id: 'o', status: 'sent', sentAtMs: ms(2026, 4, 5), createdAtMs: ms(2026, 4, 1) },
    ];
    const items: OrderItemRow[] = [
      { id: 'i1', orderId: 'o', productVariantId: 'v', productId: 'p', quantity: 2, unitPrice: 50, discountAmount: 0 },
    ];
    const receipts: PaymentReceiptRow[] = [
      { id: 'r', orderId: 'o', amount: 30, receivedAtMs: ms(2026, 4, 10) },
    ];
    const points = deriveTrend(makeInput({ orders, items, receipts }));
    const point = points[0]!;
    expect(point.month).toBe('2026-04');
    expect(point.faturado).toBe(100);
    expect(point.recebido).toBe(30);
    expect(point.pendente).toBe(70);
  });

  it('priorYear option shifts the window back by 12 months', () => {
    const orders: OrderRow[] = [
      { ...ORDER_PROTO, id: 'o', status: 'sent', sentAtMs: ms(2025, 4, 5), createdAtMs: ms(2025, 4, 1) },
    ];
    const items: OrderItemRow[] = [
      { id: 'i1', orderId: 'o', productVariantId: 'v', productId: 'p', quantity: 1, unitPrice: 100, discountAmount: 0 },
    ];
    const result = deriveTrend(
      makeInput({ orders, items, trendFrom: '2025-05', trendTo: '2026-04' }),
      { includeYear: 'priorYear' },
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.month).toBe('2025-04');
    expect(result[0]!.faturado).toBe(100);
  });

  it('sorts months ascending', () => {
    const orders: OrderRow[] = [
      { ...ORDER_PROTO, id: 'a', status: 'sent', sentAtMs: ms(2026, 1), createdAtMs: ms(2026, 1) },
      { ...ORDER_PROTO, id: 'b', status: 'sent', sentAtMs: ms(2025, 9), createdAtMs: ms(2025, 9) },
      { ...ORDER_PROTO, id: 'c', status: 'sent', sentAtMs: ms(2025, 12), createdAtMs: ms(2025, 12) },
    ];
    const items: OrderItemRow[] = orders.map((o, idx) => ({
      id: `i${idx}`,
      orderId: o.id,
      productVariantId: 'v',
      productId: 'p',
      quantity: 1,
      unitPrice: 10,
      discountAmount: 0,
    }));
    const result = deriveTrend(makeInput({ orders, items }));
    expect(result.map((p) => p.month)).toEqual(['2025-09', '2025-12', '2026-01']);
  });
});
