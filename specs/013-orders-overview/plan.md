# Implementation Plan: Orders Overview

**Branch**: `013-orders-overview` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/013-orders-overview/spec.md`

## Summary

Build a seller-facing OrdersOverview screen that consolidates every order (any status) into a single surface with tap-first filters (month scrubber, status chips, text search), a live summary band (Faturado / Recebido / Pendente), and three unified entry points (new OrdersOverview list, Home "Atividade recente" card, client profile history) that all funnel sent/canceled orders into a **new read-only OrderDetail screen**. Payment status continues to be UI-derived from `payment_receipts` (never persisted). Tablet viewport gets a split-panel layout. 100% offline-first — reads only from WatermelonDB.

Technically: pure client composition on top of existing repositories + the payment-status helper already introduced in feature 012. Small refactor extracts the helper into a shared module so the new surfaces and ClientProfile consume the same derivation.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
**Primary Dependencies**: React Native + Expo SDK 55 managed workflow, WatermelonDB, RxJS (via Watermelon observables), React Navigation native-stack
**Storage**: WatermelonDB (local SQLite) — reads only; no schema changes
**Testing**: Jest (ts-jest), jest environment `node` for logic tests, unit + integration tiers. No new UI-render tests (per §9 — deferred)
**Target Platform**: iOS 16+ and Android 11+ (Expo managed); phone + tablet layouts (§5 UX5)
**Project Type**: mobile-app — seller surface
**Performance Goals**: ≤ 1 s cold-open to fully rendered list with 500 orders; sustained 55+ fps scroll
**Constraints**: Zero Supabase calls on this surface; all data via local DB observables; pt-BR copy for UI
**Scale/Scope**: 4 screens (2 new: OrdersOverview, OrderDetail × 2 viewports via responsive branching), 1 Home QuickActionCard + 1 Home card replacement, ~10 new source files, 1 shared helper relocation, ~8 unit/integration test files

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| P1 — Offline-first is non-negotiable | ✅ | Zero Supabase calls on this surface; all reads via WatermelonDB observables. |
| P2 — Local DB is source of truth | ✅ | Reactive observables drive every render; no server round-trip on filter change. |
| P3 — MVP simplicity | ✅ | No new tables, no new routes beyond the two screens, no new sync flow. Payment-status helper is reused, not re-implemented. |
| P4 — Reuse free tools before building | ✅ | No new libs. Existing `@nozbe/watermelondb`, `react-navigation/native-stack`, and the 012 helper are reused. |
| P5 — pt-BR in copy, English in code | ✅ | Copy on screen is Portuguese; identifiers/types/tests in English. |
| P6 — Admin is online-first | N/A | Seller-only feature. |
| UX1 — Tap-first | ✅ | Chips + scrubber + one search field. No modals on primary flow. |
| UX3 — Critical data is always visible | ✅ | Client, total, status, payment are on every row. |
| UX5 — Phone + tablet | ✅ | Two distinct layouts per screen; tablet uses split panel / two-column body. |
| UX6 — Dual-role visibility | N/A | Single role. |
| D4 — Single source of truth for derived status | ✅ | `derivePaymentStatus` moved into `src/features/orders/payment/` and imported by ClientProfile + OrdersOverview + OrderDetail. |
| D7 — Role-based authorization | N/A (no role-guarded surfaces) |

## Role & Authorization Check

**N/A (no role-guarded surfaces)** — the feature reads only from seller-owned rows in WatermelonDB; no RLS changes, no Edge Functions, no admin surfaces touched.

## Design Prerequisite

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | 2 new screens × 2 viewports = 4 frames. |
| `design/screens.md` exists | ✅ | `specs/013-orders-overview/design/screens.md` |
| Phone frames cover all screens | ✅ | `orders-list-phone.png`, `order-detail-phone.png` |
| Tablet frames cover all screens | ✅ | `orders-list-tablet.png`, `order-detail-tablet.png` |
| Responsive strategy documented below | ✅ | See "Structure Decision" §2. |

## Project Structure

### Documentation (this feature)

```text
specs/013-orders-overview/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── observeOrdersForMonth.md
│   ├── computeOrdersOverviewSummary.md
│   └── derivePaymentStatus.md
├── design/
│   ├── screens.md
│   ├── orders-list-phone.png
│   ├── order-detail-phone.png
│   ├── orders-list-tablet.png
│   └── order-detail-tablet.png
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root, relevant paths)

```text
src/
├── app/
│   ├── screens/
│   │   └── HomeScreen.tsx                     # modified: add Pedidos QuickActionCard, replace Atividade stub
│   └── navigation/
│       ├── OrdersStack.tsx                    # modified: add OrdersOverview + OrderDetail routes
│       └── types.ts                           # modified: route params
└── features/
    └── orders/
        ├── overview/                          # NEW sub-tree
        │   ├── screens/
        │   │   └── OrdersOverviewScreen.tsx
        │   ├── hooks/
        │   │   ├── useOrdersOverview.ts
        │   │   └── useOrdersOverviewFilters.ts
        │   ├── components/
        │   │   ├── OrdersOverviewRow.tsx
        │   │   ├── MonthScrubber.tsx
        │   │   ├── StatusFilterChips.tsx
        │   │   ├── SummaryBand.tsx
        │   │   └── SearchField.tsx
        │   ├── selectors/
        │   │   ├── applyFilters.ts
        │   │   └── computeOrdersOverviewSummary.ts
        │   └── types.ts
        ├── detail/                            # NEW sub-tree
        │   ├── screens/
        │   │   └── OrderDetailScreen.tsx
        │   └── hooks/
        │       └── useOrderDetail.ts
        ├── payment/                           # NEW shared helper (extracted from feature 012)
        │   └── derivePaymentStatus.ts
        └── activity/                          # NEW (Home card live content)
            ├── hooks/
            │   └── useRecentActivity.ts
            └── components/
                └── RecentActivityCard.tsx

tests/
(alongside source files following existing convention: *.test.ts)
```

**Structure Decision**: mobile-app. Responsive strategy: single screen component per feature (e.g. `OrdersOverviewScreen`) that reads a `useResponsiveLayout()` hook (viewport width ≥ 820 ⇒ tablet) and branches layout internally. Core selectors and hooks are viewport-agnostic; only the top-level component switches between `OrdersOverview.Phone` and `OrdersOverview.Tablet` variants, both consuming the same hook output. This matches the approach taken for features 003–012 (phone-primary, tablet fallback).

## Complexity Tracking

None — the plan stays inside existing constitutional guarantees.

## Phase 0: Outline & Research

See [research.md](./research.md).

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md) and [contracts/](./contracts/).

## Phase 2: Tasks (delegated to /speckit-tasks)

See [tasks.md](./tasks.md).
