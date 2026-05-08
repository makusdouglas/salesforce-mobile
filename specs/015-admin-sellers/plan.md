# Implementation Plan: Admin-side Seller Management

**Branch**: `015-admin-sellers` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-admin-sellers/spec.md`

## Summary

Build the admin-only UI for provisioning sellers inside the app, replacing the current dashboard-only flow. A new **Admin menu landing screen** becomes the entry point behind the Admin tab and hosts two cards (Produtos, Vendedores). The Vendedores card opens a list (active + inactive) that routes into a unified create/edit form, plus a destructive deactivation flow that revokes the `seller` role while preserving the `salespeople` row. Creating a seller is a three-step atomic transaction (Auth user + `salespeople` row + `user_roles='seller'`) routed through a new Supabase Edge Function **`admin-create-seller`** that holds `service_role`; the client never does. All writes are protected by RLS requiring `is_admin()` (helper shipped in feature 014).

## Technical Context

**Language/Version**: TypeScript 5.x, React Native 0.76 (Expo SDK 55)
**Primary Dependencies**: Expo, Supabase JS client (`@supabase/supabase-js`), WatermelonDB (for the sync pull trigger already added in feature 014), `@react-navigation/native-stack`, `@expo/vector-icons` (lucide). No new npm dependencies required for this feature.
**Server side**: Supabase Edge Functions runtime (Deno) for the one new function; Postgres 15 + RLS for the data plane.
**Storage**: Supabase Postgres (`salespeople`, `user_roles`, `auth.users`). No new tables — only one column addition (`salespeople.active` if not already present from prior features).
**Testing**: `ts-jest`/`jest` for unit + pure-function tests; Supabase SQL tests (`pgTAP` flavour inline) for the RLS policies and barcode-style uniqueness already in the project. Edge Function tested via a Deno-side unit test + an end-to-end call from a test client.
**Target Platform**: iOS 16+ and Android 10+, phone and tablet viewports (constitution §5 UX5).
**Project Type**: Mobile app (Expo) + Supabase backend.
**Performance Goals**: SC-001 — seller provisioning end-to-end in under 90 s of wall clock; SC-004 — role-revocation propagates to reject next sign-in within 10 s.
**Constraints**: P6 (admin is online-first): Edge Function may require connectivity and a blocking spinner; if offline, surface a retry dialog, preserve form state locally, do not touch WatermelonDB's push queue. SC-002 atomicity: the Edge Function MUST roll back partial writes.
**Scale/Scope**: 1–2 admins, up to ~50 sellers per tenant for the MVP. No bulk import; single-row operations only.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Status | Notes |
|------------------|--------|-------|
| P1 Offline-first (VENDEDOR scope) | ✅ | Feature has no VENDEDOR surface. All writes are ADMIN, which P6 authorises to be online-first. |
| P2 Local DB source of truth | ✅ N/A | No VENDEDOR writes; WatermelonDB is not touched on the write path. Seller rows appear on other devices via the existing feature-014 sync pull. |
| P3 MVP simplicity | ✅ | One screen per lifecycle stage, one Edge Function, no new tables. Rejected alternative (client holds `service_role` behind a dev flag) recorded in Complexity Tracking. |
| P4 Reuse free tools — exception for in-app admin UI | ✅ (with justification) | Provisioning a seller needs three coordinated writes (Auth + `salespeople` + `user_roles`) plus UX decisions (initial-password vs invite) that don't fit Supabase dashboard's one-row-at-a-time model. Filed under P4's in-app exception introduced in v1.0.0. |
| P5 Salesperson data sacred | ✅ N/A | Feature does not mutate order, client, or receipt data. Deactivation keeps the `salespeople` row so historical order attribution is preserved (FR-013, SC-005). |
| P6 Admin online-first | ✅ | Direct Supabase writes only — no WatermelonDB push queue. Blocking spinner allowed during Edge Function call. After success, we trigger a pull via the `adminWriteTrigger` shipped in feature 014. |
| R1 WatermelonDB single client data layer — admin exception | ✅ | Follows the admin exception documented in R1. Reads during the list view go straight to Supabase (admins need the latest state); WatermelonDB is consulted only indirectly via the sync trigger after a write. |
| R2 Minimalist data model | ✅ | No new entities; adds `salespeople.active boolean not null default true` only if absent. `user_roles` already exists. |
| R3 Storage-backed images | ✅ N/A | No images in this feature. |
| R4 Local PDF generation | ✅ N/A | No PDFs. |
| R5 Discounts belong to the order | ✅ N/A | No catalogue or pricing impact. |
| UX1 Tap not type | ⚠️ | Typing is unavoidable — name, email, optional password. All other choices (credential mode, status toggle, filter) are taps. Acceptable per the "typing reserved for registration" exception in UX1. |
| UX2 Repeat last order | ✅ N/A | Not an order flow. |
| UX3 Useful empty states | ✅ | Sellers list has a "Nenhum vendedor ainda" empty state that points to "Criar vendedor" (spec AS3 of US1). |
| UX4 Sync feedback discreet | ✅ | After each admin write, the existing home pill surface already reflects the sync pull. No new indicator. |
| UX5 Phone + tablet | ✅ | 8 frames already exported by `/speckit-pencil-design` (phone + tablet per screen × 4 screens). |
| UX6 Dual-role visibility | ✅ | Feature introduces the **Admin menu** landing screen; a non-admin never sees the Admin tab and therefore never reaches this surface. Dual-role users see the menu alongside the VENDEDOR tabs (already supported by `RootTabs` in feature 014). |
| D1 Pull-then-push sync | ✅ | Post-write pull is triggered by the existing `adminWriteTrigger`. No push from admin code. |
| D2 Catalog read-only for VENDEDOR | ✅ N/A | Not a catalogue feature. |
| D3 Client registration | ✅ N/A | Not a client-registration feature. |
| D4 Order statuses | ✅ N/A | Not an order feature. |
| D5 Online-one-time auth | ✅ | Admin sign-in flow unchanged. Edge Function authenticates the caller via the Supabase JWT passed in the `Authorization` header; no `service_role` leaves the function. |
| D6 Mandatory local lock | ✅ | Local-lock is pre-navigation, unaffected by this feature. |
| D7 Role-based authorization | ✅ | Roles (`admin`, `seller`) unchanged. New RLS policies documented in `contracts/supabase-rls.md`; they reuse the `is_admin()` helper shipped in 014. Edge Function gate also re-asserts `is_admin()` on the caller's JWT before touching `service_role`. |

**Result**: No unjustified violations. The P3/P4 complexity of an Edge Function (instead of a dashboard walkthrough) is justified by the atomicity requirement (FR-005 + SC-002) which no dashboard-only path can satisfy.

## Role & Authorization Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Check | Value / Status | Notes |
|-------|----------------|-------|
| Roles affected (admin / seller / dual-role) | admin (actor), seller (subject) | Sellers are never the caller in this feature — they are the acted-upon record. Dual-role users reach the flow via the Admin tab per UX6. |
| New or modified RLS policies (per table) | `salespeople` SELECT/UPDATE admin-only writes; `user_roles` INSERT/DELETE admin-only. See `contracts/supabase-rls.md` and the migration at `supabase/migrations/0015_admin_sellers.sql`. | Policies reuse the `is_admin()` helper from 0014. The new migration only touches `salespeople.active` and tightens existing policies if necessary; the role model is unchanged. |
| Edge Functions introduced (service_role usage) | ✅ `admin-create-seller` | Holds `service_role` server-side; client passes the admin's user JWT and the caller's admin role is re-checked inside the function before any `service_role` call. Contract in `contracts/edge-function.md`. |
| Offline classification per P6 | online-required | All three writes of the provisioning flow are server-authoritative and cannot be queued locally. Deactivation and edit are also online-required but the form state is preserved on connectivity errors so the admin can retry. |
| Client-side affordance visibility rule (UX6) | Admin tab → Admin menu → Vendedores card is rendered only when `session_state.roles` includes `admin`. A seller-only session never renders any of this. | Verified by a unit test in `session.roles.test.ts` that already exists from feature 014; extended to cover the Vendedores route. |
| Dual-role user impact | A user with both `admin` and `seller` can create other sellers, but CANNOT deactivate themselves (FR-014). The form disables the toggle and the Edge Function rejects a self-targeted deactivation with `{ error: 'cannot_deactivate_self' }`. | Enforced both client-side (UX) and server-side (Edge Function + RLS). |

## Design Prerequisite

*GATE: Must pass before any implementation task is generated.*

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | 4 screens: Admin menu, Sellers list, Seller form, Deactivate confirm. |
| `design/screens.md` exists | ✅ | [design/screens.md](./design/screens.md) |
| Phone frames cover all screens | ✅ | 4/4 — `5r1fS`, `yxfXA`, `6K3QQ`, `t28UU`. |
| Tablet frames cover all screens | ✅ | 4/4 — `qAGM6`, `kU63v`, `eDUrn`, `SW4Mf`. |
| Responsive strategy documented below | ✅ | See "Structure Decision". |

`design.json`: `specs/015-admin-sellers/design.json`.

## Project Structure

### Documentation (this feature)

```text
specs/015-admin-sellers/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── edge-function.md       # admin-create-seller contract
│   ├── supabase-rls.md        # RLS policy contract for salespeople + user_roles
│   └── client-api.md          # Client-side service module contract
├── design/              # Populated by /speckit-pencil-design (already done)
└── tasks.md             # Phase 2 output (NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/features/admin/sellers/           # NEW — admin-facing sellers module
├── components/
│   ├── SellerRow.tsx                 # list-row presentational
│   └── CredentialPicker.tsx          # tablet 2-card picker / phone segmented control
├── hooks/
│   ├── useSellers.ts                 # list fetch + active/inactive segmentation
│   └── useSellerForm.ts              # form state + validation + submit wrapper
├── screens/
│   ├── AdminMenuScreen.tsx           # NEW landing menu (Produtos, Vendedores)
│   ├── AdminSellersListScreen.tsx
│   ├── AdminSellerFormScreen.tsx     # unified create + edit (isEdit flag)
│   └── AdminSellerDeactivateModal.tsx  # destructive confirm overlay
├── service/
│   ├── sellersApi.ts                 # Supabase queries (list, edit, deactivate)
│   └── adminCreateSeller.ts          # Edge Function client wrapper
└── theme.ts                          # same palette/radii as admin/products

src/app/navigation/
├── AdminStack.tsx                    # EXTEND — route AdminMenu → Products | Sellers
└── types.ts                          # EXTEND — add AdminSellers* routes

supabase/
├── migrations/
│   └── 0015_admin_sellers.sql        # adds salespeople.active, RLS tightening
├── functions/
│   └── admin-create-seller/
│       ├── index.ts                  # Edge Function handler
│       └── test.ts                   # Deno unit test
└── seeds/
    └── 0015_seed_sellers.sql         # dev-only seed data (idempotent)
```

**Structure Decision**: mobile app + Supabase back-end (no separate API service). The admin module lives under `src/features/admin/sellers/` per §9 code conventions and mirrors the shape of `src/features/admin/products/` from feature 014. The Admin menu landing is also new; it is placed under the sellers feature folder because it is introduced *by* this feature, even though it lists Produtos too — splitting it into a separate `admin/menu/` folder would create a one-file feature and violate P3 simplicity. A follow-up feature can promote it if the menu grows.

**Responsive strategy**: each screen is one component rendered against a `useAdminSellersLayout()` hook (mirrors `useAdminProductsLayout`). The hook reads `Dimensions.get('window').width` and returns `{ viewport: 'phone' | 'tablet' }`. Components branch on viewport for layout decisions (stack vs. 2-col row for the form, segmented filter vs. search+segment for the list, FAB vs. toolbar button for create). No separate component trees per viewport — one component with layout branches, keeping touch targets consistent.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New Supabase Edge Function (`admin-create-seller`) | Auth-user provisioning requires `service_role`, which the constitution forbids on the client (D7). A Postgres trigger cannot create an `auth.users` row either — only the Admin API can. | Rejected: having the admin do two steps in the Supabase dashboard, then return to the app to send an invite. Unsafe (non-atomic — admin can forget step 2) and directly contradicts FR-005 and SC-002. |
| `salespeople.active boolean` column (if not already present) | FR-010 requires preserving the row but revoking access; a dedicated flag is the clearest encoding and lets the list segment actives from inactives without joining `user_roles`. | Rejected: inferring active-ness from the presence of the `seller` role. Works but forces an N+1 or a JOIN on every list render, and obscures the semantic difference between "no role yet" and "role revoked". |
