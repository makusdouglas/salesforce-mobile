export type OrderStatus = 'draft' | 'sent' | 'canceled';

export type OrderPaymentStatus = 'paid' | 'partial' | 'pending' | 'adjust';

/**
 * Tolerance for float drift when comparing BRL decimals. 1 cent = 0.01.
 * 0.005 absorbs sub-cent rounding without crossing a cent boundary.
 */
export const PAYMENT_STATUS_EPS = 0.005;

/**
 * Derive payment status from received-vs-total for a single order.
 * Null for non-sent orders — drafts and canceled orders don't carry a
 * payment expectation.
 *
 * Contract: specs/013-orders-overview/contracts/derivePaymentStatus.md
 * Invariants are locked by features 012 and 013; changes here affect
 * ClientProfile history, OrdersOverview, and OrderDetail simultaneously.
 */
export function derivePaymentStatus(params: {
  readonly status: OrderStatus;
  readonly total: number;
  readonly received: number;
}): OrderPaymentStatus | null {
  const { status, total, received } = params;
  if (status !== 'sent') return null;
  if (received < 0) return 'adjust';
  if (received > total + PAYMENT_STATUS_EPS) return 'adjust';
  if (received >= total - PAYMENT_STATUS_EPS) return 'paid';
  if (received > 0) return 'partial';
  return 'pending';
}
