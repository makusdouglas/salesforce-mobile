# Phase 0 Research — Revenue Dashboard (017)

This document captures the technical decisions taken to resolve open questions before implementation begins. Every NEEDS CLARIFICATION raised by the spec or by the technical context is resolved below.

## R1 — Charting library

**Decision**: `react-native-gifted-charts` (latest 2.x).

**Rationale**:

- Pure-JS / Skia-backed implementation that runs in Expo managed (and dev-client) workflows without requiring native module work — important because we are on Expo SDK 55 and prefer to avoid touching the iOS/Android dirs in this feature.
- Built-in stacked bar chart and line chart components match the spec's needs (KPI band uses no chart, trend = line or stacked-bar, seller ranking = horizontal bar, aging = horizontal bar). One library covers all four chart types.
- Touch handler API exposes `onPress(item, index)` per data point — required by FR-012 (tap a month → drill down) and FR-018 (tap a seller bar → set filter) without us needing a second gesture layer.
- Renders cleanly on phone and tablet at arbitrary widths; the library exposes `spacing`, `barWidth`, `initialSpacing`, and `rotateLabel` props sufficient to keep 12 monthly columns legible at both 390 pt and 820 pt widths.
- Active community (10k+ stars, weekly releases) and a small bundle footprint (~80 KB minified). No animation deps beyond `react-native-reanimated`, which is already part of the Expo SDK 55 baseline.

**Alternatives considered**:

- **`victory-native` (v40+)**: Mature, deeply customizable, but requires `react-native-skia` as a peer dependency — adds ~700 KB to the JS bundle and a non-trivial native build step. The flexibility is wasted for this feature; we don't need annotations, axis themes, voronoi tooltips, etc.
- **`react-native-svg-charts`**: Unmaintained since 2022; we'd inherit a security-update vacuum. Rejected.
- **In-house charting via `react-native-svg`**: Three chart types × two viewports × tablet polish = ~600 lines of bespoke chart code. Violates P3 (MVP simplicity) and reinvents what gifted-charts gives us in two component imports.
- **Web-based charts in a `WebView`**: Adds a second runtime, blocks offline (seller scope), and breaks accessibility. Rejected.

**Action**: Add `react-native-gifted-charts@^2` to `package.json`. No native config. Document in the feature's tasks the constitution-required justification line: "library justified per P3 + UX5 — covers all four chart types in one dep, no dev-build required".

## R2 — Aggregation surface for admin scope

**Decision**: SQL `SECURITY DEFINER` functions (one per panel) in a new migration `0020_revenue_dashboard.sql`. No views, no Edge Function, no client-side aggregation.

**Rationale**:

- Functions accept the filter parameters (`p_seller`, `p_month`, `p_month_from`, `p_month_to`, `p_as_of`) directly, avoiding the "select from a view, then filter on the client" anti-pattern that would force the client to download more rows than needed.
- `SECURITY DEFINER` lets the function read across all sellers without us having to add cross-seller RLS exceptions on the base tables (`orders`, `receipts`, `clients`, `products`). The function itself raises `insufficient_privilege` for non-admin callers — the role check lives in one place.
- One function per panel keeps the call surface explicit and matches the in-memory cache shape on the client. Each panel can refetch independently if we ever need partial refresh (not in v1).
- Pre-aggregation in Postgres is an order of magnitude cheaper than transferring raw `orders` + `receipts` rows over 4G. Honors P6 ("admin is online-first") without requiring a heavyweight network.

**Alternatives considered**:

- **Materialized views**: Would require a refresh schedule (cron) and accept stale data. Admin's expectation is "what is true right now". Rejected.
- **Raw select from `orders` + `receipts` with client-side reduce**: Violates FR-034 / SC-003 (no client-side aggregation in admin code path). Also pulls every order row over the wire. Rejected.
- **Edge Function**: Adds a deployment artifact and a cold-start latency for nothing — there is no business logic that doesn't fit in SQL. Rejected per P4.

**Action**: Create `supabase/migrations/0020_revenue_dashboard.sql` with the six functions (signatures in `contracts/admin-rpcs.md`).

## R3 — Local derivation strategy for seller scope

**Decision**: Pure TypeScript derivation modules in `src/features/revenue/derivations/`, called from `useSellerRevenue`. They consume already-loaded WatermelonDB collections via observers from existing repositories (`ordersRepository`, `paymentReceiptsRepository`, `clientsRepository`, `productsRepository`).

**Rationale**:

- WatermelonDB observers already power feature 013's OrdersOverview; we don't add a new query layer, just a new derivation layer on top of the same observed collections.
- Pure TS lets us unit-test each derivation (KPIs, trend, top clients, top products, aging) with Jest by feeding it plain JS objects — no DB needed in the test environment.
- Derivation runs synchronously inside `useMemo`, keyed by collection version + filter state. For a single seller's data (small N — typical seller has hundreds of orders, not millions), a full re-aggregate on each change is well under the 1s budget (SC-002).
- No new persistence on the client — honors R2 ("minimalist data model") and FR-035 (no new tables).

**Alternatives considered**:

- **A separate seller RPC** (mirroring the admin RPC shape): would force the seller scope to make a network call, breaking R1 / FR-036. Rejected.
- **Pre-computing aggregates in WatermelonDB tables on every order/receipt write**: violates D4 (read-only screen — but writes happen elsewhere) and adds churn to existing write paths for a UI that doesn't need it. Rejected.
- **Server-rendered HTML / chart images**: Would need internet; breaks offline. Rejected.

**Action**: Create the six derivation modules + their unit tests. Derivations consume the existing repositories, so no new repository methods are needed unless an observer doesn't already expose `sent_at` / `total` / `payment_receipts.amount` — which it does (verified by reading `ordersRepository.ts` and `paymentReceiptsRepository.ts`).

## R4 — Currency formatting and decimal handling

**Decision**: Reuse `formatBRL` from `src/features/orders/formatting/formatBRL.ts` (also used by feature 013's SummaryBand) for every R$ value rendered on this screen.

**Rationale**:

- One canonical helper. FR-008 explicitly mandates parity with feature 13's summary band; reusing the same function is the only way to guarantee that.
- Decimal arithmetic on the client uses plain JS numbers in practice today — fine for the magnitudes a single store sees (sub-millions). If we ever grow into territory where binary FP loses precision, the fix is to upgrade `formatBRL` and every caller benefits.

**Action**: Import the helper in panel components; no copies.

## R5 — Delta % computation and edge-case rendering

**Decision**:

- `delta = (current - previous) / previous`, expressed as a percentage with 1 decimal place.
- When `previous == 0` and `current > 0`: render "—" (em dash) per FR-007. Do NOT render `+∞%`.
- When `previous == 0` and `current == 0`: render "—" as well (no movement to show).
- When both > 0: signed percentage, e.g. `+12,4%` or `-3,7%`. Comma decimal separator (Brazilian convention).
- `Ticket médio` = `Faturado / N` where N = orders count for the month; when N == 0 → render `R$ 0,00` (FR-010), no division attempted.

**Rationale**: Two of these (FR-007, FR-010) are explicit functional requirements. The choice of em dash matches feature 013's empty-state convention.

**Action**: Implement in `src/features/revenue/shared/formatDelta.ts` and unit-test both edge cases.

## R6 — Aging bucket boundaries and `sent_at` semantics

**Decision**:

- Buckets are inclusive-of-lower, exclusive-of-upper for the first three: `[0, 31)`, `[31, 61)`, `[61, 91)`, `[91, ∞)` — labeled in UI as "0–30 dias", "31–60", "61–90", ">90".
- `age = floor((now - orders.sent_at) / 86400)` measured in whole days, evaluated against the device clock (seller scope) or `now()` server-side (admin scope). The `p_as_of` parameter on `admin_receivables_aging` defaults to `now()` but exists so we can test deterministically.
- `pendente_per_order = greatest(0, orders.total - coalesce(sum(receipts.amount), 0))`. Receipts' `corrected_by` chain is handled by counting only the latest non-corrected receipt per chain (consistent with feature 012's selectors).
- Only orders with `status = 'sent'` count (FR-026 says "sent orders"). Drafts and cancelled orders are excluded.

**Rationale**: Plain integer day boundaries match common business-rep mental model. Truncating to whole days avoids "29.9 days" classification flicker. Excluding drafts/cancelled keeps the aging panel about real receivables.

**Action**: Encoded in both the SQL function body (admin) and the local derivation (seller).

## R7 — Caching policy details (admin scope)

**Decision**:

- The admin screen owns a single `useRef` holding `{ snapshot, fetchedAt, filterKey }`. On mount and on filter change, the screen calls all six RPCs in parallel with `Promise.all`. On success, it replaces the ref and re-renders. On failure: if the previous snapshot's `filterKey` matches the current filter, render the cached snapshot with a "Atualizado em HH:mm" badge + retry button (FR-042); otherwise render the empty error state with retry (FR-041).
- Cache is screen-scoped — `useEffect` cleanup on unmount discards it. There is no app-level cache, no Context, no Zustand.

**Rationale**: Honors FR-035 literally. Avoids the next-class-up problem of cache invalidation.

**Action**: Implement in `useAdminRevenue.ts`.

## R8 — Drill-down carry of filters

**Decision**:

- `OrdersOverview` (feature 013) already accepts a month and (where applicable) a salesperson filter via its existing route param. Tapping a month on the trend chart navigates to `OrdersOverview` with `{ month: <YYYY-MM>, salespersonId: <activeSellerFilter | null> }`.
- If `OrdersOverview`'s current route param does not include `month` and `salespersonId`, this feature ships a **non-breaking extension** to `HomeStackParamList.OrdersOverview` (`OrdersOverview: { month?: string; salespersonId?: string | null } | undefined`). `OrdersOverview` ignores the params if it doesn't yet honor them — a follow-up task in this feature wires the actual filter pre-application in `OrdersOverviewScreen`.
- Tapping a top-product row from admin scope → `AdminProductForm` (feature 014). From seller scope → catalog product detail (feature 6). Both routes already exist.
- Tapping a top-client row → existing `ClientProfile` route in HomeStack.

**Rationale**: Reuses navigation surfaces feature 013/14/6/7 already expose. The only schema additions are the optional params — no new screens.

**Action**: Land the param extension in this feature's tasks; ensure `OrdersOverviewScreen` consumes them.

## R9 — Tablet layout for top clients + top products

**Decision**: A single flex row whose `flexDirection` is `row` on tablet (≥ 768 pt) and `column` on phone (< 768 pt). Each card is `flex: 1` with a 16 pt gap on tablet. No new responsive primitive needed — `useViewport()` already returns `'phone' | 'tablet'`.

**Rationale**: Matches the design pass exactly (see screenshots). No reason to invent a new "two-up" component.

**Action**: Wrap in a small `TwoUp` component inside `src/features/revenue/components/` for clarity.

## R10 — Test strategy

**Decision**:

- **Unit tests (Jest)** for each derivation in `src/features/revenue/derivations/` — feed plain JS arrays of orders/receipts and assert exact output shapes (KPI numbers, trend points, top-N rows, aging bucket totals).
- **Unit tests** for `formatDelta`, edge cases (`previous == 0`, both zero, negative, large numbers).
- **Contract test** for `adminRevenueClient.ts` — mocks `@supabase/supabase-js` and asserts the RPC names + parameter shapes match `contracts/admin-rpcs.md`. Catches drift between client and migration.
- **Manual phone+tablet pass** on a populated demo dataset before marking the screen task complete (per UX5).
- No E2E tests in the MVP per constitution §9.

**Rationale**: Aligns with constitution §9 (business-logic tests prioritized; UI does not need exhaustive testing).

**Action**: Tests are listed alongside the modules they verify in `tasks.md` (Phase 5).

---

All NEEDS CLARIFICATION items are resolved. Ready for Phase 1.
