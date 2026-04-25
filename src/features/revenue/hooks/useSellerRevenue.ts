// 017-revenue-dashboard — seller-scope revenue snapshot hook. Pulls
// the seller's orders + their items + their receipts from WatermelonDB
// (no Supabase calls during render — FR-036, FR-043) and folds them
// into a RevenueSnapshot via the pure derivation modules.

import { useEffect, useMemo, useState } from 'react';
import { combineLatest, of, type Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import type Client from '@/data/models/Client';
import type Order from '@/data/models/Order';
import type OrderItem from '@/data/models/OrderItem';
import type PaymentReceipt from '@/data/models/PaymentReceipt';
import type Product from '@/data/models/Product';
import type ProductVariant from '@/data/models/ProductVariant';
import { clientsRepository } from '@/data/repositories/clientsRepository';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { paymentReceiptsRepository } from '@/data/repositories/paymentReceiptsRepository';
import { productsRepository } from '@/data/repositories/productsRepository';
import {
  observeOrdersForSalesperson,
  observeProductVariantsByIds,
} from '@/data/repositories/revenueQueries';

import {
  deriveAging,
  deriveKpis,
  deriveTopClients,
  deriveTopProducts,
  deriveTrend,
} from '../derivations';
import type {
  DerivationInput,
  OrderItemRow,
  OrderRow,
  PaymentReceiptRow,
} from '../derivations/types';
import type { RevenueFilter, RevenueSnapshot } from '../shared/types';

import { useSellerRevenueFilter } from './useSellerRevenueFilter';

interface ObservedState {
  readonly orders: readonly Order[];
  readonly items: readonly OrderItem[];
  readonly receipts: readonly PaymentReceipt[];
  readonly clients: readonly Client[];
  readonly variants: readonly ProductVariant[];
  readonly products: readonly Product[];
}

function toOrderRow(o: Order): OrderRow {
  return {
    id: o.id,
    clientId: o.clientId,
    salespersonId: o.salespersonId,
    status: o.status,
    discountAmount: o.discountAmount,
    createdAtMs: o.createdAtMs,
    sentAtMs: o.sentAtMs,
    canceledAtMs: o.canceledAtMs,
  };
}

function toItemRow(
  it: OrderItem,
  variantToProduct: Map<string, string>,
): OrderItemRow {
  return {
    id: it.id,
    orderId: it.orderId,
    productVariantId: it.productVariantId,
    productId: variantToProduct.get(it.productVariantId) ?? it.productVariantId,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discountAmount: it.discountAmount,
  };
}

function toReceiptRow(r: PaymentReceipt): PaymentReceiptRow {
  return {
    id: r.id,
    orderId: r.orderId,
    amount: r.amount,
    receivedAtMs: r.receivedAtMs,
  };
}

export interface UseSellerRevenueResult {
  readonly snapshot: RevenueSnapshot;
  readonly comparisonAvailable: boolean;
}

const EMPTY_SNAPSHOT = (filter: RevenueFilter, nowMs: number): RevenueSnapshot => ({
  scope: 'seller',
  filter,
  fetchedAt: nowMs,
  kpis: [],
  trend: [],
  topClients: [],
  topProducts: [],
  aging: [],
});

/**
 * Compose the five derivations into a snapshot. `comparisonEnabled`
 * controls whether the prior-year trend is also computed.
 */
export function useSellerRevenue(params: {
  readonly salespersonId: string | null;
  readonly comparisonEnabled?: boolean;
}): UseSellerRevenueResult {
  const { salespersonId, comparisonEnabled = false } = params;
  const filter = useSellerRevenueFilter(salespersonId);
  const [state, setState] = useState<ObservedState>({
    orders: [],
    items: [],
    receipts: [],
    clients: [],
    variants: [],
    products: [],
  });

  useEffect(() => {
    if (!salespersonId) {
      setState({ orders: [], items: [], receipts: [], clients: [], variants: [], products: [] });
      return;
    }
    let sub: Subscription | undefined;
    sub = combineLatest([
      observeOrdersForSalesperson(salespersonId),
      clientsRepository.observeByOwner(salespersonId),
      productsRepository.observeAll(),
    ])
      .pipe(
        switchMap(([orders, clients, products]) => {
          const orderIds = orders.map((o) => o.id);
          if (orderIds.length === 0) {
            return of({
              orders,
              clients,
              products,
              items: [] as readonly OrderItem[],
              receipts: [] as readonly PaymentReceipt[],
              variants: [] as readonly ProductVariant[],
            });
          }
          return combineLatest([
            orderItemsRepository.observeByOrders(orderIds),
            paymentReceiptsRepository.observeReceiptsForOrders(orderIds),
          ]).pipe(
            switchMap(([items, receipts]) => {
              const variantIds = Array.from(new Set(items.map((it) => it.productVariantId)));
              return observeProductVariantsByIds(variantIds).pipe(
                switchMap((variants) =>
                  of({ orders, clients, products, items, receipts, variants }),
                ),
              );
            }),
          );
        }),
      )
      .subscribe((next) => {
        setState(next);
      });
    return () => sub?.unsubscribe();
  }, [salespersonId]);

  const variantToProduct = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of state.variants) m.set(v.id, v.productId);
    return m;
  }, [state.variants]);

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of state.clients) m.set(c.id, c.name);
    return m;
  }, [state.clients]);

  const productNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of state.products) m.set(p.id, p.name);
    return m;
  }, [state.products]);

  const snapshot = useMemo<RevenueSnapshot>(() => {
    if (!salespersonId) return EMPTY_SNAPSHOT(filter, Date.now());
    const input: DerivationInput = {
      orders: state.orders.map(toOrderRow),
      items: state.items.map((it) => toItemRow(it, variantToProduct)),
      receipts: state.receipts.map(toReceiptRow),
      clientNameById,
      productNameById,
      filter,
      nowMs: Date.now(),
    };
    const snap: RevenueSnapshot = {
      scope: 'seller',
      filter,
      fetchedAt: input.nowMs,
      kpis: deriveKpis(input),
      trend: deriveTrend(input, { includeYear: 'current' }),
      topClients: deriveTopClients(input),
      topProducts: deriveTopProducts(input),
      aging: deriveAging(input),
    };
    return comparisonEnabled
      ? { ...snap, priorYearTrend: deriveTrend(input, { includeYear: 'priorYear' }) }
      : snap;
  }, [
    salespersonId,
    state.orders,
    state.items,
    state.receipts,
    variantToProduct,
    clientNameById,
    productNameById,
    filter,
    comparisonEnabled,
  ]);

  // Comparison is "available" when the prior-year window contains any
  // data at all; cheaper than another deriveTrend call at the call site.
  const comparisonAvailable = useMemo(() => {
    if (!salespersonId) return false;
    const probe: DerivationInput = {
      orders: state.orders.map(toOrderRow),
      items: state.items.map((it) => toItemRow(it, variantToProduct)),
      receipts: state.receipts.map(toReceiptRow),
      clientNameById,
      productNameById,
      filter,
      nowMs: Date.now(),
    };
    return deriveTrend(probe, { includeYear: 'priorYear' }).length > 0;
  }, [salespersonId, state.orders, state.items, state.receipts, variantToProduct, clientNameById, productNameById, filter]);

  return { snapshot, comparisonAvailable };
}
