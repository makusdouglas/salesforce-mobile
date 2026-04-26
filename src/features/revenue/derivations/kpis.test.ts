import { deriveKpis } from './kpis';
import type { DerivationInput, OrderRow, OrderItemRow, PaymentReceiptRow } from './types';

const APR_2026 = '2026-04';

function ms(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

function order(
  id: string,
  status: 'draft' | 'sent' | 'canceled',
  sentMs: number | null,
  createdMs: number,
  discount = 0,
): OrderRow {
  return {
    id,
    clientId: 'c1',
    salespersonId: 'sp1',
    status,
    discountAmount: discount,
    createdAtMs: createdMs,
    sentAtMs: sentMs,
    canceledAtMs: null,
  };
}

function item(orderId: string, qty: number, price: number): OrderItemRow {
  return {
    id: `it-${orderId}-${Math.random()}`,
    orderId,
    productVariantId: 'v1',
    productId: 'p1',
    quantity: qty,
    unitPrice: price,
    discountAmount: 0,
  };
}

function receipt(orderId: string, amount: number, ms: number): PaymentReceiptRow {
  return { id: `r-${orderId}-${Math.random()}`, orderId, amount, receivedAtMs: ms };
}

function makeInput(
  orders: OrderRow[],
  items: OrderItemRow[],
  receipts: PaymentReceiptRow[],
  month = APR_2026,
): DerivationInput {
  return {
    orders,
    items,
    receipts,
    clientNameById: new Map(),
    productNameById: new Map(),
    filter: {
      sellerId: 'sp1',
      month,
      trendFrom: '2025-05',
      trendTo: month,
    },
    nowMs: ms(2026, 4, 25),
  };
}

describe('deriveKpis', () => {
  it('returns 5 KPI rows in fixed label order', () => {
    const result = deriveKpis(makeInput([], [], []));
    expect(result).toHaveLength(5);
    expect(result.map((k) => k.label)).toEqual([
      'recebido',
      'faturado',
      'pendente',
      'ticket_medio',
      'pedidos_enviados',
    ]);
  });

  it('returns zero values + null deltas on empty input', () => {
    const result = deriveKpis(makeInput([], [], []));
    for (const k of result) {
      expect(k.currentValue).toBe(0);
      expect(k.previousValue).toBeNull();
      expect(k.deltaPct).toBeNull();
      expect(k.deltaDirection).toBeNull();
    }
  });

  it('aggregates Recebido from receipts whose parent sent_at is in the month', () => {
    const o1 = order('o1', 'sent', ms(2026, 4, 5), ms(2026, 4, 1));
    const o2 = order('o2', 'sent', ms(2026, 3, 5), ms(2026, 3, 1));
    const input = makeInput(
      [o1, o2],
      [item('o1', 2, 100), item('o2', 1, 50)],
      [receipt('o1', 80, ms(2026, 4, 10)), receipt('o2', 50, ms(2026, 3, 10))],
    );
    const kpis = deriveKpis(input);
    const recebido = kpis.find((k) => k.label === 'recebido')!;
    expect(recebido.currentValue).toBe(80);
    expect(recebido.previousValue).toBe(50);
  });

  it('Ticket médio = faturado / count, returns 0 when count is 0', () => {
    const o = order('o1', 'sent', ms(2026, 4, 1), ms(2026, 4, 1));
    const input = makeInput([o], [item('o1', 4, 25)], []); // total = 100
    const kpis = deriveKpis(input);
    const ticket = kpis.find((k) => k.label === 'ticket_medio')!;
    expect(ticket.currentValue).toBe(100);
    expect(ticket.previousValue).toBeNull();
  });

  it('Ticket médio is 0 (not NaN) when there are no sent orders', () => {
    const input = makeInput([], [], []);
    const ticket = deriveKpis(input).find((k) => k.label === 'ticket_medio')!;
    expect(ticket.currentValue).toBe(0);
  });

  it('Pendente = max(0, total − sum receipts) for sent orders in the month', () => {
    const o1 = order('o1', 'sent', ms(2026, 4, 5), ms(2026, 4, 1));
    const input = makeInput(
      [o1],
      [item('o1', 1, 100)],
      [receipt('o1', 30, ms(2026, 4, 10))],
    );
    const pendente = deriveKpis(input).find((k) => k.label === 'pendente')!;
    expect(pendente.currentValue).toBe(70);
  });

  it('drafts and cancelled orders are excluded from sent-only metrics', () => {
    const draft = order('d1', 'draft', null, ms(2026, 4, 5));
    const cancel = order(
      'c1',
      'canceled',
      ms(2026, 4, 5),
      ms(2026, 4, 1),
    );
    const input = makeInput(
      [draft, cancel],
      [item('d1', 1, 50), item('c1', 1, 50)],
      [],
    );
    const kpis = deriveKpis(input);
    expect(kpis.find((k) => k.label === 'pendente')!.currentValue).toBe(0);
    expect(kpis.find((k) => k.label === 'pedidos_enviados')!.currentValue).toBe(0);
  });

  it('previous = null when previous month has no relevant data', () => {
    const o = order('o1', 'sent', ms(2026, 4, 5), ms(2026, 4, 1));
    const input = makeInput([o], [item('o1', 1, 100)], []);
    for (const k of deriveKpis(input)) {
      expect(k.previousValue).toBeNull();
      expect(k.deltaPct).toBeNull();
    }
  });

  it('delta direction is up when current >= previous, down when below', () => {
    const o1 = order('o1', 'sent', ms(2026, 4, 5), ms(2026, 4, 1));
    const o2 = order('o2', 'sent', ms(2026, 3, 5), ms(2026, 3, 1));
    const input = makeInput(
      [o1, o2],
      [item('o1', 1, 200), item('o2', 1, 100)],
      [],
    );
    const fat = deriveKpis(input).find((k) => k.label === 'faturado')!;
    expect(fat.currentValue).toBe(200);
    expect(fat.previousValue).toBe(100);
    expect(fat.deltaDirection).toBe('up');
  });
});

// Make sure we don't accidentally export a default that breaks treeshaking.
test('module has only named exports', async () => {
  const mod = (await import('./kpis')) as Record<string, unknown>;
  expect(mod.default).toBeUndefined();
});
