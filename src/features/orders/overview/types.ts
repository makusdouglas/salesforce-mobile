import type {
  OrderPaymentStatus,
  OrderStatus,
} from '../payment/derivePaymentStatus';

/**
 * 013-orders-overview: row DTO consumed by the list + selectors.
 *
 * BRL decimal amounts (matches the rest of the codebase). Never
 * constructed from raw WatermelonDB models directly — always through
 * the selector pipeline so every surface sees the same shape.
 */
export type OrderOverviewRowDTO = {
  readonly id: string;
  readonly shortId: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly status: OrderStatus;
  readonly total: number;
  readonly itemCount: number;
  readonly received: number;
  readonly paymentStatus: OrderPaymentStatus | null;
  /** The status-aware timestamp used for both the row label and sorting. */
  readonly effectiveTimestampMs: number;
  readonly timestampLabel: 'atualizado' | 'enviado' | 'cancelado';
};

/**
 * Aggregated summary computed over the active filter window.
 * `received` is the per-row-capped sum, so `pending` can never go
 * negative even when an order is overpaid.
 */
export type OrdersOverviewSummaryDTO = {
  readonly ordersCount: number;
  readonly billed: number;
  readonly received: number;
  readonly pending: number;
  readonly progressRatio: number;
};

/** Status filter chips. 'all' is the default. */
export type OrdersOverviewStatusFilter =
  | 'all'
  | 'draft'
  | 'pending'
  | 'paid'
  | 'canceled';

/**
 * UI-only filter state — never persisted. `month` is 'YYYY-MM'; see
 * `selectors/monthRange.ts` for the conversion to [startMs, endMs).
 */
export type OrdersOverviewFilter = {
  readonly month: string;
  readonly status: OrdersOverviewStatusFilter;
  readonly query: string;
};
