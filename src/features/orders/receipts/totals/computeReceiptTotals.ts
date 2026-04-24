/**
 * 012-payment-receipts: pure receipts-totals selector.
 *
 * Contract: specs/012-payment-receipts/contracts/computeReceiptTotals.ts.
 * Pure, synchronous, side-effect-free. Consumed by all three receipts
 * screens.
 */

export interface ComputeReceiptTotalsInput {
  /** Order total in cents. Derived elsewhere from order + order_items. */
  orderTotalCents: number;
  /**
   * Includes regular receipts (positive amount) and corrections
   * (any non-zero amount, which may be negative for reversals).
   */
  receipts: readonly { amount: number }[];
}

export interface ReceiptTotals {
  totalCents: number;
  /** Signed sum of receipts.amount. May be > total (overpayment) or < 0 (over-correction). */
  receivedCents: number;
  /** `max(total - received, 0)`. Never negative. */
  outstandingCents: number;
  /** True when `received > total`. */
  hasOverpayment: boolean;
  /** True when `received < 0` after corrections. */
  hasNegativeBalance: boolean;
  /** `received / total`, clamped to `[0, 1]`. Zero when `total === 0`. */
  progressRatio: number;
}

export function computeReceiptTotals(input: ComputeReceiptTotalsInput): ReceiptTotals {
  const totalCents = input.orderTotalCents;
  let receivedCents = 0;
  for (const r of input.receipts) {
    receivedCents += r.amount;
  }

  const outstandingCents = totalCents - receivedCents;
  const clampedOutstanding = outstandingCents > 0 ? outstandingCents : 0;

  const hasOverpayment = receivedCents > totalCents;
  const hasNegativeBalance = receivedCents < 0;

  let progressRatio = 0;
  if (totalCents > 0) {
    const raw = receivedCents / totalCents;
    if (raw < 0) progressRatio = 0;
    else if (raw > 1) progressRatio = 1;
    else progressRatio = raw;
  }

  return {
    totalCents,
    receivedCents,
    outstandingCents: clampedOutstanding,
    hasOverpayment,
    hasNegativeBalance,
    progressRatio,
  };
}
