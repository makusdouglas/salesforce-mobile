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
      {
        id: 'a',
        createdAtMs: 1,
        status: 'draft',
        total: 0,
        itemCount: 0,
        received: 0,
        paymentStatus: null,
      },
      {
        id: 'b',
        createdAtMs: 3,
        status: 'sent',
        total: 0,
        itemCount: 0,
        received: 0,
        paymentStatus: 'pending',
      },
      {
        id: 'c',
        createdAtMs: 2,
        status: 'canceled',
        total: 0,
        itemCount: 0,
        received: 0,
        paymentStatus: null,
      },
    ] as const;
    const sorted = sortByRecentFirst(rows);
    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  test('empty input returns empty', () => {
    expect(sortByRecentFirst([])).toEqual([]);
  });
});

describe('deriveOrderHistoryRow — payment status (012-payment-receipts)', () => {
  const sent: OrderLike = {
    id: 'o-sent',
    createdAtMs: 1,
    sentAtMs: 2,
    canceledAtMs: null,
    status: 'sent',
    discountAmount: 0,
  };
  const items = [item(1, 100)]; // total = 100

  test('no receipts on a sent order → pending, received=0', () => {
    const row = deriveOrderHistoryRow(sent, items, []);
    expect(row.received).toBe(0);
    expect(row.paymentStatus).toBe('pending');
  });

  test('partial payment → partial', () => {
    const row = deriveOrderHistoryRow(sent, items, [{ amount: 30 }]);
    expect(row.received).toBe(30);
    expect(row.paymentStatus).toBe('partial');
  });

  test('exact payment → paid (EPS tolerance)', () => {
    const row = deriveOrderHistoryRow(sent, items, [{ amount: 100 }]);
    expect(row.paymentStatus).toBe('paid');
  });

  test('overpayment → adjust', () => {
    const row = deriveOrderHistoryRow(sent, items, [{ amount: 150 }]);
    expect(row.paymentStatus).toBe('adjust');
  });

  test('over-correction (received < 0) → adjust', () => {
    const row = deriveOrderHistoryRow(sent, items, [
      { amount: 10 },
      { amount: -50 },
    ]);
    expect(row.received).toBe(-40);
    expect(row.paymentStatus).toBe('adjust');
  });

  test('multiple receipts summing to exactly total → paid', () => {
    const row = deriveOrderHistoryRow(sent, items, [
      { amount: 60 },
      { amount: 40 },
    ]);
    expect(row.received).toBe(100);
    expect(row.paymentStatus).toBe('paid');
  });

  test('correction bringing total to exact → paid', () => {
    // 60 + 50 − 10 = 100
    const row = deriveOrderHistoryRow(sent, items, [
      { amount: 60 },
      { amount: 50 },
      { amount: -10 },
    ]);
    expect(row.paymentStatus).toBe('paid');
  });

  test('drafts ignore receipts (paymentStatus null)', () => {
    const row = deriveOrderHistoryRow(
      { ...sent, status: 'draft' },
      items,
      [{ amount: 100 }],
    );
    expect(row.paymentStatus).toBeNull();
  });

  test('canceled ignores receipts (paymentStatus null)', () => {
    const row = deriveOrderHistoryRow(
      { ...sent, status: 'canceled' },
      items,
      [{ amount: 100 }],
    );
    expect(row.paymentStatus).toBeNull();
  });

  test('omitting receipts yields received=0 and status=pending for sent', () => {
    const row = deriveOrderHistoryRow(sent, items);
    expect(row.received).toBe(0);
    expect(row.paymentStatus).toBe('pending');
  });
});
