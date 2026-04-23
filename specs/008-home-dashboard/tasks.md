---
description: 'Task list for implementing Home Dashboard & Empty States (008)'
---

# Tasks: Home Dashboard & Empty States

**Input**: Design documents from `/specs/008-home-dashboard/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅, design/ ✅ (four Pencil frames)

**Tests**: Included. The plan's Testing section lists seven unit-test files as mandatory (§Testing). Manual UI verification is required on a phone simulator (390 × 844) and a tablet simulator (820 × 1180) per constitution §5 UX5.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. The feature has four user stories (three P1, one P2). US1, US2, US3 together form the MVP.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 0: Design (UI features only) 🎨

**Status**: ✅ COMPLETE. `/speckit-pencil-design` ran before `/speckit-specify` and produced all four required frames (phone + tablet × populated + empty). `design/screens.md`, `design/design.json`, and the four PNG exports are checked in. The Design Prerequisite gate in plan.md is ✅.

- [x] T000 [Design] Pencil frames exist in `specs/008-home-dashboard/design/` — `home-phone.png` (XmxN2), `home-empty-phone.png` (yHNTP), `home-tablet.png` (czxzV), `home-empty-tablet.png` (IvIBz), with `screens.md` summary and `design.json` pointer file.

**Checkpoint**: Phase 0 is complete. Phase 1 may begin.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `src/features/home/` module skeleton. Role-guarded features gate: N/A — feature is VENDEDOR-surface, read-only, no RLS changes (see plan.md Role & Authorization Check).

- [ ] T001 Create feature module skeleton: directories `src/features/home/{screens,components,hooks,sync,greeting,responsive,tests}/` and the barrel file `src/features/home/index.ts` (exports will be filled in by later phases).
- [ ] T002 [P] Add `Settings: undefined` to `HomeStackParamList` in `src/app/navigation/types.ts` (route component will be registered in Phase 2).
- [ ] T003 [P] Create `src/features/home/responsive/breakpoints.ts` exporting `TABLET_MIN_WIDTH = 768` (duplicated from catalog/clients per plan Structure Decision point 2; include a TODO comment pointing at the pending extraction to `src/app/responsive/`).
- [ ] T004 [P] Create `src/features/home/hooks/useViewport.ts` — returns `'phone' | 'tablet'` via `useWindowDimensions().width >= TABLET_MIN_WIDTH`. Duplicated from `src/features/catalog/hooks/useViewport.ts`; include the same TODO.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the sync store, create placeholder/real summary hooks, and land the `SettingsScreen` relocation — all prerequisites shared by every user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. Every task here either (a) edits a file no user story task edits, or (b) lands a contract that multiple user story tasks consume.

### Sync store extension (required by US1 greeting + US3 pill)

- [ ] T005 Extend `InternalState` in `src/features/sync/state/derive.ts` with `_lastOkAt: number | null` (additive; do NOT alter `deriveStatus`). Extend exported `SyncStatusSnapshot` with `readonly lastOkAt: number | null` per `contracts/sync-store-extension.md`.
- [ ] T006 In `src/features/sync/state/syncStatusStore.ts`: add `_lastOkAt: null` to `initialState()`; add `setLastOkAt(ms: number | null)` to `_internalSyncStatusStore`; stamp `Date.now()` from inside `setLastOutcome('ok')` before `recompute()`; update `recompute()` to short-circuit only when both `status` and `lastOkAt` are unchanged (see contract); ensure `__resetForTests()` clears `_lastOkAt`. Depends on T005.
- [ ] T007 Include `lastOkAt` in `makeSnapshot()` in the same file so the public snapshot carries both fields. Depends on T006.
- [ ] T008 Verify in `src/features/sync/protocol/runPass.ts` that successful runs call `setLastOutcome('ok')` (they do); no behavioral change required. If any success path is found that short-circuits `setLastOutcome('ok')`, add an explicit `_internalSyncStatusStore.setLastOkAt(Date.now())` call on that path and note it in the PR description. Depends on T006.
- [ ] T009 [P] Write `src/features/home/tests/syncStatusStore.lastOkAt.test.ts` per `contracts/sync-store-extension.md` Test coverage section: `setLastOutcome('ok')` stamps a non-null number; `setLastOutcome('failed')` preserves the prior value; `__resetForTests` clears it; snapshot referential stability across no-op emits; two rapid `setLastOutcome('ok')` calls at the same `Date.now()` produce one snapshot. Depends on T007.

### Pure utilities (parallelizable)

- [ ] T010 [P] Create `src/features/home/sync/formatRelativeSyncAge.ts` — pure `(ageMs: number, nowMs?: number) => 'agora' | \`há ${n} min\` | \`há ${n} h\` | \`há ${n} d\`` per research.md R-003. No `Date.now()` inside; caller supplies `nowMs` for testability (but hook users can omit).
- [ ] T011 [P] Write `src/features/home/tests/formatRelativeSyncAge.test.ts` covering the four windows (60 s / 60 min / 24 h) and the integer-floor behavior.
- [ ] T012 [P] Create `src/features/home/greeting/deriveGreetingName.ts` — pure `(email: string | null) => string | null`. Returns the portion of the email before `@`, preserves unicode, returns `null` when input is `null`.
- [ ] T013 [P] Write `src/features/home/tests/deriveGreetingName.test.ts` covering: `"markus@acme.com" → "markus"`, `null → null`, unicode preserved, no-`@` input (defensively returns the whole string).

### Summary hooks (real and placeholder, parallelizable)

- [ ] T014 [P] Create `src/features/home/hooks/useCatalogSummary.ts` per `contracts/summary-hooks.md`. Observes `productsRepository.observeAll()` and returns `{ count }`. Use `useEffect` + subscription, store count in `useState`, return `{ count: 0 }` until the first observation emits.
- [ ] T015 [P] Write `src/features/home/tests/useCatalogSummary.test.ts`: count is 0 when repo is empty, count reflects additions, subscription is torn down on unmount.
- [ ] T016 [P] Create `src/features/home/hooks/useClientsSummary.ts` per contract. `(salespersonId: string | null) => { count }`. When `salespersonId` is null → returns `{ count: 0 }` without subscribing; otherwise observes `clientsRepository.observeByOwner(salespersonId)`.
- [ ] T017 [P] Write `src/features/home/tests/useClientsSummary.test.ts`: null salespersonId → count 0 and no subscription; non-null → count reflects repo; unmount cleanup.
- [ ] T018 [P] Create `src/features/home/hooks/useDraftsSummary.ts` — placeholder body `return { count: 0 };` with TODO(009-orders) comment. Signature: `() => { count: number }`.
- [ ] T019 [P] Write `src/features/home/tests/useDraftsSummary.test.ts`: locks `{ count: 0 }` contract; asserts the return type shape at compile time via a type-level check and at runtime.
- [ ] T020 [P] Create `src/features/home/hooks/useLastSentOrder.ts` — placeholder body `return null;` with TODO(009-orders) comment. Signature: `() => RecentActivityDTO | null` (the DTO type lives in `src/features/home/types.ts` — add it here if not yet present).
- [ ] T021 [P] Write `src/features/home/tests/useLastSentOrder.test.ts`: locks `null` as v1 return.

### ConfirmModal primitive + Alert migrations (infrastructure spillover)

Rationale: spec FR-005 ("no modal/alert/toast/spinner for sync") cannot be enforced by T045 while any `Alert.alert` survives in code paths Home may import. Rather than narrow the no-modal scan with an allowlist, land a single cross-cutting `ConfirmModal` primitive and migrate both existing `Alert.alert` sites (`HomePlaceholderScreen` logout confirm — relocated to `SettingsScreen` — and `CatalogScreen` "Sem internet" informational notice — deleted per constitution UX4). See plan.md §Summary "Infrastructure spillover". Design reference: `design/modals/confirm-modal-{phone,tablet}.png` (frames `zwiuM`, `Lasp4`).

- [ ] T021a [P] Create `src/app/ui/modal/ConfirmModal.tsx` — single component, declarative state. Props: `{ open: boolean, title: string, body?: string, cancelLabel?: string, primaryLabel: string, primaryVariant?: 'default' | 'destructive', onCancel?: () => void, onPrimary: () => void }`. Visual per `design/modals/confirm-modal-phone.png` (phone: 324×auto card, padding 24, gap 16, corner-radius 16, shadow 0,8,24, backdrop `#09090B99`) and `confirm-modal-tablet.png` (tablet: 480×auto card, padding 32, gap 20, corner-radius 18, shadow 0,12,32). When `cancelLabel` is undefined the button row collapses to the single primary button right-aligned (info variant). `primaryVariant='destructive'` → fill `#DC2626`, white text. Backdrop tap calls `onCancel ?? onPrimary`. Uses RN core `<Modal transparent animationType="fade">`. NO native `Alert` used anywhere inside this component. Viewport branches via a local `useWindowDimensions() >= 768` check (scoped to this file; NOT importing Home's `useViewport`).
- [ ] T021b [P] Create `src/app/ui/modal/index.ts` exporting `ConfirmModal` and its props type.
- [ ] T021c [P] Write `src/app/ui/modal/tests/ConfirmModal.test.tsx` — render the destructive-confirm variant and assert both buttons render with correct labels and tapping each fires the matching callback; render the info variant (`cancelLabel` omitted) and assert only the primary button is present; assert `open={false}` renders nothing; assert backdrop tap calls `onCancel` when defined and `onPrimary` otherwise.

### SettingsScreen relocation

- [ ] T022 Create `src/features/home/screens/SettingsScreen.tsx` hosting the two affordances currently on `HomePlaceholderScreen`: inactivity-timeout segmented control (via `lockService.getInactivityTimeout()` / `setInactivityTimeout()`) and logout button. **Logout MUST use `<ConfirmModal>` from `@/app/ui/modal` — no `Alert.alert` anywhere in this file**. Local component state `[logoutOpen, setLogoutOpen] = useState(false)`; the Pressable sets `true`; `ConfirmModal`'s `onPrimary` calls `authService.logout()`. Copy: title `"Sair da conta"`, body `"Seus dados permanecem no dispositivo. Você pode entrar novamente a qualquer momento."`, `cancelLabel="Cancelar"`, `primaryLabel="Sair"`, `primaryVariant="destructive"`. Include the two `__DEV__`-only Pressables for `DataLayerSmoke` and `DatabaseInspector`. Style mirrors the old placeholder (reuse the same StyleSheet values) but scrollable. Depends on T021a, T021b.
- [ ] T022b Delete the `Alert.alert` "Sem internet" notice in `src/features/catalog/screens/CatalogScreen.tsx:35`. `handleSyncPress` becomes: when `status === 'offline'`, early-return WITHOUT firing any alert (the inline `SyncStatusIndicator` already carries the "Sem internet" signal per constitution UX4). Remove the `Alert` import if nothing else in the file references it. No other CatalogScreen logic changes. This is the second Alert migration; together with T022 it makes T045's no-modal scan an absolute assertion with no allowlist.
- [ ] T023 Register the `Settings` route in `src/app/navigation/HomeStack.tsx` — `<Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configurações' }} />`. Depends on T002, T022.

### Scaffolded HomeScreen + delete old placeholder

- [ ] T024 Create `src/features/home/screens/HomeScreen.tsx` as a minimum-viable shell — `SafeAreaView` with background `#FAFAFA` and a TODO comment listing every subcomponent Phase 3/4/5 will add. **Root content element MUST be a `<View>`, NOT a `<ScrollView>`** (spec FR-020; a scroll surface would silently violate SC-007). This lets the Phase 2 route swap compile even before the real UI lands.
- [ ] T025 In `src/app/navigation/HomeStack.tsx`: replace the `HomePlaceholder` screen's `component={HomePlaceholderScreen}` with `component={HomeScreen}` (imported from `@/features/home`); set `options={{ headerShown: false }}`; add a one-line comment explaining the route name is preserved for compat (research.md R-002). Remove the `import { HomePlaceholderScreen }` line. Depends on T024.
- [ ] T026 Export `HomeScreen` and `SettingsScreen` from `src/features/home/index.ts`. Depends on T022, T024.
- [ ] T027 Delete `src/features/home/screens/HomePlaceholderScreen.tsx`. Depends on T025, T026 (so the app still compiles).

**Checkpoint**: Foundation ready. Sync store exposes `lastOkAt`; four summary hooks exist; SettingsScreen houses the evicted controls; HomeScreen shell compiles at the `HomePlaceholder` route. User-story implementation (Phase 3–6) can now begin in parallel.

---

## Phase 3: User Story 1 - Returning seller navigates from the hub (Priority: P1) 🎯 MVP slice

**Goal**: A returning seller opens Home and immediately sees the sync pill, greeting, three quick-action cards with live counts, and the last sent order. Each quick-action card navigates to its destination in a single tap.

**Independent Test**: With a seeded catalog (≥ 1 product), at least one client, and the `lastOkAt` timestamp stamped via a successful sync, launch the app from a locked state and verify: (a) Home is the first screen after unlock; (b) sync pill reads "Sincronizado · há N min"; (c) Catálogo card shows product count, Clientes card shows client count; (d) tapping Catálogo / Clientes navigates in one transition; (e) no modal/toast ever appears for the sync state.

### Implementation for User Story 1

- [ ] T028 [P] [US1] Create `src/features/home/components/HomeTopBar.tsx` — 56 pt phone / 64 pt tablet; white fill with 1 pt bottom border `#E4E4E7`; title "Início" (Inter 18/600 phone, 22/700 tablet) on the left; right edge slot renders `HomeSyncPill` + `Pressable` gear icon (lucide `settings`) that calls `navigation.navigate('Settings')`. The sync-pill import is a forward reference — until Phase 5 lands, render a `<View />` placeholder so this phase compiles.
- [ ] T029 [P] [US1] Create `src/features/home/components/GreetingBlock.tsx` — stacks title "Olá, <name>" (or plain "Olá" when name is null) and a subtitle "Tudo pronto para suas visitas de hoje." Name comes from `deriveGreetingName(useSession().email)`. Follows the Pencil populated frame's type sizes.
- [ ] T030 [P] [US1] Create `src/features/home/components/QuickActionCard.tsx` — consumes a `QuickActionCardDTO` (see `data-model.md`) and renders ONLY the populated variant for this phase. Icon wrap, title, subtitle, optional count badge, chevron. Empty variant is added in Phase 4 (US2).
- [ ] T031 [P] [US1] Create `src/features/home/components/RecentActivityCard.tsx` populated branch — takes `RecentActivityDTO | null` and renders the store + "R$ X · há N min" row when non-null; when null, render `null` (empty placeholder is added in Phase 4 US2). Subtitle uses `formatRelativeSyncAge` against `sentAtMs`. Store-name `Text` uses `numberOfLines={1}` and `ellipsizeMode="tail"` so long names truncate cleanly while total + timestamp stay visible (spec edge case "Very long store name").
- [ ] T032 [US1] Wire `HomeScreen.tsx`: call `useSession`, `useActiveSalespersonId` (imported from `@/features/clients`), `useCatalogSummary`, `useClientsSummary`, `useDraftsSummary`, `useLastSentOrder`, `useViewport`. Compose the `HomeSnapshotDTO` per data-model.md. Render `HomeTopBar`, `GreetingBlock`, a section label "AÇÕES RÁPIDAS" / "Ações rápidas" (case per viewport), three `QuickActionCard`s (Catálogo, Clientes, Rascunhos — pass the populated DTO derived from counts; empty DTOs for Phase 4 will be wired when US2 lands), a section label "Atividade recente" / "ATIVIDADE RECENTE", and `RecentActivityCard`. On phone: single-column stack. On tablet: two-column quick-action grid (Catálogo | Clientes row, Rascunhos | neutral spacer row) and full-width recent-activity. Navigation: Catálogo → `Catalog`, Clientes → `Clients`, Rascunhos → no-op (spec FR-014 equivalent — the populated case is unreachable in v1 because drafts placeholder always returns 0). Depends on T028, T029, T030, T031.
- [ ] T033 [US1] Update the barrel `src/features/home/index.ts` to keep exporting `HomeScreen` and `SettingsScreen`. No other exports needed. Depends on T032.
- [ ] T033a [P] [US1] Write `src/features/home/tests/counterReactivity.test.tsx` — mount `HomeScreen` (with a test-friendly navigation stub); seed the local DB with zero products; assert the Catálogo card subtitle reads the empty-state copy; `productsRepository.create(...)` a product; assert the Catálogo subtitle switches to the populated "1 produto" form **within 2000 ms** via `await waitFor(..., { timeout: 2000 })`. Covers spec FR-019 (counters update without leaving Home) AND SC-006 (within 2 s) in one test. Repeat the same pattern for clients via `clientsRepository.create(...)` in a second `describe` block.

**Checkpoint**: US1 acceptance scenarios 1–4 pass on both phone and tablet simulators (verify with the seeded-catalog state from quickstart.md §A). The sync pill renders as a placeholder `<View />` until Phase 5; that is acceptable because US1's independent test focuses on the hub navigation and counts.

---

## Phase 4: User Story 2 - First-run seller is guided to the next step (Priority: P1)

**Goal**: A first-run seller with no catalog, no clients, no drafts, no orders sees salesperson-language copy in every empty state and a concrete CTA where one exists.

**Independent Test**: Fresh install, seeded account with empty catalog and no clients; open the app; verify every empty-state string passes the FR-016 blocklist (no "erro" / "falha" / "null" / "undefined" / "sem dados"); verify the Catálogo CTA triggers `onPullToRefresh()` from `@/features/sync`; verify the Clientes CTA opens `ClientForm`; verify the Rascunhos card has no CTA; verify the Atividade Recente slot is a dashed placeholder.

### Implementation for User Story 2

- [ ] T034 [P] [US2] Create `src/features/home/components/DashedPlaceholderCard.tsx` — dashed-border (`strokeDashArray: [4, 4]` equivalent in RN) card shell with a neutral icon wrap, title, and subtitle. Props: `iconName`, `title`, `subtitle`. Reused by the empty Drafts card and empty Recent Activity.
- [ ] T035 [US2] Extend `QuickActionCard.tsx` with the empty variant — when the `populated` field in `QuickActionCardDTO` is null, render the empty card: icon wrap (neutral fill), title, subtitle, and an optional CTA (primary dark button for Catálogo "Sincronizar agora"; outlined button for Clientes "Nova loja"; NO CTA for Drafts). Dashed border only when `title` matches the drafts empty heuristic — simpler: take a `variant: 'empty-solid' | 'empty-dashed'` field on the empty DTO (add to the DTO shape in `types.ts`). Depends on T030, T034.
- [ ] T036 [US2] Extend `RecentActivityCard.tsx` with the empty branch — when the hook returns `null`, render a `DashedPlaceholderCard` with icon `send` and the copy from `design/screens.md`: "Seu último pedido enviado aparecerá aqui" + "Depois de enviar o primeiro pedido, você vê o resumo dele neste lugar." Depends on T031, T034.
- [ ] T037 [US2] Wire empty-state DTOs in `HomeScreen.tsx`: when a count is 0, pass `populated: null` + the empty-state shape (copy + CTA) to `QuickActionCard`. Catálogo CTA calls `onPullToRefresh()` from `@/features/sync`; Clientes CTA calls `navigation.navigate('ClientForm')`; Rascunhos empty card has no CTA. The greeting subtitle switches to "Vamos preparar tudo para sua primeira visita." when all three counts are 0 (first-run detection). Depends on T032, T035, T036.
- [ ] T038 [US2] Create a single Portuguese copy module `src/features/home/copy.ts` exporting every user-visible string on Home (populated titles/subtitles, empty titles/subtitles, CTA labels, recent-activity placeholder copy, greeting variants). This is the "single string table per card" anchor from data-model.md Invariants, and it makes the FR-016 blocklist test trivial.
- [ ] T039 [P] [US2] Write `src/features/home/tests/copyBlocklist.test.ts` — imports every string from `copy.ts` and asserts none of them contains (case-insensitive) any of: "erro", "falha", "null", "undefined", "sem dados". Fails the build when a future copy edit sneaks a forbidden word in. Depends on T038.
- [ ] T040 [US2] Refactor T028/T029/T030/T031 components to read their Portuguese strings from `copy.ts` instead of inlining them. Depends on T038.
- [ ] T040a [P] [US2] Write `src/features/home/tests/syncAndEmptyIndependence.test.tsx` — render `HomeScreen` with the sync store forced to `{ status: 'syncing', lastOkAt: null }` AND zero products / zero clients / zero drafts; assert **both** the amber "Sincronizando…" pill and the empty-state copy ("Seu catálogo ainda está vazio", "Cadastre sua primeira loja", "Nenhum rascunho por enquanto") render simultaneously. Covers spec FR-018 (state/copy independence) and the edge case "First-run while syncing".

**Checkpoint**: US2 acceptance scenarios 1–5 pass on phone and tablet. The empty-world world renders the HomeEmpty / Phone and HomeEmpty / Tablet frames pixel-close to `design/home-empty-phone.png` and `design/home-empty-tablet.png`. The copy blocklist test is green.

---

## Phase 5: User Story 3 - Seller checks sync status without interruption (Priority: P1)

**Goal**: The sync pill reflects all four states (in-sync with age / syncing / offline / failed with retry) entirely inline. No modal, no toast, no spinner ever appears for sync events on Home.

**Independent Test**: Walk the four states manually (natural sync cycle → airplane mode → `_internalSyncStatusStore.setLastOutcome('failed')` dev hook → tap retry); verify at each transition the pill color/label match `contracts/sync-pill.md`, no `Alert.*` fires, no overlay appears. Also: in the in-sync state, the "há N min" portion matches the formatter's output for the current `lastOkAt` delta.

### Implementation for User Story 3

- [ ] T041 [P] [US3] Create `src/features/home/sync/deriveSyncPillState.ts` — pure `({ status, lastOkAt, nowMs }) => SyncPillStateDTO` per `contracts/sync-pill.md`. Handles the semantic fallback (`in-sync + lastOkAt===null → kind: 'syncing'`).
- [ ] T042 [P] [US3] Write `src/features/home/tests/deriveSyncPillState.test.ts` covering every row of the state machine table in `contracts/sync-pill.md`, including the null-lastOkAt fallback.
- [ ] T043 [US3] Create `src/features/home/components/HomeSyncPill.tsx` — consumes `useSyncStatus()`, passes `{ status, lastOkAt, nowMs: Date.now() }` to `deriveSyncPillState`, renders the pill shape with the state-dependent colors and label per `contracts/sync-pill.md`. Tap handler: no-op except in `failed` state where it calls `onPullToRefresh()`. Accessibility: `accessibilityRole="button"` always; `accessibilityLabel` derived from the rendered label. Depends on T041.
- [ ] T044 [US3] Replace the `<View />` placeholder inside `HomeTopBar.tsx` (left by T028) with the real `HomeSyncPill`. Depends on T028, T043.
- [ ] T045 [P] [US3] Write `src/features/home/tests/noModalSyncPath.test.ts` — a static grep assertion over `src/features/home/**/*.{ts,tsx}` checking that the regex `/Alert\.alert/` appears **zero times** in the Home feature tree. This is now an absolute assertion (no allowlist) because the modal migrations in T021a/T022/T022b remove every `Alert.alert` usage from the app. The test failure message MUST say: "Home must not use Alert.alert (constitution UX4, spec FR-005). Use @/app/ui/modal ConfirmModal instead."

**Checkpoint**: US3 acceptance scenarios 1–4 pass. The manual walkthrough from quickstart.md §§C and D works end-to-end.

---

## Phase 6: User Story 4 - Seller resumes a draft from Home (Priority: P2)

**Goal**: When drafts exist (not today — `useDraftsSummary` returns 0 until 009), the Rascunhos card shows an accurate count badge and taps navigate to the drafts list.

**Independent Test** (v1 placeholder version): With `useDraftsSummary` swapped to return `{ count: 2 }` in a local dev toggle, verify the Rascunhos card renders a badge "2", the subtitle reads "2 pedidos em andamento", and tapping the card hits the `onPress` placeholder. **Full behavior ships with 009-orders**; this phase lands the plumbing.

### Implementation for User Story 4

- [ ] T046 [US4] In `QuickActionCard.tsx`, ensure the count badge is visible when the populated DTO's `badge` field is > 0 and hidden when 0 or undefined. Style matches the Pencil frame (24×24 red circle, white `700` number). This is likely a no-op if T030/T035 already render the badge correctly — if so, mark this task complete by inspecting the component and confirming the badge-hide condition is `count > 0`.
- [ ] T047 [US4] In `HomeScreen.tsx`, pass the Rascunhos populated DTO's `onPress` as a named no-op arrow function `() => { /* wired to drafts list by 009-orders */ }` with a TODO(009-orders) comment above it. This locks the contract so 009's swap-in is a single-line change. Depends on T032.
- [ ] T048 [P] [US4] Write `src/features/home/tests/draftsBadge.test.ts` — render `QuickActionCard` with `badge: 0` (asserts no badge element), `badge: 1` (asserts "1"), `badge: 2` (asserts "2"). Uses React Test Renderer (Jest's default in this repo). No simulator. **Drive the count variations by passing `badge` directly as a prop to `QuickActionCard` — do NOT modify `useDraftsSummary`**: T019 contract-locks the hook to `{ count: 0 }` and changing it here would fail that test. The component-level props are the testable seam.

**Checkpoint**: US4 acceptance scenarios 1–2 pass with a local `useDraftsSummary` override. No user-visible drafts today; plumbing is ready for 009.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cross-feature verification on both simulators, final copy pass, and follow-up chore setup.

- [ ] T048a [P] Write `src/app/ui/modal/tests/noNativeAlert.test.ts` — repo-wide static grep: `/Alert\.alert/` appears **zero times** in `src/**/*.{ts,tsx}` after this feature lands (T022 and T022b remove the only two instances). This is stronger than T045 (Home-scoped) and locks the project-level invariant that `ConfirmModal` is the only dialog primitive going forward. Failure message: "Use @/app/ui/modal ConfirmModal instead of React Native Alert.alert (constitution UX4; project-wide since 008)."
- [ ] T049 [P] Run every unit test in `src/features/home/tests/` and `src/features/sync/state/` (for the `lastOkAt` coverage). Confirm zero failures, zero `act()` warnings, and that total feature test count is ≥ 12 (seven Home + five sync-store assertions).
- [ ] T050 Manual QA on **iPhone 14 simulator** (390 × 844 portrait): walk quickstart.md scenarios A, B, C, D. Confirm Home does not scroll in any state (FR-020, SC-007). Screenshot each final state and attach to the PR description.
- [ ] T051 Manual QA on **iPad 11" simulator** (820 × 1180 portrait): same scenarios as T050 plus scenario E (tablet layout). Confirm the two-column grid matches `design/home-tablet.png` and the empty variant matches `design/home-empty-tablet.png`.
- [ ] T052 [P] Run `npx tsc --noEmit` at the repo root. Zero errors. Any existing error unrelated to this feature must be triaged in a separate issue — do NOT touch it here.
- [ ] T053 [P] Run the repo's lint / format pipeline (`npm run lint`, `npm run format:check` if they exist). Zero warnings on touched files.
- [ ] T054 File a follow-up chore ticket (or GitHub issue) titled "Extract useViewport / breakpoints / normalize into src/app/responsive/ and src/app/text/ now that there are three consumers" with references to catalog, clients, and home — per plan Structure Decision point 2. This is NOT done in this feature; the ticket is the durable artifact.
- [ ] T055 Update `CLAUDE.md` if the active-plan pointer has changed since the plan was authored (it already points to `specs/008-home-dashboard/plan.md` — this task confirms the pointer is still correct and updates the link format if needed).
- [ ] T056 Review `design/screens.md` "Open questions for the spec" section. For each of the three questions (offline pill state, empty drafts CTA, recent-activity single-item), confirm the spec's Assumptions section resolved it; if not, add a resolution note inline in `design/screens.md` pointing at the spec subsection.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Design (Phase 0)**: ✅ complete (Pencil frames already shipped).
- **Setup (Phase 1)**: Can start immediately. T001 unblocks T002–T004.
- **Foundational (Phase 2)**: Depends on Setup completion. Internal order: T005 → T006 → T007 (sync-store extension sequential); T008 parallel with T007; T009 after T007. T010–T013 parallel with each other and with T014–T021; T022 depends on lockService/authService imports (no ordering constraint within Phase 2). T024 depends on T001; T025 depends on T024; T026 depends on T022+T024; T027 depends on T025+T026.
- **User Stories (Phase 3–6)**: ALL depend on Phase 2 completion. Can then proceed in parallel by different developers, or sequentially P1 → P1 → P1 → P2.
  - Every screen task (T032, T037, T044) MUST be verified on **both** phone and tablet simulators before marked complete (constitution §5 UX5).
- **Polish (Phase 7)**: Depends on all desired user stories. T049–T053 parallel; T054–T056 sequential after T049–T053.

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 (T005–T027). Independent of US2, US3, US4 at the acceptance-test level.
- **US2 (P1)**: Depends on Phase 2 + US1 component skeletons (T030, T031). Extends them; does not replace.
- **US3 (P1)**: Depends on Phase 2 + US1 `HomeTopBar` (T028). Drops the real pill into the placeholder slot.
- **US4 (P2)**: Depends on Phase 2 + US1's `QuickActionCard` (T030) and US2's badge rendering (T035). Pure plumbing; no user-visible effect until 009-orders.

### Within Each User Story

- Pure modules and hooks first (`deriveSyncPillState`, `copy.ts`), then components, then the screen-level wiring, then cross-checks.

### Parallel Opportunities

- T002, T003, T004 run in parallel after T001.
- In Phase 2: T009, T010–T013, T014–T021 are all parallel with each other (different files, no shared state). Only the sync-store chain (T005→T006→T007) is strictly sequential.
- T028, T029, T030, T031 run in parallel within US1.
- US2, US3, US4 can be worked on by three developers once Phase 2 is done.

---

## Parallel Example: Phase 2 Foundational

```bash
# After T001 lands, launch the sync-store chain sequentially:
Task: "T005 Extend InternalState with _lastOkAt"
Task: "T006 Stamp lastOkAt on setLastOutcome('ok')"    # depends on T005
Task: "T007 Include lastOkAt in makeSnapshot()"         # depends on T006

# In parallel with the sync-store chain, run:
Task: "T010 formatRelativeSyncAge.ts"
Task: "T012 deriveGreetingName.ts"
Task: "T014 useCatalogSummary.ts"
Task: "T016 useClientsSummary.ts"
Task: "T018 useDraftsSummary.ts (placeholder)"
Task: "T020 useLastSentOrder.ts (placeholder)"
Task: "T021a ConfirmModal.tsx"
Task: "T021b src/app/ui/modal/index.ts"
Task: "T021c ConfirmModal.test.tsx"
Task: "T022b Delete Catalog 'Sem internet' alert"
Task: "T022 SettingsScreen.tsx"                 # depends on T021a, T021b

# Tests follow their modules:
Task: "T011 formatRelativeSyncAge.test.ts"   # after T010
Task: "T013 deriveGreetingName.test.ts"      # after T012
Task: "T015, T017, T019, T021"               # after their hooks
```

## Parallel Example: Phase 3 User Story 1

```bash
# All US1 components are in separate files with no cross-imports:
Task: "T028 HomeTopBar.tsx"
Task: "T029 GreetingBlock.tsx"
Task: "T030 QuickActionCard.tsx (populated variant)"
Task: "T031 RecentActivityCard.tsx (populated branch)"

# Then:
Task: "T032 Wire HomeScreen.tsx"             # depends on the four components
Task: "T033 Refresh barrel index.ts"         # depends on T032
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Phase 1 (Setup) — 4 tasks.
2. Phase 2 (Foundational) — 23 tasks. Heavier, but every task here is load-bearing for every user story.
3. Phase 3 (US1) — 6 tasks. At the checkpoint, Home renders with a placeholder sync pill; navigation + counts are live.
4. Phase 4 (US2) — 7 tasks. Empty states render; copy blocklist test is green.
5. Phase 5 (US3) — 5 tasks. Sync pill is real; all four visual states are reachable.
6. **STOP and VALIDATE**: quickstart.md §§A–D pass on phone; §A+§E pass on tablet.
7. Ship MVP.

### Incremental Delivery

- **Slice 1** (MVP): Phases 1+2+3+4+5 → demoable on both viewports in populated and empty worlds, with full sync feedback.
- **Slice 2** (US4 plumbing): Phase 6 → invisible today, but the plumbing is in place so 009-orders is a narrow, mechanical PR.
- **Slice 3** (Polish): Phase 7 → QA pass, chore ticket, typecheck/lint.

### Parallel Team Strategy

With two developers:

1. Both complete Phase 1 + Phase 2 together.
2. Split US1 + US2 (Dev A) and US3 (Dev B). Recombine for T044 (US3's drop-in replaces US1's placeholder).
3. Single developer owns US4 and Phase 7.

---

## Notes

- The feature is deliberately small — one dashboard, a settings relocation, a sync-store additive field, two placeholder hooks, plus an infrastructure-spillover `ConfirmModal` primitive. The task count (~63) reflects thorough coverage of tests + docs + QA, not feature complexity.
- Every user-visible string lives in `src/features/home/copy.ts` — edit copy there, not scattered across components.
- Both simulators (iPhone 14, iPad 11") are non-negotiable verification steps for every screen task per constitution §5 UX5.
- Nothing in this feature writes to Supabase or to any WatermelonDB repository. If a task is drafted that implies a write, it is wrong.
- Commit after each logical group (Phase 1 one commit; Phase 2 two–three commits; each user story one commit); do NOT bundle cross-phase work.
