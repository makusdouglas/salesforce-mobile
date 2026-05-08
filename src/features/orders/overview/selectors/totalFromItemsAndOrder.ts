/**
 * 013-orders-overview: compute an order's total from its item rows
 * and its order-level discount.
 *
 *   subtotal = Σ (q × p − item.discount) for items where orderId matches
 *   total    = max(0, subtotal − order.discount)
 *
 * Extracted into a selector so it can be tested without importing the
 * hook (which transitively pulls the Watermelon adapter into the jest
 * module graph).
 */

export type OrderLikeForTotal = {
  readonly id: string;
  readonly discountAmount: number;
};

export type OrderItemLikeForTotal = {
  readonly orderId: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountAmount: number;
};

export function totalFromItemsAndOrder(
  order: OrderLikeForTotal,
  items: readonly OrderItemLikeForTotal[],
): number {
  const subtotal = items
    .filter((it) => it.orderId === order.id)
    .reduce(
      (acc, item) =>
        acc + (item.quantity * item.unitPrice - item.discountAmount),
      0,
    );
  return Math.max(0, subtotal - order.discountAmount);
}
