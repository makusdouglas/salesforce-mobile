# Implementation Plan: Admin role + products/variants CRUD

**Branch**: `014-admin-products-crud` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-admin-products-crud/spec.md`

## Summary

Introduce the first admin surface in the app: a role-guarded "Admin" tab in
the root navigator that is visible only to users carrying `role='admin'` and
coexists with the seller home for dual-role users (UX6). Behind the tab, an
MVP CRUD for products (name, description, category, base price, barcode,
image) and their variants (attribute label, price). Product registration has
two entry paths:

- **Manual**: opens an empty form.
- **Barcode**: opens a camera scanner (with typed-entry fallback). The
  scanned/typed code is looked up online against `products.barcode`; if a
  live product exists, the admin is routed to a Match screen that lets them
  edit it instead of creating a duplicate; if no product matches, the form
  opens with the barcode field pre-filled.

Writes go **directly** to Supabase — admin flows are online-required (P6)
and MUST NOT touch WatermelonDB's push queue. Supabase RLS restricts
INSERT/UPDATE/DELETE on `products` and `product_variants` to admins (D7),
while seller read access (the source of the local cache in feature 5) is
preserved. Images are chosen via `expo-image-picker`, resized via
`expo-image-manipulator`, uploaded to Supabase Storage, and the resulting
public URL is stored on the product row. Barcodes are scanned via
`expo-camera` (typed fallback on the same screen). After any admin write,
the app triggers the existing feature-5 sync pull so seller devices refresh
their local cache on next sync.

## Technical Context

**Language/Version**: TypeScript 5 on React Native (Expo SDK, managed workflow)  
**Primary Dependencies**: `@supabase/supabase-js`, `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs` (new — required to host the conditional Admin tab next to the seller stack), `@nozbe/watermelondb` (seller-side only; NOT used by this feature's writes), `expo-image-picker`, `expo-image-manipulator`, `expo-camera` (new — barcode scanner), `expo-file-system`  
**Storage**: Supabase Postgres (`public.products`, `public.product_variants`, new `public.user_roles`) + Supabase Storage bucket for product images  
**Testing**: Jest (existing `pnpm test`), React Native Testing Library patterns already used in `src/features/**/tests`  
**Target Platform**: iOS + Android (Expo), phone and tablet viewports (UX5)  
**Project Type**: Expo React Native mobile app (single project)  
**Performance Goals**: Admin list renders MVP-scale catalogues (≤ a few hundred items) without pagination; barcode lookup completes in one round-trip; image upload completes on a typical 3G+ connection for assets resized ≤ ~300 KB  
**Constraints**: Online-required (P6) — no offline queueing of admin writes or barcode lookups; image resize MUST happen client-side before upload; RLS MUST reject any non-admin write; Portuguese user-facing copy  
**Scale/Scope**: New admin namespace `src/features/admin/products/**`, plus one migration (`0014_user_roles_and_admin_rls.sql`), plus an Admin tab in the root navigator. Reuses feature-3 session state and feature-5 sync trigger.

## Constitution Check

*Evaluated against constitution v1.0.0.*

| Principle | Status | Justification |
|-----------|--------|---------------|
| P1 — Offline-first for VENDEDOR | ✅ | Feature adds admin-only screens; VENDEDOR flows are untouched. |
| P2 — Local DB is source of truth during field session | ✅ | No seller data model change. Seller cache keeps reading `products`/`product_variants` via the existing sync engine. |
| P3 — MVP simplicity | ✅ | Single migration, single admin namespace, no abstractions beyond what the screens need. |
| P4 — Reuse free tools before building | ✅ | In-app admin UI is explicitly authorized by P4's v1.0.0 exception because (a) the admin UX benefits from mobile (barcode scan is phone-native) and (b) RLS already permits the operation. Supabase dashboard remains an escape hatch for bulk/schema work. |
| P5 — Salesperson data is sacred | ✅ | Feature does not touch seller-owned tables. |
| P6 — Admin is online-first | ✅ | Writes AND barcode lookup bypass WatermelonDB and go straight through `@supabase/supabase-js`. Offline state surfaces a Portuguese error and preserves form state; no queue. |

**New mandatory dependencies introduced** (per §3 "Required for admin features"):

- `expo-image-picker` — admin photo selection from camera/library. Justification: admins upload product photos directly from the device.
- `expo-image-manipulator` — resize/compress the chosen image before upload so uploaded assets stay within a predictable budget (~300 KB average). Justification: keeps catalogue loading snappy on low-end seller devices and bounds Storage costs.
- `expo-camera` — read barcodes at the point of sale. Justification: the barcode entry path is explicitly in scope per the updated spec; there is no free-tool substitute that runs inside the app.
- `@react-navigation/bottom-tabs` — required to host the conditional Admin tab adjacent to the existing `HomeStack`. The current navigator is a single native-stack; a tab navigator is introduced only at the post-auth layer (no change to auth/lock layers).

## Role & Authorization Check

| Check | Value / Status | Notes |
|-------|----------------|-------|
| Roles affected (admin / seller / dual-role) | `admin` (new primary), `admin + seller (dual-role)` | Seller-only users are unaffected except that their cache refreshes after admin writes. |
| New or modified RLS policies (per table) | `products` (INSERT/UPDATE/DELETE restricted to admin; SELECT preserved), `product_variants` (same), `user_roles` (each user can SELECT their own rows; writes via migration only) | Migration: `supabase/migrations/0014_user_roles_and_admin_rls.sql` |
| Edge Functions introduced (service_role usage) | none | All operations use the authenticated client JWT; `service_role` stays server-side. |
| Offline classification per P6 (online-required / offline-first / mixed) | online-required | Admin writes and barcode lookup MUST hit Supabase directly; no WatermelonDB push queue. Offline surfaces a Portuguese error and blocks the action. |
| Client-side affordance visibility rule (UX6) | Admin tab rendered iff the signed-in user's role set contains `admin`. Seller-only users see no admin affordance anywhere. | Enforced in `RootNavigator` via the `useRoles()` gate. |
| Dual-role user impact | Dual-role users see the seller `HomeStack` AND an extra top-level `AdminStack` simultaneously via a bottom-tab navigator — no mode toggle; direct deep-linking works from either side. | Tab bar only renders when ≥ 2 tabs exist; admin-only users see a single "Admin" tab without a visible bar (feels like a regular stack). |

## Design Prerequisite

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | 10 screens in spec.md §UI Design (5 logical screens × phone/tablet). |
| `design/screens.md` exists | ✅ | [design/screens.md](./design/screens.md) |
| Phone frames cover all screens | ✅ | `admin-products-list-phone.png`, `admin-product-source-phone.png`, `admin-barcode-scanner-phone.png`, `admin-barcode-match-phone.png`, `admin-product-form-phone.png`. |
| Tablet frames cover all screens | ✅ | Counterparts for every screen above. |
| Responsive strategy documented below | ✅ | See Structure Decision. |

## Project Structure

### Documentation (this feature)

```text
specs/014-admin-products-crud/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── supabase-rls.md
│   ├── storage-bucket.md
│   └── client-api.md
├── design/
│   ├── screens.md
│   ├── admin-products-list-{phone,tablet}.png
│   ├── admin-product-source-{phone,tablet}.png
│   ├── admin-barcode-scanner-{phone,tablet}.png
│   ├── admin-barcode-match-{phone,tablet}.png
│   └── admin-product-form-{phone,tablet}.png
├── design.json
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── app/
│   └── navigation/
│       ├── RootNavigator.tsx        # + conditional tab navigator post-auth
│       ├── RootTabs.tsx             # NEW — bottom-tabs wrapper (HomeStack [+ AdminStack when role=admin])
│       ├── AdminStack.tsx           # NEW — admin-only nested stack
│       └── types.ts                 # + AdminStackParamList, + RootTabsParamList
├── features/
│   ├── auth/
│   │   └── session/session.ts       # + roles on SessionSnapshot
│   ├── admin/                       # NEW namespace (constitution §9)
│   │   └── products/
│   │       ├── index.ts
│   │       ├── screens/
│   │       │   ├── AdminProductsListScreen.tsx
│   │       │   ├── AdminProductSourceScreen.tsx      # modal chooser
│   │       │   ├── AdminBarcodeScannerScreen.tsx
│   │       │   ├── AdminBarcodeMatchScreen.tsx
│   │       │   └── AdminProductFormScreen.tsx
│   │       ├── components/
│   │       │   ├── ProductRow.tsx
│   │       │   ├── ProductImagePicker.tsx
│   │       │   ├── BarcodeField.tsx
│   │       │   └── VariantRow.tsx
│   │       ├── hooks/
│   │       │   ├── useProducts.ts
│   │       │   ├── useProductForm.ts
│   │       │   ├── useProductImageUpload.ts
│   │       │   └── useBarcodeLookup.ts
│   │       ├── service/
│   │       │   ├── productsApi.ts       # direct Supabase client calls
│   │       │   ├── barcodeLookup.ts
│   │       │   └── imageUpload.ts
│   │       ├── responsive/
│   │       │   └── useAdminProductsLayout.ts
│   │       └── tests/
│   │           ├── productsApi.test.ts
│   │           ├── barcodeLookup.test.ts
│   │           ├── useProductForm.test.ts
│   │           └── AdminProductsListScreen.test.tsx
│   └── sync/
│       └── triggers/
│           └── adminWriteTrigger.ts  # NEW — wraps pullToRefreshTrigger
└── supabase/
    └── migrations/
        └── 0014_user_roles_and_admin_rls.sql   # NEW
```

**Structure Decision**: Admin screens live in `src/features/admin/<domain>/`
(§9 convention introduced in constitution v1.0.0). The `admin` namespace
mirrors the seller `features/<domain>/` layout but its runtime
dependencies are different: admin hooks/services call `supabase-js`
directly, never WatermelonDB. Responsive strategy: each admin screen has
one component tree; a feature-local `useAdminProductsLayout()` hook
reuses the shared viewport util and screens switch between two layout
branches (stacked for phone, split for tablet), matching the pattern in
`src/features/clients/responsive/**`. Image picker + resize pipeline
lives in `service/imageUpload.ts`; barcode lookup logic lives in
`service/barcodeLookup.ts`; both are pure functions so unit tests can mock
Supabase without pulling in Expo modules. The Root tab navigator is
introduced only at the authenticated layer so the Auth/Lock stacks are
untouched.

## Complexity Tracking

> No constitutional violations to justify. Everything in this plan maps to
> P4 (v1.0.0 in-app admin exception), P6, UX5, UX6, and D7 as defined in
> constitution v1.0.0. `expo-camera` is introduced alongside the other two
> admin-feature dependencies listed in §3; all three carry one-line
> justifications under Constitution Check.
