# Tasks: Local Data Layer (WatermelonDB Foundation)

**Input**: Design documents from `/specs/002-local-data-layer/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/repository.md](./contracts/repository.md), [contracts/schema.md](./contracts/schema.md), [contracts/migrations.md](./contracts/migrations.md)

**Tests**: Not required for this block. Per constitution §9 ("test investment goes to business logic, not plumbing") and the plan's Testing decision, verification is manual through the smoke screen (T033) and the acceptance-scenario checks. One optional unit test is included for the `_touch` helper only — it is the single piece of logic here that warrants an automated test.

**Organization**: Tasks are grouped by user story per the spec's priority ordering.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Relative-to-repo-root file paths

## Path Conventions

- Source layout: `src/data/` (new) alongside `src/app/` and `src/features/` — see [plan.md Project Structure](./plan.md#project-structure).
- All identifiers in English (constitution §9).
- Every create/edit cites the exact file path.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add WatermelonDB to the Expo project, enable the compiler features it needs, wire up the linter rule that guards constitution R1, and regenerate the native projects.

- [X] T001 Install runtime and dev dependencies: run `pnpm add @nozbe/watermelondb expo-dev-client` and `pnpm add -D @babel/plugin-proposal-decorators babel-plugin-module-resolver` at repo root; verify resulting `package.json` lists all four.
- [X] T002 [P] Edit `babel.config.js` — add `['@babel/plugin-proposal-decorators', { legacy: true }]` to the plugin list; add `['module-resolver', { alias: { '@': './src' } }]` so the `@/data` alias resolves at runtime. Keep the `babel-preset-expo` preset first.
- [X] T003 [P] Edit `tsconfig.json` — set `compilerOptions.experimentalDecorators: true`, `baseUrl: "."`, and `paths: { "@/*": ["src/*"] }`. Leave `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` from block 001 untouched.
- [X] T004 [P] Edit `eslint.config.js` — add a `no-restricted-imports` rule that blocks any import whose module name matches `@supabase/*`, applied **globally across `src/**`** with an override excluding `src/data/**` (the data layer will legitimately import `@supabase/*` when the sync block lands). The global-with-exception scoping means a future `src/lib/`, `src/shared/`, or any other top-level directory is automatically covered — see [research.md R11](./research.md#r11--eslint-enforcement-of-r1-no-supabase-imports-outside-srcdata). Error message cites constitution R1.
- [X] T005 Edit `app.json` — if the WatermelonDB docs require any config-plugin entries for its iOS/Android adapter registration, add them under `expo.plugins`. At the time of this plan the 0.28.x line ships no config plugin; if still the case, leave `app.json` untouched and mark this task done.
- [X] T006 Run `pnpm exec expo prebuild --clean` to regenerate `ios/` and `android/` with the WatermelonDB native adapter included (depends T001, T002, T005). Commit the regenerated files in the same commit as this task. *Note: this is a one-time local action; subsequent clones rerun it via `pnpm install && pnpm exec expo prebuild`.*
- [X] T007 [P] Create the empty directory skeleton `src/data/`, `src/data/schema/`, `src/data/models/`, `src/data/repositories/` (use placeholder `.gitkeep` files only if the directories would otherwise be empty at commit time — prefer populating them via subsequent tasks).

**Checkpoint**: project builds a dev client successfully; `pnpm lint` / `pnpm typecheck` still pass on the pre-002 codebase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ship the schema, the Database singleton, and every Model class — the ingredients every repository will use. No user story can land until this phase is complete.

**⚠️ CRITICAL**: No work in Phases 3–5 may begin until all Phase 2 tasks complete.

- [X] T008 [P] Create `src/data/types.ts` exporting the TS literal unions `SyncStatus = 'created' | 'updated' | 'deleted' | 'synced'`, `OrderStatus = 'draft' | 'sent' | 'canceled'`, `PaymentMethod = 'cash' | 'pix' | 'transfer' | 'card' | 'other'`, and the `DataLayerError` class (code ∈ `'VALIDATION' | 'NOT_FOUND' | 'FOREIGN_KEY' | 'STATE_TRANSITION'`).
- [X] T009 Create `src/data/schema/tables.ts` exporting `schema = appSchema({ version: 1, tables: [...] })` with **all 7 tables** — `salespeople`, `clients`, `products`, `product_variants`, `orders`, `order_items`, `payment_receipts` — per column-for-column contract in [contracts/schema.md](./contracts/schema.md). Every table must declare `server_id` (string, optional, indexed), `updated_at` (number), `_status` (string), `_changed` (string), plus its entity-specific columns with exact names and indexes.
- [X] T010 [P] Create `src/data/schema/migrations.ts` exporting `migrations = schemaMigrations({ migrations: [] })` — intentionally empty at schema v1 (see [contracts/migrations.md](./contracts/migrations.md)).
- [X] T011 Create `src/data/adapter.ts` exporting a configured `SQLiteAdapter` instance: `{ schema, migrations, jsi: true, dbName: 'salesforce.db' }` importing from T009 and T010 (depends T009, T010).
- [X] T012 [P] Create `src/data/models/Salesperson.ts` — a `Model` subclass with `static table = 'salespeople'`, `static associations = { clients: { type: 'has_many', foreignKey: 'salesperson_id' }, orders: { type: 'has_many', foreignKey: 'salesperson_id' } }`, `@field('name') name!: string`, `@field('email') email!: string`, the four sync columns (`@field('server_id')`, `@field('updated_at')`, `@field('_status')`, `@field('_changed')`), `@children('clients') clients`, `@children('orders') orders`.
- [X] T013 [P] Create `src/data/models/Client.ts` — `static table = 'clients'`, associations with salesperson (`belongs_to`) and orders (`has_many`), fields per [data-model.md §2](./data-model.md#2-client--retailers-the-salesperson-visits), typed sync columns, `@relation('salespeople', 'salesperson_id') salesperson`.
- [X] T014 [P] Create `src/data/models/Product.ts` — `static table = 'products'`, `@children('product_variants') variants`, fields (`name`, `description`, `image_url`, `unit`) + sync columns. **Intentionally no discount field** (R5 enforcement at model layer).
- [X] T015 [P] Create `src/data/models/ProductVariant.ts` — `static table = 'product_variants'`, `@relation('products', 'product_id') product`, fields (`label`, `price`, `barcode`) + sync columns. **No discount field.**
- [X] T016 [P] Create `src/data/models/Order.ts` — `static table = 'orders'`, `@relation('clients', 'client_id') client`, `@relation('salespeople', 'salesperson_id') salesperson`, `@children('order_items') items`, `@children('payment_receipts') receipts`; `@field('status') status!: OrderStatus`, `@field('discount_amount') discountAmount!: number`, plus `notes`, `created_at_ms`, `sent_at_ms`, `pdf_uri`, sync columns.
- [X] T017 [P] Create `src/data/models/OrderItem.ts` — `static table = 'order_items'`, `@relation('orders', 'order_id') order`, `@relation('product_variants', 'product_variant_id') variant`; fields `quantity`, `unit_price`, `discount_amount` + sync columns.
- [X] T018 [P] Create `src/data/models/PaymentReceipt.ts` — `static table = 'payment_receipts'`, `@relation('orders', 'order_id') order`; fields `amount`, `method: PaymentMethod`, `received_at_ms`, `image_url`, `notes` + sync columns.
- [X] T019 Create `src/data/models/index.ts` — barrel: `export { Salesperson } from './Salesperson'; export { Client } from './Client'; …` for all 7 model files (depends T012–T018).
- [X] T020 Create `src/data/database.ts` — `export const database = new Database({ adapter, modelClasses: [Salesperson, Client, Product, ProductVariant, Order, OrderItem, PaymentReceipt] });` and a `setGenerator` for WatermelonDB random ids if needed (depends T011, T019). Do NOT re-export this from `src/data/index.ts` — it stays private.
- [X] T021 [P] Create `src/data/repositories/_touch.ts` — helper `applyTouchOnCreate(raw, writtenColumns)` and `applyTouchOnUpdate(model, patch)` that populate/update the four sync columns exactly per [research.md R3](./research.md#r3--sync-adapter-column-conventions-server_id-updated_at-_status-_changed): set `_status` correctly (`'created'` on insert; `'updated'` if current is `'synced'`, unchanged otherwise; `'deleted'` on soft delete), append changed column names to `_changed` deduplicated, set `updated_at = Date.now()`, leave `server_id` null on insert.
- [X] T022 [P] Create `src/data/repositories/_errors.ts` re-exporting `DataLayerError` from `../types.ts` and exposing small helpers `throwValidation(message, field?)`, `throwNotFound(entity, id)`, `throwStateTransition(from, to)`.

**Checkpoint**: Foundation ready. `pnpm typecheck` passes. Repositories can now be built in parallel in Phase 3.

---

## Phase 3: User Story 1 — Seven MVP Entities Available Through One Data Adapter (Priority: P1) 🎯 MVP

**Goal**: Every feature can CRUD any of the seven MVP entities through a typed repository imported from `@/data`, offline, with no Supabase SDK reference in feature code.

**Independent Test**: The smoke screen created by T033 performs `create client → create order → create 2 order_items → kill app → cold-launch → read back` without network, and `pnpm lint` rejects any `@supabase/*` import written inside a feature file.

### Implementation for User Story 1

- [X] T023 [P] [US1] Create `src/data/repositories/salespeopleRepository.ts` — plain-object export with `findById`, `query`, `observe`, `observeAll`, `create`, `update`, `softDelete` exactly as typed in [contracts/repository.md `salespeopleRepository`](./contracts/repository.md#salespeoplerepository). Use `database.write(async writer => { ... })` for writes; call `_touch` helpers (T021) for sync-column bookkeeping; validate `name` non-empty and `email` non-empty at the repository, throwing `DataLayerError('VALIDATION')`.
- [X] T024 [P] [US1] Create `src/data/repositories/clientsRepository.ts` — full CRUD plus `observeByOwner(salespersonId: string)` that filters `Q.where('salesperson_id', salespersonId)`. Validate `name` and `salespersonId` per [data-model.md §2 validation](./data-model.md#2-client--retailers-the-salesperson-visits). `observeAll()` filters out `_status === 'deleted'` by default.
- [X] T025 [P] [US1] Create `src/data/repositories/productsRepository.ts` — **READ-ONLY surface**: export `findById`, `query`, `observe`, `observeAll` only. Do NOT export `create`, `update`, or `softDelete`. The absence of those methods is the compile-time enforcement of constitution D2.
- [X] T026 [P] [US1] Create `src/data/repositories/productVariantsRepository.ts` — READ-ONLY like T025, plus `observeByProduct(productId)`. No write methods.
- [X] T027 [P] [US1] Create `src/data/repositories/ordersRepository.ts` — CRUD as typed in [contracts/repository.md `ordersRepository`](./contracts/repository.md#ordersrepository); implement `markSent(id)` (transitions `draft|sent → sent`, sets `sent_at_ms`), `cancel(id)` (transitions `draft|sent → canceled`); `softDelete(id)` cascades to all `order_items` of that order in the same `database.write` transaction. Reject other transitions with `DataLayerError('STATE_TRANSITION')`.
- [X] T028 [P] [US1] Create `src/data/repositories/orderItemsRepository.ts` — CRUD per contract. `unit_price` is in the `create` input but intentionally NOT in the `update` patch type (captured at add-time). Validate `quantity > 0`, `unit_price >= 0`, `discount_amount >= 0`, `discount_amount <= unit_price * quantity`.
- [X] T029 [P] [US1] Create `src/data/repositories/paymentReceiptsRepository.ts` — CRUD per contract; validate `amount > 0`, `method` in `PaymentMethod` union.
- [X] T030 [US1] Create `src/data/repositories/index.ts` — barrel re-exporting all 7 repositories: `export { salespeopleRepository } from './salespeopleRepository';` etc. (depends T023–T029).
- [X] T031 [US1] Create `src/data/index.ts` — the **public** barrel. Re-export from `./repositories` and `./types`. Do NOT re-export `./database`, `./adapter`, `./schema`, or `./models` — those stay private to enforce SC-008 (depends T030).
- [X] T032 [US1] Edit `src/app/providers/AppProviders.tsx` to add a side-effect import `import '@/data';` near the top (before any JSX) so the `Database` singleton initializes at app boot before any feature mounts.
- [X] T033 [US1] Create `src/features/_debug/screens/DataLayerSmokeScreen.tsx` — a throwaway dev-only screen that, on mount, creates one client → creates one order for that client → creates two order_items → subscribes to `ordersRepository.observe(orderId)` and `orderItemsRepository.observeByOrder(orderId)` → renders the results as plain text. The screen exposes two buttons: one that calls `ordersRepository.update(orderId, { notes: 'reactivity probe' })`, and one that calls `orderItemsRepository.update(firstItemId, { quantity: 99 })`. Both writes MUST cause the subscribed observations to emit new values and update the rendered text without a manual refresh — this verifies **FR-012 (reactive reads)** and US1 Acceptance Scenario 4. Wire the screen into `src/app/navigation/HomeStack.tsx` behind an `__DEV__` check. This screen is the US1 independent-test vehicle; it will be removed when a real feature replaces it (tracked in the block-003 backlog).
- [X] T034 [US1] Run `pnpm typecheck` and `pnpm lint` — both MUST exit 0. Fix any issues surfaced by the new decorator syntax, path alias, or the ESLint rule from T004. Also verify the rule itself by writing a one-line `import '@supabase/supabase-js'` inside `src/features/_debug/screens/DataLayerSmokeScreen.tsx`, confirming lint rejects it, then removing the probe.
- [X] T035 [US1] Manual verification against [spec.md User Story 1 Acceptance Scenarios](./spec.md#user-story-1--the-seven-mvp-entities-are-available-to-every-feature-through-one-data-adapter-priority-p1) — execute all four scenarios on a physical Android device in airplane mode via the smoke screen from T033. Record results in `specs/002-local-data-layer/checklists/acceptance.md` (create the file if missing).

**Checkpoint**: User Story 1 complete. The data layer is usable by any feature; an MVP increment could ship from here. US2 and US3 add confidence and evolvability on top.

---

## Phase 4: User Story 2 — Every Record Is Born Sync-Ready (Priority: P2)

**Goal**: Verify and, if needed, harden the sync-column bookkeeping the Phase 3 repositories already invoke — proving every write across the seven entities populates `server_id`, `updated_at`, `_status`, `_changed` correctly.

**Independent Test**: Inspect rows across all 7 tables after running the smoke screen and confirm the four sync columns are populated exactly as spec US2 acceptance scenarios require.

### Implementation for User Story 2

- [X] T036 [US2] Audit every writable repository (T023, T024, T027, T028, T029) — for each, confirm `create` invokes `applyTouchOnCreate` before `record.update(…)`, `update` invokes `applyTouchOnUpdate` inside the write transaction, and `softDelete` transitions `_status` to `'deleted'` and bumps `updated_at` without removing the row. Document the audit outcome in `specs/002-local-data-layer/checklists/acceptance.md` under an "US2 — sync-column audit" heading.
- [~] T037 [US2] SKIPPED — after implementation it emerged that WatermelonDB's built-in sync machinery handles `_status` and `_changed` automatically, which leaves `applyTouchOnCreate`/`applyTouchOnUpdate` with only trivial field assignments (`serverId = null`, `updatedAt = Date.now()`) — too thin to warrant the Jest config investment for a single test. US2 verification lives in `checklists/acceptance.md` (repository-level audit + device-side row inspection). If a future change restores non-trivial bookkeeping in `_touch`, revisit this task.
- [X] T038 [US2] Manual verification against [spec.md User Story 2 Acceptance Scenarios](./spec.md#user-story-2--every-record-is-born-sync-ready-priority-p2) — through the smoke screen, create at least one row of every one of the 7 entities, then inspect each via the WatermelonDB dev inspector (or a one-off console log inside the smoke screen) and confirm all four sync-readiness columns are correctly populated. Record in `specs/002-local-data-layer/checklists/acceptance.md`.

**Checkpoint**: User Stories 1 + 2 deliver a complete, sync-ready data layer.

---

## Phase 5: User Story 3 — Schema Can Evolve Without Wiping the Device (Priority: P3)

**Goal**: Prove the migrations framework is wired correctly end-to-end before any real schema change is needed, and lock in the workflow doc so future migrations stay safe.

**Independent Test**: Populate a device at schema v1, apply a throwaway v2 migration that adds a column, cold-launch, confirm all v1 rows survive — then revert the throwaway change before the branch merges.

### Implementation for User Story 3

- [X] T039 [US3] Migration smoke test: on a device with records from T035, temporarily edit `src/data/schema/tables.ts` to `version: 2`; add one migration entry to `src/data/schema/migrations.ts` with `toVersion: 2, steps: [addColumns({ table: 'clients', columns: [{ name: 'scratch', type: 'string', isOptional: true }] })]`; cold-launch the app; confirm through the smoke screen that all previously created clients, orders, and order_items are still readable. Then **revert both edits** (version back to 1, migrations list back to empty) before committing. Record the outcome under "US3 — migration smoke test" in `specs/002-local-data-layer/checklists/acceptance.md`. Do NOT leave the scratch migration or column in the branch.
- [X] T040 [US3] Review [contracts/migrations.md](./contracts/migrations.md) against the implementation shipped by T009–T011 — confirm file paths, step-kind list, and `version → migration` numbering match exactly. Amend the contract document if any drift exists.

**Checkpoint**: All three user stories independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final audit, agent context refresh, branch hygiene.

- [X] T041 Verify `CLAUDE.md` between `<!-- SPECKIT START -->` / `<!-- SPECKIT END -->` markers still points at `specs/002-local-data-layer/plan.md` (set during `/speckit-plan`); correct if drifted.
- [X] T042 [P] Run the complete Success Criteria audit against [spec.md SC-001 through SC-008](./spec.md#measurable-outcomes) and append results to `specs/002-local-data-layer/checklists/acceptance.md` under a "Success Criteria audit" heading. Any SC that fails triggers a fix-and-rerun iteration — not a sign-off waiver.
- [X] T043 [P] Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` one final time from a clean branch state — all three must exit 0 with zero warnings. This is the quality gate before requesting review.
- [X] T044 Re-read [contracts/repository.md "What repositories do NOT expose"](./contracts/repository.md#what-repositories-do-not-expose) and confirm the implementation honors every item — especially that `database`, models, and schema are private (not exported from `src/data/index.ts`), and that the two read-only repositories (`productsRepository`, `productVariantsRepository`) have no write methods in their TypeScript surface.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T001 blocks T002/T003/T004/T005/T006 (packages must be installed before configs reference them). T006 (`expo prebuild`) depends on T001/T002/T005.
- **Foundational (Phase 2)**: all of Phase 1 complete. Within Phase 2: T009 blocks T011; T010 blocks T011; T012–T018 (models) can run in parallel after T008 (types) and T009 (table names); T019 blocks T020; T011 + T019 block T020; T021 and T022 are independent of models and can run in parallel from the start of Phase 2.
- **User Stories (Phases 3–5)**: all of Phase 2 complete. US1 is a prerequisite in practice for US2 and US3 — US2 audits US1's repositories, US3 smoke-tests with data created by US1. Listed as the spec priorities (P1 > P2 > P3) and executed in that order.
- **Polish (Phase 6)**: Phases 3–5 complete.

### User Story Dependencies

- **US1 (P1)**: depends only on Phase 2. The MVP cut.
- **US2 (P2)**: depends on US1 (audits its repositories + uses its smoke screen).
- **US3 (P3)**: depends on US1 (needs data on the device to prove migration preserves it); independent of US2.

### Within Each User Story

- **US1**: repositories (T023–T029) are independent and parallelizable — each lives in its own file and depends only on Phase 2 outputs. T030 (barrel) depends on all 7 repo files. T031 depends on T030. T032 depends on T031. T033 depends on T032 (uses the `@/data` import). T034 depends on T023–T033. T035 depends on T034.
- **US2**: T036 audits T023/T024/T027/T028/T029. T037 is independent. T038 depends on T036 + T033 (smoke screen access).
- **US3**: T039 depends on T035 (uses populated device). T040 is independent after the implementation ships.

### Parallel Opportunities

- Phase 1: T002, T003, T004 parallel after T001; T007 parallel anywhere.
- Phase 2: T008, T010, T021, T022 all parallel from the start. T012–T018 (the seven model files) parallel after T008.
- Phase 3 (US1): T023–T029 all parallel; T030/T031/T032/T033 are sequential.

---

## Parallel Example: Phase 2 Foundational burst

```bash
# After T001–T006 land, launch in one shot:
Task: "Create src/data/types.ts (T008)"
Task: "Create src/data/schema/migrations.ts (T010)"
Task: "Create src/data/repositories/_touch.ts (T021)"
Task: "Create src/data/repositories/_errors.ts (T022)"
# T009 (schema/tables.ts) needs to go sequentially because T011 depends on it:
Task: "Create src/data/schema/tables.ts (T009)"
# Once T008 + T009 are in, fire all 7 model files together:
Task: "Create src/data/models/Salesperson.ts (T012)"
Task: "Create src/data/models/Client.ts (T013)"
Task: "Create src/data/models/Product.ts (T014)"
Task: "Create src/data/models/ProductVariant.ts (T015)"
Task: "Create src/data/models/Order.ts (T016)"
Task: "Create src/data/models/OrderItem.ts (T017)"
Task: "Create src/data/models/PaymentReceipt.ts (T018)"
```

## Parallel Example: User Story 1 implementation burst

```bash
# After Phase 2 completes, fire all 7 repositories together:
Task: "Create src/data/repositories/salespeopleRepository.ts (T023)"
Task: "Create src/data/repositories/clientsRepository.ts (T024)"
Task: "Create src/data/repositories/productsRepository.ts (T025)"
Task: "Create src/data/repositories/productVariantsRepository.ts (T026)"
Task: "Create src/data/repositories/ordersRepository.ts (T027)"
Task: "Create src/data/repositories/orderItemsRepository.ts (T028)"
Task: "Create src/data/repositories/paymentReceiptsRepository.ts (T029)"
# Then sequentially: T030 (barrel) → T031 (public barrel) → T032 (provider import) → T033 (smoke screen) → T034 (lint/typecheck) → T035 (manual audit).
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1).
3. **STOP and VALIDATE**: run T034 + T035. The data layer is usable; every subsequent feature block (auth, catalog, orders) can start.
4. At this point, an internal preview build can ship for QA-led validation of the smoke screen.

### Incremental Delivery

1. Setup + Foundational → Foundation ready, no user-visible change.
2. Add US1 → Smoke screen validates independently → **MVP of the data layer**.
3. Add US2 → Sync-readiness verified → Foundation for the future sync block locked in.
4. Add US3 → Migration smoke test passes → Foundation for future schema evolution locked in.
5. Polish → SC audit + final lint/typecheck green → Ready for review.

### Solo-Developer Sequence (realistic for this project)

Given the project is solo (constitution P3), the realistic order is strictly serial: finish each phase before moving to the next. The "parallel bursts" sections above describe which tasks *could* be run together by an AI implementer or by multiple developers — they are not a mandate to parallelize manually.

---

## Notes

- `[P]` tasks are different files with no incomplete dependency — safe to parallelize.
- `[Story]` label traces each task back to the spec's priority ordering.
- Every user story is independently verifiable through its entry in `checklists/acceptance.md`.
- Commit after each task or small logical group — Conventional Commits (`feat(data)`, `chore(data)`, etc.).
- DO NOT skip T004 (ESLint rule) even though Supabase is not installed — adding the rule now prevents rot later (see [research.md R11](./research.md#r11--eslint-enforcement-of-r1-no-supabase-imports-outside-srcdata)).
- DO NOT leave the T039 throwaway migration in the branch — it is a verification step, not a change.
