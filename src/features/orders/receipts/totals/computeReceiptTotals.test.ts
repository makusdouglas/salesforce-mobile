/**
 * 012-payment-receipts: computeReceiptTotals behaviour lock.
 * Contract: specs/012-payment-receipts/contracts/computeReceiptTotals.ts.
 */

import { computeReceiptTotals } from './computeReceiptTotals';

describe('computeReceiptTotals', () => {
  it('empty receipts: received=0, outstanding=total, no flags', () => {
    const out = computeReceiptTotals({ orderTotalCents: 42000, receipts: [] });
    expect(out).toEqual({
      totalCents: 42000,
      receivedCents: 0,
      outstandingCents: 42000,
      hasOverpayment: false,
      hasNegativeBalance: false,
      progressRatio: 0,
    });
  });

  it('single partial payment: outstanding = total − received', () => {
    const out = computeReceiptTotals({
      orderTotalCents: 42000,
      receipts: [{ amount: 15000 }],
    });
    expect(out.receivedCents).toBe(15000);
    expect(out.outstandingCents).toBe(27000);
    expect(out.hasOverpayment).toBe(false);
    expect(out.hasNegativeBalance).toBe(false);
    expect(out.progressRatio).toBeCloseTo(15000 / 42000);
  });

  it('multiple receipts + negative correction sum correctly', () => {
    // Pix 150 + Cash 100 − 10 correction = 240
    const out = computeReceiptTotals({
      orderTotalCents: 42000,
      receipts: [{ amount: 15000 }, { amount: 10000 }, { amount: -1000 }],
    });
    expect(out.receivedCents).toBe(24000);
    expect(out.outstandingCents).toBe(18000);
    expect(out.hasOverpayment).toBe(false);
    expect(out.hasNegativeBalance).toBe(false);
  });

  it('exact payment: outstanding=0, not overpayment', () => {
    const out = computeReceiptTotals({
      orderTotalCents: 42000,
      receipts: [{ amount: 42000 }],
    });
    expect(out.outstandingCents).toBe(0);
    expect(out.hasOverpayment).toBe(false);
    expect(out.progressRatio).toBe(1);
  });

  it('overpayment: outstanding clamps at 0 and hasOverpayment flips true', () => {
    const out = computeReceiptTotals({
      orderTotalCents: 42000,
      receipts: [{ amount: 50000 }],
    });
    expect(out.receivedCents).toBe(50000);
    expect(out.outstandingCents).toBe(0);
    expect(out.hasOverpayment).toBe(true);
    expect(out.hasNegativeBalance).toBe(false);
    expect(out.progressRatio).toBe(1);
  });

  it('over-correction drives received < 0 → hasNegativeBalance', () => {
    // A lone correction of −R$ 10,00 with nothing else.
    const out = computeReceiptTotals({
      orderTotalCents: 42000,
      receipts: [{ amount: -1000 }],
    });
    expect(out.receivedCents).toBe(-1000);
    // outstanding = max(total − received, 0) = max(42000 − (−1000), 0) = 43000.
    // Over-correction increases the "owed" figure — the clamp only fires on overpayment.
    expect(out.outstandingCents).toBe(43000);
    expect(out.hasOverpayment).toBe(false);
    expect(out.hasNegativeBalance).toBe(true);
    expect(out.progressRatio).toBe(0); // clamped from negative
  });

  it('orderTotalCents = 0 edge: progressRatio is 0, no divide-by-zero', () => {
    const out = computeReceiptTotals({
      orderTotalCents: 0,
      receipts: [{ amount: 100 }],
    });
    expect(out.progressRatio).toBe(0);
    expect(out.outstandingCents).toBe(0); // max(0 − 100, 0) === 0
    expect(out.hasOverpayment).toBe(true);
  });

  it('progressRatio clamps to 1 even when receivedCents > totalCents', () => {
    const out = computeReceiptTotals({
      orderTotalCents: 100,
      receipts: [{ amount: 500 }],
    });
    expect(out.progressRatio).toBe(1);
  });
});
