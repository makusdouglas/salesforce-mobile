// 009-order-assembly: types for the pure totals derivation.
// See specs/009-order-assembly/data-model.md § Derived values.

import type { DiscountMode } from '@/data/types';

export type { DiscountMode };

/**
 * One discount entry — either a BRL amount or a percentage (0..100).
 * Mirrors the shape stored on Order + OrderItem (mode + amount columns).
 */
export interface DiscountInput {
  mode: DiscountMode;
  /** BRL when mode = 'amount'; percent 0..100 when mode = 'percent'. */
  value: number;
}

export interface OrderLineForTotals {
  id: string;
  quantity: number;
  unitPrice: number;
  discount: DiscountInput;
}

export interface OrderForTotals {
  discount: DiscountInput;
}

export interface PerLineTotal {
  lineId: string;
  /** `qty × unitPrice`, before any discount. */
  lineSubtotal: number;
  /** Discount resolved to BRL, already clamped to ≤ lineSubtotal. */
  lineDiscountAmount: number;
  /** `max(0, lineSubtotal − lineDiscountAmount)`. */
  lineTotal: number;
}

/** Inline warning surfaced in the UI when a discount is clamped. */
export type DiscountWarning =
  | { kind: 'line-percent-over-100'; lineId: string }
  | { kind: 'line-amount-over-subtotal'; lineId: string }
  | { kind: 'order-percent-over-100' }
  | { kind: 'order-amount-over-subtotal' };

export interface OrderTotals {
  subtotal: number;
  lineDiscountsTotal: number;
  /** `max(0, subtotal − lineDiscountsTotal)`. */
  postLineSubtotal: number;
  /** Order-level discount resolved to BRL, already clamped to ≤ postLineSubtotal. */
  orderDiscount: number;
  /** `max(0, postLineSubtotal − orderDiscount)`. */
  total: number;
  perLine: PerLineTotal[];
  warnings: DiscountWarning[];
}
