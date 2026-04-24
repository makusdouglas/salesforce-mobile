import { useEffect, useState } from 'react';
import { combineLatest, of, type Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import type Order from '@/data/models/Order';
import type OrderItem from '@/data/models/OrderItem';
import type PaymentReceipt from '@/data/models/PaymentReceipt';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { ordersRepository } from '@/data/repositories/ordersRepository';
import { paymentReceiptsRepository } from '@/data/repositories/paymentReceiptsRepository';

import {
  deriveOrderHistoryRow,
  sortByRecentFirst,
  type OrderItemLike,
  type OrderLike,
  type ReceiptLike,
} from '../orders/deriveOrderHistory';
import { type OrderHistoryRowDTO } from '../types';

function toOrderLike(order: Order): OrderLike {
  return {
    id: order.id,
    createdAtMs: order.createdAtMs,
    sentAtMs: order.sentAtMs,
    canceledAtMs: order.canceledAtMs,
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

function toReceiptLike(receipt: PaymentReceipt): ReceiptLike {
  return { amount: receipt.amount };
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
              combineLatest([
                orderItemsRepository.observeByOrder(o.id),
                paymentReceiptsRepository.observeByOrder(o.id),
              ]).pipe(
                switchMap(([items, receipts]: [OrderItem[], PaymentReceipt[]]) =>
                  of(
                    deriveOrderHistoryRow(
                      toOrderLike(o),
                      items.map(toOrderItemLike),
                      receipts.map(toReceiptLike),
                    ),
                  ),
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
