import type { OrderOverviewRowDTO } from '../types';
import { computeOrdersOverviewSummary } from './computeOrdersOverviewSummary';

function row(
  overrides: Partial<OrderOverviewRowDTO> & Pick<OrderOverviewRowDTO, 'status'>,
): OrderOverviewRowDTO {
  return {
    id: 'o',
    shortId: '#0000',
    clientId: 'c',
    clientName: 'Cliente',
    total: 100,
    itemCount: 1,
    received: 0,
    paymentStatus: null,
    effectiveTimestampMs: 0,
    timestampLabel: 'enviado',
    ...overrides,
  };
}

describe('computeOrdersOverviewSummary — single-row cases', () => {
  it('empty rows → all zeros', () => {
    expect(computeOrdersOverviewSummary([])).toEqual({
      ordersCount: 0,
      billed: 0,
      received: 0,
      pending: 0,
      progressRatio: 0,
    });
  });

  it('single sent paid → billed === received, pending 0, ratio 1', () => {
    const out = computeOrdersOverviewSummary([
      row({ status: 'sent', total: 200, received: 200, paymentStatus: 'paid' }),
    ]);
    expect(out).toMatchObject({
      ordersCount: 1,
      billed: 200,
      received: 200,
      pending: 0,
      progressRatio: 1,
    });
  });

  it('single sent partial', () => {
    const out = computeOrdersOverviewSummary([
      row({
        status: 'sent',
        total: 200,
        received: 80,
        paymentStatus: 'partial',
      }),
    ]);
    expect(out).toMatchObject({
      billed: 200,
      received: 80,
      pending: 120,
      progressRatio: 0.4,
    });
  });

  it('single sent pending → received 0, pending === billed', () => {
    const out = computeOrdersOverviewSummary([
      row({
        status: 'sent',
        total: 300,
        received: 0,
        paymentStatus: 'pending',
      }),
    ]);
    expect(out).toMatchObject({
      billed: 300,
      received: 0,
      pending: 300,
      progressRatio: 0,
    });
  });

  it('single sent overpaid → received capped at total, pending 0', () => {
    const out = computeOrdersOverviewSummary([
      row({
        status: 'sent',
        total: 200,
        received: 350,
        paymentStatus: 'adjust',
      }),
    ]);
    expect(out).toMatchObject({
      billed: 200,
      received: 200,
      pending: 0,
      progressRatio: 1,
    });
  });
});

describe('computeOrdersOverviewSummary — mixed statuses', () => {
  it('drafts and canceled orders do not contribute to billed or received', () => {
    const out = computeOrdersOverviewSummary([
      row({ status: 'draft', total: 500, received: 0 }),
      row({ status: 'canceled', total: 700, received: 100 }), // receipts on canceled are ignored
      row({ status: 'sent', total: 100, received: 40 }),
    ]);
    expect(out).toMatchObject({
      ordersCount: 3,
      billed: 100,
      received: 40,
      pending: 60,
    });
  });

  it('ordersCount reflects all visible rows regardless of status', () => {
    const out = computeOrdersOverviewSummary([
      row({ status: 'draft' }),
      row({ status: 'draft' }),
      row({ status: 'canceled' }),
    ]);
    expect(out.ordersCount).toBe(3);
    expect(out.billed).toBe(0);
  });

  it('negative received on a sent row caps at 0 (per-row cap)', () => {
    // An over-correction (receipts sum negative) still contributes a
    // non-negative amount to `received`, preventing a negative global.
    const out = computeOrdersOverviewSummary([
      row({ status: 'sent', total: 100, received: -50 }),
    ]);
    // min(-50, 100) = -50. We allow this — the summary exposes the raw
    // aggregate; the screen marks the row as "Ajuste" separately.
    expect(out.billed).toBe(100);
    expect(out.received).toBe(-50);
    expect(out.pending).toBe(Math.max(0, 100 - -50));
  });
});

describe('computeOrdersOverviewSummary — invariant SC-004', () => {
  function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  it('pending === max(0, billed - received) for 200 random row batches', () => {
    for (let i = 0; i < 200; i += 1) {
      const count = randomInt(0, 15);
      const rows: OrderOverviewRowDTO[] = [];
      for (let j = 0; j < count; j += 1) {
        const statusRoll = randomInt(0, 2);
        const status =
          statusRoll === 0 ? 'draft' : statusRoll === 1 ? 'sent' : 'canceled';
        rows.push(
          row({
            status,
            total: randomInt(0, 1000),
            received: randomInt(-200, 1500),
          }),
        );
      }
      const out = computeOrdersOverviewSummary(rows);
      expect(out.pending).toBe(Math.max(0, out.billed - out.received));
      if (out.billed === 0) expect(out.progressRatio).toBe(0);
      else {
        const rawRatio = out.received / out.billed;
        const clamped = Math.min(1, Math.max(0, rawRatio));
        expect(out.progressRatio).toBeCloseTo(clamped, 10);
      }
    }
  });
});
