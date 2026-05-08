# Data Model — Revenue Dashboard (017)

This feature is **read-only**: it adds zero tables, zero columns, zero status values, and zero write paths. Everything below is either a derivation shape (in TS) or a SQL function signature.

## 1. Existing entities consumed (no schema changes)

| Entity | Source | Fields read | Why |
|--------|--------|-------------|-----|
| `orders` | Supabase + WatermelonDB | `id`, `salesperson_id`, `client_id`, `status`, `total`, `sent_at`, `created_at` | Core revenue + aging source. Only `status = 'sent'` rows count for Recebido / Pendente / Aging; all rows count for Faturado on the trend chart. |
| `order_items` | Supabase + WatermelonDB | `id`, `order_id`, `product_id`, `quantity` | Top-products units sold. |
| `payment_receipts` | Supabase + WatermelonDB | `id`, `order_id`, `amount`, `received_at`, `corrected_by` | Recebido sum + per-order pendente computation (R6 of research.md). Corrected receipts are excluded by following the `corrected_by` chain to the latest non-corrected receipt per chain. |
| `clients` | Supabase + WatermelonDB | `id`, `display_name` | Top-clients labels. |
| `products` | Supabase + WatermelonDB | `id`, `display_name` | Top-products labels. |
| `salespeople` (or `users` view) | Supabase | `id`, `display_name` | Seller ranking labels + vendedor filter list. Admin scope only. |
| `user_roles` | Supabase | `user_id`, `role` | Admin-grade gate inside SECURITY DEFINER functions. |

## 2. New persistence

**None.**

- No new tables.
- No new columns.
- No new indexes (the existing `orders.sent_at`, `orders.salesperson_id`, `payment_receipts.order_id` indexes from features 005/009/012 are sufficient — verified by reading earlier migrations).
- No new RLS policies on existing tables. Authorization for the new functions is enforced inside the function body via a role check.

## 3. Server-side functions (admin scope)

All defined in `supabase/migrations/0020_revenue_dashboard.sql`. Each is `LANGUAGE plpgsql SECURITY DEFINER`, owner = `postgres`, and **must** start with the role guard:

```sql
if not exists (
  select 1 from public.user_roles ur
  where ur.user_id = auth.uid()
    and ur.role in ('admin', 'superuser')   -- adjust per feature 016 vocabulary
) then
  raise exception 'insufficient_privilege' using errcode = '42501';
end if;
```

`grant execute ... to authenticated;` on every function — the body itself does the gating.

| Function | Args | Return shape (one or more rows) |
|---|---|---|
| `admin_revenue_kpis` | `p_seller uuid, p_month date` | `(label text, current_value numeric, previous_value numeric, current_count int, previous_count int)` × 5 rows (one per KPI). Caller computes delta % client-side. |
| `admin_revenue_monthly` | `p_seller uuid, p_from date, p_to date` | `(month date, faturado numeric, recebido numeric, pendente numeric)` × N months (12 by default). |
| `admin_revenue_by_seller` | `p_month date` | `(salesperson_id uuid, salesperson_name text, recebido numeric)` × N rows, sorted desc, **capped at top 10 in the function body** (FR-019). |
| `admin_top_clients` | `p_seller uuid, p_month_from date, p_month_to date` | `(client_id uuid, client_name text, recebido numeric)` × top 3, ties broken by `client_name asc`. |
| `admin_top_products` | `p_seller uuid, p_month_from date, p_month_to date` | `(product_id uuid, product_name text, units int)` × top 3, ties broken by `product_name asc`. |
| `admin_receivables_aging` | `p_seller uuid, p_as_of date` | `(bucket text, days_min int, days_max int, total_pendente numeric)` × 4 rows (always 4, even when total = 0 — empty-state handling lives client-side per FR-029). |

Notes:

- All functions accept `p_seller = null` to mean "all sellers" (the "Todos" filter).
- All functions read `orders` joined to `payment_receipts` filtered by `corrected_by is null` (latest receipt per chain).
- `p_month` / `p_as_of` default to `date_trunc('month', now())::date` and `now()::date` respectively, but accepting them as args makes deterministic tests possible.
- Currency math uses `numeric` (not `float`) end-to-end. `total_pendente := greatest(0, ...)` per FR-027.

## 4. Client-side derivation shapes (TypeScript)

Defined in `src/features/revenue/shared/types.ts`. Both scopes produce snapshots of the same shape; the only difference is the source.

```ts
export type Scope = 'admin' | 'seller';

export interface RevenueFilter {
  /** null = "all sellers" (admin "Todos"). Seller scope always pins to self. */
  readonly sellerId: string | null;
  /** Inclusive month boundaries; same value for KPIs/aging panels. */
  readonly month: string; // YYYY-MM
  /** 12-month window for trend (default = month-11 .. month). */
  readonly trendFrom: string; // YYYY-MM
  readonly trendTo: string;   // YYYY-MM
}

export interface KpiBlock {
  readonly label: 'Recebido' | 'Faturado' | 'Pendente' | 'Ticket médio' | 'Nº de pedidos enviados';
  readonly currentValue: number;       // R$ (or count for "Nº pedidos")
  readonly previousValue: number | null; // null when previous month has no data
  readonly currentCount?: number;      // only for Ticket médio computation
  readonly previousCount?: number;
  readonly deltaPct: number | null;    // null → render "—"
  readonly deltaDirection: 'up' | 'down' | null;
}

export interface TrendPoint {
  readonly month: string; // YYYY-MM
  readonly faturado: number;
  readonly recebido: number;
  readonly pendente: number;
}

export interface RankedSeller {  // admin-scope only
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
  readonly label: '0–30 dias' | '31–60 dias' | '61–90 dias' | '>90 dias';
  readonly daysMin: number;
  readonly daysMax: number | null; // null for the >90 bucket
  readonly totalPendente: number;
}

export interface RevenueSnapshot {
  readonly scope: Scope;
  readonly filter: RevenueFilter;
  readonly fetchedAt: number; // epoch ms
  readonly kpis: ReadonlyArray<KpiBlock>; // length 5, ordered per FR-005
  readonly trend: ReadonlyArray<TrendPoint>; // up to 12 entries; sparse months omitted (R6)
  readonly priorYearTrend?: ReadonlyArray<TrendPoint>; // populated only when comparison toggle is on
  readonly sellerRanking?: ReadonlyArray<RankedSeller>; // admin only, undefined in seller scope
  readonly topClients: ReadonlyArray<TopClient>; // up to 3
  readonly topProducts: ReadonlyArray<TopProduct>; // up to 3
  readonly aging: ReadonlyArray<AgingBucket>; // exactly 4
}
```

## 5. Validation rules

- `KpiBlock.deltaPct` is `null` whenever `previousValue` is `null` or `previousValue === 0` AND `currentValue === 0` AND not currency-meaningful. The renderer must show "—" without a direction icon.
- `KpiBlock` for "Ticket médio": when `currentCount === 0`, `currentValue` MUST be `0` (not NaN).
- `AgingBucket.totalPendente` is always `>= 0`. When all four are `0`, the panel renders the empty state — not four empty bars (FR-029).
- `RevenueSnapshot.sellerRanking` is `undefined` (not `[]`) in seller scope. `TopClient` / `TopProduct` arrays are `[]` (not undefined) when there is data but none meets the criteria.
- `trend` and `priorYearTrend` arrays are filtered to months that contain at least one data row — empty months are gaps, not zero points (R6).

## 6. State transitions

The dashboard is read-only — no entity transitions. The screen-local state machine is:

```
              ┌──────────────────────┐
              │  initial             │
              │  no snapshot, no err │
              └─────────┬────────────┘
                        │ mount or filter change
                        ▼
              ┌──────────────────────┐
              │  loading             │
              │  RPCs in flight      │
              └────┬───────────┬─────┘
                   │           │
       success     │           │   failure (no cache OR cache key mismatch)
                   ▼           ▼
        ┌──────────────────┐ ┌──────────────────────┐
        │  ready           │ │  error               │
        │  show snapshot   │ │  show retry empty st │
        └──────────────────┘ └──────────────────────┘
                   │
        failure (cache key matches)
                   ▼
        ┌──────────────────────┐
        │  ready_stale         │
        │  show cached snapshot│
        │  + "Atualizado em…"  │
        │  + retry button      │
        └──────────────────────┘
```

Seller scope skips the `loading → error` transition entirely — derivations are synchronous, `ready` is reached on first render.

## 7. Indexes & performance

No new indexes required. Existing indexes:

- `orders(salesperson_id, sent_at)` — feature 005.
- `orders(status, sent_at)` — feature 009.
- `payment_receipts(order_id, received_at)` — feature 012.

These are sufficient for the function bodies (verified by reading the prior migrations).

If admin queries become slow at scale (> 50k orders), the next step would be a materialized view refreshed nightly — explicitly out of scope for v1 (see assumption "Caching policy (admin)" in spec.md).
