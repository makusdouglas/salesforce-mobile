# Implementation Plan: Revenue Dashboard

**Branch**: `017-revenue-dashboard` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-revenue-dashboard/spec.md`

## Summary

A single dashboard surface that renders five panels (KPI band, monthly trend chart, seller ranking, top clients/products, aging de recebíveis) for two scopes selected at navigation time: **admin scope** (online-first, Supabase-backed RPC reads, optional vendedor filter) and **seller scope** (offline-first, WatermelonDB-backed repository reads, no filter, no ranking). Both scopes share the same screen component tree; entry-point routing decides which data source and which panels render. Read-only — no mutations to `orders` or `receipts`.

Technical approach: introduce one new top-level screen `RevenueDashboardScreen` that delegates to a scope-specific data hook (`useAdminRevenue` vs `useSellerRevenue`). Add five Supabase RPCs returning pre-aggregated rows for admin reads (P6) and one local repository module that derives the same shapes from WatermelonDB queries (R1). Reuse the existing `useViewport` responsive hook from feature 013, the `formatBRL` helper, and the established R$ / decimal conventions. Pick one off-the-shelf React Native charting library (see research.md) — never build charts from primitives.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.2, React Native 0.83.4
**Primary Dependencies**: Expo SDK 55 (managed + dev client), `@nozbe/watermelondb` 0.28, `@supabase/supabase-js` 2.103, `@react-navigation/native-stack` 7.x, **NEW**: charting library — see Phase 0 research
**Storage**: WatermelonDB (seller scope) + Supabase Postgres via dedicated read-only RPCs (admin scope). No new client tables, no new server-side write paths.
**Testing**: Jest (existing config) for repository derivations, hook reducers, and KPI math; manual phone+tablet verification per UX5 (no automated UI snapshot tests in MVP, per constitution §9).
**Target Platform**: iOS 15+ and Android (modern), portrait orientation only (UX5).
**Project Type**: Mobile app — single Expo project. Folder layout per §9: `src/features/admin/revenue/` (admin screen + hooks + Supabase client) and `src/features/revenue/` (seller screen + hooks + repository derivations). Shared chart components live under `src/features/revenue/charts/` and are imported from both.
**Performance Goals**: Admin panels ready ≤ 3s on typical 4G (SC-001); seller panels ready ≤ 1s from WatermelonDB on cached data (SC-002). Filter changes re-paint within 2s (SC-005).
**Constraints**: Strictly read-only (FR-037, SC-009). Admin response cache is in-memory only, scoped to screen lifecycle (FR-035). No client-side aggregation of raw orders/receipts in admin code path (FR-034, SC-003). Seller code path has zero Supabase calls during render (FR-036, SC-004).
**Scale/Scope**: Two new entry points (one per home), one new screen component (rendered in two scopes), four new SQL views/functions in Supabase, one new local-derivation module. Estimated ~12 source files in `src/features/admin/revenue/`, ~10 in `src/features/revenue/`, plus shared chart wrappers (~3 files).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Compliance |
|---|---|
| **P1 — Offline-first** | ✅ Seller scope is fully offline, computed from WatermelonDB (FR-036, FR-043). Admin scope is online-first per the explicit P6 exception below. |
| **P2 — Local DB is source of truth** | ✅ Untouched. Read-only feature; no writes. |
| **P3 — MVP simplicity** | ✅ One screen, two scopes, one charting library. Aging is computed from existing `orders` + `receipts` columns; no new persistence. |
| **P4 — Reuse free tools** | ✅ Aggregations live in Supabase as views / RPCs (no Edge Function, no custom backend). Charts use an off-the-shelf library, no in-house chart rendering. |
| **P5 — Salesperson data is sacred** | ✅ Read-only. No write paths added. |
| **P6 — Admin is online-first** | ✅ Admin code path hits Supabase via RPCs and never writes to WatermelonDB (FR-034, FR-035). Spinner during initial fetch is allowed for admin per P6. Falls back to last in-memory cached snapshot on transient failure (FR-042). |
| **R1 — WatermelonDB is the seller data layer** | ✅ Seller scope reads exclusively from WatermelonDB (FR-036). Admin exception under R1 explicitly permits direct Supabase reads. |
| **R2 — Minimalist data model** | ✅ No new client tables. Server side: only **views/functions**, not new tables. |
| **R3 — Images live in Storage** | N/A — no images. |
| **R4 — PDF + email** | N/A — no exports in v1 (assumption). |
| **R5 — Discounts** | N/A — read-only. |
| **UX1 — Tap not type** | ✅ Filters are chip + tap-first list; period is a month picker, no free text. |
| **UX2 — Repeat last order** | N/A. |
| **UX3 — Useful empty states** | ✅ FR-040 mandates Portuguese salesperson-language empty states for every panel. |
| **UX4 — Sync feedback** | N/A — sync indicator already lives on Home; this screen does not duplicate it. |
| **UX5 — Phone + tablet** | ✅ Pencil design produced four frames (phone+tablet × admin+seller). Responsive strategy below. |
| **UX6 — Dual-role visibility** | ✅ Both cards render simultaneously for dual-role users (FR-003); scope is determined by entry point (FR-004). No mode toggle. |
| **D1 — Sync pull then push** | N/A — read-only. |
| **D2 — Catalog read-only for seller** | N/A — this screen only reads from `orders`/`receipts`/`clients`/`products`. |
| **D3 — Client registration** | N/A. |
| **D4 — Order statuses** | ✅ FR-038 forbids new status enum values. The aging computation uses existing `orders.status = 'sent'` rows only. |
| **D5/D6 — Auth & lock** | ✅ Inherited; no changes. |
| **D7 — Role-based authorization** | ✅ Admin RPCs return data only when caller has any admin-grade role (FR-039). Seller RPCs are not added — seller scope reads locally. RLS specifics in the Role table below. |

No violations. The Complexity Tracking table is left empty by design.

## Role & Authorization Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Check | Value / Status | Notes |
|-------|----------------|-------|
| Roles affected | `admin + seller (dual-role)` | Admin sees aggregated cross-seller data with optional filter; seller sees own data only. |
| New or modified RLS policies | **New SECURITY DEFINER functions** in `supabase/migrations/0020_revenue_dashboard.sql`: `admin_revenue_kpis(p_seller uuid, p_month date)`, `admin_revenue_monthly(p_seller uuid)`, `admin_revenue_by_seller(p_month date)`, `admin_top_clients(p_seller uuid, p_month_from date, p_month_to date)`, `admin_top_products(p_seller uuid, p_month_from date, p_month_to date)`, `admin_receivables_aging(p_seller uuid, p_as_of date)`. Each function gates on `auth.uid()` having any role in `user_roles` whose `role` is admin-grade (`'admin'` or `'superuser'` per feature 016). Functions are `SECURITY DEFINER` so they can read across all sellers without exposing raw tables — `EXECUTE` is granted to `authenticated` and the function body raises `insufficient_privilege` for non-admin callers. No new RLS on `orders` or `receipts`. |
| Edge Functions introduced | none | Server-side aggregation lives in SQL functions, not Edge Functions; no `service_role` needed. |
| Offline classification per P6 | **mixed**: admin = online-required, seller = offline-first | Justification: each scope is internally pure — admin is fully online, seller is fully offline. There is no scope where the user toggles between modes. The "mixed" label only describes the feature; both code paths are individually clean. |
| Client-side affordance visibility (UX6) | "Receita" card visible on AdminHome only when role check `useAdminGate()` (or equivalent admin-grade check) passes; "Minha receita" card visible on the seller home for every signed-in user. | Inside the dashboard, the vendedor filter and seller-ranking panel render only in admin scope (entry point determined). |
| Dual-role user impact | Sees both cards. Tapping each opens its own scope; no overlap, no conflict. | Already covered by UX6 generally; this feature does not introduce special dual-role logic beyond rendering both cards on their respective homes. |

A Phase 1 setup task in `tasks.md` MUST land the migration `supabase/migrations/0020_revenue_dashboard.sql` before any screen task starts.

## Design Prerequisite

*GATE: Must pass before any implementation task is generated.*

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | Five panels + role-conditional filter bar. |
| `design/screens.md` exists | ✅ | [design/screens.md](./design/screens.md) |
| Phone frames cover all screens | ✅ | RevenueDashboard / Phone (admin) `mgkvx`, RevenueDashboardSeller / Phone `VKBOc`. |
| Tablet frames cover all screens | ✅ | RevenueDashboard / Tablet (admin) `2LUrw`, RevenueDashboardSeller / Tablet `limaj`. |
| Responsive strategy documented below | ✅ | See "Structure Decision". |

`design.json` path: `specs/017-revenue-dashboard/design.json`.

## Project Structure

### Documentation (this feature)

```text
specs/017-revenue-dashboard/
├── plan.md              # This file
├── spec.md
├── design/
│   ├── screens.md
│   ├── revenue-dashboard-phone.png
│   ├── revenue-dashboard-tablet.png
│   ├── revenue-dashboard-seller-phone.png
│   └── revenue-dashboard-seller-tablet.png
├── design.json
├── research.md          # Phase 0 output (this command)
├── data-model.md        # Phase 1 output (this command)
├── contracts/           # Phase 1 output (this command)
│   ├── admin-rpcs.md
│   └── seller-derivations.md
├── quickstart.md        # Phase 1 output (this command)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── navigation/
│       ├── AdminStack.tsx                         # add `AdminRevenue` screen route
│       ├── HomeStack.tsx (or equivalent)          # add `Revenue` screen route
│       └── types.ts                               # add `AdminRevenue` and `Revenue` route entries
├── features/
│   ├── admin/
│   │   ├── menu/                                  # AdminMenuScreen.tsx → add "Receita" tile
│   │   └── revenue/                               # NEW (admin scope)
│   │       ├── index.ts
│   │       ├── screens/
│   │       │   └── AdminRevenueScreen.tsx
│   │       ├── hooks/
│   │       │   ├── useAdminRevenue.ts             # orchestrates 5 RPC calls + in-memory cache
│   │       │   ├── useAdminRevenueFilters.ts     # vendedor + período state
│   │       │   └── useActiveSellersForFilter.ts  # tap-first list of admin-visible sellers
│   │       ├── service/
│   │       │   ├── adminRevenueClient.ts          # thin wrappers around Supabase RPC calls
│   │       │   └── adminRevenueClient.test.ts     # contract tests (mock Supabase)
│   │       └── components/
│   │           └── VendedorFilterSheet.tsx
│   ├── home/
│   │   └── screens/
│   │       └── HomeScreen.tsx                     # add "Minha receita" tile
│   └── revenue/                                   # NEW (seller scope + shared)
│       ├── index.ts
│       ├── screens/
│       │   └── SellerRevenueScreen.tsx
│       ├── hooks/
│       │   ├── useSellerRevenue.ts                # delegates to local derivations
│       │   └── useViewport.ts                     # re-export from features/orders or local copy
│       ├── derivations/
│       │   ├── kpis.ts                            # current/prev month + delta math
│       │   ├── trend.ts                           # 12-month series builder
│       │   ├── topClients.ts
│       │   ├── topProducts.ts
│       │   ├── aging.ts
│       │   └── *.test.ts                          # one Jest file per derivation
│       ├── shared/
│       │   ├── types.ts                           # RevenueSnapshotDTO, KpiBlock, AgingBucket, …
│       │   ├── formatDelta.ts
│       │   └── empty-states.ts                    # Portuguese empty-state copy strings
│       └── components/                            # role-agnostic panels rendered in both scopes
│           ├── KpiBand.tsx
│           ├── TrendChartCard.tsx                 # imports the chosen chart lib
│           ├── SellerRankingCard.tsx              # admin-only; rendered conditionally
│           ├── TopClientsCard.tsx
│           ├── TopProductsCard.tsx
│           ├── AgingCard.tsx
│           └── PanelEmptyState.tsx
├── data/
│   └── repositories/
│       └── revenueQueries.ts                      # WatermelonDB query helpers used by derivations
└── components/                                    # nothing new here
supabase/migrations/
└── 0020_revenue_dashboard.sql                     # 6 SECURITY DEFINER functions + grants
```

**Structure Decision**:

- **Two feature folders** per §9: `src/features/admin/revenue/` (admin scope, online-first, Supabase RPC client) and `src/features/revenue/` (seller scope, offline-first, WatermelonDB derivations + the shared panel components used by both scopes). The admin scope screen imports the panel components from the seller scope's `components/` directory — that is the canonical home because seller scope is the more constrained variant. Admin scope simply adds the filter bar + seller-ranking card on top.
- **Responsive strategy**: reuse the existing `useViewport()` hook from feature 013 (`src/features/orders/hooks/useViewport.ts`), promoted to a shared location if desired. Each panel component receives no viewport prop; layout branches happen inside `TopClientsCard` + `TopProductsCard` (side-by-side on tablet, stacked on phone — implemented as two cards inside a flex row whose `flexDirection` switches on viewport). KPI grid stays 2+2+1 on phone and tablet (already wide enough to read on tablet without re-layout per design pass). Trend chart renders at `width: '100%'` with library-controlled axes — the chosen library handles its own breakpoints. Padding tokens come from existing scale (16 / 28).
- **Single screen, two routes**: `RevenueDashboardScreen` is parameterized by `scope: 'admin' | 'seller'`. Two route entries (`AdminRevenue` and `Revenue`) each inject the right scope. This keeps FR-004 honest (scope from entry point) and avoids any toggle.
- **Cache lives in the screen, not in a global store**: per FR-035, the in-memory cache is the screen component's `useState`/`useRef`. No Zustand, no Context. Re-mounting the screen forces a fresh fetch.

## Complexity Tracking

> No constitutional violations. This table is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_ | — | — |
