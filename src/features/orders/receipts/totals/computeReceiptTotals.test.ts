/**
 * 012-payment-receipts: computeReceiptTotals behaviour lock.
 * Unit convention: BRL decimals (e.g. 194.50). Matches the rest of the
 * codebase (see computeOrderTotals).
 */

import { computeReceiptTotals } from './computeReceiptTotals';

describe('computeReceiptTotals', () => {
  it('empty receipts: received=0, outstanding=total, no flags', () => {
    const out = computeReceiptTotals({ orderTotal: 420, receipts: [] });
    expect(out).toEqual({
      total: 420,
      received: 0,
      outstanding: 420,
      hasOverpayment: false,
      hasNegativeBalance: false,
      progressRatio: 0,
    });
  });

  it('single partial payment: outstanding = total − received', () => {
    const out = computeReceiptTotals({
      orderTotal: 420,
      receipts: [{ amount: 150 }],
    });
    expect(out.received).toBe(150);
    expect(out.outstanding).toBe(270);
    expect(out.hasOverpayment).toBe(false);
    expect(out.hasNegativeBalance).toBe(false);
    expect(out.progressRatio).toBeCloseTo(150 / 420);
  });

  it('multiple receipts + negative correction sum correctly', () => {
    // Pix 150 + Cash 100 − 10 correction = 240
    const out = computeReceiptTotals({
      orderTotal: 420,
      receipts: [{ amount: 150 }, { amount: 100 }, { amount: -10 }],
    });
    expect(out.received).toBe(240);
    expect(out.outstanding).toBe(180);
    expect(out.hasOverpayment).toBe(false);
    expect(out.hasNegativeBalance).toBe(false);
  });

  it('exact payment: outstanding=0, not overpayment', () => {
    const out = computeReceiptTotals({
      orderTotal: 420,
      receipts: [{ amount: 420 }],
    });
    expect(out.outstanding).toBe(0);
    expect(out.hasOverpayment).toBe(false);
    expect(out.progressRatio).toBe(1);
  });

  it('overpayment: outstanding clamps at 0 and hasOverpayment flips true', () => {
    const out = computeReceiptTotals({
      orderTotal: 420,
      receipts: [{ amount: 500 }],
    });
    expect(out.received).toBe(500);
    expect(out.outstanding).toBe(0);
    expect(out.hasOverpayment).toBe(true);
    expect(out.hasNegativeBalance).toBe(false);
    expect(out.progressRatio).toBe(1);
  });

  it('over-correction drives received < 0 → hasNegativeBalance', () => {
    const out = computeReceiptTotals({
      orderTotal: 420,
      receipts: [{ amount: -10 }],
    });
    expect(out.received).toBe(-10);
    // outstanding = max(total − received, 0) = max(420 − (−10), 0) = 430.
    // Over-correction increases the "owed" figure — the clamp only fires on overpayment.
    expect(out.outstanding).toBe(430);
    expect(out.hasOverpayment).toBe(false);
    expect(out.hasNegativeBalance).toBe(true);
    expect(out.progressRatio).toBe(0); // clamped from negative
  });

  it('orderTotal = 0 edge: progressRatio is 0, no divide-by-zero', () => {
    const out = computeReceiptTotals({
      orderTotal: 0,
      receipts: [{ amount: 1 }],
    });
    expect(out.progressRatio).toBe(0);
    expect(out.outstanding).toBe(0); // max(0 − 1, 0) === 0
    expect(out.hasOverpayment).toBe(true);
  });

  it('progressRatio clamps to 1 even when received > total', () => {
    const out = computeReceiptTotals({
      orderTotal: 100,
      receipts: [{ amount: 500 }],
    });
    expect(out.progressRatio).toBe(1);
  });

  it('realistic BRL decimals with cents: 194.50 order, 150.00 received', () => {
    const out = computeReceiptTotals({
      orderTotal: 194.5,
      receipts: [{ amount: 150 }],
    });
    expect(out.received).toBeCloseTo(150);
    expect(out.outstanding).toBeCloseTo(44.5);
    expect(out.hasOverpayment).toBe(false);
  });
});
