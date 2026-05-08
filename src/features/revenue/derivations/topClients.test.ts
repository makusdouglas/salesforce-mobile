import { deriveTopClients } from './topClients';
import type { DerivationInput, OrderRow, PaymentReceiptRow } from './types';

function ms(year: number, month: number, day = 15): number {
  return new Date(year, month - 1, day, 12).getTime();
}

const PROTO: Omit<OrderRow, 'id' | 'clientId' | 'sentAtMs' | 'createdAtMs'> = {
  salespersonId: 'sp1',
  status: 'sent',
  discountAmount: 0,
  canceledAtMs: null,
};

function makeInput(args: {
  orders: OrderRow[];
  receipts: PaymentReceiptRow[];
  clients: readonly (readonly [string, string])[];
}): DerivationInput {
  return {
    orders: args.orders,
    items: [],
    receipts: args.receipts,
    clientNameById: new Map(args.clients),
    productNameById: new Map(),
    filter: {
      sellerId: 'sp1',
      month: '2026-04',
      trendFrom: '2025-05',
      trendTo: '2026-04',
    },
    nowMs: ms(2026, 4, 25),
  };
}

describe('deriveTopClients', () => {
  it('returns [] for empty input', () => {
    expect(deriveTopClients(makeInput({ orders: [], receipts: [], clients: [] }))).toEqual([]);
  });

  it('caps at 3 entries sorted desc', () => {
    // All orders fall inside the default trend window (2025-05 .. 2026-04).
    const orders: OrderRow[] = ['c1', 'c2', 'c3', 'c4', 'c5'].map((cid, i) => ({
      ...PROTO,
      id: `o-${cid}`,
      clientId: cid,
      sentAtMs: ms(2025, 12 - i, 5),
      createdAtMs: ms(2025, 12 - i, 1),
    }));
    const receipts: PaymentReceiptRow[] = [
      { id: 'r1', orderId: 'o-c1', amount: 50, receivedAtMs: ms(2025, 12, 10) },
      { id: 'r2', orderId: 'o-c2', amount: 200, receivedAtMs: ms(2025, 11, 10) },
      { id: 'r3', orderId: 'o-c3', amount: 100, receivedAtMs: ms(2025, 10, 10) },
      { id: 'r4', orderId: 'o-c4', amount: 300, receivedAtMs: ms(2025, 9, 10) },
      { id: 'r5', orderId: 'o-c5', amount: 250, receivedAtMs: ms(2025, 8, 10) },
    ];
    const result = deriveTopClients(
      makeInput({
        orders,
        receipts,
        clients: [
          ['c1', 'Alpha'],
          ['c2', 'Beta'],
          ['c3', 'Gamma'],
          ['c4', 'Delta'],
          ['c5', 'Epsilon'],
        ],
      }),
    );
    expect(result).toHaveLength(3);
    expect(result.map((r) => [r.clientName, r.recebido])).toEqual([
      ['Delta', 300],
      ['Epsilon', 250],
      ['Beta', 200],
    ]);
  });

  it('tie-breaks ties by client name ascending (pt-BR)', () => {
    const orders: OrderRow[] = ['c1', 'c2'].map((cid) => ({
      ...PROTO,
      id: `o-${cid}`,
      clientId: cid,
      sentAtMs: ms(2026, 4, 5),
      createdAtMs: ms(2026, 4, 1),
    }));
    const receipts: PaymentReceiptRow[] = [
      { id: 'r1', orderId: 'o-c1', amount: 100, receivedAtMs: ms(2026, 4, 10) },
      { id: 'r2', orderId: 'o-c2', amount: 100, receivedAtMs: ms(2026, 4, 11) },
    ];
    const result = deriveTopClients(
      makeInput({
        orders,
        receipts,
        clients: [
          ['c1', 'Bruno'],
          ['c2', 'Ana'],
        ],
      }),
    );
    expect(result.map((r) => r.clientName)).toEqual(['Ana', 'Bruno']);
  });

  it('excludes clients with zero received', () => {
    const orders: OrderRow[] = [
      { ...PROTO, id: 'o', clientId: 'c1', sentAtMs: ms(2026, 4), createdAtMs: ms(2026, 4) },
    ];
    expect(
      deriveTopClients(
        makeInput({ orders, receipts: [], clients: [['c1', 'Empty']] }),
      ),
    ).toEqual([]);
  });
});
