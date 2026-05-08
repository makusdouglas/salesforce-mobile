// 017-revenue-dashboard — pure-data input shapes for the derivation
// modules. Mirror the WatermelonDB row schemas but keep the derivations
// importable in Jest without pulling the database adapter in.

import type { RevenueFilter } from '../shared/types';

export interface OrderRow {
  readonly id: string;
  readonly clientId: string;
  readonly salespersonId: string;
  readonly status: 'draft' | 'sent' | 'canceled';
  readonly discountAmount: number;
  readonly createdAtMs: number;
  readonly sentAtMs: number | null;
  readonly canceledAtMs: number | null;
}

export interface OrderItemRow {
  readonly id: string;
  readonly orderId: string;
  readonly productVariantId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountAmount: number;
}

export interface PaymentReceiptRow {
  readonly id: string;
  readonly orderId: string;
  readonly amount: number;
  readonly receivedAtMs: number;
}

export interface DerivationInput {
  readonly orders: readonly OrderRow[];
  readonly receipts: readonly PaymentReceiptRow[];
  readonly items: readonly OrderItemRow[];
  readonly clientNameById: ReadonlyMap<string, string>;
  readonly productNameById: ReadonlyMap<string, string>;
  readonly filter: RevenueFilter;
  /** Reference clock; pass Date.now() at the call site, override in tests. */
  readonly nowMs: number;
}
