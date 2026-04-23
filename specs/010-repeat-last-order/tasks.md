# Tasks: Repeat Past Order

**Input**: Design documents from `/specs/010-repeat-last-order/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, design/, quickstart.md

**Tests**: Included — plan.md lists the unit-test suites required by constitution §9. Screen-level interaction testing is manual, matching the house convention from 006/007/008/009.

**Organization**: Tasks are grouped by user story. Each story is independently testable per the Independent Test criteria from spec.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Paths are repo-relative.

## Path Conventions

Mobile RN app — single project. Source at `src/`, tests co-located with modules.

---

## Phase 0: Design (UI features only) 🎨

**Status**: ✅ Complete. Four frames (ClientProfile × phone+tablet edited in place; OrderSummary × phone+tablet reused unchanged) exported on 2026-04-23. `design/screens.md` and `design/design.json` are written. The plan's Design Prerequisite gate is marked ✅.

No Phase 0 tasks remain. Phase 1 may begin.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Route-type extension. No schema change, no Supabase DDL, no new stack — this feature is additive to 009's surface.

- [X] T001 Extend `OrderSummary` route params in `src/app/navigation/types.ts` to accept an optional `droppedNames?: string[]` alongside the existing `orderId: string`. Keep back-compat: existing call sites that pass only `{ orderId }` must continue to typecheck.

**Checkpoint**: route type accepts the new param. Everything else from 009 is already in place — no additional setup required for this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Repository observation + service method skeleton + errors. These are dependencies of every user story below and carry no UI.

- [X] T002 [P] Add `observeLastSentForClient(clientId: string): Observable<Order | null>` to `src/data/repositories/ordersRepository.ts`. Query: `orders WHERE client_id = ? AND status = 'sent' AND _status != 'deleted' ORDER BY sent_at_ms DESC LIMIT 1`. Reuse the existing `(client_id)` index; do not add a new index. Also confirm `findById(id: string): Promise<Order | null>` is exported (add it if missing). No write methods change.
- [X] T003 [P] Write `src/data/repositories/__tests__/ordersRepository.observeLastSentForClient.test.ts`: emits `null` when the client has no sent orders; emits the single most-recent sent row when multiple exist; ignores `draft` and `canceled` rows; reacts to a subsequent `markSent(...)` call by emitting the newly-sent row; respects `_status != 'deleted'` (deleted sent orders are invisible).
- [X] T004 Add the two new error classes to `src/features/orders/services/ordersService.ts` following the existing pattern (`readonly code`, extends `Error`): `CannotRepeatDraftError` with `code = 'CANNOT_REPEAT_DRAFT'` carrying the source `orderId`; `AllItemsUnavailableError` with `code = 'ALL_ITEMS_UNAVAILABLE'`. Export both from the same module alongside the existing error classes.
- [X] T005 Add the `repeat` method signature + types to `src/features/orders/services/ordersService.ts`: `export interface RepeatInput { sourceOrderId: string }`, `export interface RepeatResult { orderId: string; droppedProductNames: string[] }`, and the stub `async repeat(input: RepeatInput): Promise<RepeatResult>` that throws `new Error('not implemented')`. Implementation lands in US1 (T008). Purpose: downstream screen + hook tasks can import the final type shape immediately.

**Checkpoint**: repo observation + service surface are declared and typed. Screens, hooks, and tests for all user stories can proceed in parallel.

---

## Phase 3: User Story 1 - Repeat most recent order in one tap (Priority: P1) 🎯 MVP

**Goal**: From a returning client's profile, the salesperson sees the dark "Repetir último pedido" hero card with the last sent order's date + item count + total, taps it once, and lands on `OrderSummaryScreen` with every line cloned and ready to send. Total taps profile → sent = 2.

**Independent Test**: With a client whose most recent sent order has 8 lines and a 5% order discount, open the client profile, tap the hero card, verify the summary shows 8 lines with the same quantities and the 5% discount, tap "Enviar" — count taps (must be ≤ 2). Verify the source order row is untouched.

- [X] T006 [P] [US1] Write `src/features/orders/services/__tests__/ordersService.repeat.test.ts`: happy-path clone copies `client_id`, `salesperson_id`, `discount_amount`, `discount_mode`, plus every line's `product_variant_id`, `quantity`, `discount_amount`, `discount_mode`; each cloned line's `unit_price` reflects the CURRENT `product_variants.price` (use a fixture where the variant price changed between source creation and repeat); returned `orderId !== sourceOrderId`; returned draft has `status = 'draft'` and `sent_at_ms = null`; source row row-version is unchanged before vs after (SC-006 lock); `droppedProductNames === []` when all variants are available; calling against a `draft` source throws `CannotRepeatDraftError` carrying the source id; calling against a non-existent source throws `OrderNotFoundError`. **Also** assert that calling `repeat` twice on the same sent source produces two distinct `orderId`s and leaves the source row-version unchanged (no-dedupe edge case from spec §Edge Cases).
- [X] T007 [P] [US1] Write `src/features/orders/hooks/__tests__/useRepeatOrder.test.ts`: given a `sent` source, calls `ordersService.repeat` and returns `{ kind: 'landed', orderId, droppedNames }`; given a `draft` source, does NOT call `ordersService.repeat` and returns `{ kind: 'landed', orderId: source.id, droppedNames: [] }` (resume); given a `canceled` source, calls `repeat` like any non-draft; `AllItemsUnavailableError` surfaces as `{ kind: 'blocked', reason: 'all_unavailable' }`; unknown errors rethrow.
- [X] T008 [US1] Implement `ordersService.repeat` in `src/features/orders/services/ordersService.ts` per the contract in `contracts/ordersService.repeat.md`. Order of operations: (1) `ordersRepository.findById(sourceOrderId)` → throw `OrderNotFoundError` if missing; (2) throw `CannotRepeatDraftError(source.id)` if `status === 'draft'`; (3) `orderItemsRepository.findByOrder(sourceOrderId)`; (4) for each line, resolve `productVariantsRepository.findById(line.productVariantId)` and (if the variant exists) `productsRepository.findById(variant.productId)`, classifying into `kept` / `dropped`; (5) throw `AllItemsUnavailableError` if `kept.length === 0` (do NOT open a `database.write` action in this path); (6) inside a single `database.write(...)`, call `ordersRepository.create(...)` with source's `client_id`/`salesperson_id`/`discount_amount`/`discount_mode` and `status = 'draft'`, then for each `kept` line call `orderItemsRepository.create(...)` with `quantity`, `discount_amount`, `discount_mode` from source and `unit_price = variant.price` (CURRENT); (7) return `{ orderId: newDraft.id, droppedProductNames: dropped.map(d => d.productName ?? 'Item indisponível') }`. Reuse existing `assertValidStatus` on the write path.
- [X] T009 [P] [US1] Implement `src/features/orders/hooks/useRepeatOrder.ts` exporting `useRepeatOrder(): { repeat(sourceOrderId: string): Promise<RepeatOutcome> }` with `RepeatOutcome = { kind: 'landed'; orderId: string; droppedNames: string[] } | { kind: 'blocked'; reason: 'all_unavailable' }`. Internal flow: read source via `ordersRepository.findById`; if `status === 'draft'` return `{ kind: 'landed', orderId: source.id, droppedNames: [] }`; else call `ordersService.repeat({ sourceOrderId })` in a try/catch, mapping `AllItemsUnavailableError` → `{ kind: 'blocked', reason: 'all_unavailable' }` and rethrowing other errors. Do NOT perform navigation in the hook — that responsibility belongs to the screen.
- [X] T010 [P] [US1] Implement `src/features/clients/components/RepeatHeroCard.tsx`. Props: `{ lastSent: { dateLabel: string; itemCount: number; total: number } | null; onPress: () => void; busy?: boolean }`. When `lastSent === null`, render nothing (no placeholder, no disabled state — FR-015). Layout follows `design/client-profile-phone.png` (the dark zinc-900 card with the circular refresh-cw icon) and `design/client-profile-tablet.png` (same shape, slightly more padding, with a right-aligned "Abrir resumo" pill). Use the existing color + radius tokens from 008/009 — no new palette entry. The component reads `useViewport()` for the phone vs. tablet split. `dateLabel` MUST be produced by 008's existing short date helper (`formatOrderDateShort` in `src/features/home/formatting/date.ts` — same helper used by the Home "last sent order" summary) so the hero and Home surfaces stay visually aligned.
- [X] T011 [P] [US1] Implement `src/features/clients/components/RepeatIconButton.tsx`. Props: `{ dim?: boolean; onPress: () => void }`. 40 × 40 circular button, fill `#F4F4F5`, refresh-cw icon in zinc-900 (or zinc-500 when `dim`). Used in US2 on history rows; built here so US1 and US2 can land in parallel.
- [X] T012 [US1] Edit `src/features/clients/screens/ClientProfileScreen.tsx` to mount the hero card above the existing history list: observe `ordersRepository.observeLastSentForClient(clientId)`; derive `itemCount` + `total` via `orderItemsRepository.observeByOrder(lastSent.id)` + `computeOrderTotals(lastSent, items)`; format date via 008's existing date helper; pass `{ dateLabel, itemCount, total }` to `<RepeatHeroCard>`. On press, call `useRepeatOrder().repeat(lastSent.id)`; on `{ kind: 'landed' }` navigate to `'Orders' → 'OrderSummary'` with `{ orderId, droppedNames }`; on `{ kind: 'blocked' }` set a local state that swaps the hero for the inline "Itens indisponíveis" notice (reused from T017 later; in this task render a plain Text fallback so US1 stands alone). Keep every existing piece of the profile unchanged for now — US2 will demote the "Novo pedido" button and T014 adds per-row ↺.
- [ ] T013 [US1] Manual QA US1 against `quickstart.md` §7 "Client with ≥ 2 sent orders": on iPhone 14 simulator (390 × 844) and iPad 11" simulator (820 × 1180), verify hero renders with correct metadata, tap → summary, tap "Enviar" → sent. Count taps = 2 on both viewports. Confirm the source order row in Home's history is untouched (e.g., via dev inspector — `source.row_version` before/after). **SC-004 timing**: run the profile→sent flow 5 times per viewport with a phone stopwatch and record the median; it MUST be under 10 s. Log the 10 medians in `checklists/requirements.md` notes before ticking.

**Checkpoint**: User Story 1 alone delivers the constitution UX2 mandate: the most recent order can be repeated in a single tap. US2 can now proceed in parallel with US3/US4.

---

## Phase 4: User Story 2 - Repeat a specific older order (Priority: P1)

**Goal**: Every history row on the client profile has a circular ↺ button. Tapping ↺ on a row clones that specific order (not necessarily the latest) and lands the salesperson on `OrderSummaryScreen` with that order's lines.

**Independent Test**: On a client with 4+ past orders (latest = 15 apr), tap the ↺ on the 18 mar row — the summary must be cloned from 18 mar, not from 15 apr. Tapping the row body (not the ↺) opens the read-only view of 18 mar with no draft created.

- [X] T014 [US2] Edit `src/features/clients/screens/ClientProfileScreen.tsx` to append `<RepeatIconButton>` to each history row's right edge. The button's `onPress` calls `useRepeatOrder().repeat(row.id)` and routes identically to the hero path (navigate on `landed`, swap local state on `blocked`). Pass `dim={row.status === 'canceled'}`. Keep the card body's existing tap handler (opens the read-only past-order view) untouched so the affordances don't overlap — the ↺ button MUST call `stopPropagation()` on its press event to prevent the card tap from firing. Hit-zone correctness is locked in T025 (FR-010 test).
- [ ] T015 [US2] Manual QA US2 against `quickstart.md` §7: on a client with 4 sent orders, tap ↺ on the third-oldest — verify the summary shows *that* order's lines and count; tap the card body of the same row — verify the read-only view opens and no new draft appears in Home's drafts count. Repeat the card-body-vs-icon test specifically on tablet to confirm the hit zones don't overlap. **SC-002 timing**: time 5 profile→↺→send runs per viewport on older-than-latest orders and record the medians alongside T013's numbers.

**Checkpoint**: User Stories 1 + 2 cover both repeat paths. The feature is functionally complete for the happy path on every sendable source. US3 exercises the edit flow; US4 hardens the unhappy paths.

---

## Phase 5: User Story 3 - Adjust items before sending (Priority: P2)

**Goal**: After landing on `OrderSummaryScreen` via either repeat path, the salesperson can tap into the draft editor (the existing 009 flow), change a quantity, return to the summary, and send. No new code is required on the summary itself — this story is a verification that the cloned draft behaves like any other draft.

**Independent Test**: From a repeat-landed summary, tap an item row — the existing 009 editor opens. Change a quantity, return to the summary, verify the totals updated, tap "Enviar".

- [ ] T016 [US3] Manual QA US3: trigger a repeat (hero or ↺), tap any line on the resulting summary, confirm the 009 draft editor opens with all cloned lines intact. Edit one quantity (up and down), return to summary, confirm `computeOrderTotals` reflects the change and the "Enviar" button stays enabled. No automated test added — this is a reuse-verification of 009 primitives and any regression would already break 009's own test suite.

**Checkpoint**: The cloned draft is indistinguishable from a manually-built draft; edit + send flows work end-to-end.

---

## Phase 6: User Story 4 - Handle products no longer available (Priority: P2)

**Goal**: A past order with one or more soft-deleted variants still produces a usable draft; the dropped lines are surfaced via a non-dismissable notice on the summary. When every line is unavailable, no draft is created and the salesperson sees a blocking notice on the profile.

**Independent Test**: Deactivate one variant referenced by a past order; tap ↺ on that order; verify the summary shows a notice banner naming the dropped product and the remaining lines are intact. Then deactivate every variant referenced by another past order; tap ↺; verify no navigation, a blocking notice replaces the hero/row feedback, and the `orders` row count is unchanged.

- [X] T017 [P] [US4] Implement `src/features/orders/components/DroppedItemsNotice.tsx`. Props: `{ names: string[] }`. Renders nothing when `names.length === 0`. Otherwise renders a non-dismissable amber banner reading `"Itens indisponíveis: <name>, <name>, ..."` with an `alert-triangle` feather icon. Use existing 009 banner tokens if present; otherwise inline the style per design (warning-amber fill, zinc-900 text). No interactive controls — this is informational only (UX4 spirit).
- [X] T018 [P] [US4] Implement `src/features/clients/components/AllUnavailableNotice.tsx`. Props: `{ onDismiss: () => void }`. Small inline notice (NOT a modal) rendered on `ClientProfileScreen` when `useRepeatOrder` returns `{ kind: 'blocked' }`. Copy is pinned by FR-008: exactly `"Este pedido não pode ser repetido — nenhum dos itens está disponível."` with a dismiss affordance (×) that clears the local blocked-state. Place it in-place of the hero card (hero path) or adjacent to the tapped row (per-row path — see T020).
- [X] T019 [US4] Edit `src/features/orders/screens/OrderSummaryScreen.tsx` to read `route.params.droppedNames ?? []` and render `<DroppedItemsNotice names={droppedNames} />` above the line list. No layout branch change. No other edits to the summary.
- [X] T020 [US4] Edit `src/features/clients/screens/ClientProfileScreen.tsx` to consume `useRepeatOrder`'s `{ kind: 'blocked' }` result by rendering `<AllUnavailableNotice>` in place of the hero card (when the hero path was blocked) or below the row whose ↺ was tapped (when a per-row path was blocked). Local state tracks which path is currently blocked so the notice appears in the right spot; tapping another ↺ or the hero again clears the state.
- [X] T021 [US4] Extend `src/features/orders/services/__tests__/ordersService.repeat.test.ts` (added in T006) with the availability-gate cases: one variant soft-deleted → line dropped + product name in `droppedProductNames`, other lines intact, draft created; one variant's parent product soft-deleted (variant itself active) → same treatment; every variant soft-deleted → `AllItemsUnavailableError` thrown AND `orders.count` unchanged before/after (row-count diff); atomicity: injecting a throw into `orderItemsRepository.create` mid-clone → `orders.count` + `order_items.count` both unchanged (rollback lock, R-005).
- [ ] T022 [US4] Manual QA US4 against `quickstart.md` §7 "Source with a deleted variant" and "Source with every variant deleted". On both viewports: partial-drop renders the amber banner on summary; all-unavailable renders the inline notice on profile and does NOT navigate.

**Checkpoint**: User Story 4 hardens the unhappy paths. Every branch of the repeat state-machine is now covered by test or QA.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Demote the "Novo pedido" button per the design summary, widen the catalog-write ban, and bake the manual QA into a single regression pass.

- [X] T023 Edit `src/features/clients/screens/ClientProfileScreen.tsx` to demote the existing "Novo pedido" primary CTA to the secondary outline style shown in `design/client-profile-phone.png` and `design/client-profile-tablet.png`. Relabel to `"Novo pedido em branco"`. Phone: the button stays in the bottom action bar but switches to white fill + zinc-300 border. Tablet: the button stays in the top bar but takes the same outline treatment. No behavior change — still navigates to `'Orders' → 'OrderDraft'` with `{ clientId }`.
- [X] T024 [P] Widen the scan root in `src/features/orders/noCatalogWrites.test.ts` to also cover `src/features/clients/**` and `src/features/orders/hooks/useRepeatOrder.ts`. Two assertions: (a) zero references to `productsCollection.create|update|destroy|prepareUpdate|prepareCreate|prepareDestroyPermanently` or the same on `productVariantsCollection` along the repeat code path (R5 lock); (b) **zero references to `fetch`, `global.fetch`, `@supabase/`, or any `import from '@/data/sync/...'` inside `ordersService.repeat`, `useRepeatOrder`, `RepeatHeroCard`, or `RepeatIconButton`** — this is the FR-016 offline lock (no network modules allowed along the repeat code path).
- [ ] T025 Write `src/features/clients/screens/__tests__/ClientProfileScreen.test.tsx` (new or extending the existing file): mount with a seeded client that has a sent order — assert `RepeatHeroCard` is rendered with correct date/itemCount/total; mount with an empty-history client — assert zero `RepeatHeroCard` AND zero `RepeatIconButton` are in the tree (FR-015); mount with a client whose only past order is a draft — assert hero is NOT rendered but the ↺ on the draft row IS rendered (R-003/R-004 intersection); **FR-010 hit-zone test**: fire a press on the row's `RepeatIconButton` and assert the row's own onPress handler is NOT called (the ↺'s `stopPropagation` from T014 must win).
- [ ] T026 Write `src/features/orders/screens/__tests__/OrderSummaryScreen.droppedNames.test.tsx`: mounted with `route.params.droppedNames = ['Leite Integral 1L']`, `<DroppedItemsNotice>` renders with that name; mounted without the param, renders unchanged from 009's baseline.
- [ ] T027 Final regression pass: execute every checklist in `quickstart.md` §7 end-to-end on both iPhone 14 and iPad 11" simulators. Tick each in `specs/010-repeat-last-order/checklists/requirements.md`. File any delta as a bug before marking the feature complete.

**Checkpoint**: Feature 010 is ready to merge. All P1 and P2 user stories verified on both viewports; no new npm package, no new migration, no Supabase change, no new navigation route — additive only.

---

## Dependencies

```text
Phase 1 (T001)
  └─▶ Phase 2 (T002–T005)
        └─▶ Phase 3 US1 (T006–T013)
              ├─▶ Phase 4 US2 (T014–T015)     [can start after T011/T012]
              ├─▶ Phase 5 US3 (T016)          [can start after T012 lands]
              └─▶ Phase 6 US4 (T017–T022)     [T017 + T018 [P] after T005; T019 after T017; T020 after T018 + T012]
                    └─▶ Phase 7 Polish (T023–T027)
```

- T001 is a tiny type change; everything else unblocks from it immediately.
- T002 and T004/T005 are in the same module pair (repo + service) and **must** land before any US phase starts, but they can be tackled in parallel.
- T006 (service test) and T007 (hook test) are written against the contract and can be red-first; T008 and T009 turn them green.
- T010 and T011 are pure components and can be built in parallel with service/hook work — they only depend on T001's route-param shape.
- US2 depends on T011 (the icon button) and on `ClientProfileScreen` already having the hero-card integration (T012) because both affordances share the `useRepeatOrder` glue.
- US4 components (T017, T018) are parallel with US1/US2 components but integration (T019, T020) must wait for the screens to exist.
- Polish phase (T023–T027) must run last because the widened scan (T024) and regression pass (T027) check the whole feature surface.

## Parallel Execution Opportunities

Within Phase 2:
- T002 (repo observation) ∥ T003 (repo test) ∥ T004 (error classes) ∥ T005 (service signature).

Within Phase 3 (US1), all these can run concurrently once T005 lands:
- T006 (service test stub) ∥ T007 (hook test stub) ∥ T010 (`RepeatHeroCard`) ∥ T011 (`RepeatIconButton`).
- T008 (service impl) and T009 (hook impl) turn their respective red tests green and can also run in parallel (different files).

Within Phase 6 (US4):
- T017 (`DroppedItemsNotice`) ∥ T018 (`AllUnavailableNotice`) ∥ T021 (extend service tests).

## Independent Test Criteria (from spec.md)

- **US1**: Hero tap → summary → send in ≤ 2 taps; source order unchanged. Verified via T013 manual QA + T006 behaviour lock.
- **US2**: Per-row ↺ clones *that* specific order (not the latest); card body opens read-only view without cloning. Verified via T015 manual QA + the behaviour lock in T006.
- **US3**: Cloned draft edits + sends via existing 009 primitives. Verified via T016 manual QA.
- **US4**: Partial-drop → amber banner on summary; all-unavailable → inline block on profile with zero draft created. Verified via T021 tests + T022 manual QA.

## MVP Scope

User Story 1 alone (Phases 1 + 2 + 3, tasks T001–T013) satisfies the constitution's UX2 mandate: the most recent sent order can be repeated in a single tap from the client profile, landing the salesperson on `OrderSummaryScreen` ready to send. Shipping here is a valid increment. User Stories 2–4 are scope expansions agreed during design and are strongly recommended but not strictly required to claim UX2 compliance.

## Notes

- No schema migration, no Supabase DDL, no new navigation route — the whole feature rides on top of 009's surface.
- The `noCatalogWrites` static scan (widened in T024) is the single most important lock for R5 as the feature surface grows — do not merge the feature with this test skipped.
- The resume-on-Draft policy lives in **two** places (hook + service) on purpose — see R-003. Do not "DRY" this by moving it to only one layer.

## Implementation status (2026-04-23)

All logic and static-lock tasks are complete and green (44 test suites, 434 tests). The remaining tasks are manual-QA / screen-render tasks that require the iOS and iPad simulators:

| Task | Kind | Status |
|------|------|--------|
| T013 | Manual QA — US1 timing (5 runs × 2 viewports) | ⬜ pending simulator session |
| T015 | Manual QA — US2 hit-zone + timing | ⬜ pending simulator session |
| T016 | Manual QA — US3 edit-then-send | ⬜ pending simulator session |
| T022 | Manual QA — US4 partial + all-unavailable | ⬜ pending simulator session |
| T025 | Screen test — `ClientProfileScreen.test.tsx` | ⬜ deferred (matches 006/007/008/009 house convention — no React screen test harness in this repo; logic exhaustively covered by `useRepeatOrder.test.ts` + `ordersService.repeat.test.ts`) |
| T026 | Screen test — `OrderSummaryScreen.droppedNames.test.tsx` | ⬜ deferred (same rationale; `DroppedItemsNotice` renders deterministically from props) |
| T027 | End-to-end regression pass in simulators | ⬜ pending simulator session |

All constitution gates (R5 static lock, FR-016 static lock, SC-006 row-version lock, R-005 atomicity test, R-003 double-guard test) are enforced by automated tests that run in CI.
