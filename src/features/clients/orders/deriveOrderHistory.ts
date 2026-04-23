import type { OrderHistoryRowDTO, OrderHistoryStatus } from '../types';

export type OrderLike = {
  readonly id: string;
  readonly createdAtMs: number;
  readonly status: OrderHistoryStatus;
  readonly discountAmount: number;
};

export type OrderItemLike = {
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountAmount: number;
};

/**
 * Pure derivation per research R-004:
 *   subtotal = Σ (q × p − item.discount)
 *   total    = max(0, subtotal − order.discount)
 */
export function deriveOrderHistoryRow(
  order: OrderLike,
  items: readonly OrderItemLike[],
): OrderHistoryRowDTO {
  const subtotal = items.reduce(
    (acc, item) => acc + (item.quantity * item.unitPrice - item.discountAmount),
    0,
  );
  const total = Math.max(0, subtotal - order.discountAmount);
  return {
    id: order.id,
    createdAtMs: order.createdAtMs,
    status: order.status,
    total,
    itemCount: items.length,
  };
}

/** Sort helper: most recent first by createdAtMs. */
export function sortByRecentFirst(
  rows: readonly OrderHistoryRowDTO[],
): OrderHistoryRowDTO[] {
  return [...rows].sort((a, b) => b.createdAtMs - a.createdAtMs);
}
