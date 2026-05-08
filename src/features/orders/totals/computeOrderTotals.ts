// 009-order-assembly: pure totals derivation.
// No Watermelon imports, no side effects — callable from tests as a plain
// function. See data-model.md § Derivation.

import type {
  DiscountInput,
  DiscountWarning,
  OrderForTotals,
  OrderLineForTotals,
  OrderTotals,
  PerLineTotal,
} from './types';

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function resolveLineDiscount(
  discount: DiscountInput,
  lineSubtotal: number,
  lineId: string,
  warnings: DiscountWarning[],
): number {
  if (discount.value <= 0) return 0;
  if (discount.mode === 'percent') {
    const pct = clamp(discount.value, 0, 100);
    if (discount.value > 100) warnings.push({ kind: 'line-percent-over-100', lineId });
    return (lineSubtotal * pct) / 100;
  }
  const resolved = clamp(discount.value, 0, lineSubtotal);
  if (discount.value > lineSubtotal) warnings.push({ kind: 'line-amount-over-subtotal', lineId });
  return resolved;
}

function resolveOrderDiscount(
  discount: DiscountInput,
  postLineSubtotal: number,
  warnings: DiscountWarning[],
): number {
  if (discount.value <= 0) return 0;
  if (discount.mode === 'percent') {
    const pct = clamp(discount.value, 0, 100);
    if (discount.value > 100) warnings.push({ kind: 'order-percent-over-100' });
    return (postLineSubtotal * pct) / 100;
  }
  const resolved = clamp(discount.value, 0, postLineSubtotal);
  if (discount.value > postLineSubtotal) warnings.push({ kind: 'order-amount-over-subtotal' });
  return resolved;
}

export function computeOrderTotals(
  order: OrderForTotals,
  lines: readonly OrderLineForTotals[],
): OrderTotals {
  const warnings: DiscountWarning[] = [];
  const perLine: PerLineTotal[] = [];

  let subtotal = 0;
  let lineDiscountsTotal = 0;

  for (const line of lines) {
    const lineSubtotal = line.quantity * line.unitPrice;
    const lineDiscountAmount = resolveLineDiscount(line.discount, lineSubtotal, line.id, warnings);
    const lineTotal = Math.max(0, lineSubtotal - lineDiscountAmount);
    perLine.push({ lineId: line.id, lineSubtotal, lineDiscountAmount, lineTotal });
    subtotal += lineSubtotal;
    lineDiscountsTotal += lineDiscountAmount;
  }

  const postLineSubtotal = Math.max(0, subtotal - lineDiscountsTotal);
  const orderDiscount = resolveOrderDiscount(order.discount, postLineSubtotal, warnings);
  const total = Math.max(0, postLineSubtotal - orderDiscount);

  return {
    subtotal,
    lineDiscountsTotal,
    postLineSubtotal,
    orderDiscount,
    total,
    perLine,
    warnings,
  };
}
