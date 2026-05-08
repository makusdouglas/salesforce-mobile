# Contract — Admin Revenue RPCs (Supabase)

All functions live in `supabase/migrations/0020_revenue_dashboard.sql`. Schema = `public`. Each function is `LANGUAGE plpgsql SECURITY DEFINER`, owned by `postgres`, executes the role guard at the top of the body (raises `42501 insufficient_privilege` for non-admin callers), and is granted `EXECUTE` to `authenticated`.

The "Receipt sum" semantic referenced below means: `coalesce(sum(pr.amount), 0)` over rows in `payment_receipts pr` where `pr.order_id = orders.id` AND `pr.corrected_by IS NULL`.

`admin-grade roles` = `('admin', 'superuser')` — adjust the role list to match the canonical set defined in feature 016.

---

## 1. `admin_revenue_kpis`

**Args**

```sql
admin_revenue_kpis(p_seller uuid DEFAULT NULL, p_month date DEFAULT date_trunc('month', now())::date)
```

**Returns**

```sql
table (
  label text,             -- one of: 'recebido', 'faturado', 'pendente', 'ticket_medio', 'pedidos_enviados'
  current_value numeric,  -- R$ for currency labels; integer count for 'pedidos_enviados'
  previous_value numeric, -- nullable when previous month has zero relevant rows
  current_count int,      -- total sent orders count for the month (used to compute Ticket médio client-side; same on every row)
  previous_count int      -- previous month sent orders count
)
```

**Semantics**

- `p_month` = first day of the month being reported.
- "previous month" = `p_month - interval '1 month'`.
- `recebido` = sum of receipts whose parent order's `sent_at` falls in the month, scoped to `p_seller` if non-null.
- `faturado` = sum of `orders.total` for orders with `created_at` in the month.
- `pendente` = sum over sent orders of `greatest(0, orders.total - <Receipt sum>)` for orders with `sent_at` in the month.
- `ticket_medio` = `faturado / nullif(<sent orders count for the month>, 0)`; row's `current_value` is the result, or `0` if zero orders.
- `pedidos_enviados` = count of orders with `status = 'sent'` and `sent_at` in the month.
- `previous_value` = same metric for the previous month; the function returns `null` if the previous month has zero relevant rows for the metric.

**Errors**

- `42501 insufficient_privilege` — caller lacks an admin-grade role.

**Client mapping** → `KpiBlock[]` (length 5, ordered: Recebido, Faturado, Pendente, Ticket médio, Nº de pedidos enviados).

---

## 2. `admin_revenue_monthly`

**Args**

```sql
admin_revenue_monthly(
  p_seller uuid DEFAULT NULL,
  p_from date DEFAULT (date_trunc('month', now()) - interval '11 months')::date,
  p_to date DEFAULT date_trunc('month', now())::date
)
```

**Returns**

```sql
table (
  month date,         -- first day of the calendar month
  faturado numeric,
  recebido numeric,
  pendente numeric
)
```

**Semantics**

- One row per calendar month between `p_from` and `p_to` inclusive **that has at least one relevant order or receipt**. Months without any data are **omitted** (no zero-row fillers — see R6 of research.md).
- `faturado`, `recebido`, `pendente` defined exactly as in `admin_revenue_kpis` but per-month.
- `p_seller = null` ⇒ aggregate across all sellers.

**Errors**

- `42501 insufficient_privilege`.

**Client mapping** → `TrendPoint[]`.

---

## 3. `admin_revenue_by_seller`

**Args**

```sql
admin_revenue_by_seller(p_month date DEFAULT date_trunc('month', now())::date)
```

**Returns**

```sql
table (
  salesperson_id uuid,
  salesperson_name text,
  recebido numeric
)
```

**Semantics**

- Sum of `recebido` per seller for the given month, ordered by `recebido desc, salesperson_name asc`.
- **Capped at 10 rows** in the function body (FR-019).
- Sellers with `recebido = 0` are excluded.

**Errors**

- `42501 insufficient_privilege`.

**Client mapping** → `RankedSeller[]`. Admin scope only.

---

## 4. `admin_top_clients`

**Args**

```sql
admin_top_clients(
  p_seller uuid DEFAULT NULL,
  p_month_from date DEFAULT date_trunc('month', now())::date,
  p_month_to date DEFAULT date_trunc('month', now())::date
)
```

**Returns**

```sql
table (
  client_id uuid,
  client_name text,
  recebido numeric
)
```

**Semantics**

- Sum of `recebido` per client in the given period (inclusive month range), ordered by `recebido desc, client_name asc`.
- **Capped at 3 rows** in the function body (FR-020 + FR-025).
- Clients with `recebido = 0` excluded.

**Errors**

- `42501 insufficient_privilege`.

**Client mapping** → `TopClient[]`.

---

## 5. `admin_top_products`

**Args**

```sql
admin_top_products(
  p_seller uuid DEFAULT NULL,
  p_month_from date DEFAULT date_trunc('month', now())::date,
  p_month_to date DEFAULT date_trunc('month', now())::date
)
```

**Returns**

```sql
table (
  product_id uuid,
  product_name text,
  units int
)
```

**Semantics**

- Sum of `order_items.quantity` per product across orders whose `sent_at` falls in the period, ordered by `units desc, product_name asc`.
- **Capped at 3 rows** in the function body.
- Products with `units = 0` excluded.

**Errors**

- `42501 insufficient_privilege`.

**Client mapping** → `TopProduct[]`.

---

## 6. `admin_receivables_aging`

**Args**

```sql
admin_receivables_aging(
  p_seller uuid DEFAULT NULL,
  p_as_of date DEFAULT now()::date
)
```

**Returns**

```sql
table (
  bucket text,           -- '0-30', '31-60', '61-90', '>90' (label text only — UI translates to PT)
  days_min int,
  days_max int,          -- nullable for the >90 bucket
  total_pendente numeric
)
```

**Semantics**

- Considers only `orders.status = 'sent'` rows.
- `age_days = (p_as_of - orders.sent_at::date)`. Negative ages (future-dated `sent_at`) are excluded.
- `pendente_per_order = greatest(0, orders.total - <Receipt sum>)`.
- Sums `pendente_per_order` into the four buckets per the boundaries in research R6.
- Always returns 4 rows (even when `total_pendente = 0`); the client renders the empty state when all four are zero (FR-029).

**Errors**

- `42501 insufficient_privilege`.

**Client mapping** → `AgingBucket[]` of length 4.

---

## Client wrapper (`adminRevenueClient.ts`)

The TS wrapper surfaces six functions, one per RPC, returning `Promise<RowShape[]>`. It must:

- Use the standard project Supabase client (not the service-role one).
- Translate Postgres errors into a typed `AdminRevenueError` with `kind: 'forbidden' | 'network' | 'unknown'`.
- Never retry on `forbidden` — the screen surfaces "Sem permissão" copy and stops.
- Be 100% covered by `adminRevenueClient.test.ts` which mocks the Supabase client and asserts (a) the RPC name, (b) the parameter object shape, (c) the row→DTO mapping for happy path + forbidden path.

---

## Versioning

Any breaking change (column rename, removal, type change) requires a new migration `0021_*.sql` that adds the next version of the function alongside the old one, plus a coordinated client release. RLS additions/removals on the underlying tables MUST coordinate with this contract — RPC bodies assume the current `orders`, `payment_receipts`, `order_items`, `clients`, `products`, `salespeople`, `user_roles` schemas as of feature 016.
