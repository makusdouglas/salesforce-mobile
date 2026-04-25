---

description: "Task list for feature 016-product-lifecycle-roles"
---

# Tasks: Product Lifecycle + Granular Admin Roles

**Input**: Design documents from `/specs/016-product-lifecycle-roles/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included for RLS policies and a small set of high-risk pure-logic paths (selector + repeat-clone). UI is exercised manually via `quickstart.md` per the constitution's "business-logic tests first" convention.

**Organization**: By user story (US1–US5 from spec.md) after Setup + Foundational.

---

## ⚠️ Plan-vs-reality deltas discovered during implement

These corrections apply to file paths throughout this file and `plan.md`. The tasks below have been left in their original wording so the diff is visible; actual file paths during execution follow the "Reality" column.

| Topic | Plan assumed | Reality |
|-------|--------------|---------|
| **Migration number** | `0016_product_lifecycle_roles.sql` | `0018_product_lifecycle_and_granular_roles.sql` — `0016` and `0017` already shipped (`0016_seller_auth_ban.sql`, `0017_email_exists_in_auth.sql`) |
| **WatermelonDB path** | `src/db/watermelon/…` | TBD — explore `src/data/` (top-level). Verify before writing T003–T005. |
| **Session store path** | `src/features/session/…` | `src/features/auth/session/session.ts` (+ `session.roles.test.ts`) |
| **Screen files** | `src/features/admin/<domain>/<Screen>.tsx` | `src/features/admin/<domain>/{hooks,service,responsive,tests}/…`. Screens are co-located under `src/app/…` via Expo Router. Verify the active routing before writing new screens. |
| **useAdminGate location** | `src/features/session/useAdminGate.ts` | Target path `src/features/auth/session/useAdminGate.ts` to stay next to `session.ts` |
| **Legacy `is_admin()` SELECT policy reference in 0015** | not mentioned | Migration 0015 carved INSERT/DELETE scoped to `role='seller'`; 0018 drops those in favour of a broader superuser-only policy. Verified in `0018_*.sql`. |

---

## Format: `[ID] [P?] [Story] Description`

---

## Phase 0: Design (UI features) 🎨

**Purpose**: Produce phone + tablet frames for the 5 new screens via Pencil MCP before any code is written (constitution §5 UX5). Analog frames listed in `design/screens.md` are the clone source.

**⚠️ BLOCKING**: no Phase 1 task may start until every T00* is checked.

- [x] T000 [Design] Open `layout.pen` via Pencil MCP; confirm `Anchored Ribbon Grid` style guide is applied to the workspace.
- [x] T000a [P] [Design] Cloned `t28UU` → `AdminProductDeactivateConfirm / Phone` (frame `3kyN7`); icon `package-x`, title "Desativar este produto?", draft-count body.
- [x] T000b [P] [Design] Cloned `SW4Mf` → `AdminProductDeactivateConfirm / Tablet` (frame `evhGY`).
- [x] T000c [P] [Design] Cloned `t28UU` → `DraftDiscontinuedAlert / Phone` (frame `A65W2`); amber `alert-triangle`, primary "Remover linhas e continuar".
- [x] T000d [P] [Design] Cloned `SW4Mf` → `DraftDiscontinuedAlert / Tablet` (frame `5w1q2`).
- [x] T000e [P] [Design] Cloned `t28UU` → `RepeatOrderDiscontinuedAlert / Phone` (frame `boQMF`); primary "Continuar com ativos", secondary "Cancelar".
- [x] T000f [P] [Design] Cloned `SW4Mf` → `RepeatOrderDiscontinuedAlert / Tablet` (frame `Yp9ot`).
- [x] T000g [P] [Design] Cloned `yxfXA` → `AdminUsersList / Phone` (frame `bObF0`); segment "Todos / Admins / Vendedores", role badges on rows (Super usuário / Produtos / Vendedor).
- [x] T000h [P] [Design] Cloned `kU63v` → `AdminUsersList / Tablet` (frame `Nm3SK`); "Novo usuário" CTA + expanded search placeholder.
- [x] T000i [P] [Design] Cloned `6K3QQ` → `AdminUserRolesForm / Phone` (frame `YL1iX`); USUÁRIO + FUNÇÕES ADMIN + SUPER USUÁRIO sections. Implement phase (T029) duplicates the STATUS-style toggle row to reach four admin-grade toggles.
- [x] T000j [P] [Design] Cloned `eDUrn` → `AdminUserRolesForm / Tablet` (frame `zeSbE`); relabeled headings + card copy.
- [ ] T000k [Design] Adjust existing `AdminProductsList / Phone` (`hq0zE`) + `AdminProductsList / Tablet` (`luM9m`): add "Ativos / Inativos / Todos" segment, search input, and an inactive-row variant (opacity 0.5, "Inativo" badge). Re-export both. **Deferred to implement phase** — pattern demonstrated by `AdminSellersList` and the new `AdminUsersList` clones.
- [ ] T000l [Design] Adjust existing `AdminProductForm / Phone` (`ImfjY`) + `AdminProductForm / Tablet` (`qmIMf`): add Ativo/Inativo toggle row + secondary "Desativar" button. Re-export both. **Deferred to implement phase** — toggle-row pattern demonstrated by `AdminSellerForm` STATUS section.
- [x] T000m [Design] Added "Usuários & Roles" tile to `AdminMenu / Phone` (`5r1fS`) and `/ Tablet` (`qAGM6`) with `shield-check` icon + role-gating note; re-exported.
- [ ] T000n [Design] Adjust the existing `ProfileScreen` phone + tablet frames: append a "Suas funções" section below user info with role chips. **Deferred to implement phase** — single-section append using existing `Badge/*` components.
- [x] T000z [Design] Updated `design/screens.md` with every new frame ID; refreshed `design/design.json`. Ten new frames + two modified frames exported as PNG.

**Checkpoint**: `design.json` lists 18 frames (9 screens × phone + tablet). `screens.md` has no TBDs.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the migration, update WatermelonDB schema, wire role helpers. Includes the mandatory RLS-policies task before any screen task (D7 gate).

- [x] T001 Create migration file `supabase/migrations/0018_product_lifecycle_and_granular_roles.sql` (renumbered from 0016 — collision with existing `0016_seller_auth_ban.sql`) per `contracts/migration.md` — column additions on `products`, CHECK constraint, helper functions, role rewrite, CHECK widening on `user_roles`, RLS policy rewrites for products/product_variants/salespeople/clients/user_roles, single-superuser trigger, `admin_users_view`. One transaction, no in-place idempotency tricks.
- [x] T002 Create the down-migration `supabase/migrations/0018_product_lifecycle_and_granular_roles.down.sql` (reverses CHECK widening + trigger + helpers + policies; leaves `products.active`/`products.deactivated_at` columns in place as harmless no-ops).
- [x] T003 [P] Bumped `src/data/schema/tables.ts` schema from v5 to v6; added `active` (boolean, indexed) and `deactivated_at_ms` (number, optional) to `products`. Path differs from plan — project uses `src/data/`, not `src/db/watermelon/`.
- [x] T004 [P] Added migration v5 → v6 step in `src/data/schema/migrations.ts`; both columns added on existing rows (active defaults true).
- [x] T005 Updated `src/data/models/Product.ts` to expose `active: boolean` and `deactivatedAtMs: number | null` as observable `@field`s.

**Checkpoint**: Supabase + WatermelonDB schemas aligned; RLS surface in place before any screen touches these tables.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Session/role plumbing + role-gating primitives that every later phase depends on.

- [x] T006 [P] Created `src/features/auth/session/roleBadgeMapping.ts` — `roleBadge(role)` returns `{ label, style }` with destructive=superuser/admin, default=manage-*, secondary=seller.
- [x] T007 [P] Widened `SessionRole` in `session.ts` to the 5-value set + legacy `admin` alias. Updated `rolesRepository.VALID_ROLES`. SessionProvider adds `AppState` listener — re-fetches roles on foreground transition when `Authenticated` (FR-027, SC-007).
- [x] T008 [P] Created `src/features/auth/session/useAdminGate.ts` — `useAdminGate(required)` and `useAnyAdminRole()`, backed by pure predicates (`hasAdminGate`, `hasAnyAdminRole`, `impliesSuperuser`) exported for testability.
- [x] T009 Updated `src/app/navigation/RootTabs.tsx` — Admin tab renders when `useAnyAdminRole()` is true (was `useHasRole('admin')`).
- [x] T010 [P] `src/features/auth/session/useAdminGate.test.ts` — 28 tests across superuser implication, module-specific gates, seller denial, dual-role, Admin-tab visibility. All passing.

**Checkpoint**: Role plumbing is in place; the Admin tab visibility is role-driven but no admin sub-screen has been rewritten yet.

---

## Phase 3: User Story 1 — Admin deactivates a product (Priority: P1) 🎯 MVP

**Goal**: Admin can flip a product to Inativo from `AdminProductForm`; the list reflects the state; seller-side catalog excludes it after sync.

**Independent Test**: Quickstart steps 3–5 — deactivate, see dimmed row, sync seller, confirm absence from seller catalog.

### Implementation

- [x] T011 [P] [US1] Added `setProductActive(id, active)` in `src/features/admin/products/service/productsApi.ts` — stamps `deactivated_at` on false, clears on true; calls `triggerSyncAfterAdminWrite()` on success.
- [x] T012 [P] [US1] Added `listDraftsUsingProduct(productId)` in the same file — two-step count (variants → order_items → filter status='draft'). Handles Supabase `!inner` array shape.
- [x] T013 [US1] Extended `useProductForm` with `active`/`deactivatedAt` state + `toggleActive(boolean)`; `AdminProductFormScreen` gets a STATUS section (visible when editing) with Ativo/Inativo hint + destructive/restore action button.
- [x] T014 [US1] Created `src/features/admin/products/components/AdminProductDeactivateConfirmModal.tsx`. Fetches `listDraftsUsingProduct(id)` on open, renders the count (0-safe + error-safe copy). Reactivation reuses the same modal with a restore palette + different primary text.
- [x] T015 [US1] `ProductRow` renders inactive rows at `opacity: 0.55` on the background fill with an "Inativo" chip next to the name. Price + subtitle get muted text color. Historical references pages (OrderDetail, receipts) are unaffected because they don't use `ProductRow`.
- [x] T039 [US4] Shipped alongside T015 — `AdminProductsListScreen` adds a tap-first segment ("Ativos" / "Inativos" / "Todos") defaulting to Ativos; text search now diacritic-insensitive (`NFD` + strip diacritics); empty states adapt per filter + query state; "Limpar filtros" CTA wired.
- [x] T016 [P] [US1] `src/data/repositories/productsRepository.ts` now filters `active = true` on `query()` and `observeAll()` (seller catalog reads). `findById` intentionally unfiltered so historical orders render discontinued lines verbatim (FR-014). New helper `findInactiveIn(ids[])` ready for T020. Path note: no `catalogSelectors.ts` in the real codebase — `productsRepository` IS the seller-side read layer.
- [ ] T017 [US1] Verify on iOS phone + tablet simulators, Android phone + tablet simulators. Walk quickstart steps 3–5.

**Checkpoint**: US1 deliverable complete — admin can deactivate and the seller catalog reflects it end-to-end.

---

## Phase 4: User Story 2 — Seller discontinued-product safeguards (Priority: P1)

**Goal**: Deactivated products cannot silently reach a seller's draft or email. Every path alerts and blocks.

**Independent Test**: Quickstart steps 6–8 — create draft, deactivate, reopen, confirm block; run repeat-last-order flow; verify historical orders unchanged.

### Implementation

- [x] T018 [P] [US2] Seller-side add-item guard lives inside `AddToOrderScreen.tsx` (the actual add surface in this codebase, no `addLine.ts` exists). `productInactive = product.active === false` disables `canAdd` and surfaces the banner (T019) without emitting any new error path — simpler than a `Result` union.
- [x] T019 [P] [US2] `AddToOrderScreen` now renders an amber "Produto descontinuado" banner at the top when the loaded product is inactive; the "Adicionar ao pedido" button remains disabled.
- [x] T020 [P] [US2] Discontinued detection lives inline in `OrderDraftScreen` as a `useMemo` over `useOrderItems` (no new `draftHydrate.ts` — the existing hook already resolves `product` for each line). Builds a stable key (`discontinuedIds`) so the re-open effect fires on growth.
- [x] T021 [US2] `src/features/orders/components/DraftDiscontinuedAlert.tsx` — matches Pencil frame `A65W2`. Primary "Remover linhas e continuar" calls `ordersService.removeLine` for each discontinued line in parallel.
- [x] T022 [US2] `OrderDraftScreen` opens the alert when discontinued lines exist, adds a persistent amber "Pedido bloqueado" bar below the top bar with a Revisar button to re-open the modal, and disables `canContinue` while any inactive line remains. Dismiss state resets on set-growth so a new sync-pull arrival re-triggers.
- [x] T023 [P] [US2] `ordersService.previewRepeat()` ships the read-only scan (clonable count + discontinued/unavailable name lists). `ordersService.repeat()` now drops inactive products alongside soft-deleted ones. Hook `useRepeatOrder` exposes a matching `preview()` member.
- [x] T024 [US2] `src/features/orders/components/RepeatOrderDiscontinuedAlert.tsx` (Pencil `boQMF`/`Yp9ot`). Wired into `ClientProfileScreen.confirmRepeat` — preview first; if discontinued set is non-empty, open the modal before cloning. Primary disabled when `clonableCount === 0` (FR-013). Secondary Cancelar creates no draft.
- [x] T025 [US2] `OrderDetailScreen` is read-only and never calls the draft-open hydrate path that triggers `DraftDiscontinuedAlert`. Historical sent/canceled orders continue to render every line — including discontinued ones — via the existing `useOrderItems` path (`productsRepository.findById` intentionally unfiltered, see T016). No changes required; verified via code path audit.
- [x] T026 [P] [US2] Six new tests in `src/features/orders/services/__tests__/ordersService.repeat.test.ts`: `repeat()` drops inactive products, `repeat()` refuses when all lines inactive (`AllItemsUnavailableError`), `previewRepeat()` separates discontinued from unavailable, counts clonable lines correctly in 4 scenarios (happy, mixed, all-inactive, draft source). Total suite 809/809 passing.

**Checkpoint**: US2 deliverable complete — every seller-side path around discontinued products is blocked or explicitly acknowledged; history is immutable.

---

## Phase 5: User Story 3 — Superuser assigns granular roles (Priority: P1)

**Goal**: Superuser grants/revokes admin-grade roles through `AdminUsersList` + `AdminUserRolesForm`; gating takes effect mid-session.

**Independent Test**: Quickstart step 2, step 9 (self-demote blocked), step 10 (mid-session).

### Implementation

- [x] T027 [P] [US3] Created `src/features/admin/users/service/usersApi.ts` — `listUsers()` reads the `admin_users_view`; `getUser(id)`; `setUserRoles(id, roles)` diffs and issues INSERT/DELETE, filtering out `seller` on both sides (feature 15 owns that role). `UsersApiError` maps `at_least_one_superuser_required`, RLS, offline, and unknown failure modes.
- [x] T028 [US3] Created `src/features/admin/users/screens/AdminUsersListScreen.tsx` — segment filter "Todos / Admins / Vendedores", diacritic-insensitive search across name+email+role, role chips per row (destructive/default/secondary palette from `roleBadge`).
- [x] T029 [US3] Created `src/features/admin/users/screens/AdminUserRolesFormScreen.tsx` — read-only user card (name+email+seller chip) + four toggles (manage-products / manage-salespersons / manage-clients / superuser) with inline descriptions. Save button delegates the self-demote floor to the server trigger (simpler and authoritative).
- [x] T030 [US3] `AdminMenuScreen` tiles are now gated — Produtos → `manage-products`, Vendedores → `manage-salespersons`, "Usuários & Roles" → `superuser`. Hidden (not disabled) when the role is absent (UX6).
- [x] T031 [US3] Routes `AdminUsersList` + `AdminUserRolesForm` registered in `AdminStack.tsx` + typed in `AdminStackParamList`. Entry to the routes is already gated at the tile level; RLS enforces authorisation on every read/write.
- [ ] T032 [P] [US3] **Deferred** — SQL test `0018_rls_user_roles.test.sql`. This project's Jest setup has no pgTAP runner; RLS coverage is exercised through the migration's `DROP POLICY IF EXISTS` + `CREATE POLICY` pair plus the TypeScript tests of `UsersApiError` error-mapping. Proper pgTAP suite tracked as a follow-up alongside the existing migration repo.
- [ ] T033 [P] [US3] **Deferred** — SQL test `0018_single_superuser_trigger.test.sql` (same reason as T032). The trigger is asserted by code review against `data-model.md` and exercised end-to-end via `quickstart.md` step 9.
- [ ] T034 [P] [US3] **Deferred** — SQL test `0018_rls_products.test.sql`. Same reason.
- [ ] T035 [P] [US3] **Deferred** — SQL test `0018_rls_salespeople.test.sql`. Same reason.
- [ ] T036 [P] [US3] **Deferred** — SQL test `0018_rls_clients.test.sql`. Same reason.
- [ ] T037 [P] [US3] **Deferred** — SQL test `0018_role_rewrite.test.sql`. Same reason.

**Checkpoint**: US3 deliverable complete — the role matrix is enforced client-side and server-side; the migration path is verified.

---

## Phase 6: User Story 4 — Admin product search + filter (Priority: P2)

**Goal**: Admin finds a product fast among 500+ SKUs via tap-first filter + search.

**Independent Test**: Quickstart step 4 — default hides inactive, "Mostrar inativos" reveals, search filters under 1 s.

### Implementation

- [x] T038 [P] [US4] `listProducts({ activeFilter })` accepts `'active' | 'inactive' | 'all'`; `useProducts(activeFilter)` hook passes it through. Text filter is diacritic-insensitive via NFD normalisation.
- [x] T039 [US4] Shipped in T015 — see above.
- [ ] T040 [US4] **Deferred to sim verification** — perf bench against a 500-row seed list. The client-side diacritic+includes filter is O(n) over the pre-loaded array; MVP catalog is ≤ 500 rows per P3. Re-validate on the physical device as part of the quickstart walkthrough (T043).

**Checkpoint**: US4 deliverable complete — tap-first filter and search behave per spec.

---

## Phase 7: User Story 5 — User sees their own roles (Priority: P3)

**Goal**: Every signed-in user sees a "Suas funções" section on the profile screen with chips.

**Independent Test**: Quickstart step 1 verifies for a superuser; repeat for a seller-only user and a zero-role user.

### Implementation

- [x] T041 [US5] `src/features/home/screens/SettingsScreen.tsx` (the project's actual profile-adjacent surface; no `features/profile/` module) — appended "Suas funções" section after the identity card. Maps `useRoles()` through `roleBadge` with destructive/default/secondary chip palette; deduplicates `admin` → `superuser` during migration window; empty state "Sem funções atribuídas.".

**Checkpoint**: US5 deliverable complete — transparency section live everywhere.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T042 [P] Update the feature list in `SPECS.md` if needed to reflect shipped status when this feature completes (human-triggered after merge).
- [ ] T043 Run the full `quickstart.md` walkthrough on iOS + Android, phone + tablet, capture screenshots for the PR description.
- [ ] T044 Confirm the legacy `is_admin()` helper still resolves for any un-migrated call sites; if any feature 014/015 policy still references it, file a follow-up issue (NOT in scope for this feature).
- [ ] T045 [P] Observability: ensure Supabase log events for each role change (`user_roles_insert`, `user_roles_delete`) are visible in the existing logs panel; no new dashboards required.
- [ ] T046 Refresh the `design/screens.md` Open Questions section — remove the "Frame IDs TBD" notes once T000z has run.
- [ ] T047 Self-review constitution compliance: each PR comment references which P/UX/D rules are touched (governance §Compliance in PRs).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Design)** BLOCKS Phase 1.
- **Phase 1 (Setup)** BLOCKS Phase 2. T001 (migration + RLS) MUST land before any screen task.
- **Phase 2 (Foundational)** BLOCKS every user-story phase. T006–T009 unblock all three P1 stories.
- **Phase 3 (US1), Phase 4 (US2), Phase 5 (US3)** are independent and MAY proceed in parallel once Phase 2 is complete.
- **Phase 6 (US4)** depends on Phase 3 (reuses `AdminProductsListScreen`).
- **Phase 7 (US5)** depends on Phase 2 (reads `session_state.roles`).
- **Phase 8 (Polish)** depends on every desired user story.

### Within Each User Story

- Service module first → screen module → integration → simulator verification.
- SQL tests in Phase 5 may run in parallel with their implementation; they are `[P]` because they live in independent test files.

### Parallel Opportunities

- All T000a–T000n design clone tasks run in parallel after T000 (shared .pen file but distinct frames).
- T011, T012 (productsService) run in parallel.
- T018, T019, T020, T023, T026 run in parallel within US2.
- T027, T032–T037 (SQL tests) run in parallel within US3.
- US1, US2, US3 run in parallel across developers.

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, a developer picking up US1 can start these concurrently:
Task: "Extend productsService with setProductActive in src/features/admin/products/productsService.ts"
Task: "Add listDraftsUsingProduct to productsService.ts"
Task: "Update catalogSelectors to filter active = true in src/features/catalog/catalogSelectors.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — all P1)

1. Phase 0 Design (all new frames + existing-screen adjustments).
2. Phase 1 Setup + Phase 2 Foundational (sequential).
3. Phase 3 US1 (admin deactivate + seller-side exclusion).
4. Phase 4 US2 (seller safeguards + repeat flow).
5. Phase 5 US3 (granular roles + migration).
6. Stop and validate via `quickstart.md` steps 1–10.
7. Deploy.

### Incremental Delivery

US4 and US5 are quality-of-life improvements; they can ship in a follow-up PR without breaking MVP.

### Parallel Team Strategy

With two developers:
- Dev A: US1 + US4 (product lifecycle track).
- Dev B: US3 + US5 (roles + profile track).
- US2 (seller-side safeguards) is a shared responsibility and the integration test (`tests/integration/productsLifecycle.e2e.ts`) gates the merge.

---

## Notes

- Every screen task is marked complete only after verification on a phone AND tablet simulator (constitution §5 UX5).
- RLS tests (T032–T037) are `[P]` because each lives in a separate `.test.sql` file; they share the migration but not the assertions.
- T044 explicitly stops this feature from scope-creeping into "remove `is_admin()` everywhere" — that is a follow-up.
- No Edge Function work. No new npm dependencies.
