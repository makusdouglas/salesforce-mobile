# Tasks: Admin role + products/variants CRUD

**Input**: Design documents from `/specs/014-admin-products-crud/`
**Prerequisites**: plan.md (✅), spec.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅)
**Tests**: Unit + hook + screen tests are included per constitution §9 and the existing project conventions.
**Organization**: Tasks are grouped by user story so each can be implemented, tested, and delivered independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5) or `Setup` / `Design` / `Polish`

## Phase 0: Design 🎨

- [x] T001 [Design] `design.json` covers 5 logical screens × phone + tablet (10 frames total). Exported screenshots: `admin-products-list-{phone,tablet}.png`, `admin-product-source-{phone,tablet}.png`, `admin-barcode-scanner-{phone,tablet}.png`, `admin-barcode-match-{phone,tablet}.png`, `admin-product-form-{phone,tablet}.png`. `screens.md` documents phone→tablet deltas (split layout on form, larger reticle on scanner, inline "Editar" button on list).

**Checkpoint**: Phase 0 is green — proceed.

## Phase 1: Setup (role foundation & infra) — BLOCKS all screen tasks (D7)

- [ ] T010 [Setup] Create `supabase/migrations/0014_user_roles_and_admin_rls.sql` implementing:
  - `public.user_roles (user_id uuid references auth.users(id) on delete cascade, role text check (role in ('admin','seller')), created_at timestamptz default now(), primary key (user_id, role))`.
  - `SELECT` own rows RLS policy on `user_roles`; no write policy.
  - `public.is_admin()` `STABLE SECURITY DEFINER` helper.
  - `ALTER TABLE public.products ADD COLUMN barcode text`.
  - `ALTER TABLE public.products ADD COLUMN base_price numeric(12,2) NOT NULL DEFAULT 0`.
  - `UPDATE public.products` with the minimum-live-variant-price backfill documented in `data-model.md` (so existing catalogues do not show R$ 0,00 post-migration).
  - `CREATE UNIQUE INDEX products_barcode_live_idx ON public.products (barcode) WHERE deleted_at IS NULL AND barcode IS NOT NULL`.
  - Per-policy admin INSERT/UPDATE/DELETE + authenticated SELECT on `products` and `product_variants` (see `contracts/supabase-rls.md`).
  - Do NOT hard-code the first-admin UUID in this migration — seeding is handled by T010b so the migration stays idempotent and environment-agnostic.
- [ ] T010b [Setup] Add `supabase/seeds/0014_first_admin.sql` with a templated `INSERT INTO public.user_roles (user_id, role) VALUES ('<replace-me>', 'admin') ON CONFLICT DO NOTHING;`. Document the psql one-liner in `quickstart.md` §1. This keeps the checked-in migration free of placeholder UUIDs.
- [ ] T011 [Setup] Create Supabase Storage bucket `product-images` (public read) and install the admin-only write policy from `contracts/storage-bucket.md`. Capture the policy SQL in the migration file.
- [ ] T012 [Setup] Install new dependencies via `pnpm add expo-image-picker expo-image-manipulator expo-camera @react-navigation/bottom-tabs`; register `expo-image-picker` and `expo-camera` in `app.json` `plugins` with the required permission copy (camera + photo library).
- [ ] T013 [Setup] [P] Add `src/services/supabase/adminClient.ts` (if a dedicated admin client is warranted) OR confirm the existing Supabase client carries the auth JWT; document the choice in `research.md`.
- [ ] T014 [Setup] Extend `src/features/auth/session/session.ts`: add `roles: ReadonlyArray<'admin' | 'seller'>` to `SessionSnapshot`, wire a `_setRoles()` internal setter, update `makeSnapshot` to include `roles`, and keep backward-compatible defaults (`[]`).
- [ ] T015 [Setup] In `src/features/auth/session/bootstrap.ts` (and any post-login path), fetch `user_roles` for the signed-in user and publish them to the session snapshot. Refresh on session refresh events.
- [ ] T016 [Setup] [P] Expose `useSession`, `useRoles`, `useHasRole` from `@/features/auth` (`session/index.ts`), matching `contracts/client-api.md`.
- [ ] T017 [Setup] [P] Unit tests for `session.ts` role transitions: initial empty, set-after-login, clear-on-logout, idempotent re-set. File: `src/features/auth/session/session.roles.test.ts`.

**Checkpoint**: Role foundation + RLS in place. Proceed to navigation.

## Phase 2: US1 — Role-guarded Admin tab (Priority P1)

- [ ] T020 [US1] Introduce `src/app/navigation/RootTabs.tsx`: a bottom-tab navigator that always shows the seller `HomeStack` and conditionally shows the `AdminStack` when `useHasRole('admin')` is true. Hide the tab bar (`tabBarStyle: { display: 'none' }`) when only one tab is present so seller-only users see no change.
- [ ] T021 [US1] Add `src/app/navigation/AdminStack.tsx` skeleton (stack navigator) with placeholder `AdminProductsListScreen` route to unblock parallel work.
- [ ] T022 [US1] Update `src/app/navigation/RootNavigator.tsx` to render `RootTabs` instead of `HomeStack` directly inside the `LockGate` branch; keep `AuthStack` and `Relogin` untouched.
- [ ] T023 [US1] Update `src/app/navigation/types.ts` with `RootTabsParamList` and `AdminStackParamList` (routes: `AdminProducts`, `AdminProductSource`, `AdminBarcodeScanner`, `AdminBarcodeMatch`, `AdminProductForm`).
- [ ] T024 [US1] [P] Screen test: `RootTabs` renders only `HomeStack` for seller-only; renders both for admin; renders only the admin tab (invisible bar) for admin-only. File: `src/app/navigation/RootTabs.test.tsx`.
- [ ] T025 [US1] [P] Screen test: role revocation at runtime removes the Admin tab on the next render. Extend `RootTabs.test.tsx`.

**Checkpoint**: MVP for US1 deliverable — an admin sees the tab, a seller does not.

## Phase 3: US4 — RLS verified (Priority P1, server-side)

- [ ] T030 [US4] Write a Jest contract test that uses a mocked `supabase-js` client (two personas: admin, seller) and exercises the 7 cases listed in `contracts/supabase-rls.md`. File: `src/features/admin/products/tests/rls.contract.test.ts` (matches the pattern used by feature 5 under `src/features/sync/tests/`, per research.md §R-009). End-to-end RLS verification against a live Supabase project is documented in `quickstart.md` §6 and runs manually per release.
- [ ] T031 [US4] Add a negative-path integration test that confirms anonymous callers are rejected on SELECT/INSERT on `products` and `product_variants`.

**Checkpoint**: US4 server-side gate is verified independently of the UI.

## Phase 4: US2 — Manual product CRUD (Priority P1)

- [ ] T040 [US2] Create `src/features/admin/products/service/productsApi.ts` with `listProducts`, `saveProduct`, `softDeleteProduct` matching `contracts/client-api.md`.
- [ ] T041 [US2] Create `src/features/admin/products/service/imageUpload.ts` implementing `pickAndUploadImage` (picker + manipulator + upload + `getPublicUrl`) per `contracts/storage-bucket.md`.
- [ ] T042 [US2] Create `src/features/sync/triggers/adminWriteTrigger.ts` wrapping `pullToRefreshTrigger`; swallow errors, log via existing telemetry.
- [ ] T043 [US2] [P] Hook: `src/features/admin/products/hooks/useProducts.ts` — loads the list, exposes refresh.
- [ ] T044 [US2] Hook: `src/features/admin/products/hooks/useProductForm.ts` — holds form state for name/description/category/base_price/barcode/image_url/variants; Save orchestrates `pickAndUploadImage` (if pending) then `saveProduct` then `adminWriteTrigger`. On any failure (offline, RLS rejection, upload failure, unique-barcode conflict) the hook MUST NOT reset form state — the user's typed values stay visible so they can retry (FR-020). Implements the soft-rollback rule from `research.md` §R-003b when a create fails between steps 1 and 2.
- [ ] T045 [US2] [P] Hook: `src/features/admin/products/hooks/useProductImageUpload.ts` — permission prompt, picker → manipulator → upload pipeline exposed as a single async call the form can await.
- [ ] T046 [US2] Create `src/features/admin/products/components/ProductImagePicker.tsx`: dashed drop zone when empty; image fill + "Trocar imagem" when a URL exists.
- [ ] T047 [US2] Create `src/features/admin/products/components/VariantRow.tsx`: label + price inputs, soft-delete affordance.
- [ ] T048 [US2] Create `src/features/admin/products/components/ProductRow.tsx` used by the list: thumbnail, name, category, base price, edit chevron.
- [ ] T049 [US2] Create `src/features/admin/products/responsive/useAdminProductsLayout.ts` returning `'phone' | 'tablet'`.
- [ ] T050 [US2] Create `src/features/admin/products/screens/AdminProductsListScreen.tsx` — list with empty state, "Novo" CTA that navigates to `AdminProductSource`, search field on tablet only (per design).
- [ ] T051 [US2] Create `src/features/admin/products/screens/AdminProductSourceScreen.tsx` — modal chooser with "Cadastro manual" and "Escanear código de barras".
- [ ] T052 [US2] Create `src/features/admin/products/screens/AdminProductFormScreen.tsx` with phone (stacked) and tablet (split) branches; receives optional `{ productId?, prefilledBarcode? }` params; renders offline banner + blocks Save when offline.
- [ ] T053 [US2] Wire all 3 screens into `AdminStack`.
- [ ] T054 [US2] [P] Unit tests: `productsApi.test.ts` (happy path, RLS error mapping, variant diff), `imageUpload.test.ts` (picker cancel, permission denied, manipulator failure, upload failure).
- [ ] T055 [US2] [P] Hook tests: `useProductForm.test.ts` (offline blocks Save, atomic save triggers sync, variant add/remove/edit lifecycle).
- [ ] T056 [US2] [P] Screen test: `AdminProductsListScreen.test.tsx` — empty state, renders 10 rows, "Novo" navigates.

**Checkpoint**: Manual path works end-to-end — US2 deliverable.

## Phase 5: US3 — Barcode flow (Priority P1)

- [ ] T060 [US3] Create `src/features/admin/products/service/barcodeLookup.ts` implementing `lookupBarcode` per `contracts/client-api.md` (normalize → query → map errors).
- [ ] T061 [US3] Hook: `src/features/admin/products/hooks/useBarcodeLookup.ts` exposing `run(code)` that returns the `BarcodeLookupResult` union.
- [ ] T062 [US3] Create `src/features/admin/products/components/BarcodeField.tsx` — labeled input with a small inline "Escanear" button that navigates to `AdminBarcodeScanner` and writes the scanned code back to the form.
- [ ] T063 [US3] Create `src/features/admin/products/screens/AdminBarcodeScannerScreen.tsx` — `expo-camera` preview with reticle, torch toggle, accepted symbologies `code128`, `ean-13`, `ean-8`, `upc-a`, `qr`; persistent typed-entry fallback that MUST preserve the typed value across failed "Verificar código" attempts (FR-020); on result call `useBarcodeLookup`, then navigate to `AdminBarcodeMatch` (match) or `AdminProductForm` with `prefilledBarcode` (no match); on offline show the Portuguese banner and keep the user on the scanner with their input intact.
- [ ] T064 [US3] Create `src/features/admin/products/screens/AdminBarcodeMatchScreen.tsx` — amber banner, product card, "Editar este produto" → `AdminProductForm` with `productId`, "Escanear outro código" → back to scanner.
- [ ] T065 [US3] Surface a DB-unique-constraint violation on `saveProduct` with a Portuguese message and a "Ver produto existente" CTA that navigates to the Match screen with the conflicting row.
- [ ] T066 [US3] Wire new screens into `AdminStack`; update `AdminStackParamList` types.
- [ ] T067 [US3] [P] Unit test: `barcodeLookup.test.ts` — normalization, match / no_match / offline branches, soft-deleted row treated as `no_match`.
- [ ] T068 [US3] [P] Hook test: `useBarcodeLookup.test.ts` — offline surfaces correct status, match returns product payload.
- [ ] T069 [US3] [P] Screen tests: `AdminBarcodeMatchScreen.test.tsx` (renders product, CTAs navigate); `AdminBarcodeScannerScreen.test.tsx` (manual entry path — camera is mocked, typed code → Match vs Form navigation).
- [ ] T070 [US3] [P] DB-level test documented inline in the migration (or a companion `supabase/tests/0014_barcode_unique.sql`): two INSERTs targeting the same live barcode — expect the second to fail on `products_barcode_live_idx`. A third INSERT reusing a soft-deleted barcode MUST succeed. Run manually against the local Supabase per the step in `quickstart.md` §1.

**Checkpoint**: Barcode flow works end-to-end — US3 deliverable.

## Phase 6: US5 — List polish (Priority P2)

- [ ] T080 [US5] Implement search field (tablet only, per design) on `AdminProductsListScreen`: case-insensitive substring match over name + category.
- [ ] T081 [US5] Empty state on the list with a prominent "Novo" CTA.
- [ ] T082 [US5] [P] Screen test: search filters rows correctly; empty query restores full list.

**Checkpoint**: US5 deliverable.

## Phase 7: Polish & hardening

- [ ] T090 [Polish] Portuguese error copy pass across all admin screens (offline, RLS rejection, duplicate barcode, image upload failure, camera permission denied).
- [ ] T091 [Polish] Manual verification against `design.json` on phone + tablet simulators — diff each screen against the screenshots and log any delta in `design/screens.md` under "Design decisions".
- [ ] T092 [Polish] Run `pnpm typecheck && pnpm lint && pnpm test` and clean up any regressions.
- [ ] T093 [Polish] Update `supabase/migrations/README.md` with the 0014 migration entry and the Storage bucket setup.
- [ ] T094 [Polish] Exercise the `quickstart.md` flow end-to-end against a real Supabase project; correct anything that drifted.
- [ ] T095 [Polish] Flip `app.json` `ios.supportsTablet` to `true` (Android has no equivalent flag — verify the tablet layouts render on an Android tablet simulator). Without this change, UX5 is satisfied in design only.

## Dependency notes

- T020–T025 (US1) depend on T014–T016 (session exposes roles).
- T040+ (US2) depend on T010–T012 (migration + Storage + deps) and T020–T023 (navigation skeleton).
- T060+ (US3) depend on T040+ (form must exist to receive prefilled barcode) and T010 (unique index).
- T080+ (US5) depends on T050 (list screen exists).
- T092 (full test sweep) runs last.

## Parallelization hints

- T040, T041, T042, T043, T045 can run in parallel — different files, different responsibilities.
- T054, T055, T056 are all test files and can run in parallel with any completed production file.
- T060–T064 share `AdminStack` wiring (T066) so coordinate that PR last.
