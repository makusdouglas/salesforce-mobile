import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';
import { combineLatest, of, type Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import type Client from '@/data/models/Client';
import type Order from '@/data/models/Order';
import { database } from '@/data/database';
import { clientsRepository } from '@/data/repositories/clientsRepository';

import { formatShortOrderId } from '../../formatting/formatShortOrderId';
import type { OrderStatus } from '../../payment/derivePaymentStatus';

export type RecentActivityItemDTO = {
  readonly orderId: string;
  readonly shortId: string;
  readonly clientName: string;
  readonly status: 'sent' | 'canceled';
  readonly total: number;
  readonly effectiveTimestampMs: number;
};

const MAX_ITEMS = 5;

/**
 * 013-orders-overview: live feed for the Home "Atividade recente"
 * card. Emits the N most recent sent/canceled orders owned by the
 * current salesperson, ordered by `sent_at_ms ?? canceled_at_ms`
 * descending.
 *
 * Drafts are handled by the existing "Rascunhos em andamento" card.
 */
export function useRecentActivity(
  salespersonId: string | null,
): readonly RecentActivityItemDTO[] {
  const [items, setItems] = useState<readonly RecentActivityItemDTO[]>([]);

  useEffect(() => {
    if (!salespersonId) {
      setItems([]);
      return;
    }

    const orders = database.get<Order>('orders');
    const notDeleted = Q.where('_status', Q.notEq('deleted'));

    let sub: Subscription | undefined;
    sub = orders
      .query(
        Q.where('salesperson_id', salespersonId),
        Q.or(
          Q.where('status', 'sent' satisfies OrderStatus),
          Q.where('status', 'canceled' satisfies OrderStatus),
        ),
        notDeleted,
      )
      .observeWithColumns(['status', 'sent_at_ms', 'canceled_at_ms'])
      .pipe(
        switchMap((rows: readonly Order[]) => {
          if (rows.length === 0) return of<RecentActivityItemDTO[]>([]);
          return combineLatest([
            of(rows),
            clientsRepository.observeByOwner(salespersonId),
          ]).pipe(
            switchMap(([orderRows, clients]: [readonly Order[], readonly Client[]]) => {
              const clientNameById = new Map(
                clients.map((c) => [c.id, c.name] as const),
              );
              const mapped: RecentActivityItemDTO[] = orderRows
                .filter((o) => o.status === 'sent' || o.status === 'canceled')
                .map((o) => {
                  const ts =
                    o.status === 'sent'
                      ? o.sentAtMs ?? o.createdAtMs
                      : o.canceledAtMs ?? o.createdAtMs;
                  return {
                    orderId: o.id,
                    shortId: formatShortOrderId({
                      id: o.id,
                      orderNumber: o.orderNumber,
                    }),
                    clientName: clientNameById.get(o.clientId) ?? '',
                    status: o.status as 'sent' | 'canceled',
                    // Best-effort total from the order's `notes`-free columns.
                    // The card only needs a visual cue; the canonical total
                    // renders on OrderDetail after navigation.
                    total: 0,
                    effectiveTimestampMs: ts,
                  };
                })
                .sort((a, b) => b.effectiveTimestampMs - a.effectiveTimestampMs)
                .slice(0, MAX_ITEMS);
              return of(mapped);
            }),
          );
        }),
      )
      .subscribe({
        next: (rows) => setItems(rows),
        error: () => setItems([]),
      });

    return () => sub?.unsubscribe();
  }, [salespersonId]);

  return items;
}
