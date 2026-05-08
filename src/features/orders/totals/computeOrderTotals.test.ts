import { describe, expect, it } from '@jest/globals';

import { computeOrderTotals } from './computeOrderTotals';
import type { DiscountInput, OrderForTotals, OrderLineForTotals } from './types';

const noDiscount: DiscountInput = { mode: 'amount', value: 0 };

function line(
  overrides: Partial<OrderLineForTotals> & { id: string; quantity: number; unitPrice: number },
): OrderLineForTotals {
  return { discount: noDiscount, ...overrides };
}

function order(discount: DiscountInput = noDiscount): OrderForTotals {
  return { discount };
}

describe('computeOrderTotals', () => {
  it('returns zeros for an empty order', () => {
    const t = computeOrderTotals(order(), []);
    expect(t.subtotal).toBe(0);
    expect(t.lineDiscountsTotal).toBe(0);
    expect(t.postLineSubtotal).toBe(0);
    expect(t.orderDiscount).toBe(0);
    expect(t.total).toBe(0);
    expect(t.perLine).toEqual([]);
    expect(t.warnings).toEqual([]);
  });

  it('sums subtotal across lines with no discount', () => {
    const t = computeOrderTotals(order(), [
      line({ id: 'a', quantity: 2, unitPrice: 10 }),
      line({ id: 'b', quantity: 1, unitPrice: 5.5 }),
    ]);
    expect(t.subtotal).toBe(25.5);
    expect(t.total).toBe(25.5);
    expect(t.perLine).toHaveLength(2);
    expect(t.perLine[0]?.lineTotal).toBe(20);
    expect(t.perLine[1]?.lineTotal).toBe(5.5);
  });

  it('applies a percent line discount', () => {
    const t = computeOrderTotals(order(), [
      line({ id: 'a', quantity: 1, unitPrice: 39, discount: { mode: 'percent', value: 10 } }),
    ]);
    expect(t.perLine[0]?.lineDiscountAmount).toBeCloseTo(3.9, 6);
    expect(t.perLine[0]?.lineTotal).toBeCloseTo(35.1, 6);
    expect(t.total).toBeCloseTo(35.1, 6);
    expect(t.warnings).toEqual([]);
  });

  it('applies an amount line discount', () => {
    const t = computeOrderTotals(order(), [
      line({ id: 'a', quantity: 2, unitPrice: 10, discount: { mode: 'amount', value: 3 } }),
    ]);
    expect(t.perLine[0]?.lineDiscountAmount).toBe(3);
    expect(t.perLine[0]?.lineTotal).toBe(17);
  });

  it('clamps line percent > 100 and emits a warning', () => {
    const t = computeOrderTotals(order(), [
      line({ id: 'a', quantity: 1, unitPrice: 10, discount: { mode: 'percent', value: 150 } }),
    ]);
    expect(t.perLine[0]?.lineTotal).toBe(0);
    expect(t.warnings).toContainEqual({ kind: 'line-percent-over-100', lineId: 'a' });
  });

  it('clamps amount line discount > subtotal and emits a warning', () => {
    const t = computeOrderTotals(order(), [
      line({ id: 'a', quantity: 1, unitPrice: 10, discount: { mode: 'amount', value: 50 } }),
    ]);
    expect(t.perLine[0]?.lineTotal).toBe(0);
    expect(t.warnings).toContainEqual({ kind: 'line-amount-over-subtotal', lineId: 'a' });
  });

  it('applies an order-level percent discount to postLineSubtotal', () => {
    const t = computeOrderTotals(order({ mode: 'percent', value: 10 }), [
      line({ id: 'a', quantity: 2, unitPrice: 10 }),
    ]);
    expect(t.postLineSubtotal).toBe(20);
    expect(t.orderDiscount).toBe(2);
    expect(t.total).toBe(18);
  });

  it('composes line + order discounts sequentially (not additively)', () => {
    // 2 × R$ 10,00 = R$ 20,00; 10% line discount → R$ 18,00;
    // 10% order discount on R$ 18,00 → R$ 1,80; total R$ 16,20.
    const t = computeOrderTotals(order({ mode: 'percent', value: 10 }), [
      line({ id: 'a', quantity: 2, unitPrice: 10, discount: { mode: 'percent', value: 10 } }),
    ]);
    expect(t.postLineSubtotal).toBe(18);
    expect(t.orderDiscount).toBeCloseTo(1.8, 6);
    expect(t.total).toBeCloseTo(16.2, 6);
  });

  it('clamps order percent > 100 and emits a warning', () => {
    const t = computeOrderTotals(order({ mode: 'percent', value: 200 }), [
      line({ id: 'a', quantity: 1, unitPrice: 10 }),
    ]);
    expect(t.total).toBe(0);
    expect(t.warnings).toContainEqual({ kind: 'order-percent-over-100' });
  });

  it('clamps order amount > postLineSubtotal and emits a warning', () => {
    const t = computeOrderTotals(order({ mode: 'amount', value: 100 }), [
      line({ id: 'a', quantity: 1, unitPrice: 10 }),
    ]);
    expect(t.total).toBe(0);
    expect(t.warnings).toContainEqual({ kind: 'order-amount-over-subtotal' });
  });

  it('never produces negative totals', () => {
    const t = computeOrderTotals(order({ mode: 'amount', value: 999 }), [
      line({ id: 'a', quantity: 1, unitPrice: 1 }),
    ]);
    expect(t.total).toBeGreaterThanOrEqual(0);
    expect(t.perLine[0]?.lineTotal).toBeGreaterThanOrEqual(0);
  });

  it('ignores a negative-value discount as if it were zero', () => {
    const t = computeOrderTotals(order({ mode: 'amount', value: -5 }), [
      line({ id: 'a', quantity: 1, unitPrice: 10, discount: { mode: 'percent', value: -1 } }),
    ]);
    expect(t.orderDiscount).toBe(0);
    expect(t.perLine[0]?.lineDiscountAmount).toBe(0);
    expect(t.total).toBe(10);
  });
});
