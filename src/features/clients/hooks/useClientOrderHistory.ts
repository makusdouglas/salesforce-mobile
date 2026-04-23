import { useEffect, useState } from 'react';
import { combineLatest, of, type Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import type Order from '@/data/models/Order';
import type OrderItem from '@/data/models/OrderItem';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { ordersRepository } from '@/data/repositories/ordersRepository';

import {
  deriveOrderHistoryRow,
  sortByRecentFirst,
  type OrderItemLike,
  type OrderLike,
} from '../orders/deriveOrderHistory';
import { type OrderHistoryRowDTO } from '../types';

function toOrderLike(order: Order): OrderLike {
  return {
    id: order.id,
    createdAtMs: order.createdAtMs,
    status: order.status,
    discountAmount: order.discountAmount,
  };
}

function toOrderItemLike(item: OrderItem): OrderItemLike {
  return {
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountAmount: item.discountAmount,
  };
}

export function useClientOrderHistory(clientId: string): readonly OrderHistoryRowDTO[] {
  const [rows, setRows] = useState<readonly OrderHistoryRowDTO[]>([]);

  useEffect(() => {
    let sub: Subscription | undefined;
    sub = ordersRepository
      .observeByClient(clientId)
      .pipe(
        switchMap((orders: Order[]) => {
          if (orders.length === 0) return of<OrderHistoryRowDTO[]>([]);
          return combineLatest(
            orders.map((o) =>
              orderItemsRepository
                .observeByOrder(o.id)
                .pipe(
                  switchMap((items: OrderItem[]) =>
                    of(deriveOrderHistoryRow(toOrderLike(o), items.map(toOrderItemLike))),
                  ),
                ),
            ),
          );
        }),
      )
      .subscribe({
        next: (derived) => setRows(sortByRecentFirst(derived)),
        error: () => setRows([]),
      });
    return () => sub?.unsubscribe();
  }, [clientId]);

  return rows;
}
