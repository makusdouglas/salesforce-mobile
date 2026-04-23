import type { OrderHistoryRowDTO, OrderHistoryStatus } from '../types';

export type OrderLike = {
  readonly id: string;
  readonly createdAtMs: number;
  readonly sentAtMs: number | null;
  readonly canceledAtMs: number | null;
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
  // effectiveAtMs = the timestamp that best represents "when did this order
  // happen" from the salesperson's perspective:
  //   - sent order  → sentAtMs     (when it actually went out)
  //   - canceled   → canceledAtMs (when it was called off)
  //   - draft      → createdAtMs  (when they started it)
  // Keeps the display date honest AND makes the reverse-chronological sort
  // behave intuitively when a draft is sent after other newer drafts exist.
  const effectiveAtMs =
    order.status === 'sent'
      ? order.sentAtMs ?? order.createdAtMs
      : order.status === 'canceled'
        ? order.canceledAtMs ?? order.createdAtMs
        : order.createdAtMs;
  return {
    id: order.id,
    createdAtMs: effectiveAtMs,
    status: order.status,
    total,
    itemCount: items.length,
  };
}

/** Sort helper: most recent first by the row's effective date. */
export function sortByRecentFirst(
  rows: readonly OrderHistoryRowDTO[],
): OrderHistoryRowDTO[] {
  return [...rows].sort((a, b) => b.createdAtMs - a.createdAtMs);
}
