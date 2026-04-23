// 009-order-assembly: resolves OR creates a draft order, then observes it.
//
// Called with either `{ orderId }` (reopen existing) or `{ clientId }` (start
// a new draft for a client). On a `clientId` entry, the hook calls
// `ordersService.createDraft` exactly once — the creation is guarded by a
// ref to avoid React StrictMode's double-invocation in dev and rapid
// re-mounts.

import { useEffect, useRef, useState } from 'react';

import { useActiveSalespersonId } from '@/features/clients';

import type Order from '@/data/models/Order';
import { ordersRepository } from '@/data/repositories/ordersRepository';

import { ordersService } from '../services/ordersService';

export interface UseDraftOrderResult {
  /** `null` while creating, otherwise the observed order row. */
  readonly order: Order | null;
  /** `true` once the order id is known and the observation has emitted. */
  readonly isReady: boolean;
  readonly error: Error | null;
}

export function useDraftOrder(
  params:
    | { readonly orderId: string; readonly clientId?: undefined }
    | { readonly orderId?: undefined; readonly clientId: string },
): UseDraftOrderResult {
  const spInfo = useActiveSalespersonId();
  const [resolvedOrderId, setResolvedOrderId] = useState<string | null>(
    params.orderId ?? null,
  );
  const [order, setOrder] = useState<Order | null>(null);
  const [, bumpTick] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const createGuard = useRef(false);

  // (1) Create a new draft when invoked with clientId only.
  useEffect(() => {
    if (params.orderId !== undefined) return;
    if (resolvedOrderId !== null) return;
    if (createGuard.current) return;
    if (spInfo.salespersonId === null) return; // wait for bootstrap
    createGuard.current = true;
    let canceled = false;
    void (async () => {
      try {
        const { orderId } = await ordersService.createDraft({
          clientId: params.clientId,
          salespersonId: spInfo.salespersonId as string,
        });
        if (!canceled) setResolvedOrderId(orderId);
      } catch (err) {
        if (!canceled) setError(err instanceof Error ? err : new Error(String(err)));
      }
    })();
    return () => {
      canceled = true;
    };
  }, [params.orderId, params.clientId, resolvedOrderId, spInfo.salespersonId]);

  // (2) Observe the row once its id is known.
  useEffect(() => {
    if (resolvedOrderId === null) return;
    const sub = ordersRepository.observe(resolvedOrderId).subscribe({
      next: (row) => {
        setOrder(row);
        // WatermelonDB re-emits the same Order instance on updates. Force a
        // re-render so controlled inputs (e.g. DiscountControl) see new values.
        bumpTick((n) => n + 1);
      },
      error: (err: unknown) =>
        setError(err instanceof Error ? err : new Error(String(err))),
    });
    return () => {
      sub.unsubscribe();
    };
  }, [resolvedOrderId]);

  return {
    order,
    isReady: resolvedOrderId !== null && order !== null,
    error,
  };
}
