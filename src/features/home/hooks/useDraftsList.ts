/**
 * 009-order-assembly: powers the DraftsListScreen (FR-017).
 *
 * Observes `orders` where status = 'draft' scoped to the active salesperson,
 * joins each row with its client (for the name) and order_items (for the
 * count + running total via computeOrderTotals), and returns a flat array
 * sorted by `updated_at` desc (done at the repo layer).
 */

import { useEffect, useState } from 'react';

import type Client from '@/data/models/Client';
import type Order from '@/data/models/Order';
import { clientsRepository } from '@/data/repositories/clientsRepository';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { ordersRepository } from '@/data/repositories/ordersRepository';
import { useActiveSalespersonId } from '@/features/clients';
import { computeOrderTotals } from '@/features/orders/totals/computeOrderTotals';
import type { OrderLineForTotals } from '@/features/orders/totals/types';

export interface DraftListEntry {
  readonly orderId: string;
  readonly clientName: string;
  readonly itemCount: number;
  readonly total: number;
  readonly lastSavedAtMs: number;
}

async function resolve(order: Order): Promise<DraftListEntry> {
  const [client, items] = await Promise.all([
    clientsRepository.findById(order.clientId) as Promise<Client | null>,
    orderItemsRepository.findByOrder(order.id),
  ]);
  const lines: OrderLineForTotals[] = items.map((line) => ({
    id: line.id,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: { mode: line.discountMode, value: line.discountAmount },
  }));
  const totals = computeOrderTotals(
    { discount: { mode: order.discountMode, value: order.discountAmount } },
    lines,
  );
  return {
    orderId: order.id,
    clientName: client?.name ?? '—',
    itemCount: items.length,
    total: totals.total,
    lastSavedAtMs: order.updatedAt,
  };
}

export function useDraftsList(): DraftListEntry[] {
  const { salespersonId } = useActiveSalespersonId();
  const [rows, setRows] = useState<DraftListEntry[]>([]);

  useEffect(() => {
    if (salespersonId === null) {
      setRows([]);
      return;
    }
    let cancelled = false;
    const sub = ordersRepository
      .observeDraftsForSalesperson(salespersonId)
      .subscribe({
        next: (orders) => {
          void (async () => {
            const resolved = await Promise.all(orders.map(resolve));
            if (!cancelled) setRows(resolved);
          })();
        },
      });
    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, [salespersonId]);

  return rows;
}
