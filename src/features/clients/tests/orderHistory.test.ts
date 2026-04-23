import {
  deriveOrderHistoryRow,
  sortByRecentFirst,
  type OrderItemLike,
  type OrderLike,
} from '../orders/deriveOrderHistory';

const baseOrder: OrderLike = {
  id: 'o1',
  createdAtMs: 1_700_000_000_000,
  sentAtMs: null,
  canceledAtMs: null,
  status: 'draft',
  discountAmount: 0,
};

function item(quantity: number, unitPrice: number, discount = 0): OrderItemLike {
  return { quantity, unitPrice, discountAmount: discount };
}

describe('deriveOrderHistoryRow', () => {
  test('sums q*p when no discounts', () => {
    const row = deriveOrderHistoryRow(baseOrder, [item(2, 10), item(3, 4)]);
    expect(row.total).toBe(2 * 10 + 3 * 4); // 32
    expect(row.itemCount).toBe(2);
  });

  test('subtracts item discounts from subtotal', () => {
    const row = deriveOrderHistoryRow(baseOrder, [item(2, 10, 5), item(1, 7)]);
    // 2*10 - 5 + 1*7 - 0 = 22
    expect(row.total).toBe(22);
  });

  test('subtracts order discount from subtotal', () => {
    const row = deriveOrderHistoryRow(
      { ...baseOrder, discountAmount: 3 },
      [item(2, 10)],
    );
    // 20 - 3 = 17
    expect(row.total).toBe(17);
  });

  test('clamps to zero when order discount exceeds subtotal', () => {
    const row = deriveOrderHistoryRow(
      { ...baseOrder, discountAmount: 50 },
      [item(1, 10)],
    );
    expect(row.total).toBe(0);
  });

  test('empty items: total is 0 (clamped from -order.discount)', () => {
    const row = deriveOrderHistoryRow({ ...baseOrder, discountAmount: 10 }, []);
    expect(row.total).toBe(0);
    expect(row.itemCount).toBe(0);
  });

  test('empty items with zero order discount: total is 0', () => {
    const row = deriveOrderHistoryRow(baseOrder, []);
    expect(row.total).toBe(0);
    expect(row.itemCount).toBe(0);
  });

  test('canceled orders still produce a total', () => {
    const row = deriveOrderHistoryRow(
      { ...baseOrder, status: 'canceled' },
      [item(1, 10)],
    );
    expect(row.status).toBe('canceled');
    expect(row.total).toBe(10);
  });

  test('preserves id, status; uses sentAtMs for sent orders', () => {
    const row = deriveOrderHistoryRow(
      {
        id: 'o2',
        createdAtMs: 42,
        sentAtMs: 99,
        canceledAtMs: null,
        status: 'sent',
        discountAmount: 0,
      },
      [],
    );
    expect(row.id).toBe('o2');
    expect(row.status).toBe('sent');
    // effective timestamp: sentAtMs for sent orders (falls through to
    // createdAtMs when sentAtMs is null, then again for drafts).
    expect(row.createdAtMs).toBe(99);
  });

  test('uses canceledAtMs for canceled orders', () => {
    const row = deriveOrderHistoryRow(
      {
        id: 'o3',
        createdAtMs: 10,
        sentAtMs: null,
        canceledAtMs: 55,
        status: 'canceled',
        discountAmount: 0,
      },
      [],
    );
    expect(row.createdAtMs).toBe(55);
  });

  test('drafts keep createdAtMs as the effective timestamp', () => {
    const row = deriveOrderHistoryRow(
      {
        id: 'o4',
        createdAtMs: 20,
        sentAtMs: null,
        canceledAtMs: null,
        status: 'draft',
        discountAmount: 0,
      },
      [],
    );
    expect(row.createdAtMs).toBe(20);
  });
});

describe('sortByRecentFirst', () => {
  test('orders rows by createdAtMs descending', () => {
    const rows = [
      { id: 'a', createdAtMs: 1, status: 'draft', total: 0, itemCount: 0 },
      { id: 'b', createdAtMs: 3, status: 'sent', total: 0, itemCount: 0 },
      { id: 'c', createdAtMs: 2, status: 'canceled', total: 0, itemCount: 0 },
    ] as const;
    const sorted = sortByRecentFirst(rows);
    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  test('empty input returns empty', () => {
    expect(sortByRecentFirst([])).toEqual([]);
  });
});
