// 009-order-assembly: derive totals + warnings from observed order + items.
// Uses the pure computeOrderTotals function. Recomputes on every render —
// inexpensive at the MVP scale (< 50 lines).

import type Order from '@/data/models/Order';
import type OrderItem from '@/data/models/OrderItem';

import { computeOrderTotals } from '../totals/computeOrderTotals';
import type { OrderLineForTotals, OrderTotals } from '../totals/types';

export function toLineInput(line: OrderItem): OrderLineForTotals {
  return {
    id: line.id,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: { mode: line.discountMode, value: line.discountAmount },
  };
}

export function useOrderTotals(
  order: Order | null,
  lines: readonly OrderItem[],
): OrderTotals {
  if (order === null) {
    return {
      subtotal: 0,
      lineDiscountsTotal: 0,
      postLineSubtotal: 0,
      orderDiscount: 0,
      total: 0,
      perLine: [],
      warnings: [],
    };
  }
  return computeOrderTotals(
    { discount: { mode: order.discountMode, value: order.discountAmount } },
    lines.map(toLineInput),
  );
}
