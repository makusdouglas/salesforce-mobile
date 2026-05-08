# Implementation Plan: Product Lifecycle + Granular Admin Roles

**Branch**: `016-product-lifecycle-roles` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-product-lifecycle-roles/spec.md`

> ℹ️ **Reconstructed plan** — the original `plan.md` was untracked and was overwritten by `setup-plan.sh` during a misrouted `/speckit-plan` invocation on 2026-04-25. This file is rebuilt from `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, and the as-shipped code (`tasks.md` reality column, the `0018_*.sql` migrations, and the source under `src/features/admin/{products,users}` + `src/features/auth/session/` + `src/features/orders/`).

## Summary

Two tightly-related admin refinements layered on top of features 6, 9, 10, 14, 15:

- **Part A — Product deactivation lifecycle**. `products` gains `active boolean` + `deactivated_at timestamptz`. The admin flips the flag from `AdminProductForm`, confirming via a modal that surfaces the live count of draft orders referencing the SKU. Seller-side reads filter `active = true`; existing drafts that contain a now-inactive product fire a blocking modal (`DraftDiscontinuedAlert`) and the send action stays disabled until the inactive lines are removed. Repeat-last-order runs a preview that opens `RepeatOrderDiscontinuedAlert` so dropped lines are always acknowledged. Historical sent/canceled orders render verbatim — history is immutable.
- **Part B — Granular admin roles**. The single `admin` flag is replaced by four admin-grade roles (`manage-products`, `manage-salespersons`, `manage-clients`, `superuser`) plus the existing `seller`. Legacy `admin` rows are rewritten to `superuser` in the same migration. The Admin tab and its tile grid render only the modules the user is authorised for; a deferrable Postgres trigger guarantees ≥ 1 superuser at all times. A new `AdminUsersList` + `AdminUserRolesForm` (superuser-only) host the role-editing UX. The profile screen ("Settings") gains a "Suas funções" section showing the signed-in user's chips. Sessions re-evaluate roles on `AppState=active` and after every sync pull — no logout required to pick up grants.

Both parts ship behind a single Supabase migration (`0018_product_lifecycle_and_granular_roles.sql`, renumbered from the originally-planned `0016` because slots 0016/0017 had already been used by feature 015 follow-ups). A small follow-up `0019_fix_admin_users_view.sql` corrects the `admin_users_view` SECURITY mode after dogfooding.

## Technical Context

**Language/Version**: TypeScript 5.x, React Native 0.76 (Expo SDK 55).
**Primary Dependencies**: Expo, Supabase JS client (`@supabase/supabase-js`), WatermelonDB, `@react-navigation/native-stack`, `@expo/vector-icons` (lucide). No new npm dependencies.
**Server side**: Postgres 15 + RLS. No new Edge Functions in this feature.
**Storage**: Supabase Postgres (`products`, `product_variants`, `salespeople`, `clients`, `user_roles`, plus the new `admin_users_view`). WatermelonDB schema bumps v5 → v6 to add `active` (boolean, indexed) and `deactivated_at_ms` (number, nullable) on the local `products` mirror.
**Testing**: `ts-jest`/`jest` for unit + pure-function tests. RLS coverage is shipped via the migration's drop-then-recreate pattern + the `usersApi` error-mapping suite; pgTAP-style SQL tests are deferred (no pgTAP runner wired up in this repo) and tracked as follow-up.
**Target Platform**: iOS 16+ and Android 10+, phone and tablet viewports (constitution §5 UX5).
**Project Type**: Mobile app (Expo) + Supabase backend.
**Performance Goals**: SC-001 — deactivation propagates to 100% of seller catalogs within the next sync (target ≤ 30 s active-connectivity). SC-003 — admin search + filter resolves a target row among 500+ SKUs in under 3 s.
**Constraints**: P6 (admin online-first) — deactivation, role grants, and `listDraftsUsingProduct` calls all require connectivity; nothing is queued in the local push pipeline. P1 (offline-first for sellers) — seller-side enforcement reads from WatermelonDB only; the inactive-product detection on draft open uses the local mirror, not Supabase. D1 (pull-then-push) — admin writes finish, then call `triggerSyncAfterAdminWrite()` to enqueue a pull on every device.
**Scale/Scope**: ~500 product SKUs, ~50 sellers, single-digit admins per tenant for MVP. Single-row writes everywhere — no bulk role assignment, no bulk deactivate.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Status | Notes |
|------------------|--------|-------|
| P1 Offline-first (VENDEDOR scope) | ✅ | Seller-side discontinued detection reads from WatermelonDB (`productsRepository`); the seller never blocks on a network call. The admin-only modals (deactivate confirm, role form) are P6 surfaces. |
| P2 Local DB source of truth | ✅ | Seller draft-open hydrate, `addLine` guard, and catalog filter all read the local mirror. The Supabase row is authoritative on the admin side only. |
| P3 MVP simplicity | ✅ | No new tables. Two columns added. Five client-side helper functions. No new Edge Functions. The single-superuser floor uses one trigger function, not a service. |
| P4 Reuse free tools — exception for in-app admin UI | ✅ (with justification) | Granular role editing via the Supabase dashboard is per-row and exposes raw `user_roles` text — too footgun-heavy for delegated admins. The in-app `AdminUserRolesForm` shows human-readable Portuguese labels and the floor-of-1-superuser invariant via UI guard + server trigger. Filed under P4's in-app exception introduced in v1.0.0. |
| P5 Salesperson data sacred | ✅ | Deactivation never deletes `products` rows, never modifies `order_items`. Historical orders render their original lines verbatim (FR-014). |
| P6 Admin online-first | ✅ | All admin writes go straight to Supabase. `listDraftsUsingProduct` is a live SELECT against Supabase (not WatermelonDB) so the count is global across all sellers. After every admin write we call the existing `triggerSyncAfterAdminWrite()`. |
| R1 WatermelonDB single client data layer — admin exception | ✅ | Admin reads `admin_users_view` directly from Supabase (admins want the latest state). Seller reads still go through `productsRepository`/`useOrderItems` (WatermelonDB). |
| R2 Minimalist data model | ✅ | Two new columns on `products`; one widened CHECK on `user_roles`. No new tables. |
| R3 Storage-backed images | ✅ N/A | No image work. |
| R4 Local PDF generation | ✅ N/A | No PDF work. |
| R5 Discounts belong to the order | ✅ N/A | Pricing untouched. |
| UX1 Tap not type | ✅ | The new `AdminProductsList` filter is a tap-first segmented control ("Ativos / Inativos / Todos"). Search remains a single text input (typing reserved for finding-by-name). Role toggles in `AdminUserRolesForm` are switches, not text. |
| UX2 Repeat last order | ✅ | Repeat flow now has an explicit preview step (`previewRepeat`) so discontinued lines are always surfaced before cloning — never silently dropped. |
| UX3 Useful empty states | ✅ | `AdminProductsList` empty state distinguishes "no products" from "no matches under current filter" and offers a "Limpar filtros" CTA. The Settings → Suas funções empty state reads "Sem funções atribuídas". |
| UX4 Sync feedback discreet | ✅ | After every admin write the existing home-pill surface picks up the pull. No new indicator. |
| UX5 Phone + tablet | ✅ | Pencil frames exist for every new screen and modal — see `design/screens.md`. Two existing screens (`AdminProductsList`, `AdminProductForm`) deferred their phone+tablet frame deltas to implement-phase patterns demonstrated by feature 015. |
| UX6 Dual-role visibility | ✅ | Admin-tab visibility is now driven by `useAnyAdminRole()` (any of the four admin-grade roles ⇒ tab renders). Tile grid hides modules the user lacks; routes are also navigator-guarded for defense in depth. A seller-only session never reaches any of these surfaces. |
| D1 Pull-then-push sync | ✅ | Post-deactivate / post-role-grant pulls are queued via the existing `adminWriteTrigger`. No push from this feature. |
| D2 Catalog read-only for VENDEDOR | ✅ | Seller never writes to `products`. The admin write of `active`/`deactivated_at` is the ADMIN-side exception introduced in v1.0.0. |
| D3 Client registration | ✅ N/A | Not a client feature. The migration adds admin-only INSERT/UPDATE/DELETE policies on `clients` (the seller-owned permissive policy from 0005 stays — feature 17 will tighten that). |
| D4 Order statuses | ✅ N/A | Status enum unchanged. |
| D5 Online-one-time auth | ✅ | Authentication path untouched. Role re-evaluation reads `user_roles` for the signed-in user only — no JWT rotation. |
| D6 Mandatory local lock | ✅ | Lock surface unaffected. |
| D7 Role-based authorization | ✅ | All admin-write RLS policies rewritten to require `is_superuser() OR is_<module>()`. `user_roles` SELECT/INSERT/UPDATE/DELETE require `superuser`, plus a self-SELECT branch for the profile screen. Helpers documented in `contracts/supabase-rls.md`. |

**Result**: No unjustified violations. The P3/P4 cost of an in-app `AdminUserRolesForm` (instead of dashboard role editing) is justified by the human-readable label set, the live floor-of-1-superuser feedback, and the dual-role nature of the same workforce reusing the app.

## Role & Authorization Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Check | Value / Status | Notes |
|-------|----------------|-------|
| Roles affected | admin (multi-role: `superuser` / `manage-products` / `manage-salespersons` / `manage-clients`) + seller (consumes the inactive-product rules). | The legacy `admin` role survives only as a transient alias during the migration window — `is_admin()` is redefined to return `is_superuser()`. |
| New or modified RLS policies (per table) | `products`, `product_variants` — admin-write policies switched to `is_superuser() OR is_manage_products()`. `salespeople` — switched to `is_superuser() OR is_manage_salespersons()`. `clients` — adds three admin policies (`is_superuser() OR is_manage_clients()`); seller path stays under `clients_dev_all`. `user_roles` — SELECT self-or-superuser; INSERT/UPDATE/DELETE superuser-only. See `contracts/supabase-rls.md`. | All policy bodies live in migration `0018_product_lifecycle_and_granular_roles.sql`; the drop-then-create pattern guarantees idempotency at the migration boundary. |
| Edge Functions introduced (service_role usage) | None. | Role assignment is a plain authenticated INSERT/DELETE on `user_roles`; the deferrable trigger handles the floor-of-1-superuser invariant server-side. No `service_role` use. |
| Offline classification per P6 | online-required (admin writes + draft-count read); offline-capable (seller-side enforcement). | The seller-side path is offline-first because the inactive flag rides on the existing pull pipeline; the admin path is online-only because `listDraftsUsingProduct` and the role write both hit Supabase directly. |
| Client-side affordance visibility rule (UX6) | Admin tab shows when `useAnyAdminRole()` is true. Tile grid shows each tile only when the user holds the matching admin-grade role. "Usuários & Roles" is `superuser`-only. Direct-route navigation is also guarded by `useAdminGate(required)`. | Verified in `useAdminGate.test.ts` (28 tests). |
| Dual-role user impact | A user holding both `seller` and any admin-grade role sees the Admin tab alongside the seller tabs (Catálogo, Pedidos, Clientes). The Admin tile grid still gates each module by role. | The `seller` role is never editable from `AdminUserRolesForm` — feature 015's `admin-create-seller` Edge Function and deactivation flow remain the single owner of that role. |

## Design Prerequisite

*GATE: Must pass before any implementation task is generated.*

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | 5 new screens/modals + 4 modified screens. |
| `design/screens.md` exists | ✅ | [design/screens.md](./design/screens.md) |
| Phone frames cover all new screens | ✅ | New: `3kyN7` (AdminProductDeactivateConfirm), `A65W2` (DraftDiscontinuedAlert), `boQMF` (RepeatOrderDiscontinuedAlert), `bObF0` (AdminUsersList), `YL1iX` (AdminUserRolesForm). |
| Tablet frames cover all new screens | ✅ | New: `evhGY`, `5w1q2`, `Yp9ot`, `Nm3SK`, `zeSbE`. |
| Modified-screen frame deltas | ⚠️ deferred-to-impl | `AdminProductsList` (segment + search + dimmed-row variant), `AdminProductForm` (Ativo/Inativo toggle + Desativar action), `AdminMenu` (Usuários & Roles tile), `ProfileScreen` (Suas funções section). Patterns demonstrated by feature 015's analogs; deltas applied directly in code without re-exporting fresh PNGs. |
| Responsive strategy documented below | ✅ | See "Structure Decision". |

`design.json`: `specs/016-product-lifecycle-roles/design.json`.

## Project Structure

### Documentation (this feature)

```text
specs/016-product-lifecycle-roles/
├── plan.md              # This file
├── research.md          # Phase 0 — 10 R-### decisions (soft-delete, role helpers, etc.)
├── data-model.md        # Phase 1 — products + user_roles extensions; derived helpers
├── quickstart.md        # Phase 1 — 10-step end-to-end smoke test
├── contracts/
│   ├── client-api.md         # productsService, usersService, useAdminGate, addLine, etc.
│   ├── migration.md          # 0018 transaction ordering + rollback plan
│   └── supabase-rls.md       # Per-table policy matrix + helper-function table
├── checklists/
│   └── requirements.md       # /speckit-checklist output
├── design/                   # Pencil exports (PNG + screens.md + design.json)
└── tasks.md                  # Phase 2 output (NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/features/admin/products/                 # EXTEND from feature 014
├── components/
│   ├── AdminProductDeactivateConfirmModal.tsx   # NEW — frame 3kyN7 / evhGY; reused for reactivate
│   └── ProductRow.tsx                           # MODIFY — dimmed/inactive-chip variant
├── hooks/
│   ├── useProducts.ts                           # MODIFY — accepts activeFilter ('active' | 'inactive' | 'all')
│   └── useProductForm.ts                        # MODIFY — adds active/deactivatedAt + toggleActive()
├── screens/
│   ├── AdminProductsListScreen.tsx              # MODIFY — segment + diacritic-insensitive search + empty states
│   └── AdminProductFormScreen.tsx               # MODIFY — STATUS section (Ativo/Inativo) when editing
└── service/
    └── productsApi.ts                           # MODIFY — adds setProductActive(), listDraftsUsingProduct()

src/features/admin/users/                    # NEW — superuser-only
├── hooks/
│   └── useUsers.ts                              # list + diff-based saveRoles
├── screens/
│   ├── AdminUsersListScreen.tsx                 # NEW — frame bObF0 / Nm3SK
│   └── AdminUserRolesFormScreen.tsx             # NEW — frame YL1iX / zeSbE
└── service/
    └── usersApi.ts                              # listUsers() over admin_users_view; setUserRoles() diff

src/features/auth/session/                   # EXTEND from feature 014
├── session.ts                                   # MODIFY — widens SessionRole to 5 + admin alias; AppState refresh
├── rolesRepository.ts                           # MODIFY — VALID_ROLES expanded
├── useAdminGate.ts                              # NEW — useAdminGate(required) + useAnyAdminRole()
├── useAdminGate.test.ts                         # NEW — 28 tests
└── roleBadgeMapping.ts                          # NEW — single source of truth for chip label/style

src/features/admin/sellers/screens/
└── AdminMenuScreen.tsx                          # MODIFY — gate each tile by useAdminGate(); add Usuários & Roles tile

src/features/orders/                         # EXTEND from features 9, 10
├── components/
│   ├── DraftDiscontinuedAlert.tsx               # NEW — frame A65W2 / 5w1q2
│   └── RepeatOrderDiscontinuedAlert.tsx         # NEW — frame boQMF / Yp9ot
├── hooks/
│   └── useRepeatOrder.ts                        # MODIFY — exposes preview() returning { clonable, discontinued }
├── screens/
│   ├── OrderDraftScreen.tsx                     # MODIFY — discontinued detection + persistent block bar
│   └── AddToOrderScreen.tsx                     # MODIFY — banner + disabled add when product.active === false
└── services/
    ├── ordersService.ts                         # MODIFY — adds previewRepeat(); repeat() drops inactive lines
    └── __tests__/ordersService.repeat.test.ts   # MODIFY — 6 new tests for inactive handling

src/features/clients/screens/
└── ClientProfileScreen.tsx                      # MODIFY — wire previewRepeat → RepeatOrderDiscontinuedAlert

src/features/home/screens/
└── SettingsScreen.tsx                           # MODIFY — append "Suas funções" section

src/data/                                    # EXTEND
├── schema/tables.ts                             # v5 → v6: add products.active + products.deactivated_at_ms
├── schema/migrations.ts                         # add v5 → v6 step
├── models/Product.ts                            # @field active, @field deactivatedAtMs
└── repositories/productsRepository.ts           # filter active = true on query/observeAll; findInactiveIn(ids[])

src/app/navigation/
├── AdminStack.tsx                               # ADD AdminUsersList + AdminUserRolesForm routes
├── RootTabs.tsx                                 # MODIFY — Admin tab visibility uses useAnyAdminRole()
└── types.ts                                     # MODIFY — new AdminStackParamList entries

supabase/
├── migrations/
│   ├── 0018_product_lifecycle_and_granular_roles.sql       # Single transaction — see contracts/migration.md
│   └── 0019_fix_admin_users_view.sql                       # Follow-up: corrects view SECURITY mode
└── rollbacks/
    └── 0018_product_lifecycle_and_granular_roles.down.sql  # Reverses CHECK widening, trigger, helpers, policies
```

**Structure Decision**: mobile app + Supabase back-end. The product-lifecycle work extends `src/features/admin/products/` and `src/features/orders/`; the granular-roles work introduces `src/features/admin/users/` and grows `src/features/auth/session/`. Two reality-check deltas vs. the original plan:

1. **Migration number**: planned as `0016_*`; shipped as `0018_*` because slots `0016_seller_auth_ban.sql` and `0017_email_exists_in_auth.sql` were already taken by feature 015 follow-ups.
2. **Code paths**: the original plan referenced `src/db/watermelon/`, `src/features/session/`, and `src/features/profile/`. Reality: this codebase puts the data layer at `src/data/`, the session module at `src/features/auth/session/`, and the profile-adjacent surface at `src/features/home/screens/SettingsScreen.tsx`. `tasks.md` documents these deltas in its top "Plan-vs-reality" table.

**Responsive strategy**: every modified screen reuses its existing layout hook (`useAdminProductsLayout`, etc.). New modals use the existing `Modal/Center` + `Alert/Default` Pencil component pair so the phone↔tablet branch is one prop. No separate component trees per viewport — touch targets stay consistent.

## Complexity Tracking

| Violation / Cost | Why Needed | Simpler Alternative Rejected Because |
|-----------------|------------|-------------------------------------|
| Two-step preview/clone in repeat-last-order (`previewRepeat` + `cloneRepeat`) | The repeat flow may legitimately drop lines (when source contains inactive products), and FR-012 requires the user to acknowledge **before** the new draft is created. | Rejected: clone first, then alert. That would leave the seller looking at a freshly-shrunk draft with no chance to cancel — silent-drop UX violates the spec's "never silently drop" command. |
| Soft delete (`active boolean` + `deactivated_at`) on `products` | FR-014 requires historical orders to render their original lines verbatim, including discontinued items. Hard delete would cascade into `order_items`. | Rejected: hard delete + a denormalised line snapshot copied into every `order_item`. Three months of schema churn for an MVP-scale feature. Also rejected: a status enum (`active` / `discontinued` / `draft`) — every decision so far is binary; an enum is easy to add later. |
| Deferrable constraint trigger (`enforce_at_least_one_superuser`) | Client-side checks alone are bypassable through the dashboard, an authenticated direct REST call, or a race between two simultaneous self-demotes. | Rejected: a single-superuser SELECT count + UPDATE inside a transaction on the client. Race-prone and dashboard-bypassable. Rejected: a `BEFORE` trigger — would reject valid superuser-swap patterns ("demote A and promote B in one transaction") because the row-by-row count goes through zero mid-statement. The deferrable `AFTER` constraint trigger evaluates only at COMMIT time, which lets swaps work. |
| Per-role SQL helpers (`is_superuser()`, `is_manage_products()`, …) instead of a single `has_role(text)` | Policy bodies read cleanly (`is_superuser() OR is_manage_products()`) and the per-helper definitions make unit testing straightforward; keeping `is_admin()` as an alias prevents breaking any feature 014/015 policy we have not gotten to yet. | Rejected: `has_role('manage-products')` everywhere. Works, but every policy body becomes a noisier string-match and the legacy `is_admin()` alias becomes ambiguous. |
| `admin_users_view` instead of two client-side queries | `AdminUsersList` needs `auth.users.email` joined with `salespeople.name` and an aggregated `roles[]` per row in a single read. Two queries on the client would N+1. | Rejected: a single `select … from auth.users join …` from the client — `auth.users` is in the `auth` schema, not exposed to PostgREST by default. The view is the smallest seam that gives admins one read while keeping schema boundaries intact. (`0019_fix_admin_users_view.sql` follow-up adjusts SECURITY mode after dogfooding revealed an RLS-leak shape.) |
| pgTAP tests deferred (T032–T037) | This repo has no pgTAP runner; SQL test files would not execute on CI. RLS coverage is shipped via the migration's drop-and-recreate pattern + the TS-level `usersApi` error-mapping suite + manual `quickstart.md` walkthrough. | Rejected: blocking the feature on a CI overhaul. Tracked as follow-up alongside the migration repo's broader test infrastructure. The shipped error-mapping tests catch regressions in the `at_least_one_superuser_required` and `forbidden` paths we care most about. |
