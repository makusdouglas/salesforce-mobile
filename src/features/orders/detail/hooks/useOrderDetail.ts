import { useEffect, useState } from 'react';
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
import { totalFromItemsAndOrder } from '../../overview/selectors/totalFromItemsAndOrder';
import type { OrderOverviewRowDTO } from '../../overview/types';

export type OrderDetailItemDTO = {
  readonly id: string;
  readonly productVariantId: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountAmount: number;
  readonly lineTotal: number;
};

export type OrderDetailReceiptDTO = {
  readonly id: string;
  readonly amount: number;
  readonly method: string;
  readonly receivedAtMs: number;
  readonly notes: string | null;
  readonly attachmentLocalPath: string | null;
  readonly attachmentUrl: string | null;
  readonly correctionOfReceiptId: string | null;
};

export type OrderDetailDTO = {
  readonly header: OrderOverviewRowDTO;
  readonly client: {
    readonly id: string;
    readonly name: string;
    readonly addressLine: string | null;
    readonly phone: string | null;
  } | null;
  readonly items: readonly OrderDetailItemDTO[];
  readonly receipts: readonly OrderDetailReceiptDTO[];
  readonly totals: {
    readonly subtotal: number;
    readonly itemDiscounts: number;
    readonly orderDiscount: number;
    readonly total: number;
  };
  readonly pdfUri: string | null;
};

export type UseOrderDetailResult = {
  readonly detail: OrderDetailDTO | null;
  readonly isLoading: boolean;
};

/**
 * 013-orders-overview: observable-backed read for one order.
 *
 * Composes `ordersRepository.observe(id)` with items, receipts, and the
 * client row. Re-emits on any mutation to the order, its items, its
 * receipts, or the client's name. Returns `null` for `detail` until
 * the first payload lands, and if the order id does not resolve.
 */
export function useOrderDetail(orderId: string): UseOrderDetailResult {
  const [state, setState] = useState<{
    detail: OrderDetailDTO | null;
    isLoading: boolean;
  }>({ detail: null, isLoading: true });

  useEffect(() => {
    setState({ detail: null, isLoading: true });
    if (!orderId) {
      setState({ detail: null, isLoading: false });
      return;
    }

    let sub: Subscription | undefined;
    sub = ordersRepository
      .observe(orderId)
      .pipe(
        switchMap((order: Order | null) => {
          if (!order) {
            return of<OrderDetailDTO | null>(null);
          }
          return combineLatest([
            of(order),
            orderItemsRepository.observeByOrder(orderId),
            paymentReceiptsRepository.observeByOrder(orderId),
            clientsRepository.observe(order.clientId),
          ]).pipe(
            switchMap(
              ([o, items, receipts, client]: [
                Order,
                readonly OrderItem[],
                readonly PaymentReceipt[],
                Client | null,
              ]) => of(buildDetailDTO(o, items, receipts, client)),
            ),
          );
        }),
      )
      .subscribe({
        next: (detail) => setState({ detail, isLoading: false }),
        error: () => setState({ detail: null, isLoading: false }),
      });

    return () => sub?.unsubscribe();
  }, [orderId]);

  return state;
}

function buildDetailDTO(
  order: Order,
  items: readonly OrderItem[],
  receipts: readonly PaymentReceipt[],
  client: Client | null,
): OrderDetailDTO {
  const total = totalFromItemsAndOrder(
    { id: order.id, discountAmount: order.discountAmount },
    items.map((it) => ({
      orderId: it.orderId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountAmount: it.discountAmount,
    })),
  );
  const subtotal = items.reduce(
    (acc, it) => acc + it.quantity * it.unitPrice,
    0,
  );
  const itemDiscounts = items.reduce((acc, it) => acc + it.discountAmount, 0);

  const received = receipts.reduce((acc, r) => acc + r.amount, 0);
  const paymentStatus = derivePaymentStatus({
    status: order.status,
    total,
    received,
  });

  const header: OrderOverviewRowDTO = {
    id: order.id,
    shortId: formatShortOrderId({ id: order.id, orderNumber: order.orderNumber }),
    clientId: order.clientId,
    clientName: client?.name ?? '',
    status: order.status,
    total,
    itemCount: items.length,
    received,
    paymentStatus,
    effectiveTimestampMs:
      order.status === 'sent'
        ? order.sentAtMs ?? order.createdAtMs
        : order.status === 'canceled'
          ? order.canceledAtMs ?? order.createdAtMs
          : order.updatedAt ?? order.createdAtMs,
    timestampLabel:
      order.status === 'sent'
        ? 'enviado'
        : order.status === 'canceled'
          ? 'cancelado'
          : 'atualizado',
  };

  const itemsDTO: OrderDetailItemDTO[] = items.map((it) => ({
    id: it.id,
    productVariantId: it.productVariantId,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discountAmount: it.discountAmount,
    lineTotal: it.quantity * it.unitPrice - it.discountAmount,
  }));

  const receiptsDTO: OrderDetailReceiptDTO[] = [...receipts]
    .sort((a, b) => b.receivedAtMs - a.receivedAtMs)
    .map((r) => ({
      id: r.id,
      amount: r.amount,
      method: r.method,
      receivedAtMs: r.receivedAtMs,
      notes: r.notes,
      attachmentLocalPath: r.attachmentLocalPath,
      attachmentUrl: r.attachmentUrl,
      correctionOfReceiptId: r.correctionOfReceiptId,
    }));

  return {
    header,
    client: client
      ? {
          id: client.id,
          name: client.name,
          addressLine: client.addressLine,
          phone: client.phone,
        }
      : null,
    items: itemsDTO,
    receipts: receiptsDTO,
    totals: {
      subtotal,
      itemDiscounts,
      orderDiscount: order.discountAmount,
      total,
    },
    pdfUri: order.pdfUri,
  };
}
