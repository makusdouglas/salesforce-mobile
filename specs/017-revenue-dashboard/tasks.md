# Tasks: Revenue Dashboard

**Input**: Design documents in `/specs/017-revenue-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/admin-rpcs.md, contracts/seller-derivations.md, design/screens.md
**Branch**: `017-revenue-dashboard`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable — different files, no dependencies on incomplete tasks in the same phase
- **[Story]**: user-story label (US1..US5)

## Path Conventions

Mobile app, single Expo project. Source under `src/`, migrations under `supabase/migrations/`.

---

## Phase 0: Design 🎨 — already complete

Pencil artifacts produced and recorded in `specs/017-revenue-dashboard/design/`. No tasks to generate here.

- [x] T000 Pencil design pass (4 frames: phone+tablet × admin+seller) captured in `design/screens.md` and `design.json`.

---

## Phase 1: Setup (project + infra)

- [X] T001 Add `react-native-gifted-charts` to `package.json` and run `pnpm install`. Verify it imports cleanly in a throwaway script (`node -e "require('react-native-gifted-charts')"` is not enough — confirm Metro bundles it by adding a temporary import in `src/_debug` then removing it).
- [X] T002 Create the migration `supabase/migrations/0020_revenue_dashboard.sql` containing the six SECURITY DEFINER functions per `contracts/admin-rpcs.md`. Each function: role guard at top (raise 42501 for non-admin), `LANGUAGE plpgsql`, `SECURITY DEFINER`, owner postgres, `grant execute ... to authenticated;`. **This task MUST land before any admin screen task per the Role & Authorization Check gate.**
- [X] T003 [P] Apply the migration locally via `pnpm supabase db push` and smoke-test the role guard from `psql` (admin → 5 KPI rows; non-admin → 42501) per quickstart §2.
- [X] T004 [P] Create the empty feature folders: `src/features/revenue/{screens,hooks,derivations,shared,components}` and `src/features/admin/revenue/{screens,hooks,service,components}`. Each folder gets an `index.ts` that re-exports its public surface. No logic yet.

---

## Phase 2: Foundational (shared types, helpers, navigation wiring)

These are blocking prerequisites for every story.

- [X] T005 Define the snapshot types in `src/features/revenue/shared/types.ts` per `data-model.md` §4 (`Scope`, `RevenueFilter`, `KpiBlock`, `TrendPoint`, `RankedSeller`, `TopClient`, `TopProduct`, `AgingBucket`, `RevenueSnapshot`).
- [X] T006 [P] Implement `src/features/revenue/shared/formatDelta.ts` (signed % with comma decimal; em dash for null/zero-previous; up/down direction). Add `formatDelta.test.ts` covering all edge cases from research.md R5.
- [X] T007 [P] Add Portuguese empty-state copy strings to `src/features/revenue/shared/empty-states.ts` (one per panel: KPI band — N/A, trend, top clients, top products, aging, prior-year overlay disabled).
- [X] T008 [P] Add a small `TwoUp` responsive wrapper at `src/features/revenue/components/TwoUp.tsx` (uses `useViewport()` to switch flexDirection between `column` and `row`). Re-export from the components barrel.
- [X] T009 Promote or re-export the existing `useViewport` hook so both feature folders can import it from a single canonical location: `src/features/revenue/hooks/useViewport.ts` re-exports from `src/features/orders/hooks/useViewport.ts`. Do NOT duplicate logic.
- [X] T010 Extend `OrdersOverview` route params in `src/app/navigation/types.ts` to accept `{ month?: string; salespersonId?: string | null }` (non-breaking — default both to undefined). Mirror in any inline param type. No screen-side wiring yet — that lives in T024 / T039.
- [X] T011 Add the `Revenue` route to `HomeStackParamList` in `src/app/navigation/types.ts` and the `AdminRevenue` route to `AdminStackParamList`. Both take `undefined` (no params). Wire screens up in T012 once the screen file exists.

---

## Phase 3: User Story 1 — Admin sees consolidated revenue health (P1) 🎯 MVP

**Goal**: Admin opens AdminMenu → Receita and immediately sees all 5 panels populated for the current month with deltas.

**Independent test**: As an admin with ≥ 2 sellers, ≥ 50 orders this month and ≥ 20 with partial receipts, tap Receita on AdminMenu. Verify all 5 KPIs render with deltas, the trend chart shows 12 months × 3 series, the ranking shows ≥ 2 sellers sorted desc, top clients/products show 3 each, and aging shows non-zero buckets. Per quickstart §4 steps 1–11.

### Admin data layer

- [X] T012 [P] [US1] Implement `src/features/admin/revenue/service/adminRevenueClient.ts` — six functions wrapping the RPCs per `contracts/admin-rpcs.md`. Each maps Postgres errors into `AdminRevenueError { kind: 'forbidden' | 'network' | 'unknown'; message: string }` and returns `Promise<Row[]>`.
- [X] T013 [P] [US1] Add `adminRevenueClient.test.ts` (Jest) — mock `@supabase/supabase-js`, assert RPC names, parameter shapes, row→DTO mapping for happy + forbidden paths. Coverage = 100% per contract.
- [X] T014 [US1] Implement `src/features/admin/revenue/hooks/useAdminRevenue.ts` — orchestrates the six RPC calls in parallel via `Promise.all`, owns the screen-scoped `useRef` cache `{ snapshot, fetchedAt, filterKey }`, drives the `loading | ready | ready_stale | error` state machine per data-model.md §6.
- [X] T015 [P] [US1] Implement `src/features/admin/revenue/hooks/useAdminRevenueFilters.ts` — owns `{ sellerId: null, month: <current>, trendFrom: <m-11>, trendTo: <current> }`. Setter API for vendedor and período.

### Shared panel components (used by US1 and US2)

- [X] T016 [P] [US1] Implement `src/features/revenue/components/KpiBand.tsx` — renders 5 cards in 2+2+1 grid. Uses `formatBRL` from `src/features/orders/formatting/formatBRL.ts` and `formatDelta` from T006. Accepts `kpis: KpiBlock[]`. Empty/zero rendering per FR-007 / FR-010.
- [X] T017 [P] [US1] Implement `src/features/revenue/components/TrendChartCard.tsx` — wraps `LineChart` (or stacked-bar variant) from `react-native-gifted-charts`. Three series Faturado / Recebido / Pendente. Renders the comparison overlay when `priorYearTrend` is provided. Empty state per FR-015 + T007. Tap-handler prop `onMonthPress(month: string)`.
- [X] T018 [P] [US1] Implement `src/features/revenue/components/SellerRankingCard.tsx` — horizontal bar chart from gifted-charts, sorted desc, capped at 10. `onSellerPress(salespersonId)` callback. Returns `null` if input is empty (no panel header — FR-017 hides the entire card in seller scope, but the component renders an empty-state when called with empty data in admin scope).
- [X] T019 [P] [US1] Implement `src/features/revenue/components/TopClientsCard.tsx` — list of up to 3 rows. Tap a row → calls `onClientPress(clientId)` (parent navigates). Empty state copy per T007.
- [X] T020 [P] [US1] Implement `src/features/revenue/components/TopProductsCard.tsx` — symmetric to TopClientsCard but with `units` not `recebido`. `onProductPress(productId)` callback.
- [X] T021 [P] [US1] Implement `src/features/revenue/components/AgingCard.tsx` — 4 horizontal bars green / amber / orange / red per design. Empty state collapses to one line "Sem pendências em aberto." per FR-029.

### Admin screen + filter UI + navigation

- [X] T022 [US1] Implement `src/features/admin/revenue/components/VendedorFilterSheet.tsx` — bottom sheet with "Todos" chip + tap-first list of active sellers (loaded via a thin Supabase select on `salespeople`). Pure presentation; receives sellers + onSelect from parent.
- [X] T023 [US1] Implement `src/features/admin/revenue/hooks/useActiveSellersForFilter.ts` — fetches active sellers list once when sheet opens, caches in memory. Returns `{ sellers, loading, error }`.
- [X] T024 [US1] Implement `src/features/admin/revenue/screens/AdminRevenueScreen.tsx` — top bar, filter bar (chips for vendedor + período), assembles all six panels via `useAdminRevenue` + the panel components from T016–T021. Navigation handlers: trend→`OrdersOverview` with month + salespersonId; ranking→sets vendedor filter; client→`ClientProfile`; product→`AdminProductForm`. Render `KpiBand` + `TrendChartCard` + `SellerRankingCard` + `TwoUp(TopClientsCard, TopProductsCard)` + `AgingCard` in fixed order. Show "Atualizado em HH:mm" badge in `ready_stale`. Show retry empty state in `error`.
- [X] T025 [US1] Wire the new `AdminRevenue` route in `src/app/navigation/AdminStack.tsx` (after the existing screens, no new initial route).
- [X] T026 [US1] Add the **Receita** tile to AdminMenuScreen at `src/features/admin/sellers/screens/AdminMenuScreen.tsx` (or wherever `AdminMenuScreen` lives — verify path). Visible to any admin-grade role per FR-001 (no extra gate). Reuse the existing tile pattern.
- [X] T027 [US1] Manual verification on phone simulator + tablet simulator per quickstart §4 steps 1–11. Confirm all 5 panels render, deltas show correct direction icons, drill-downs navigate to the right screens with the right params.

**Checkpoint**: User Story 1 alone delivers the MVP — admins can monitor business health from one screen.

---

## Phase 4: User Story 2 — Seller sees own revenue from home shortcut (P1)

**Goal**: Seller (or dual-role user from seller home) opens "Minha receita", sees the same panels minus filter + ranking, fully offline.

**Independent test**: Sign in as seller, airplane mode, tap Minha receita, verify ≤ 1 s render from local data with no spinner stuck on a network call. Per quickstart §5.

### Seller derivations

- [X] T028 [P] [US2] Implement `src/features/revenue/derivations/kpis.ts` (`deriveKpis`) per `contracts/seller-derivations.md` §1. Add `kpis.test.ts` covering happy path, empty input, previous-month-zero edge case, ticket-médio divide-by-zero.
- [X] T029 [P] [US2] Implement `src/features/revenue/derivations/trend.ts` (`deriveTrend`) per §2. Add `trend.test.ts` covering happy path, sparse months (gaps not zeros), prior-year window.
- [X] T030 [P] [US2] Implement `src/features/revenue/derivations/topClients.ts` per §3 with tie-break by client name asc. Add `topClients.test.ts`.
- [X] T031 [P] [US2] Implement `src/features/revenue/derivations/topProducts.ts` per §4. Add `topProducts.test.ts`.
- [X] T032 [P] [US2] Implement `src/features/revenue/derivations/aging.ts` per §5. Add `aging.test.ts` covering boundary days (30, 31, 60, 61, 90, 91) and all-zero collapse.
- [X] T033 [US2] Implement `src/data/repositories/revenueQueries.ts` — small helpers that observe the seller's orders, their receipts (latest-non-corrected per chain), their items, and build the `clientNameById` / `productNameById` maps. Reuses existing repositories; do NOT add new WatermelonDB queries that break feature 005's observer patterns.

### Seller screen + entry point

- [X] T034 [US2] Implement `src/features/revenue/hooks/useSellerRevenue.ts` per `contracts/seller-derivations.md` aggregator section. Synchronous after first observer tick; `isLoading: false` at idle.
- [X] T035 [US2] Implement `src/features/revenue/hooks/useSellerRevenueFilter.ts` — pins `sellerId` to the active seller, defaults `month = current`, `trendFrom = m-11`, `trendTo = current`. Read-only in v1 (seller has no filter UI).
- [X] T036 [US2] Implement `src/features/revenue/screens/SellerRevenueScreen.tsx` — top bar "Minha receita" + month indicator. Renders `KpiBand` + `TrendChartCard` + `TwoUp(TopClientsCard, TopProductsCard)` + `AgingCard`. **Does NOT render** `SellerRankingCard` (FR-017). No filter bar. Trend tap → `OrdersOverview` with `month + salespersonId = self`. Top product tap → catalog product detail (feature 6) `ProductDetail` route. Top client tap → `ClientProfile`.
- [X] T037 [US2] Wire the new `Revenue` route in the seller home stack (`src/app/navigation/HomeStack.tsx` or whichever file declares `HomeStackParamList` routes).
- [X] T038 [US2] Add the **Minha receita** tile to `src/features/home/screens/HomeScreen.tsx`, sitting alongside Catálogo, Clientes, Pedidos, Rascunhos per FR-002. Match existing tile pattern.
- [X] T039 [US2] Wire `OrdersOverviewScreen` to consume the new optional `month` and `salespersonId` route params (extended in T010): on mount, set the screen's filter state from the params if present. Keep current behavior when both are absent.
- [X] T040 [US2] Manual verification on phone + tablet per quickstart §5 (airplane mode test included). Confirm zero network calls fire from seller scope (use Flipper or Reactotron, or `console.log` instrumentation, then remove).

**Checkpoint**: Sellers have a first-class offline view of their own revenue. Combined with US1, the dual-role surface is complete.

---

## Phase 5: User Story 3 — Admin filters dashboard to a single seller (P2)

**Goal**: Admin picks a vendedor → every panel re-scopes; tapping a ranking bar is a shortcut for the same.

**Independent test**: Per quickstart §4 steps 7–8, 12.

- [X] T041 [US3] In `useAdminRevenue` (T014): on filter change (vendedor or período), invalidate the cache key, fire all six RPCs again with the new `p_seller`/`p_month*` args, and re-paint within ≤ 2 s (SC-005). No partial paint — show the previous snapshot dimmed during the in-flight request.
- [X] T042 [US3] In `AdminRevenueScreen` (T024): wire the vendedor chip → opens `VendedorFilterSheet`; selecting a seller calls `setSellerId` on the filters hook. Wire the período chip → opens a month picker (reuse `MonthYearPicker` from `src/features/orders/overview/components/`).
- [X] T043 [US3] In `AdminRevenueScreen`: wire `SellerRankingCard.onSellerPress(id)` → calls `setSellerId(id)`. Confirms FR-018.
- [X] T044 [US3] In all panel `onPress` handlers (trend, top clients, top products): forward the active `filter.sellerId` into the navigation params so drill-downs inherit the filter (FR-030). Top product → `AdminProductForm` ignores sellerId (product is not seller-scoped); document this in the screen.
- [X] T045 [US3] Manual verification per quickstart §4 step 12. Confirm "Todos" returns to aggregated values and there are no stale numbers from the previous filter visible (FR-033).

---

## Phase 6: User Story 4 — Admin compares against previous year (P3)

**Goal**: Toggle "Comparar com ano anterior" → faded prior-year series overlays the trend chart.

**Independent test**: Seed orders spanning ≥ 13 months, toggle on, confirm overlay; with < 1 month of prior-year data, confirm toggle disabled with hint.

- [X] T046 [US4] Add a 7th RPC call (or extend `admin_revenue_monthly` with a `p_prior_year_offset boolean default false` arg — choose one in implementation; document the decision in the migration's comment header). Update `contracts/admin-rpcs.md` if the signature changes.
- [X] T047 [US4] In `useAdminRevenue` (T014): when the comparison toggle is on, fetch the prior-year window in parallel with the rest. Add `priorYearTrend?: TrendPoint[]` to the snapshot. Store the toggle state in the hook (not in filters — it's screen-local UI state).
- [X] T048 [US4] In `TrendChartCard` (T017): render the `priorYearTrend` overlay with reduced opacity (e.g. `opacity: 0.35`) and a distinct line style. The legend gains a fourth entry "Ano anterior" only when overlay is on.
- [X] T049 [US4] Disable the toggle when prior-year data is empty; show hint copy "Sem dados do ano anterior para comparar" beneath the toggle (T007).
- [X] T050 [US4] In `useSellerRevenue` (T034): also expose the toggle state and the prior-year derivation (`deriveTrend(input, { includeYear: 'priorYear' })` — already implemented in T029). Seller scope toggle behavior identical to admin.
- [X] T051 [US4] In `SellerRevenueScreen` (T036): wire the toggle into the trend card. Same disabled-with-hint behavior.
- [X] T052 [US4] Manual verification on both scopes — seed a dataset with 14 months of data, confirm overlay appears; truncate to 6 months, confirm toggle disables.

---

## Phase 7: User Story 5 — Dual-role user switches scope by entry point (P3)

**Goal**: A user with both roles sees both cards, opens the correct scope based on which card they tap.

**Independent test**: Sign in as dual-role user, confirm both home tiles. Open Receita → admin scope (filters present). Back, open Minha receita → seller scope (no filters). Per quickstart §5 steps 1–7 with a dual-role user.

- [X] T053 [US5] Confirm `AdminTab` and `HomeTab` both render for dual-role users (no change needed — UX6 is already implemented; this task is verification only). Document the verification steps in a brief PR-note.
- [X] T054 [US5] In `AdminRevenueScreen` and `SellerRevenueScreen`: assert at top of component (dev-only `console.warn`) that the scope matches the entry point. Catches regressions early.
- [X] T055 [US5] Manual verification per spec.md User Story 5 acceptance scenarios 1–3.

---

## Phase 8: Polish & Cross-Cutting

- [X] T056 [P] Run `pnpm typecheck` and resolve any errors introduced by new types in `data-model.md`.
- [X] T057 [P] Run `pnpm lint` and resolve any new lint errors. The new feature folders MUST follow the existing eslint config (no new ignores).
- [X] T058 [P] Run `pnpm test src/features/revenue src/features/admin/revenue` and confirm the entire derivation + client-wrapper suite is green.
- [X] T059 Verify SC-009 (zero writes): run the app for 5 minutes interacting with both scopes, then check `select count(*) from orders` and `select count(*) from payment_receipts` before/after — must be identical.
- [X] T060 Verify SC-008 (no horizontal scroll, no cropped charts) on phone (iPhone SE 375 pt as a stress test) and tablet (iPad 11" 820 pt). Take comparison screenshots if anything looks off.
- [X] T061 Update `SPECS.md` index to add the new feature row pointing at `specs/017-revenue-dashboard/spec.md`.
- [X] T062 Add a one-line note to `CHANGELOG.md` (if present) under the next-release header: "feat(017): admin + seller revenue dashboards".
- [X] T063 [P] Final pass on Portuguese empty-state copy in `src/features/revenue/shared/empty-states.ts` — read aloud, ensure salesperson-language tone (UX3), no English fallbacks anywhere in the rendered UI.

---

## Dependencies & Story Completion Order

```
Setup (Phase 1)            T001 → T002 → T003 ; T004 [P]
Foundational (Phase 2)     T005 → T006 [P], T007 [P], T008 [P], T009, T010, T011

US1 (Phase 3) — MVP         depends on Foundational
                            T012 [P], T013 [P], T014, T015 [P]
                            then T016..T021 [P]
                            then T022, T023, T024, T025, T026
                            then T027 (verification)

US2 (Phase 4)               depends on Foundational + the panel components from US1 (T016, T017, T019, T020, T021)
                            T028..T032 [P], T033, T034, T035, T036, T037, T038, T039, T040

US3 (Phase 5)               depends on US1 (T014, T024, SellerRankingCard from T018)
                            T041 → T042 → T043 → T044 → T045

US4 (Phase 6)               depends on US1 + US2 (TrendChartCard, useAdminRevenue, useSellerRevenue, deriveTrend)
                            T046 → T047, T048, T049 ; T050, T051 ; T052 (verification)

US5 (Phase 7)               depends on US1 + US2 (both screens must exist)
                            T053 → T054 → T055

Polish (Phase 8)            depends on every story
                            T056 [P], T057 [P], T058 [P], T059, T060, T061, T062, T063 [P]
```

**MVP scope** = Phase 1 + Phase 2 + Phase 3 (US1). That alone delivers admin-side revenue monitoring and is shippable on its own.

**Recommended delivery slices**:

1. **Slice A (MVP)**: Phases 1–3 → Admin sees consolidated revenue.
2. **Slice B**: + Phase 4 (US2) → Sellers get offline self-view.
3. **Slice C**: + Phase 5 (US3) → Admin filtering and drill-down.
4. **Slice D**: + Phase 6–8 (US4 polish, US5 verification, polish).

## Parallel execution opportunities

- **Phase 1**: T003 and T004 can run in parallel after T002.
- **Phase 2**: T006, T007, T008 are pure helpers — fully parallel after T005.
- **US1**: T012, T013, T015 in parallel; the six panel components T016–T021 in parallel after T005 lands.
- **US2**: T028–T032 derivation modules in parallel — five different files, five different tests.
- **Polish**: T056–T058, T063 in parallel; T059, T060 are sequential manual checks.

## Independent test criteria recap

| Story | Independent test |
|---|---|
| US1 | Admin opens Receita → all 5 panels populated; drill-downs land on correct screens. |
| US2 | Seller in airplane mode opens Minha receita → all panels render ≤ 1 s from local data. |
| US3 | Admin picks vendedor → every panel re-scopes ≤ 2 s; ranking-bar tap is the same shortcut. |
| US4 | Toggle on with ≥ 13 months of data → fainter overlay appears. < 1 month → toggle disabled. |
| US5 | Dual-role user sees both cards; admin entry → admin scope, seller entry → seller scope. |

## Format validation

All 63 tasks above use the required checklist format `- [ ] [TaskID] [P?] [Story?] Description with file path`. Setup, Foundational, and Polish phases omit the [Story] label per spec; user-story phases include it.
