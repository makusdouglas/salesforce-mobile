import { useEffect, useMemo, useState } from 'react';
import { combineLatest, of, type Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import type Client from '@/data/models/Client';
import type Order from '@/data/models/Order';
import type OrderItem from '@/data/models/OrderItem';
import type PaymentReceipt from '@/data/models/PaymentReceipt';
import { clientsRepository } from '@/data/repositories/clientsRepository';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { ordersRepository } from '@/data/repositories/ordersRepository';
import { paymentReceiptsRepository } from '@/data/repositories/paymentReceiptsRepository';

import { formatShortOrderId } from '../../formatting/formatShortOrderId';
import { derivePaymentStatus } from '../../payment/derivePaymentStatus';
import { applyFilters } from '../selectors/applyFilters';
import { computeOrdersOverviewSummary } from '../selectors/computeOrdersOverviewSummary';
import { monthKeyToRange } from '../selectors/monthRange';
import { totalFromItemsAndOrder } from '../selectors/totalFromItemsAndOrder';
import type {
  OrderOverviewRowDTO,
  OrdersOverviewFilter,
  OrdersOverviewSummaryDTO,
} from '../types';

export type UseOrdersOverviewResult = {
  readonly rows: readonly OrderOverviewRowDTO[];
  readonly summary: OrdersOverviewSummaryDTO;
  readonly isLoading: boolean;
};

const EMPTY_SUMMARY: OrdersOverviewSummaryDTO = {
  ordersCount: 0,
  billed: 0,
  received: 0,
  pending: 0,
  progressRatio: 0,
};

/**
 * 013-orders-overview: list hook — fans out `observeOrdersForMonth` plus
 * batch observers for items/receipts/clients, and produces the row DTOs
 * + summary in a single reactive stream so any downstream mutation
 * (new receipt, new draft, status flip) re-renders the whole surface.
 */
export function useOrdersOverview(params: {
  salespersonId: string | null;
  filter: OrdersOverviewFilter;
}): UseOrdersOverviewResult {
  const { salespersonId, filter } = params;
  const [state, setState] = useState<{
    rows: readonly OrderOverviewRowDTO[];
    isLoading: boolean;
  }>({ rows: [], isLoading: true });

  const { startMs, endMs } = useMemo(
    () => monthKeyToRange(filter.month),
    [filter.month],
  );

  useEffect(() => {
    if (!salespersonId) {
      setState({ rows: [], isLoading: false });
      return;
    }
    setState((prev) => ({ ...prev, isLoading: true }));

    let sub: Subscription | undefined;
    sub = combineLatest([
      ordersRepository.observeOrdersForMonth(salespersonId, startMs, endMs),
      clientsRepository.observeByOwner(salespersonId),
    ])
      .pipe(
        switchMap(
          ([orders, clients]: [readonly Order[], readonly Client[]]) => {
            if (orders.length === 0) {
              return of<readonly OrderOverviewRowDTO[]>([]);
            }
            const orderIds = orders.map((o) => o.id);
            return combineLatest([
              of(orders),
              of(clients),
              orderItemsRepository.observeByOrders(orderIds),
              paymentReceiptsRepository.observeReceiptsForOrders(orderIds),
            ]).pipe(
              switchMap(([orderList, clientList, items, receipts]) => {
                const clientNameById = new Map(
                  clientList.map((c) => [c.id, c.name] as const),
                );
                const itemsByOrder = new Map<string, OrderItem[]>();
                for (const it of items) {
                  const bucket = itemsByOrder.get(it.orderId) ?? [];
                  bucket.push(it);
                  itemsByOrder.set(it.orderId, bucket);
                }
                const receiptsByOrder = new Map<string, PaymentReceipt[]>();
                for (const r of receipts) {
                  const bucket = receiptsByOrder.get(r.orderId) ?? [];
                  bucket.push(r);
                  receiptsByOrder.set(r.orderId, bucket);
                }

                const out = orderList.map((order) => {
                  const orderItems = itemsByOrder.get(order.id) ?? [];
                  const orderReceipts = receiptsByOrder.get(order.id) ?? [];
                  const total = totalFromItemsAndOrder(order, orderItems);
                  const received = orderReceipts.reduce(
                    (acc, r) => acc + r.amount,
                    0,
                  );
                  const paymentStatus = derivePaymentStatus({
                    status: order.status,
                    total,
                    received,
                  });
                  const effectiveTimestampMs =
                    order.status === 'sent'
                      ? order.sentAtMs ?? order.createdAtMs
                      : order.status === 'canceled'
                        ? order.canceledAtMs ?? order.createdAtMs
                        : order.updatedAt ?? order.createdAtMs;
                  const timestampLabel =
                    order.status === 'sent'
                      ? ('enviado' as const)
                      : order.status === 'canceled'
                        ? ('cancelado' as const)
                        : ('atualizado' as const);
                  const row: OrderOverviewRowDTO = {
                    id: order.id,
                    shortId: formatShortOrderId({
                      id: order.id,
                      orderNumber: order.orderNumber,
                    }),
                    clientId: order.clientId,
                    clientName: clientNameById.get(order.clientId) ?? '',
                    status: order.status,
                    total,
                    itemCount: orderItems.length,
                    received,
                    paymentStatus,
                    effectiveTimestampMs,
                    timestampLabel,
                  };
                  return row;
                });
                // Sort most-recent-first by effective timestamp.
                const sorted = [...out].sort(
                  (a, b) => b.effectiveTimestampMs - a.effectiveTimestampMs,
                );
                return of(sorted);
              }),
            );
          },
        ),
      )
      .subscribe({
        next: (rows) => setState({ rows, isLoading: false }),
        error: () => setState({ rows: [], isLoading: false }),
      });

    return () => sub?.unsubscribe();
  }, [salespersonId, startMs, endMs]);

  const filteredRows = useMemo(
    () => applyFilters(state.rows, filter),
    [state.rows, filter],
  );
  const summary = useMemo(
    () => (filteredRows.length === 0 ? EMPTY_SUMMARY : computeOrdersOverviewSummary(filteredRows)),
    [filteredRows],
  );

  return { rows: filteredRows, summary, isLoading: state.isLoading };
}

