// 017-revenue-dashboard — DTOs shared by admin (online) and seller
// (offline) data paths. Shapes are identical; sellerRanking is omitted
// in seller scope. See specs/017-revenue-dashboard/data-model.md §4.

export type Scope = 'admin' | 'seller';

export type KpiLabel =
  | 'recebido'
  | 'faturado'
  | 'pendente'
  | 'ticket_medio'
  | 'pedidos_enviados';

export interface RevenueFilter {
  /** null = "all sellers" (admin "Todos"). Seller scope pins this to self. */
  readonly sellerId: string | null;
  /** First-day-of-month key for KPIs/aging. ISO YYYY-MM-DD. */
  readonly month: string;
  /** Inclusive month boundaries for the trend window. ISO YYYY-MM-DD. */
  readonly trendFrom: string;
  readonly trendTo: string;
}

export interface KpiBlock {
  readonly label: KpiLabel;
  readonly currentValue: number;
  /** null when the previous month has no comparable data (FR-007). */
  readonly previousValue: number | null;
  /** null → render "—" with no direction icon. */
  readonly deltaPct: number | null;
  readonly deltaDirection: 'up' | 'down' | null;
  /** Convenience for ticket_medio + pedidos_enviados; not all panels need it. */
  readonly currentCount?: number;
  readonly previousCount?: number;
}

export interface TrendPoint {
  /** YYYY-MM (no day component). */
  readonly month: string;
  readonly faturado: number;
  readonly recebido: number;
  readonly pendente: number;
}

/** Admin scope only — the seller ranking is hidden in seller scope (FR-017). */
export interface RankedSeller {
  readonly salespersonId: string;
  readonly salespersonName: string;
  readonly recebido: number;
}

export interface TopClient {
  readonly clientId: string;
  readonly clientName: string;
  readonly recebido: number;
}

export interface TopProduct {
  readonly productId: string;
  readonly productName: string;
  readonly units: number;
}

export interface AgingBucket {
  readonly label: '0-30' | '31-60' | '61-90' | '>90';
  readonly daysMin: number;
  readonly daysMax: number | null;
  readonly totalPendente: number;
}

export interface RevenueSnapshot {
  readonly scope: Scope;
  readonly filter: RevenueFilter;
  /** Epoch ms — used for "Atualizado em HH:mm" stale badge in admin scope. */
  readonly fetchedAt: number;
  readonly kpis: readonly KpiBlock[];
  readonly trend: readonly TrendPoint[];
  /** Populated only when the comparison toggle is on. */
  readonly priorYearTrend?: readonly TrendPoint[] | undefined;
  /** Undefined in seller scope (vs empty array in admin scope when nobody ranks). */
  readonly sellerRanking?: readonly RankedSeller[] | undefined;
  readonly topClients: readonly TopClient[];
  readonly topProducts: readonly TopProduct[];
  /** Always 4 entries (renderer collapses to empty state when all are zero — FR-029). */
  readonly aging: readonly AgingBucket[];
}
