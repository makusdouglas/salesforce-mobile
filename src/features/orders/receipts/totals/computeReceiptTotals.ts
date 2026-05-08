/**
 * 012-payment-receipts: pure receipts-totals selector.
 *
 * Contract: specs/012-payment-receipts/contracts/computeReceiptTotals.ts.
 * Pure, synchronous, side-effect-free. Consumed by all three receipts
 * screens.
 *
 * Unit convention: BRL decimals (e.g. 194.50) — matches the rest of the
 * codebase (orders.discount_amount, order_items.unit_price are all
 * numeric(12,2)). Do NOT feed this selector integer-cents.
 */

export interface ComputeReceiptTotalsInput {
  /** Order total in BRL decimal. Derived elsewhere from order + order_items. */
  orderTotal: number;
  /**
   * Includes regular receipts (positive amount) and corrections
   * (any non-zero amount, which may be negative for reversals). Amounts in BRL decimal.
   */
  receipts: readonly { amount: number }[];
}

export interface ReceiptTotals {
  total: number;
  /** Signed sum of receipts.amount. May be > total (overpayment) or < 0 (over-correction). */
  received: number;
  /** `max(total - received, 0)`. Never negative. */
  outstanding: number;
  /** True when `received > total`. */
  hasOverpayment: boolean;
  /** True when `received < 0` after corrections. */
  hasNegativeBalance: boolean;
  /** `received / total`, clamped to `[0, 1]`. Zero when `total === 0`. */
  progressRatio: number;
}

export function computeReceiptTotals(input: ComputeReceiptTotalsInput): ReceiptTotals {
  const total = input.orderTotal;
  let received = 0;
  for (const r of input.receipts) {
    received += r.amount;
  }

  const rawOutstanding = total - received;
  const outstanding = rawOutstanding > 0 ? rawOutstanding : 0;

  const hasOverpayment = received > total;
  const hasNegativeBalance = received < 0;

  let progressRatio = 0;
  if (total > 0) {
    const raw = received / total;
    if (raw < 0) progressRatio = 0;
    else if (raw > 1) progressRatio = 1;
    else progressRatio = raw;
  }

  return {
    total,
    received,
    outstanding,
    hasOverpayment,
    hasNegativeBalance,
    progressRatio,
  };
}
