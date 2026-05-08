---

description: "Tasks — Admin-side Seller Management"
---

# Tasks: Admin-side Seller Management

**Input**: Design documents from `/specs/015-admin-sellers/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/` (edge-function.md, supabase-rls.md, client-api.md), `quickstart.md`, `design/screens.md` + 8 exported frames

## Phase 0: Design ✅ (already complete)

The Pencil pass ran during `/speckit-auto` Phase 3. All 4 screens × 2 viewports exist in `layout.pen` with exports under `design/`. **Checkpoint is green** — do not re-run.

## Phase 1: Setup

- [ ] T001 Add `salespeople.active` migration scaffolding at `supabase/migrations/0015_admin_sellers.sql` (empty skeleton with header + transaction block only).
- [ ] T002 [P] Create feature folder tree: `src/features/admin/sellers/{components,hooks,screens,service,tests}/` with empty `index.ts` barrels and a `theme.ts` that re-exports the same tokens as `src/features/admin/products/theme.ts`.
- [ ] T003 [P] Extend `src/app/navigation/types.ts` with the new route params: `AdminMenu` (no params), `AdminSellersList`, `AdminSellerForm: { mode: 'create' } | { mode: 'edit'; authUserId: string }`, `AdminSellerDeactivateModal: { authUserId: string; name: string }`.
- [ ] T004 [P] Add `.specify/feature.json` sanity check by running `cat .specify/feature.json` and confirming it points to `specs/015-admin-sellers`.

## Phase 2: Foundational (blocking)

No user story can complete without these — the migration enables reads, the Edge Function enables creation, the client service module is shared by all screens. Complete **all of Phase 2** before starting any user story phase.

- [ ] T005 Fill `supabase/migrations/0015_admin_sellers.sql` per `data-model.md` §Migrations: add `active` column, the name non-empty check, and both `deactivate_seller` / `reactivate_seller` `security definer` functions.
- [ ] T006 Append the RLS policy block from `contracts/supabase-rls.md` to `supabase/migrations/0015_admin_sellers.sql` (salespeople admin SELECT/INSERT/UPDATE + no-delete; user_roles admin INSERT/DELETE scoped to `role='seller'`).
- [ ] T007 Run the migration locally (`supabase db reset` or `supabase migration up`) and confirm `\d+ salespeople` shows the new column; confirm both functions appear in `\df public.*seller*`.
- [ ] T008 [P] Create Edge Function scaffold at `supabase/functions/admin-create-seller/index.ts` implementing the algorithm in `contracts/edge-function.md` §Handler (parse → verify JWT+admin → create auth user → insert salespeople → insert user_role → rollback on any failure).
- [ ] T009 [P] Write Deno unit tests at `supabase/functions/admin-create-seller/test.ts` covering the 7 cases listed in `contracts/edge-function.md` §Tests (happy paths, 401, 403, 409, 422, rollback).
- [ ] T010 Deploy the Edge Function to the local Supabase stack (`supabase functions serve admin-create-seller`) and run the Deno tests; they MUST all pass.
- [ ] T011 [P] Write RLS contract tests at `supabase/tests/0015_admin_sellers_rls.sql` covering the 11 cases listed in `contracts/supabase-rls.md` §Test coverage. Use `pgTAP`-style assertions consistent with `supabase/tests/0014_barcode_unique.sql`.
- [ ] T012 Implement the client service module at `src/features/admin/sellers/service/sellersApi.ts` per `contracts/client-api.md` §Public shape — `listSellers`, `updateSellerName`, `deactivateSeller`, `reactivateSeller` (each mapping Supabase errors to `SellerApiError`).
- [ ] T013 Implement the Edge Function client wrapper at `src/features/admin/sellers/service/adminCreateSeller.ts` that calls `supabase.functions.invoke('admin-create-seller', ...)` and maps the response to `SellerRow` / throws `SellerApiError`.
- [ ] T014 [P] Add a pure-function `useFriendlyError` helper at `src/features/admin/sellers/hooks/useFriendlyError.ts` that maps every `SellerApiError['code']` to Portuguese copy (one-liner per code).
- [ ] T015 Extend the existing `adminWriteTrigger` in `src/features/sync/triggers/adminWriteTrigger.ts` to accept a `'seller-write'` source label; wire each write path in `sellersApi.ts` / `adminCreateSeller.ts` to call it after a successful write so seller-side devices pull the change on next sync (D1).
- [ ] T016 [P] Add a unit test at `src/features/auth/session/session.roles.test.ts` covering the scenario "seller-only session does not see the AdminMenu route." Extend the existing roles test rather than creating a new file.

**Checkpoint**: migration applied, Edge Function green on all 7 tests, RLS contract tests pass, client service module compiles.

## Phase 3: User Story 5 — Admin menu as a single entry point (Priority P3, but **implemented first**)

**Rationale for order swap**: US5 is the new navigation shell that every other story lands in. Implementing it first means US1–US4 have a real route to push onto the navigator instead of a temporary one, and the UX6 visibility check has a single owner.

**Story goal**: an admin taps the Admin tab and lands on the menu; a seller-only user never sees the Admin tab at all.

**Independent test (from spec §US5)**: admin sees two cards (Produtos + Vendedores); seller-only session does not see the Admin tab; dual-role user sees the menu above their VENDEDOR tabs.

- [ ] T017 [US5] Implement `AdminMenuScreen` at `src/features/admin/sellers/screens/AdminMenuScreen.tsx`, consuming `useAdminSellersLayout` for phone-vs-tablet and rendering the two cards per Pencil frames `5r1fS` (phone) / `qAGM6` (tablet). Copy from `layout.pen` via `mcp__pencil__batch_get` at build time if needed.
- [ ] T018 [P] [US5] Implement the responsive hook `src/features/admin/sellers/responsive/useAdminSellersLayout.ts` that mirrors `useAdminProductsLayout`: reads `Dimensions.get('window').width` and returns `{ viewport: 'phone' | 'tablet' }`.
- [ ] T019 [US5] Refactor `src/app/navigation/AdminStack.tsx` so the **initial route is `AdminMenu`**, not `AdminProductsList`. `AdminMenu` routes to `AdminProductsList` (existing feature 014) on the Produtos card tap and to `AdminSellersList` (added in Phase 4) on the Vendedores card tap.
- [ ] T020 [US5] In `src/app/navigation/RootTabs.tsx`, confirm the Admin tab renders only when `session.roles.includes('admin')` (guard shipped in feature 014). Add a test assertion in `session.roles.test.ts` for the dual-role case.
- [ ] T021 [US5] Manually validate on phone + tablet simulators that the menu renders at the frame dimensions exported in `design/admin-menu-phone.png` / `admin-menu-tablet.png`. Record any layout delta in the PR description.

## Phase 4: User Story 1 — See every seller at a glance (Priority P1)

**Story goal**: admins open Admin → Vendedores and see every seller the company has ever provisioned, grouped by active/inactive.

**Independent test (from spec §US1)**: seed one active + one inactive seller via the database directly, then open the list and verify both appear with correct status badges.

- [ ] T022 [US1] Implement `useSellers` at `src/features/admin/sellers/hooks/useSellers.ts` that wraps `sellersApi.listSellers` with a `filter: 'all' | 'active' | 'inactive'` state and returns `{ sellers, filter, setFilter, isLoading, error, refetch }`.
- [ ] T023 [US1] Implement `SellerRow` at `src/features/admin/sellers/components/SellerRow.tsx` — presentational, takes `{ seller: SellerRow; onPress: () => void }` and mirrors Pencil frames `1OMlk` (active) / `6q7yu` (inactive, 75% opacity).
- [ ] T024 [US1] Implement `AdminSellersListScreen` at `src/features/admin/sellers/screens/AdminSellersListScreen.tsx` — topBar + segmented filter + list. Phone uses a `+` icon in the topBar; tablet uses a "Novo vendedor" primary button and surfaces the search input (Pencil frames `yxfXA` / `kU63v`).
- [ ] T025 [US1] Add the empty-state branch inside `AdminSellersListScreen` per spec §US1 AS3: "Nenhum vendedor ainda" + primary "Criar vendedor" CTA. Must render only when `sellers.length === 0` *and* filter is `'all'`.
- [ ] T026 [P] [US1] Wire the search input on tablet to an in-memory filter (case-insensitive match on name or email). Phone intentionally skips search for now (design decision recorded in `design/screens.md`).
- [ ] T027 [US1] Smoke-test on both viewports: seed 1 active + 1 inactive seller via SQL, confirm both render with correct badges; toggle each filter and verify the segments work.

## Phase 5: User Story 2 — Provision a new seller end-to-end (Priority P1)

**Story goal**: an admin creates a seller via either credential mode; all three records are created atomically or none are.

**Independent test (from spec §US2)**: from admin session, open Admin → Vendedores → Criar vendedor, pick "Enviar convite", submit; the seller appears as active, an invite email is dispatched, and signing in as that seller greets them by name.

- [ ] T028 [US2] Implement `useSellerForm` at `src/features/admin/sellers/hooks/useSellerForm.ts` — holds `{ name, email, mode, password }`, runs the validation rules from `contracts/client-api.md` + `contracts/edge-function.md` §Request body, exposes `submit()` returning `SellerRow | never`.
- [ ] T029 [US2] Implement `CredentialPicker` at `src/features/admin/sellers/components/CredentialPicker.tsx` — phone = segmented control (Pencil `LDj1R`); tablet = 2-card picker (Pencil `qUMM5`). Controlled component driven by `useSellerForm`.
- [ ] T030 [US2] Implement `AdminSellerFormScreen` (create mode) at `src/features/admin/sellers/screens/AdminSellerFormScreen.tsx` — topBar + Dados section + Credencial section with conditional password field. Wire Salvar → `useSellerForm.submit()` → `adminCreateSeller` → navigate back to list. Phone mirrors `6K3QQ`; tablet mirrors `eDUrn` (centered 640pt card).
- [ ] T031 [US2] Add the blocking spinner overlay during submission per plan.md §Constraints; preserve form state on network error so the admin can retry without retyping.
- [ ] T032 [US2] Map Edge Function errors from `adminCreateSeller` to inline field errors (`email_in_use` → under email, `validation_error` → under the named field) using `useFriendlyError`.
- [ ] T033 [US2] Wire `AdminSellersListScreen`'s "Criar vendedor" CTA and topBar `+` button to push `AdminSellerForm: { mode: 'create' }`.
- [ ] T034 [US2] Smoke-test both branches: password-mode creation → fresh sign-in works; invite-mode creation → invite email arrives (Supabase Inbucket in local dev). Run the full quickstart §4–5 steps.
- [ ] T035 [P] [US2] Add `src/features/admin/sellers/tests/useSellerForm.test.ts` unit-testing validation edge cases (empty name, bad email, password too short, mode-password without password).

## Phase 6: User Story 3 — Edit a seller's profile (Priority P2)

**Story goal**: an admin updates a seller's display name; status toggle flips active/inactive without opening the destructive modal for simple reactivation.

**Independent test (from spec §US3)**: create a seller, rename them, save; the new name shows up in the list and in the seller's home greeting on next sign-in.

- [ ] T036 [US3] Extend `useSellerForm` to support **edit mode**: accepts a pre-loaded `SellerRow`, disables the email field, adds a status toggle that calls `sellersApi.deactivateSeller` / `reactivateSeller` on change (guarded against self-deactivation).
- [ ] T037 [US3] Extend `AdminSellerFormScreen` to render the "Status" section (Pencil `tJYmY`) when `mode === 'edit'`. Toggle shows a tooltip when disabled for self-deactivation; hide the "Desativar vendedor" destructive button when the seller is already inactive.
- [ ] T038 [US3] Wire `AdminSellersListScreen` row tap to push `AdminSellerForm: { mode: 'edit', authUserId }`; load the seller via `sellersApi.listSellers` cache or a one-row `SELECT` if not in cache.
- [ ] T039 [US3] On successful name edit, optimistically update the list so the new name is visible before the next sync. Revert on error.
- [ ] T040 [US3] Smoke-test: rename a seller; confirm the list reflects it; sign in as that seller on a second device and verify the home greeting uses the new name.

## Phase 7: User Story 4 — Deactivate a seller without losing history (Priority P2)

**Story goal**: deactivation revokes access immediately AND preserves the `salespeople` row; reactivation restores access; self-deactivation is rejected.

**Independent test (from spec §US4)**: create a seller, have them place an order, deactivate them; sign-in fails with "Conta desativada", past orders still attribute the seller, zero rows deleted.

- [ ] T041 [US4] Implement `AdminSellerDeactivateModal` at `src/features/admin/sellers/screens/AdminSellerDeactivateModal.tsx` — overlay with destructive red primary button per Pencil `t28UU` / `SW4Mf`. Takes `{ authUserId, name, onConfirm, onCancel }`.
- [ ] T042 [US4] Wire the "Desativar vendedor" button in `AdminSellerFormScreen` to open the modal; `onConfirm` → `sellersApi.deactivateSeller` → close modal + editor + refetch list.
- [ ] T043 [US4] Implement the client-side self-deactivation guard: `AdminSellerFormScreen` disables the toggle AND the destructive button when `seller.auth_user_id === session.user.id`, with the tooltip copy from spec §FR-014.
- [ ] T044 [US4] In `src/features/auth/session/bootstrap.ts` (from feature 014) OR equivalent session check, branch on the role set: (a) zero roles → reject with "Conta desativada" and route to login; (b) `admin` only → admin UI (Admin tab, no VENDEDOR flows); (c) `seller` (with or without `admin`) → current behaviour. Admin-only users MUST NOT be rejected. Covers US4 AS2 without breaking admin-only sign-in.
- [ ] T045 [US4] In the session bootstrap path, re-read `user_roles` on every token refresh; compare previous-snapshot vs new-snapshot: if a role was **lost** (e.g., `seller` was present and now isn't), tear the session's role-specific surface down without logging the user out entirely when another role remains. Only log out fully when the new role set is empty.
- [ ] T046 [US4] Verify historical order attribution: after deactivation, open an existing order in `src/features/orders/screens/OrderDraftScreen.tsx` (or the appropriate history screen) that references the deactivated seller and confirm the name still renders. This is a readonly test — no code change expected, but a manual check required.
- [ ] T047 [US4] Smoke-test the reactivation path: deactivate → reactivate from the editor toggle → confirm the seller can sign in again (re-using their existing password; no new invite).

## Phase 8: Polish & cross-cutting concerns

- [ ] T048 [P] Run the complete `quickstart.md` top-to-bottom; record any step that deviates from expectation as a follow-up.
- [ ] T049 [P] Run `pnpm lint` + `pnpm typecheck` + `pnpm test` at repo root; all must be green before PR.
- [ ] T050 [P] Build the dev client and verify on an iOS phone simulator + an iPad 11" simulator (constitution §5 UX5). Layout MUST match the Pencil exports — any delta > 8pt is a bug.
- [ ] T051 [P] Add a brief section to the `README.md` (or existing `docs/admin-runbook.md` if present) explaining how to deploy `admin-create-seller` to a new environment (secrets, `supabase functions deploy`, smoke test).
- [ ] T052 Update `.specify/memory/constitution.md` with a note under §7 D7 marker linking feature 015 as the reference implementation for admin-only writes to `salespeople` via a `security definer` function. **Do not bump the constitution version** — this is a reference addition, not a principle change.
- [ ] T053 Run `/speckit-analyze` to verify spec ↔ plan ↔ tasks coherence before opening the PR.

---

## Dependencies and parallel opportunities

| Group | Tasks | Runs in parallel | Notes |
|-------|-------|------------------|-------|
| Setup | T001–T004 | T002, T003, T004 are [P] | T001 must land first so T005 has a file to edit. |
| Foundational | T005–T016 | T008+T009+T011+T014+T016 are [P] after T007 | T005→T006→T007 is sequential (same file). T008/T009/T011 touch separate files — parallel. T012/T013 depend on T010 (function deployed). |
| US5 | T017–T021 | T018 is [P] | Unblocks US1–US4. |
| US1 | T022–T027 | T026 is [P] | Needs US5 done. Needs `sellersApi.listSellers` from T012. |
| US2 | T028–T035 | T035 is [P] | Needs US1 done (list refresh after create). Needs `adminCreateSeller` from T013. |
| US3 | T036–T040 | — | Needs US2 done (shares `AdminSellerFormScreen`). |
| US4 | T041–T047 | — | Needs US3 done (shares the editor & toggle). |
| Polish | T048–T053 | T048–T051 are [P] | T053 last. |

## MVP suggestion

Ship **Phase 1 + Phase 2 + Phase 3 (US5) + Phase 4 (US1) + Phase 5 (US2)** as the first merge — this delivers the core "provision a seller" loop. Phases 6–7 (edit + deactivate) can land in a follow-up PR on the same branch without breaking any committed behaviour.

## Format validation

Every line under `Phase X` uses the required format: `- [ ] TXXX [P?] [USx?] Description + file path.` Setup/Foundational/Polish tasks carry no `[USx]` label; story tasks all do. IDs run sequentially T001→T053 with no gaps.
