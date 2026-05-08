import { deriveTopProducts } from './topProducts';
import type { DerivationInput, OrderItemRow, OrderRow } from './types';

function ms(year: number, month: number, day = 15): number {
  return new Date(year, month - 1, day, 12).getTime();
}

const ORDER: Omit<OrderRow, 'id' | 'sentAtMs' | 'createdAtMs'> = {
  clientId: 'c1',
  salespersonId: 'sp1',
  status: 'sent',
  discountAmount: 0,
  canceledAtMs: null,
};

function input(
  orders: OrderRow[],
  items: OrderItemRow[],
  products: readonly (readonly [string, string])[],
): DerivationInput {
  return {
    orders,
    items,
    receipts: [],
    clientNameById: new Map(),
    productNameById: new Map(products),
    filter: {
      sellerId: 'sp1',
      month: '2026-04',
      trendFrom: '2025-05',
      trendTo: '2026-04',
    },
    nowMs: ms(2026, 4, 25),
  };
}

describe('deriveTopProducts', () => {
  it('returns [] for empty input', () => {
    expect(deriveTopProducts(input([], [], []))).toEqual([]);
  });

  it('caps at 3, sorted by units desc', () => {
    const orders = ['p1', 'p2', 'p3', 'p4'].map((pid) => ({
      ...ORDER,
      id: `o-${pid}`,
      sentAtMs: ms(2026, 4, 5),
      createdAtMs: ms(2026, 4, 1),
    }));
    const items: OrderItemRow[] = [
      { id: 'i1', orderId: 'o-p1', productVariantId: 'v', productId: 'p1', quantity: 5, unitPrice: 1, discountAmount: 0 },
      { id: 'i2', orderId: 'o-p2', productVariantId: 'v', productId: 'p2', quantity: 20, unitPrice: 1, discountAmount: 0 },
      { id: 'i3', orderId: 'o-p3', productVariantId: 'v', productId: 'p3', quantity: 10, unitPrice: 1, discountAmount: 0 },
      { id: 'i4', orderId: 'o-p4', productVariantId: 'v', productId: 'p4', quantity: 30, unitPrice: 1, discountAmount: 0 },
    ];
    const products: [string, string][] = [
      ['p1', 'Café'],
      ['p2', 'Açúcar'],
      ['p3', 'Óleo'],
      ['p4', 'Arroz'],
    ];
    const result = deriveTopProducts(input(orders, items, products));
    expect(result.map((r) => [r.productName, r.units])).toEqual([
      ['Arroz', 30],
      ['Açúcar', 20],
      ['Óleo', 10],
    ]);
  });

  it('tie-breaks by product name ascending', () => {
    const orders = ['p1', 'p2'].map((pid) => ({
      ...ORDER,
      id: `o-${pid}`,
      sentAtMs: ms(2026, 4, 5),
      createdAtMs: ms(2026, 4, 1),
    }));
    const items: OrderItemRow[] = [
      { id: 'i1', orderId: 'o-p1', productVariantId: 'v', productId: 'p1', quantity: 5, unitPrice: 1, discountAmount: 0 },
      { id: 'i2', orderId: 'o-p2', productVariantId: 'v', productId: 'p2', quantity: 5, unitPrice: 1, discountAmount: 0 },
    ];
    const products: [string, string][] = [
      ['p1', 'Beta'],
      ['p2', 'Alpha'],
    ];
    expect(
      deriveTopProducts(input(orders, items, products)).map((r) => r.productName),
    ).toEqual(['Alpha', 'Beta']);
  });

  it('aggregates units across multiple line items of the same product', () => {
    const orders = [
      { ...ORDER, id: 'o-1', sentAtMs: ms(2026, 4, 5), createdAtMs: ms(2026, 4, 1) },
      { ...ORDER, id: 'o-2', sentAtMs: ms(2026, 4, 6), createdAtMs: ms(2026, 4, 2) },
    ];
    const items: OrderItemRow[] = [
      { id: 'i1', orderId: 'o-1', productVariantId: 'v', productId: 'p1', quantity: 3, unitPrice: 1, discountAmount: 0 },
      { id: 'i2', orderId: 'o-2', productVariantId: 'v', productId: 'p1', quantity: 4, unitPrice: 1, discountAmount: 0 },
    ];
    const result = deriveTopProducts(input(orders, items, [['p1', 'X']]));
    expect(result).toEqual([{ productId: 'p1', productName: 'X', units: 7 }]);
  });
});
