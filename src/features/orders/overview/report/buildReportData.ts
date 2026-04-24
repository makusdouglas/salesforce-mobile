import { Q } from '@nozbe/watermelondb';

import type Client from '@/data/models/Client';
import { database } from '@/data/database';
import type Order from '@/data/models/Order';
import type OrderItem from '@/data/models/OrderItem';
import type PaymentReceipt from '@/data/models/PaymentReceipt';

import { formatShortOrderId } from '../../formatting/formatShortOrderId';
import { derivePaymentStatus } from '../../payment/derivePaymentStatus';
import { computeOrdersOverviewSummary } from '../selectors/computeOrdersOverviewSummary';
import { totalFromItemsAndOrder } from '../selectors/totalFromItemsAndOrder';
import type {
  OrderOverviewRowDTO,
  OrdersOverviewSummaryDTO,
} from '../types';

export type ReportMonthBucket = {
  readonly monthKey: string;
  readonly summary: OrdersOverviewSummaryDTO;
  readonly rows: readonly OrderOverviewRowDTO[];
};

export type ReportData = {
  readonly salespersonId: string;
  readonly salespersonName: string | null;
  readonly generatedAtMs: number;
  readonly monthlyBuckets: readonly ReportMonthBucket[];
};

/** Map a single order to its bucket month key (status-aware, per R6). */
function monthKeyForOrder(order: Order): string {
  const ts =
    order.status === 'sent'
      ? order.sentAtMs ?? order.createdAtMs
      : order.status === 'canceled'
        ? order.canceledAtMs ?? order.createdAtMs
        : order.updatedAt ?? order.createdAtMs;
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

export type BuildReportDataInput = {
  readonly salespersonId: string;
  readonly salespersonName?: string | null;
  /**
   * Optional clock injector for deterministic tests. Defaults to
   * Date.now() in production.
   */
  readonly nowMs?: number;
  /**
   * When set, limits the report to buckets whose `monthKey >= floor`.
   * Not currently wired to the UI — reserved for future "last N months"
   * exports. `undefined` (default) means include every month the seller
   * has at least one order in.
   */
  readonly monthFloor?: string;
};

/**
 * 013-orders-overview: builds the multi-month report consumed by the
 * PDF and CSV exporters. Reads once from WatermelonDB (all of the
 * seller's orders + items + receipts + clients) and composes the same
 * row DTOs the list surface uses, grouped by bucket month.
 *
 * Pure with respect to the DB snapshot at call time — it does NOT
 * subscribe to observables. A second call picks up any changes.
 */
export async function buildReportData(
  input: BuildReportDataInput,
): Promise<ReportData> {
  const { salespersonId, salespersonName = null, nowMs = Date.now() } = input;
  if (!salespersonId) {
    return {
      salespersonId: '',
      salespersonName,
      generatedAtMs: nowMs,
      monthlyBuckets: [],
    };
  }

  const orders = database.get<Order>('orders');
  const orderItems = database.get<OrderItem>('order_items');
  const paymentReceipts = database.get<PaymentReceipt>('payment_receipts');
  const clientsCollection = database.get<Client>('clients');
  const notDeleted = Q.where('_status', Q.notEq('deleted'));

  const [orderList, clients] = await Promise.all([
    orders
      .query(Q.where('salesperson_id', salespersonId), notDeleted)
      .fetch() as Promise<readonly Order[]>,
    clientsCollection
      .query(Q.where('salesperson_id', salespersonId), notDeleted)
      .fetch() as Promise<readonly Client[]>,
  ]);
  if (orderList.length === 0) {
    return {
      salespersonId,
      salespersonName,
      generatedAtMs: nowMs,
      monthlyBuckets: [],
    };
  }

  const orderIds = orderList.map((o) => o.id);
  const [items, receipts] = await Promise.all([
    orderItems
      .query(Q.where('order_id', Q.oneOf([...orderIds])), notDeleted)
      .fetch(),
    paymentReceipts
      .query(Q.where('order_id', Q.oneOf([...orderIds])), notDeleted)
      .fetch(),
  ]);

  const clientNameById = new Map(clients.map((c) => [c.id, c.name] as const));
  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const it of items as readonly OrderItem[]) {
    const bucket = itemsByOrder.get(it.orderId) ?? [];
    bucket.push(it);
    itemsByOrder.set(it.orderId, bucket);
  }
  const receiptsByOrder = new Map<string, PaymentReceipt[]>();
  for (const r of receipts as readonly PaymentReceipt[]) {
    const bucket = receiptsByOrder.get(r.orderId) ?? [];
    bucket.push(r);
    receiptsByOrder.set(r.orderId, bucket);
  }

  // Bucket orders by month key.
  const bucketsByMonth = new Map<string, OrderOverviewRowDTO[]>();
  for (const order of orderList) {
    const monthKey = monthKeyForOrder(order);
    if (input.monthFloor && monthKey < input.monthFloor) continue;

    const orderItemsForRow = itemsByOrder.get(order.id) ?? [];
    const orderReceiptsForRow = receiptsByOrder.get(order.id) ?? [];
    const total = totalFromItemsAndOrder(
      { id: order.id, discountAmount: order.discountAmount },
      orderItemsForRow.map((it) => ({
        orderId: it.orderId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountAmount: it.discountAmount,
      })),
    );
    const received = orderReceiptsForRow.reduce((acc, r) => acc + r.amount, 0);
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
    const row: OrderOverviewRowDTO = {
      id: order.id,
      shortId: formatShortOrderId({ id: order.id, orderNumber: order.orderNumber }),
      clientId: order.clientId,
      clientName: clientNameById.get(order.clientId) ?? '',
      status: order.status,
      total,
      itemCount: orderItemsForRow.length,
      received,
      paymentStatus,
      effectiveTimestampMs,
      timestampLabel:
        order.status === 'sent'
          ? 'enviado'
          : order.status === 'canceled'
            ? 'cancelado'
            : 'atualizado',
    };
    const bucket = bucketsByMonth.get(monthKey) ?? [];
    bucket.push(row);
    bucketsByMonth.set(monthKey, bucket);
  }

  const monthKeys = [...bucketsByMonth.keys()].sort((a, b) =>
    a < b ? 1 : a > b ? -1 : 0,
  );
  const monthlyBuckets: ReportMonthBucket[] = monthKeys.map((monthKey) => {
    const rows = (bucketsByMonth.get(monthKey) ?? []).sort(
      (a, b) => b.effectiveTimestampMs - a.effectiveTimestampMs,
    );
    return {
      monthKey,
      summary: computeOrdersOverviewSummary(rows),
      rows,
    };
  });

  return {
    salespersonId,
    salespersonName,
    generatedAtMs: nowMs,
    monthlyBuckets,
  };
}
