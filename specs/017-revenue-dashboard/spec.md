# Feature Specification: Revenue Dashboard

**Feature Branch**: `017-revenue-dashboard`
**Created**: 2026-04-25
**Status**: Draft
**Roles affected**: `admin + seller (dual-role)` — admins see aggregated cross-seller data with optional single-seller filter; sellers see only their own data. Dual-role users (UX6) see both entry points and the dashboard auto-detects scope from the entry point.
**Input**: User description: "Revenue dashboard for admins (aggregated, with optional single-seller filter) and for each seller (own data only); same screen powers both views with role-based scope. Layout: KPI band, monthly trend chart, seller ranking (admin only), top clients & top products, aging de recebíveis. Admin filters by vendedor and período. Admin = online-first via Supabase RPCs; seller = offline-first via WatermelonDB. Read-only derivations only."

## UI Design *(primordial source)*

**Design source**: [design/screens.md](./design/screens.md) — generated from `layout.pen` via the Pencil MCP.

### Screens

| Screen | Screenshot | Intent |
|--------|------------|--------|
| RevenueDashboard / Phone (admin) | [revenue-dashboard-phone.png](./design/revenue-dashboard-phone.png) | Full admin scope — filters, KPI band, trend, ranking, top clients/products, aging |
| RevenueDashboard / Tablet (admin) | [revenue-dashboard-tablet.png](./design/revenue-dashboard-tablet.png) | Tablet variant with side-by-side top clients/products |
| RevenueDashboardSeller / Phone | [revenue-dashboard-seller-phone.png](./design/revenue-dashboard-seller-phone.png) | Seller scope — no filter bar, no seller ranking |
| RevenueDashboardSeller / Tablet | [revenue-dashboard-seller-tablet.png](./design/revenue-dashboard-seller-tablet.png) | Seller scope tablet variant |

### Working layout

The dashboard is a single scrollable screen. Top-to-bottom order is fixed; admin-only panels are simply hidden when the seller scope is active.

| Order | Panel | Admin scope | Seller scope |
|-------|-------|-------------|--------------|
| 1 | KPI band (Recebido / Faturado / Pendente / Ticket médio / Nº pedidos enviados) — each with delta % vs previous month | Aggregated across sellers, honoring vendedor filter | Self only |
| 2 | Monthly trend chart (last 12 months: Faturado, Recebido, Pendente) with overlay toggle "Comparar com ano anterior" | Aggregated, honoring filter | Self only |
| 3 | Seller ranking — horizontal bars of Recebido by seller for active month, sorted desc, tap to set filter | **Visible** | **Hidden** |
| 4 | Top clients (Top 3 by Recebido) + Top products (Top 3 by units sold) — side-by-side on tablet, stacked on phone | Aggregated, honoring filter | Self only |
| 5 | Aging de recebíveis — bucketed bars (0–30, 31–60, 61–90, >90) of total Pendente by age of `orders.sent_at` | Aggregated, honoring filter | Self only |

### Filters (admin only — hidden in seller scope)

- **Vendedor**: chip "Todos" + tap-first list of active sellers; selecting one re-scopes every panel (including drill-down targets).
- **Período**: month range picker. Default = current month for KPIs/aging; default = last 12 months for trend chart.

### Drill-downs

- Trend chart: tap a month → opens OrdersListScreen (feature 13) pre-filtered to that month and to the active seller filter.
- Seller ranking bar: tap → sets vendedor filter to that seller on this dashboard.
- Top client: tap → opens client profile (feature 7).
- Top product: tap → opens AdminProductForm (feature 14) for admin, or catalog detail (feature 6) for seller.

### Design decisions carried into this spec

- One screen, one scroll, role-conditional panels — avoids a separate admin-only screen.
- All values in R$ follow the formatting and decimal handling already used by feature 13's summary band.
- Charts must degrade gracefully with sparse data: empty states use salesperson-friendly Portuguese copy (UX3), never a broken chart (UX5).
- "Comparar com ano anterior" overlay only appears when there is at least one month of data in the prior-year window; otherwise the toggle is disabled with a hint.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin sees consolidated revenue health (Priority: P1)

The administrator opens AdminHome (feature 14), taps the new **Receita** card, and immediately sees how the business is doing this month: total Recebido, Faturado, Pendente, Ticket médio, Nº pedidos enviados — each with a delta vs the previous month and an up/down indicator. Below the KPIs, the 12-month trend chart shows where the business is heading. The seller ranking shows who is producing this month. Top clients and top products show what's driving revenue. Aging de recebíveis shows how much is stuck and how old.

**Why this priority**: This is the primary business-monitoring surface for the administrator. Without it, the admin has no consolidated view of the operation — feature 13's order list shows individual orders but never aggregates revenue, deltas, or aging. P1 because it unlocks the entire feature.

**Independent Test**: Sign in as an admin user with at least 2 sellers, recent orders, and partial receipts. Tap the Receita card. Verify all five KPIs render with correct values and deltas, the trend chart shows three series for 12 months, the seller ranking shows sellers sorted desc by Recebido, top clients/products show top 3, and aging shows non-zero buckets where applicable.

**Acceptance Scenarios**:

1. **Given** an admin with multiple active sellers and orders in the current and previous month, **When** the admin opens the Receita dashboard, **Then** the KPI band shows current-month absolute values for all five KPIs and a signed delta % vs the previous month.
2. **Given** an admin viewing the dashboard, **When** the trend chart loads, **Then** it shows the last 12 months with three series (Faturado, Recebido, Pendente) labeled and color-coded.
3. **Given** an admin viewing the dashboard, **When** at least 2 sellers have Recebido > 0 in the active month, **Then** the seller ranking shows them as horizontal bars sorted descending by Recebido.
4. **Given** an admin viewing the dashboard, **When** there are at least 3 clients with Recebido > 0 in the filter window, **Then** the Top Clients panel lists the top 3 sorted by Recebido.

---

### User Story 2 - Seller sees their own revenue from the home shortcut (Priority: P1)

A seller on the road taps the new **Minha receita** card on the seller home (feature 8) — sitting alongside Catálogo, Clientes, Pedidos, Rascunhos. The dashboard opens scoped to their own data. They see the same panels as the admin (minus the seller ranking and the vendedor filter). All data is computed locally from WatermelonDB so it works fully offline.

**Why this priority**: Sellers in the field need an at-a-glance view of their own performance without waiting for connectivity (R1, P6). P1 because it is the seller's first-class view of their own business.

**Independent Test**: Put the device in airplane mode after a successful sync. Sign in as a seller. Tap **Minha receita**. Verify the screen renders KPIs, trend, top clients, top products, and aging using only local data, with no spinner stuck on a network call.

**Acceptance Scenarios**:

1. **Given** a seller signed in offline with WatermelonDB populated from a prior sync, **When** the seller taps Minha receita, **Then** the dashboard renders all panels using local data only and never blocks on a network request.
2. **Given** a seller viewing Minha receita, **When** the screen loads, **Then** the seller ranking panel is hidden and the vendedor filter is not present.
3. **Given** a seller viewing Minha receita, **When** the seller taps a month on the trend chart, **Then** OrdersListScreen opens pre-filtered to that month and scoped to the seller's own orders.

---

### User Story 3 - Admin filters the dashboard to a single seller (Priority: P2)

An admin wants to evaluate one seller's performance. They open the dashboard, tap the **Vendedor** filter, pick that seller from the tap-first list. Every panel on the screen — KPIs, trend, top clients/products, aging — re-scopes to that seller. Drill-downs (trend tap → OrdersListScreen) inherit the filter. Tapping a bar in the seller ranking is a shortcut for the same action.

**Why this priority**: Differentiates the admin view from the seller view and supports performance reviews / coaching conversations. P2 because the dashboard is still useful without the filter (Story 1 covers the aggregated case).

**Independent Test**: As an admin, open the dashboard. Note the aggregated values. Pick one seller from the Vendedor filter. Verify every panel changes; verify the drill-down to OrdersListScreen carries the seller filter. Tap "Todos" to clear the filter and verify the panels return to aggregated values.

**Acceptance Scenarios**:

1. **Given** an admin viewing the dashboard with the "Todos" filter active, **When** the admin selects a specific seller from the vendedor filter, **Then** every panel (KPI band, trend, top clients, top products, aging) re-renders with values scoped to that seller only.
2. **Given** an admin with the vendedor filter set to a specific seller, **When** the admin taps a month on the trend chart, **Then** OrdersListScreen opens filtered to that month AND that seller.
3. **Given** an admin viewing the dashboard with "Todos" active, **When** the admin taps a bar in the seller ranking, **Then** the vendedor filter is set to that seller and all panels re-scope.

---

### User Story 4 - Admin compares against the previous year (Priority: P3)

An admin wants seasonal context — is March 2026 better or worse than March 2025? They toggle **Comparar com ano anterior** above the trend chart. The chart adds a fainter set of points/lines for the same months one year ago. When prior-year data does not exist, the toggle is disabled with a short hint instead of showing an empty overlay.

**Why this priority**: A useful analytical lens but not required for day-1 value. The dashboard is fully functional without it.

**Independent Test**: Seed orders that span at least 13 months. Open the dashboard, toggle the overlay on, verify the prior-year series renders as a fainter overlay aligned to the same months. With < 1 month of prior-year data, verify the toggle is disabled with the hint copy.

**Acceptance Scenarios**:

1. **Given** the dashboard has at least one month of data in the prior-year window, **When** the admin toggles "Comparar com ano anterior" on, **Then** the trend chart adds a visually distinct (lighter/faded) prior-year series for the same calendar months.
2. **Given** there is no data in the prior-year window, **When** the admin views the trend chart, **Then** the toggle is disabled and shows a hint such as "Sem dados do ano anterior para comparar".

---

### User Story 5 - Dual-role user switches scope by entry point (Priority: P3)

A user with both admin and seller roles sees both **Receita** (on AdminHome) and **Minha receita** (on the seller home) cards simultaneously. Tapping Receita opens the admin scope; tapping Minha receita opens the seller scope. The same dashboard component handles both — the entry point determines what data source and what panels are shown.

**Why this priority**: A small but important correctness behavior for UX6 dual-role users. P3 because most users are single-role; the dual-role population is a minority but the bug surface (showing the wrong scope) would be high-impact for them.

**Independent Test**: Sign in as a user with both admin and seller grants. Verify both cards appear on their respective home screens. Open Receita; verify admin filters appear. Go back, open Minha receita; verify seller scope (no vendedor filter, no seller ranking).

**Acceptance Scenarios**:

1. **Given** a dual-role user is signed in, **When** they view AdminHome and the seller home, **Then** both Receita and Minha receita cards are visible on their respective homes.
2. **Given** a dual-role user opens Receita from AdminHome, **When** the dashboard loads, **Then** it renders the admin scope (Supabase-backed, with vendedor filter and seller ranking).
3. **Given** the same user opens Minha receita from the seller home, **When** the dashboard loads, **Then** it renders the seller scope (WatermelonDB-backed, no vendedor filter, no seller ranking).

---

### Edge Cases

- **Seller has no orders yet**: KPIs show R$ 0,00 and "—" (em dash) for delta. Trend chart shows an empty-state illustration with copy like "Ainda não há dados suficientes para exibir." (UX3). Top clients/products show empty-state copy. Aging panel hides bars and shows "Sem pendências em aberto."
- **All Pendente values are zero**: Aging panel collapses to a single empty-state row "Sem pendências em aberto." instead of showing four empty bars.
- **Previous month has no data** (so delta % is undefined): Show "—" (em dash) where the delta would appear; do not show "+∞%" or "NaN%".
- **Admin is offline**: Per P6 admin is online-first. Show the cached in-memory snapshot if one exists (with a "Atualizado em HH:mm" hint); otherwise show a friendly error state with "Sem conexão. Tente novamente." and a retry button. Never write the admin response to WatermelonDB.
- **Seller is offline**: Works fully — all panels render from WatermelonDB. No banner, no warning.
- **Admin selects a seller in the vendedor filter who has zero data**: Each panel renders its own empty state (same copy as a seller with no orders); the screen never shows a generic "no data" page that hides the filter chips.
- **Drill-down target month has no orders**: OrdersListScreen handles its own empty state; the dashboard simply navigates with the filter set.
- **More than 3 sellers/clients/products tied for top spot**: Stable sort by name (asc) as the tiebreaker, then take the first 3.
- **Seller ranking with > 10 sellers**: Show the top 10 inline; provide no "see all" — the panel is a quick visual snapshot, not a full report (avoids scope creep into a separate sellers report).
- **Sparse trend chart (e.g., only 2 months of data)**: Render whatever months exist; do not pad with zeros (zeros lie about activity). Empty months render as gaps.

## Requirements *(mandatory)*

### Functional Requirements

#### Access & Routing

- **FR-001**: System MUST add a **Receita** card to AdminHome (feature 14) visible to any user holding any admin-grade role; no new role-gate beyond admin visibility.
- **FR-002**: System MUST add a **Minha receita** card to the seller home (feature 8), placed alongside Catálogo, Clientes, Pedidos, and Rascunhos, replacing none of them.
- **FR-003**: System MUST surface both cards simultaneously for dual-role users (UX6) and load the appropriate scope based on the entry point (admin card → admin scope; seller card → seller scope).
- **FR-004**: System MUST resolve the dashboard scope deterministically from the entry point at navigation time and not infer scope from any in-screen toggle.

#### KPI Band

- **FR-005**: System MUST display five KPIs in a fixed order: Recebido, Faturado, Pendente, Ticket médio, Nº de pedidos enviados.
- **FR-006**: Each KPI MUST show the absolute value for the current month and a signed delta % vs the previous calendar month, with an up/down visual indicator.
- **FR-007**: When the previous month has no comparable data, the delta MUST render as an em dash ("—") and the up/down indicator MUST be omitted; the system MUST NOT display "NaN", "∞", or zero deltas in this case.
- **FR-008**: KPI absolute values MUST use the same R$ formatting and decimal handling as feature 13's summary band.
- **FR-009**: Admin-scope KPIs MUST aggregate across sellers honoring the active vendedor filter; seller-scope KPIs MUST be scoped to the signed-in seller's own data only.
- **FR-010**: Ticket médio MUST be defined as `Faturado / Nº pedidos enviados` for the active month; when Nº pedidos enviados = 0, Ticket médio MUST render R$ 0,00 (not divide-by-zero).

#### Trend Chart

- **FR-011**: System MUST display a monthly trend chart spanning the last 12 calendar months (default período for this panel) with three named series: Faturado, Recebido, Pendente.
- **FR-012**: Tapping a month on the trend chart MUST navigate to OrdersListScreen (feature 13) pre-filtered to that month AND to the active seller filter (or "all sellers" when admin has no filter active).
- **FR-013**: System MUST provide a "Comparar com ano anterior" toggle above the trend chart that, when on, adds a visually distinct fainter series for the same calendar months one year ago.
- **FR-014**: When the prior-year window has zero data, the comparison toggle MUST be disabled and accompanied by a short hint (Portuguese, salesperson-language).
- **FR-015**: Trend chart series MUST render legibly on phone and tablet (UX5); the system MUST NOT render an empty/broken chart — if no data exists in the window, an empty-state illustration with Portuguese copy MUST be shown instead (UX3).

#### Seller Ranking (admin only)

- **FR-016**: System MUST display a horizontal bar chart of Recebido by seller for the active month, sorted descending, in admin scope only.
- **FR-017**: System MUST hide the seller ranking entirely in seller scope (no panel header, no empty state).
- **FR-018**: Tapping a bar in the seller ranking MUST set the dashboard's vendedor filter to that seller and re-scope all other panels accordingly.
- **FR-019**: System MUST cap the visible ranking at the top 10 sellers (tie-broken by seller name ascending) — no "see all" affordance.

#### Top Clients & Top Products

- **FR-020**: System MUST display a Top 3 clients list ranked by Recebido within the active filter window.
- **FR-021**: System MUST display a Top 3 products list ranked by units sold within the active filter window.
- **FR-022**: On tablet form factors the two lists MUST render side-by-side; on phone form factors they MUST stack vertically.
- **FR-023**: Tapping a client row MUST open the client profile (feature 7).
- **FR-024**: Tapping a product row MUST open AdminProductForm (feature 14) when in admin scope, or the catalog detail (feature 6) when in seller scope.
- **FR-025**: Ties beyond the top 3 MUST be broken by name (ascending) before truncation.

#### Aging de Recebíveis

- **FR-026**: System MUST bucket total Pendente across sent orders by the age of `orders.sent_at` into four buckets: 0–30 dias, 31–60, 61–90, and >90.
- **FR-027**: Per-order Pendente MUST be computed as `max(0, order.total − sum(receipts.amount))`, then summed by bucket.
- **FR-028**: Aging MUST honor the active scope (admin filter or seller-self).
- **FR-029**: When all buckets are zero, the panel MUST show empty-state copy ("Sem pendências em aberto.") instead of four empty bars.

#### Filters (admin only)

- **FR-030**: System MUST display a **Vendedor** filter (admin only) consisting of a "Todos" chip and a tap-first list of active sellers; selecting an option MUST re-scope every panel and inherit into all drill-down targets.
- **FR-031**: System MUST display a **Período** month-range filter (admin only) defaulting to the current month for KPIs/aging and the last 12 months for the trend chart.
- **FR-032**: Filters MUST be hidden entirely in seller scope.
- **FR-033**: Changing a filter MUST re-fetch (admin) or re-derive locally (seller) all panels; partial re-fetch MUST NOT leave stale values in unrelated panels.

#### Data Sources & Constraints

- **FR-034**: Admin scope MUST read panel data exclusively from Supabase via dedicated server-side aggregations (e.g. RPCs/views named `admin_revenue_monthly`, `admin_revenue_by_seller`, `admin_top_clients`, `admin_top_products`, `admin_receivables_aging`); the client MUST NOT pull raw orders or receipts and aggregate them itself (P6).
- **FR-035**: Admin-scope responses MUST be cached in memory only for the lifetime of the screen; the system MUST NOT write any admin-aggregation result to WatermelonDB.
- **FR-036**: Seller scope MUST compute every panel locally from WatermelonDB via repositories with no Supabase calls during dashboard rendering (R1).
- **FR-037**: System MUST NOT mutate `orders` or `receipts` (or any other write surface) from this screen; all values are read-only derivations (D4).
- **FR-038**: System MUST NOT introduce any new status enum values.
- **FR-039**: System MUST NOT introduce any new role specifically for "view revenue" — admin visibility (any admin-grade role from feature 016) is sufficient.

#### Empty States, Errors, Offline

- **FR-040**: Every panel MUST have a sparse-data empty state with salesperson-language Portuguese copy (UX3); a panel MUST NEVER render a broken chart, an "undefined" label, or a dev-style error.
- **FR-041**: In admin scope when no cached snapshot exists and the network call fails, the screen MUST show a friendly error state with a retry affordance.
- **FR-042**: In admin scope when a cached snapshot exists and the latest fetch fails, the screen MUST show the cached values with an "Atualizado em HH:mm" timestamp and a non-blocking refresh affordance.
- **FR-043**: Seller scope MUST function fully offline (no network call during render); the system MUST NOT show "Sem conexão" banners on the seller dashboard.

### Key Entities

> All entities are read-only derivations; this feature creates no new write paths.

- **Revenue snapshot (admin)**: Aggregated rows returned by Supabase RPCs/views, keyed by (período, seller filter). Includes monthly KPIs, monthly trend points, per-seller monthly Recebido, top clients/products lists, and aging buckets. Lives in memory only; never persisted client-side.
- **Revenue snapshot (seller)**: Same shape as admin (minus per-seller ranking), computed locally from WatermelonDB by reading the seller's own orders and their receipts. Materialized on demand inside the dashboard view models; not persisted in a new table.
- **Filter state**: `{ sellerId | null, periodStart, periodEnd }` — UI-only state owned by the dashboard screen; default `sellerId = null` ("Todos"), default período = current month for KPIs/aging and last 12 months for trend.
- **Aging bucket**: `{ label, days_min, days_max | null, total_pendente }` — derived from `orders.sent_at` and `receipts.amount` per the FR-026/FR-027 formula.

> No new tables. The feature relies on existing entities from prior features: `orders`, `receipts`, `order_items`, `products`, `clients`, and `users` (as already used by feature 13 and feature 14).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin opening the dashboard from a fully-populated AdminHome (≥ 2 sellers, ≥ 50 orders this month, ≥ 20 with partial receipts) sees all five panels rendered with real values within 3 seconds on a typical 4G connection.
- **SC-002**: A seller opening Minha receita with the device in airplane mode (after a successful prior sync) sees the dashboard fully rendered within 1 second from local data, with no network call attempted.
- **SC-003**: 100% of admin-scope panel data on this screen comes from server-side aggregations; zero client-side aggregation of raw `orders`/`receipts` rows is performed (verified by code inspection of the admin code path).
- **SC-004**: 100% of seller-scope panel data on this screen comes from WatermelonDB; zero Supabase calls are made from the seller code path during dashboard rendering (verified by code inspection / network log when offline).
- **SC-005**: Switching the admin vendedor filter from "Todos" to a specific seller updates every panel within 2 seconds, with no stale values from the previous filter visible in any panel.
- **SC-006**: Tapping any drill-down (trend month, ranking bar, client row, product row) navigates to the correct destination with the correct filter applied on first attempt in 95% of usability test sessions.
- **SC-007**: Empty states for sparse data render in salesperson-language Portuguese with no "undefined", "NaN", "Infinity", or English fallback copy visible in any panel under any data condition.
- **SC-008**: The dashboard renders without horizontal scroll, cropped charts, or overlapping labels on phones (≤ 414 pt wide) and tablets (≥ 768 pt wide).
- **SC-009**: Zero writes to `orders` or `receipts` (or any other table) occur from any interaction on this screen, verified by repository-level inspection.

## Assumptions

- **Existing aggregation surfaces**: Supabase RPCs / views for the five admin aggregations (`admin_revenue_monthly`, `admin_revenue_by_seller`, `admin_top_clients`, `admin_top_products`, `admin_receivables_aging`) do not yet exist and will be created as part of this feature's plan/data-model phase. RLS will scope them to admin-grade roles only.
- **Existing WatermelonDB schema**: Seller-side aggregations rely entirely on the `orders`, `order_items`, `receipts`, `products`, and `clients` tables already populated by features 005/006/007/009/012; no new columns or tables are added to WatermelonDB.
- **Charting library**: A single off-the-shelf React Native charting library (e.g. `victory-native` or `react-native-gifted-charts`) will be added in this feature's plan phase; the choice and rationale are captured in `research.md`.
- **Currency / decimal handling**: R$ formatting and decimal arithmetic reuse the helpers already used by feature 13's summary band — no new currency utility is introduced.
- **Seller ranking visible threshold**: Caps at top 10 sellers; if real-world data shows the cap is too low, the cap is adjusted in a follow-up — no in-app "see all" expansion is built in v1.
- **Period filter granularity**: Month-level only. Custom day ranges, quarters, or fiscal-year periods are explicitly out of scope for v1.
- **Caching policy (admin)**: In-memory only, scoped to the screen's lifecycle. No persistence to WatermelonDB, no shared cross-screen cache. Acceptable for v1 because admin sessions are short-lived in practice.
- **No exports**: PDF/CSV export of the dashboard is out of scope for v1.
- **No drill-down on aging buckets**: Tapping an aging bar does not open a filtered orders list in v1; the panel is a snapshot only.
- **Dual-role detection**: Already handled by the existing role-resolution logic from feature 016; this feature consumes it but does not modify it.
