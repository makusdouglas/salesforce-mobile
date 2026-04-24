/**
 * Contract: computeReceiptTotals
 *
 * Pure, synchronous, side-effect-free selector. Called by all three receipts
 * screens. Implementation at `src/features/orders/receipts/totals/computeReceiptTotals.ts`.
 */

export interface ComputeReceiptTotalsInput {
  /** Order total in cents. Derived elsewhere from order + order_items; this selector takes it verbatim. */
  orderTotalCents: number;
  /** Includes both regular receipts (positive amount) and corrections (any non-zero amount). */
  receipts: ReadonlyArray<{ amount: number }>;
}

export interface ReceiptTotals {
  /** Echo of input (for convenience at call sites). */
  totalCents: number;
  /** Signed sum of receipts.amount. May be > total (overpayment) or < 0 (over-correction). */
  receivedCents: number;
  /** max(total - received, 0). Never negative. */
  outstandingCents: number;
  /** True when receivedCents > totalCents. */
  hasOverpayment: boolean;
  /** True when receivedCents < 0 (net negative after corrections). */
  hasNegativeBalance: boolean;
  /** receivedCents / totalCents, clamped to [0, 1] for the progress bar. 0 when totalCents === 0. */
  progressRatio: number;
}

export function computeReceiptTotals(input: ComputeReceiptTotalsInput): ReceiptTotals;
