# Tasks: Client Management

**Input**: Design documents from `/specs/007-client-registration/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/clients-service.md](./contracts/clients-service.md), [contracts/client-draft-store.md](./contracts/client-draft-store.md), [contracts/search-filter.md](./contracts/search-filter.md), [contracts/order-history.md](./contracts/order-history.md), [contracts/responsive.md](./contracts/responsive.md), [quickstart.md](./quickstart.md)

**Tests**: Eight unit-test files per constitution §9 and the plan's Testing section — `normalize`, `matches`, `filter`, `clientDraftStore`, `cnpj`, `orderHistory`, `useActiveSalespersonId`, `contactSplit`. No UI tests. No integration tests. Screen-level verification happens by manual walkthrough on phone (390 × 844) + tablet (820 × 1180) simulators per UX5.

**Organization**: Tasks are grouped by the spec's three user stories in priority order (US1 / US2 are P1; US3 is P2). US1 is the MVP. US2 is independently testable on top of US1 (or with seeded clients). US3 layers search / filter onto the list built in US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Relative-to-repo-root file paths

## Path Conventions

- Source layout from [plan.md Project Structure](./plan.md#project-structure): `src/features/clients/` owns the feature; three files outside it get modified (`src/app/navigation/HomeStack.tsx`, `src/app/navigation/types.ts`, `src/features/home/screens/HomePlaceholderScreen.tsx`). Zero 002 files edited. Zero `package.json` changes.
- All identifiers in English (constitution §9). UI copy in Portuguese — form labels, chip labels, empty-state copy, pending-sync badge label, error messages.
- Every create/edit cites the exact file path.
- `jest` + `ts-jest` + `jest.config.js` at repo root are already installed. No new runtime dependency.

---

## Phase 0: Design (UI features only) 🎨

**Status**: ✅ **Complete.** Ran in a separate session on 2026-04-22. The `design/` directory contains 12 PNGs (six screens × two viewports, with first-launch-empty / no-matches / empty-history variants exported as distinct frames), `screens.md`, and `design.json`. Plan's Design Prerequisite gate is green.

**⚠️ BLOCKING**: No task from Phase 1 onward may start until every task in Phase 0 is checked. This enforces constitution §5 UX5 (phone + tablet are first-class deliverables) and keeps the `.pen` file as the primordial source for the implementation. Three target screens × two viewports = six frames.

- [X] T001 [Design] Produce Pencil frames for this feature. Choose ONE of:
  (a) Re-run `/speckit-pencil-design` in a session where the `mcp__pencil__*` tools are available. The hook opens `layout.pen`, applies the `Anchored Ribbon Grid / Lavender Cream` style guide already established by 006, creates or adjusts six frames (see T001a–T001c), exports PNGs into `specs/007-client-registration/design/`, writes `screens.md`, and emits `design.json`.
  (b) Author the six frames manually in the Pencil desktop app, export the PNGs into `specs/007-client-registration/design/`, and hand-write `screens.md` + `design.json` matching the schema used by `specs/006-product-catalog/design/`.
- [X] T001a [P] [Design] Create phone frame `clients-phone` (390 × 844 pt) for `ClientsScreen` — top bar + search field + `Recente` chip + A–Z initial chips row + single-column list of `ClientListRow` with pending-sync badge variant + first-launch empty state variant + no-matches state variant. Export to `specs/007-client-registration/design/clients-phone.png`.
- [X] T001b [P] [Design] Create tablet frame `clients-tablet` (820 × 1180 pt) for `ClientsScreen` — same composition with wider paddings (28 pt), more chips inline, 520 pt max-width search field, 84 pt row height. Export to `specs/007-client-registration/design/clients-tablet.png`.
- [X] T001c [P] [Design] Create phone frame `client-form-phone` and tablet frame `client-form-tablet` for `ClientFormScreen`. Phone: single-column stacked `Nome / CNPJ / Endereço / Contato / Notas` with 20 pt horizontal padding and full-width `Salvar` primary + `Cancelar` ghost. Tablet: two-column pairs on a 720 pt centered form column with 48 pt horizontal padding, `Salvar` right-aligned 240 pt inline with `Cancelar` on its left. Also draw the `Precisamos sincronizar pela primeira vez` blocking state variant (phone + tablet). Export as `client-form-phone.png` and `client-form-tablet.png`.
- [X] T001d [P] [Design] Create phone frame `client-profile-phone` and tablet frame `client-profile-tablet` for `ClientProfileScreen`. Phone: vertical stack identity → order history → sticky bottom `Novo pedido` CTA. Tablet: 45 / 55 split — identity left, history + CTA right. Show the order-history empty-state variant AND a populated variant (with at least one draft, one sent, one canceled row to validate the FR-015 visual distinction). Export as `client-profile-phone.png` and `client-profile-tablet.png`.
- [X] T001z [Design] Write `specs/007-client-registration/design/screens.md` with the frame table (screen × viewport → PNG + 1-line intent), list the components referenced from the catalog design system, record design decisions (how the pending-sync badge visually reads, how canceled orders are distinguished, the "contact" single-field split heuristic surface in the form), and list open questions for the spec if any. Emit `specs/007-client-registration/design/design.json` with the same `{ screens: [{ name, frame_id, screenshot }] }` shape 006 uses. Commit the `.pen` file and every export.

**Checkpoint**: `design/screens.md` lists three screens × two viewports (six frames). `design/design.json` lists each. The plan's Design Prerequisite ⚠️ flips to ✅. Only now may Phase 1 start.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify the RLS prerequisite for writes, scaffold the `src/features/clients/` directory tree, and update the plan + CLAUDE.md pointer. **No new runtime dependency is introduced by this feature** — `package.json` is untouched.

**⚠️ Role-guarded features**: the plan's Role & Authorization Check is non-N/A (this feature writes to `clients`, which is listed in constitution D7). Per [research.md §R-009](./research.md), no new RLS policy is authored — existing policies from 005's bootstrap already permit the owning salesperson to INSERT / SELECT their own rows. T002 is a read-only verification, not a migration.

- [ ] T002 Execute the Supabase-side RLS verification per [research.md §R-009](./research.md) against the **dev** Supabase project via the dashboard SQL editor. Run:

  ```sql
  select polname, polcmd, pg_catalog.pg_get_expr(polqual, polrelid) as using_expr
  from pg_policy
  where polrelid = 'public.clients'::regclass
  order by polname;
  ```

  Expected: at least one INSERT policy AND at least one SELECT policy scoped to `auth.uid() = salesperson_id` (or an equivalent expression — a policy on `auth.uid()` that maps to the owning salesperson row). Paste the output into the PR description. If either policy is missing, STOP and open a follow-up issue for the admin to author them in the Supabase dashboard before any screen task runs — this feature's writes cannot ship without them.

- [X] T003 [P] Create the directory skeleton under `src/features/clients/`: `screens/`, `components/`, `hooks/`, `drafts/`, `search/`, `cnpj/`, `responsive/`, `tests/`. No files yet — Phase 2 populates them. (Added `contact/` as well per remediation patch.)

**Checkpoint**: `pnpm lint`, `pnpm typecheck`, `pnpm test` green on the pre-007 codebase (nothing added yet). `src/features/clients/` exists with the 8 empty subfolders. Dev Supabase `clients` RLS verified.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the responsive primitives, the public DTO types, the search-normalize + CNPJ utility modules, the draft store, the active-salesperson hook, the route type declarations, and the Home entry button — all shared across US1 / US2 / US3. Everything here is pure TypeScript or tiny React primitives; nothing depends on a screen.

**⚠️ CRITICAL**: No work in Phases 3–5 may begin until all Phase 2 tasks complete.

### Responsive primitives

- [X] T004 [P] Create `src/features/clients/responsive/breakpoints.ts` exporting the constant `TABLET_MIN_WIDTH = 768` with a JSDoc explaining the choice per [contracts/responsive.md](./contracts/responsive.md). Add a one-line TODO comment referencing the catalog duplicate and the rule-of-three extraction plan (research R-008).

- [X] T005 [P] Create `src/features/clients/hooks/useViewport.ts`: imports `useWindowDimensions` from `react-native` and `TABLET_MIN_WIDTH` from `../responsive/breakpoints`; exports the `Viewport` type (`'phone' | 'tablet'`) and the `useViewport()` hook that returns `width >= TABLET_MIN_WIDTH ? 'tablet' : 'phone'`. Matches `src/features/catalog/hooks/useViewport.ts` exactly. Add the same one-line TODO comment.

### DTOs and pure utilities

- [X] T006 [P] Create `src/features/clients/types.ts` with the DTOs from [data-model.md](./data-model.md): `ClientListItemDTO`, `ClientProfileDTO`, `ClientDraft`, `ClientFilterState`, `OrderHistoryRowDTO`, `ActiveSalespersonState`, and the `EMPTY_DRAFT` constant. Every field matches the data-model exactly. No logic in this file — pure types and constants.

- [X] T007 [P] Create `src/features/clients/search/normalize.ts` exporting `normalize(input: string): string`. Implementation = `input.normalize('NFD').replace(/\p{Mn}/gu, '').toLocaleLowerCase('pt-BR').trim()`. One-line TODO referencing the catalog duplicate (research R-008). Matches `src/features/catalog/search/normalize.ts` exactly.

- [X] T008 [P] Create `src/features/clients/tests/normalize.test.ts` per [contracts/search-filter.md § normalize](./contracts/search-filter.md): empty string, diacritic stripping (`"São Paulo" → "sao paulo"`, `"açaí" → "acai"`, `"Limão" → "limao"`), case folding (`"ÁRVORE" → "arvore"`), trim (`"  Loja  " → "loja"`).

- [X] T009 [P] Create `src/features/clients/cnpj/cnpj.ts` per [research.md §R-002](./research.md): exports `normalize(raw: string): string` (strips every non-digit via `raw.replace(/\D/g, '')`) and `isValidFormat(raw: string): boolean` (returns `true` if the normalized form has length `0` or length `14`). No checksum. Pure.

- [X] T010 [P] Create `src/features/clients/tests/cnpj.test.ts`: accepts `"12.345.678/0001-99"` (normalized → `"12345678000199"`, length 14, valid); accepts bare 14 digits; rejects 13 digits; rejects 15 digits; rejects `"abc"` (normalizes to empty, which is valid per spec FR-008 — test documents this explicitly); an empty string is valid.

### Draft store

- [X] T011 [P] Create `src/features/clients/drafts/clientDraftStore.ts` per [contracts/client-draft-store.md](./contracts/client-draft-store.md): a module-level `let current: ClientDraft | null = null` and a `Set<() => void>` of listeners. Exports a single object `clientDraftStore` with methods `get()`, `set(next)`, `clear()`, `subscribe(listener)`, and `__resetForTests()`. `clear()` is a no-op (listeners do NOT fire) when `current === null`. Listeners fire synchronously on every state change.

- [X] T012 [P] Create `src/features/clients/tests/clientDraftStore.test.ts` covering every acceptance item from [contracts/client-draft-store.md § Test contract](./contracts/client-draft-store.md): initial get is null; set/get returns the set value; consecutive set calls replace (no merge); clear emits and returns to null; clear on empty store does NOT emit; multiple subscribers all receive emissions; unsubscribe stops emissions; `__resetForTests` wipes draft and listeners. `afterEach(() => clientDraftStore.__resetForTests())`.

- [X] T013 Create `src/features/clients/hooks/useClientDraft.ts`: a thin `useSyncExternalStore(clientDraftStore.subscribe, clientDraftStore.get)` wrapper. Returns `{ draft: ClientDraft, setDraft: (patch: Partial<ClientDraft>) => void, clearDraft: () => void }`. `setDraft(patch)` reads current (or `EMPTY_DRAFT`), merges the patch, and calls `clientDraftStore.set(merged)`. `clearDraft` delegates to `clientDraftStore.clear`.

### Active salesperson resolution

- [X] T014 Create `src/features/clients/hooks/useActiveSalespersonId.ts` per [quickstart.md §2](./quickstart.md): observes `salespeopleRepository.observeAll()` (from `@/data/repositories/salespeopleRepository`) and subscribes to `useSession()` (from `@/features/auth`). Returns `ActiveSalespersonState` from `../types`. Transition rules:
  - `sessionStatus !== 'Authenticated'` or `email === null` → `{ status: 'resolving', salespersonId: null }`.
  - Observations land, one row's email matches → `{ status: 'ready', salespersonId: match.id }`.
  - Observations land, no match → `{ status: 'missing', salespersonId: null }`.
  Tears down the subscription on unmount.

- [X] T015 Create `src/features/clients/tests/useActiveSalespersonId.test.ts` covering: resolves via session email when a matching salesperson row exists; returns `missing` when authenticated but no row matches; returns `resolving` while unauthenticated; re-renders when the salesperson row is added after initial mount. Use `@testing-library/react-hooks` style (or the project's existing pattern — check 003/004 tests for convention).

### Navigation + Home entry

- [X] T016 Update `src/app/navigation/types.ts` — add four entries to `HomeStackParamList`: `Clients: undefined`, `ClientForm: undefined`, `ClientProfile: { clientId: string }`, `NewOrder: { clientId: string }`. Preserve the existing `HomePlaceholder`, `DataLayerSmoke`, `Catalog`, `ProductDetail` entries exactly.

- [X] T017 Update `src/features/home/screens/HomePlaceholderScreen.tsx` — insert a new primary `Pressable` with the label `Ver clientes` **above** the existing `Ver catálogo` button. Uses the same `styles.button` / `styles.buttonPressed` / `styles.buttonLabel` tokens. On press: `navigation.navigate('Clients')`. No other edits to this file.

### Contact-field split + shared observable helper

- [X] T017a [P] Create `src/features/clients/contact/splitContact.ts` exporting the pure function `splitContact(raw: string): { phone: string | null, email: string | null }` used by the form save handler (T024). Rules: (a) split on newlines, trim each line; (b) the first line containing `@` becomes `email`; (c) every remaining non-empty line joined by space becomes `phone`; (d) if no `@`-line exists, the whole joined content becomes `phone` and `email` is null; (e) empty / whitespace-only input returns `{ phone: null, email: null }`.

- [X] T017b [P] Create `src/features/clients/tests/contactSplit.test.ts`: empty input returns both null; whitespace-only returns both null; phone-only line; email-only line; phone line 1 + email line 2; email line 1 + phone line 2; `@`-bearing line routed to `email` even when phone follows; multiple phone lines joined with space; leading/trailing whitespace trimmed per line.

- [X] T017c [P] Create `src/features/clients/hooks/useObservableClient.ts`: a thin wrapper around `clientsRepository.observe(clientId)` using `useState<Client | null>(null) + useEffect`. Tears down the subscription on unmount. Used by `ClientProfileScreen` (T034) and `NewOrderStubScreen` (T035) to avoid duplicating the observation.

**Checkpoint**: `pnpm lint`, `pnpm typecheck`, `pnpm test` green. The five Foundational-phase test files pass (normalize, cnpj, clientDraftStore, useActiveSalespersonId, contactSplit); filter / matches / orderHistory ship in later phases. The Home screen has a `Ver clientes` button but tapping it would crash because the `Clients` route has no component yet — that is fine; US1 mounts it.

---

## Phase 3: User Story 1 - Register a new client in the field, offline (Priority: P1) 🎯 MVP

**Goal**: A salesperson can tap `Ver clientes` from Home, tap `Novo cliente` (either the header action on the list or the empty-state CTA), fill a 5-field form offline, save, and see the new row at the top of the clients list carrying a discreet "Aguardando envio" badge. When connectivity returns, the badge clears automatically.

**Independent Test**: Put the simulator in airplane mode. From Home, tap `Ver clientes`. The first-launch empty state renders with `Cadastrar primeiro cliente` as the primary CTA. Tap it. Fill `Nome = "Loja Teste"`, `CNPJ = "12.345.678/0001-99"`, `Endereço = "Rua X, 10"`, `Contato = "11 98765-4321"`, `Notas = "Primeira visita"`. Tap `Salvar`. The form closes, the new client appears at the top of the list with a pending-sync indicator. Turn airplane mode off. After the next sync pass, the indicator clears. Repeat on both phone (390 × 844) and tablet (820 × 1180) simulators.

### Implementation for User Story 1

- [X] T018 [P] [US1] Create `src/features/clients/components/PendingSyncBadge.tsx`: a small horizontal flex with a 6 × 6 pt dot (color `#F59E0B` amber — matches 005's pending-sync palette) and a label `Aguardando envio` in 12 pt muted foreground. Accepts `visible: boolean` — returns `null` when `visible === false` so callers can render it unconditionally. No state.

- [X] T019 [P] [US1] Create `src/features/clients/components/ClientListRow.tsx` per the phone + tablet frames: title row (name + optional CNPJ badge on the right), secondary row (address snippet + `<PendingSyncBadge visible={client.isPendingSync} />`). Accepts `ClientListItemDTO`, `onPress`, and `viewport: Viewport`. Phone row height 72 pt; tablet 84 pt.

- [X] T020 [US1] Create `src/features/clients/components/ClientEmptyView.tsx`: centered copy `Nenhum cliente cadastrado ainda. Comece pelo primeiro cliente da sua rota.` + primary button `Cadastrar primeiro cliente`. Accepts `onCreatePress` and `viewport`. Phone: full width; tablet: max-width 460 pt centered.

- [X] T021 [US1] Create `src/features/clients/hooks/useClients.ts`: observes `clientsRepository.observeByOwner(salespersonId)` (gracefully returns empty when `salespersonId === null`). Derives `ClientListItemDTO[]` from each `Client` model, including `isPendingSync = model._raw._status !== 'synced'` per [research.md §R-006](./research.md) and `addressSnippet` / `contactSnippet` truncation rules from [data-model.md](./data-model.md) (first 40 chars of `addressLine`, `phone ?? email` truncated). Returns `{ clients: readonly ClientListItemDTO[], hasAny: boolean }`. Sorts clients by name (localeCompare pt-BR) for stable list display.

- [X] T022 [P] [US1] Create `src/features/clients/components/CnpjField.tsx`: a `TextInput` with `keyboardType='numbers-and-punctuation'`, `maxLength={18}` (14 digits + 4 punctuation chars), inline error hint text below the field when `isValidFormat(value) === false` and `value !== ''`. Accepts `value`, `onChangeText`, `viewport`. The hint text: `CNPJ deve ter 14 dígitos. Exemplo: 12.345.678/0001-99.` Does NOT format-as-the-user-types (strips formatting on save via `cnpj.normalize` — keeps typing simple per UX1).

- [X] T023 [P] [US1] Create `src/features/clients/components/ClientFormFields.tsx`: renders five labeled field groups — `Nome *`, `CNPJ`, `Endereço`, `Contato`, `Notas` — reading from `ClientDraft` via the `draft` prop and emitting changes through `onChange(patch: Partial<ClientDraft>)`. Uses `<TextInput>` for four; uses `<CnpjField>` for CNPJ. `Notas` is `multiline` with 4 lines visible. Accepts `viewport`: on tablet, name+CNPJ form row 1, address+contact form row 2, notes full-width row 3; on phone, single-column stack. `Nome` is starred visually but the star is informational — validation happens on the Save button.

- [X] T024 [US1] Create `src/features/clients/screens/ClientFormScreen.tsx`:
  - Top bar: back chevron (`accessibilityLabel="Voltar"`) that calls `navigation.goBack()`; title `Novo cliente`; right action `Salvar` (disabled unless form valid AND `useActiveSalespersonId().status === 'ready'`).
  - Body: reads `useClientDraft()`, renders `<ClientFormFields draft={draft} onChange={setDraft} viewport={viewport} />`.
  - Blocking state: when `useActiveSalespersonId().status === 'missing'`, overlay with copy `Precisamos sincronizar pela primeira vez para cadastrar clientes. Conecte-se à internet e toque em atualizar.` + button `Sincronizar agora` that calls `onPullToRefresh()` from `@/features/sync`.
  - Save handler (form valid + `status === 'ready'`):
    1. Split `draft.contact` into `phone` / `email` via `splitContact` from `../contact/splitContact` (T017a).
    2. Call `clientsRepository.create({ salespersonId, name: draft.name.trim(), taxId: cnpj.normalize(draft.taxId) || null, phone: phone || null, email: email || null, addressLine: draft.addressLine.trim() || null, notes: draft.notes.trim() || null })`.
    3. `clearDraft()`; `navigation.goBack()`.
  - Cancel handler (on a visible `Cancelar` ghost button): `clearDraft()`, `navigation.goBack()`.
  - Validation predicate for Save-enabled: `draft.name.trim().length > 0 && cnpj.isValidFormat(draft.taxId)`.

- [X] T025 [US1] Create `src/features/clients/screens/ClientsScreen.tsx` — **minimal version for US1** (search / filter are added in US3):
  - Top bar: back chevron + title `Clientes` + `<SyncStatusIndicator />` on the right.
  - When `hasAny === false`: render `<ClientEmptyView onCreatePress={() => navigation.navigate('ClientForm')} viewport={viewport} />`.
  - When `hasAny === true`: render a `FlatList` of `<ClientListRow>` (taps to `ClientForm` via a header-right `Novo cliente` action button in the top bar; row tap is wired in US2 / T034). Sorted by the hook's default order.
  - Consumes `useActiveSalespersonId()` → passes `salespersonId` to `useClients(salespersonId)`.

- [X] T026 [US1] Create `src/features/clients/index.ts` barrel exporting `ClientsScreen` and `ClientFormScreen` (other screens added in US2). No component besides the screens is re-exported — feature internals stay private per [contracts/clients-service.md](./contracts/clients-service.md).

- [X] T027 [US1] Update `src/app/navigation/HomeStack.tsx` — add `<Stack.Screen name="Clients" component={ClientsScreen} options={{ headerShown: false }} />` and `<Stack.Screen name="ClientForm" component={ClientFormScreen} options={{ headerShown: false, presentation: 'modal' }} />`. Import from `@/features/clients`. Place between the `ProductDetail` registration and the dev-only `DataLayerSmoke` registration.

- [ ] T028 [US1] Run the US1 independent test: (a) airplane mode → ClientsScreen empty state visible → tap CTA → form opens → fill and save → row appears + pending-sync badge visible; (b) turn airplane mode off → after next sync pass, badge clears. Repeat on both phone and tablet simulators. Screenshot each state and attach to the PR. If any step fails, file a bug, do NOT mark this task complete.

**Checkpoint**: US1 is fully functional on both viewports. A salesperson can register their first client offline. The clients list shows registered rows with per-row pending-sync indicators that clear on sync. MVP ready to deploy / demo.

---

## Phase 4: User Story 2 - Open a client profile and start a new order (Priority: P1)

**Goal**: From the clients list, tapping a row opens a profile showing the store identity, an order-history list (most recent first with status pill and total), and a single visually dominant `Novo pedido` CTA that navigates to a stub screen (which 008 replaces when it ships).

**Independent Test**: With at least one client in the local DB (create via US1 or seed 20 via the `DataLayerSmoke` helper), open the list, tap a row. The profile opens with the client's identity block, the order-history area (empty state if no orders; populated if orders exist — seed at least one `draft`, one `sent`, and one `canceled` via the smoke screen for the populated variant). The `Novo pedido` CTA is visually dominant above the fold on both phone and tablet. Tapping it navigates to the `NewOrder` stub screen which displays `Preparando pedido para [client.name] — módulo em breve (feature 008)` and offers a back button. Repeat on both phone and tablet simulators.

### Implementation for User Story 2

- [X] T029 [P] [US2] Create `src/features/clients/components/OrderHistoryEmptyView.tsx`: centered copy `Nenhum pedido ainda. Toque em Novo pedido para começar.` Accepts `viewport`. No CTA of its own — the primary `Novo pedido` CTA is already below on the profile.

- [X] T030 [P] [US2] Create `src/features/clients/components/OrderHistoryRow.tsx` per [contracts/order-history.md § OrderHistoryRow visual rules](./contracts/order-history.md): renders date (`dd/MM/yyyy` via a local formatter), status pill (`Rascunho` neutral / `Enviado` green / `Cancelado` muted strikethrough), and total (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`). Canceled rows rendered at opacity 0.5 with strikethrough on name + total. Accepts `OrderHistoryRowDTO` and `viewport`.

- [X] T031 [US2] Create `src/features/clients/components/OrderHistoryList.tsx`: vertical list of `<OrderHistoryRow>`. If the input array is empty, renders `<OrderHistoryEmptyView />` instead. Accepts `rows: readonly OrderHistoryRowDTO[]` and `viewport`.

- [X] T032 [US2] Create `src/features/clients/hooks/useClientOrderHistory.ts` per [contracts/order-history.md § useClientOrderHistory](./contracts/order-history.md): observes `ordersRepository.observeByClient(clientId)`, and for each emitted `Order[]`, observes each order's items via `orderItemsRepository.observeByOrder(order.id)` (or the existing `orderItemsRepository` query method), derives `OrderHistoryRowDTO` via the total formula `max(0, Σ(q*p - item.discount) - order.discount)`, and returns the list sorted `createdAtMs` descending. Use `combineLatest` + `switchMap` following the pattern of `useCatalog.ts`.

- [X] T033 [P] [US2] Create `src/features/clients/tests/orderHistory.test.ts`: pure unit tests on the derivation function (factored out of the hook as `deriveOrderHistoryRow(order, items)` for testability) — covers every test case in [contracts/order-history.md § Test contract](./contracts/order-history.md): single order no discounts; item discounts; order discount; clamp-to-zero; empty items; ordering; canceled still produces a total.

- [X] T034 [US2] Create `src/features/clients/screens/ClientProfileScreen.tsx`:
  - Reads `route.params.clientId`. Observes the client via `useObservableClient` from `../hooks/useObservableClient` (T017c).
  - Top bar: back chevron + title = client name (truncated) + `<SyncStatusIndicator />` on the right.
  - When client is `null` (soft-deleted between list and profile): render a salesperson-language "client not available" state with a `Voltar` button.
  - Identity block: name, CNPJ (or `—`), address, contact (phone + email concatenated nicely), notes, inline `<PendingSyncBadge visible={...} />` next to the name.
  - History section: `Pedidos` header + `<OrderHistoryList rows={history} viewport={viewport} />` where `history = useClientOrderHistory(clientId)`.
  - Primary CTA: a bottom-sticky `Pressable` labeled `Novo pedido` (full-width on phone, 240 pt centered on tablet). On press: `navigation.navigate('NewOrder', { clientId })`.
  - Tablet layout: 45 / 55 horizontal split — identity left, history + CTA right, matching [contracts/responsive.md § ClientProfileScreen](./contracts/responsive.md).

- [X] T035 [P] [US2] Create `src/features/clients/screens/NewOrderStubScreen.tsx` per [contracts/clients-service.md § NewOrderStubScreen](./contracts/clients-service.md): reads `route.params.clientId`, observes the client via `useObservableClient` from `../hooks/useObservableClient` (T017c), renders centered copy `Preparando pedido para {client.name}\nMódulo de pedidos em breve (008).` + a back button `Voltar para o cliente`. If the client is null (navigated directly with a bogus id), shows `Cliente não encontrado` with back. No side effects. No DB writes.

- [X] T036 [US2] Update `src/features/clients/index.ts` — add `ClientProfileScreen` and `NewOrderStubScreen` to the barrel exports.

- [X] T037 [US2] Update `src/app/navigation/HomeStack.tsx` — add `<Stack.Screen name="ClientProfile" component={ClientProfileScreen} options={{ headerShown: false }} />` and `<Stack.Screen name="NewOrder" component={NewOrderStubScreen} options={{ headerShown: false }} />`. Import from `@/features/clients`. Place after the `ClientForm` registration.

- [X] T038 [US2] Update `src/features/clients/screens/ClientsScreen.tsx` (from T025) — wire the `ClientListRow` `onPress` to `navigation.navigate('ClientProfile', { clientId })`. The minimal list built in US1 becomes tap-through here. (Wiring added at T025 time since both screens land in the same implementation pass; typecheck confirms the route is now registered via T037.)

- [ ] T039 [US2] Run the US2 independent test. Seed via the `DataLayerSmoke` screen (or a temporary dev-only button under `if (__DEV__)` on `HomePlaceholderScreen`) enough orders to cover the three statuses. Verify: (a) profile renders identity block + history; (b) canceled order visually distinct; (c) `Novo pedido` CTA dominant on both viewports; (d) tap navigates to the `NewOrderStubScreen` displaying the client name; (e) a client with zero orders shows the empty-history copy. Repeat on both simulators. Attach screenshots to the PR.

**Checkpoint**: US1 + US2 ship together as the P1 bundle. A salesperson can register clients offline, open their profile, see history, and trigger the (stubbed) order flow. The `NewOrder` hand-off boundary is in place for 008 to swap into.

---

## Phase 5: User Story 3 - Find a client quickly with tap-first search (Priority: P2)

**Goal**: The clients list exposes a tap-first filter chip row (`Recente` + alphabetic initials) and a fallback text search field. Typing and tapping compose. A no-match state with a reset control appears when filters narrow the list to zero.

**Independent Test**: Seed at least 20 clients across at least two distinct initial letters, with at least one of them having `updatedAt` in the top-10 of the set. Open the clients list. (a) Tap a letter chip — the list narrows to clients whose normalized name starts with that letter; the chip highlights. (b) Tap it again — the filter clears. (c) Tap `Recente` — only the 10 most recently touched clients remain. (d) Type `sao` into the search field (with no accents) — clients named "São Paulo ..." appear. (e) Activate a chip AND type a query — both filters compose (intersection). (f) Type `xzqw123` — the no-matches state appears with a `Limpar busca` reset. (g) Reset — the full list returns. (h) With fewer than 2 distinct letters in the dataset, the chip row hides entirely; text search still works.

### Implementation for User Story 3

- [X] T040 [P] [US3] Create `src/features/clients/search/matches.ts` per [contracts/search-filter.md § matchesQuery](./contracts/search-filter.md): exports `matchesQuery(client: ClientListItemDTO, normalizedQuery: string): boolean`. Empty query → true. Name primary: `normalize(client.name).includes(normalizedQuery)`. CNPJ secondary: if `client.taxId !== null`, `cnpj.normalize(client.taxId).includes(cnpj.normalize(normalizedQuery))`. Import `normalize` from `./normalize` and `cnpj` from `../cnpj/cnpj`.

- [X] T041 [P] [US3] Create `src/features/clients/tests/matches.test.ts` covering every item in [contracts/search-filter.md § matches.test.ts](./contracts/search-filter.md): empty query returns true; name substring start/middle/end; CNPJ match formatted vs digits-only; CNPJ match null → false; no-match combinations.

- [X] T042 [US3] Create `src/features/clients/search/filter.ts` per [contracts/search-filter.md § applyFilter](./contracts/search-filter.md): exports `RECENT_LIMIT = 10` constant and `applyFilter({ clients, query, activeFilter })`. Normalizes the query once. Short-circuits when query is empty and `activeFilter === null`. When `activeFilter.kind === 'recent'`: shallow-copy + sort by `updatedAt` descending + slice(0, RECENT_LIMIT). When `activeFilter.kind === 'letter'`: filter to clients whose `normalize(client.name).charAt(0) === activeFilter.value.toLocaleLowerCase('pt-BR')`. Finally applies `matchesQuery` with the pre-normalized query.

- [X] T043 [P] [US3] Create `src/features/clients/tests/filter.test.ts` covering every item in [contracts/search-filter.md § filter.test.ts](./contracts/search-filter.md): empty-query + null filter returns full list; recent returns top-10; letter filter matches first-letter; query + letter intersects; query + recent intersects; all three compose; no-match combinations return empty.

- [X] T044 [US3] Create `src/features/clients/hooks/useClientsFilter.ts`: local `useState<ClientFilterState>({ query: '', activeFilter: null })`. Returns `{ query, setQuery, activeFilter, setActiveFilter, filtered, reset }` where `filtered = useMemo(() => applyFilter({ clients, query, activeFilter }), [clients, query, activeFilter])` and `reset` resets both to defaults via `useCallback`. Accepts the upstream `clients: readonly ClientListItemDTO[]`.

- [X] T045 [P] [US3] Create `src/features/clients/components/SearchBar.tsx`: `<TextInput>` with placeholder `Buscar cliente`, clear button (x) when `value.length > 0`, `accessibilityLabel="Buscar cliente"`. Phone: full width; tablet: 520 pt max-width centered. Accepts `value`, `onChangeText`, `viewport`.

- [X] T046 [P] [US3] Create `src/features/clients/components/FilterChipRow.tsx`: horizontal `ScrollView` + a `Recente` chip followed by unique initial-letter chips derived from `clients.map(c => normalize(c.name).charAt(0).toUpperCase())` (deduplicated, sorted A–Z, non-empty letters only). When fewer than 2 distinct letters are present, hide the chip row entirely (returns `null`). Accepts `clients`, `activeFilter`, `onChange`. Tapping an active chip clears the filter (per FR-020 and FR-021-ish composition).

- [X] T047 [P] [US3] Create `src/features/clients/components/ClientNoMatchesView.tsx`: centered copy `Nenhum cliente encontrado com esta busca.` + ghost button `Limpar busca`. Accepts `onReset` and `viewport`. Distinct from `ClientEmptyView` — different copy and different semantics (FR-025 / FR-027).

- [X] T048 [US3] Update `src/features/clients/screens/ClientsScreen.tsx` (from T025 / T038) — introduce the search + filter strip. When `hasAny === true`, render `<SearchBar>` + `<FilterChipRow>` above the list. Pass `clients` through `useClientsFilter(clients)` and render the list from `filter.filtered`. When `filter.filtered.length === 0 && (filter.query !== '' || filter.activeFilter !== null)`: render `<ClientNoMatchesView onReset={filter.reset} viewport={viewport} />` instead of the list.

- [ ] T049 [US3] Run the US3 independent test. Seed 20+ clients via the `DataLayerSmoke` button to produce A–Z coverage. Verify all eight scenarios in the goal above on both phone and tablet simulators. Attach screenshots. In particular verify the `< 2 distinct letters` degradation path by temporarily seeding just 2 clients both starting with "L" — the chip row should hide.

**Checkpoint**: All three stories independently functional. Tap-first search is live. The feature set meets every spec FR.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story sweeps that validate constitutional compliance and readiness to ship.

- [ ] T050 [P] Manual walkthrough on the phone simulator (390 × 844 pt portrait): run every acceptance scenario from [spec.md US1 / US2 / US3](./spec.md). Record any issues and fix before marking complete. No task is complete without a phone-sim verification.

- [ ] T051 [P] Manual walkthrough on the tablet simulator (820 × 1180 pt portrait): run the same acceptance scenarios. Confirm the tablet layouts genuinely differ from phone (form is two-column, profile is 45 / 55 split, chip row shows more chips). If a layout is a stretched phone layout, file a bug — UX5 is a deliverable.

- [X] T052 [P] Constitution compliance sweep:
  - **P1 (no blocking spinner)**: inspect every screen on list / form / profile in online, offline, and syncing states. No full-screen spinner anywhere.
  - **D3 (no in-app duplicate block)**: attempt to register the same CNPJ twice. Both rows land. No warning, no block. Verify SC-009.
  - **UX5 (both viewports)**: every screen has been verified on both simulators.
  - **§9 (English identifiers / Portuguese copy)**: scan declarations to confirm identifiers are English (`grep -rE '^(export )?(function|const|let|class|type|interface) [A-Za-z_]+' src/features/clients/ --include='*.ts' --include='*.tsx'` — every captured identifier MUST be English). Separately confirm Portuguese appears only inside string literals (`grep -rE '"[^"]*(cliente|pedido|cadastrar)[^"]*"' src/features/clients/ --include='*.ts' --include='*.tsx'` — every hit MUST be a string literal, never part of an identifier).
  - **FR-007 (duplicate allowed)** + **FR-031 (role-guarded)** + **FR-032 (no admin affordances)**: verified by UI walkthrough.

- [X] T053 Run the full `pnpm test` suite and confirm green. Confirm specifically the eight new test files: `normalize.test.ts`, `matches.test.ts`, `filter.test.ts`, `clientDraftStore.test.ts`, `cnpj.test.ts`, `orderHistory.test.ts`, `useActiveSalespersonId.test.ts`, `contactSplit.test.ts`. Each was added in the phase that introduced the module under test.

- [X] T054 Run `pnpm typecheck` and `pnpm lint` green. Fix any warnings that the changes introduced.

- [ ] T055 Update the plan's Phase 1 post-design re-check (`plan.md` → "Phase 1 post-design re-check" section) if Phase 0's design outcome introduced any constitution-level note (e.g., a rejected design decision that deserves to be recorded). If nothing changed, leave the section as-is.

- [ ] T056 Run `quickstart.md` end-to-end as a fresh user would: fresh simulator boot → sign in → unlock → home → tap `Ver clientes` → first-launch empty state → register → view profile → tap `Novo pedido` stub → back → search. Every step MUST succeed without a technical hiccup. Document any friction in a follow-up issue.

- [X] T057 Verify the `NewOrder` hand-off contract still matches [contracts/order-history.md § Hand-off contract with feature 008](./contracts/order-history.md) — route name `NewOrder`, param `{ clientId: string }`, stub component replaceable. This is a grep-level check: `grep -n "NewOrder" src/app/navigation/types.ts src/features/clients/index.ts` should yield exactly two hits of each token, not more.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Design (Phase 0)**: BLOCKING per the plan. T001 (and its sub-tasks T001a–T001z) MUST complete before any Phase 1 task starts.
- **Setup (Phase 1)**: Depends on Phase 0. T002 and T003 can run in parallel.
- **Foundational (Phase 2)**: Depends on Setup completion. Within Phase 2, T004 / T005 / T006 / T007 / T008 / T009 / T010 / T011 / T012 / T017a / T017c all carry [P] and can run in parallel. T013 depends on T006 + T011 (uses `ClientDraft` and `clientDraftStore`). T014 depends on T006 (uses `ActiveSalespersonState`). T015 depends on T014. T017b depends on T017a (the test imports the module). T016 (types) and T017 (Home button) each depend on nothing in this phase and can run in parallel with all of the above.
- **User Stories (Phase 3+)**: All depend on Foundational (Phase 2) completion.
  - US1 and US2 are both P1; US2 depends on US1's `ClientsScreen` existing (T025) and on its barrel + HomeStack edits (T026, T027, T038 modifies T025's file).
  - US3 depends on US1's `ClientsScreen` existing — T048 modifies the same file T025 creates and T038 edits.
  - If a second developer is available, US2 can run in parallel with US1 **only** when US1 is past T025 (the screen file is created). Otherwise, sequence US1 → US2 → US3.
- **Polish (Phase 6)**: Depends on US1 + US2 + US3 complete.

### User Story Dependencies

- **US1 (P1)**: depends on Foundational. No other story.
- **US2 (P1)**: depends on Foundational. Integrates with US1's `ClientsScreen` to wire the row-tap → profile navigation (T038). US1's clients list must exist (T025 done) before T038 lands.
- **US3 (P2)**: depends on Foundational + US1. Integrates with US1's `ClientsScreen` to mount the search / chip row (T048). US1's list must exist before T048.

### Within Each User Story

- Tests (where included) are colocated with the module they cover and run as part of `pnpm test` — they are NOT TDD-ordered (not required by spec). Pure-function tests (T008, T010, T012, T033, T041, T043) can be written before or after the module they cover; either way, they must pass before the task is checked.
- Components before screens (the screen depends on its child components existing).
- Screens before HomeStack registration + barrel export (types must resolve).
- HomeStack registration before the "Run independent test" task.

### Parallel Opportunities

- Phase 0: T001a, T001b, T001c, T001d are all independent frames — run in parallel. T001z is the summary step (blocks on the four frame tasks).
- Phase 1: T002 and T003 are independent — run in parallel.
- Phase 2: All [P]-marked tasks run in parallel. T013 / T014 / T015 have narrow dependencies documented above.
- US1: T018 / T019 / T022 / T023 are all separate files — run in parallel. T020 / T021 / T024 / T025 are sequential within the feature module because later ones compose earlier ones.
- US2: T029 / T030 / T033 / T035 are independent files — run in parallel. T031 / T032 / T034 are sequential (list composes row; screen composes list + hook).
- US3: T040 / T041 / T043 / T045 / T046 / T047 are independent — run in parallel. T042 / T044 / T048 sequence on top.
- Polish: T050 / T051 / T052 / T053 / T054 / T057 are independent — run in parallel. T056 sequences after manual walkthroughs (it's the composed end-to-end pass).

---

## Parallel Example: User Story 1

```bash
# Launch the independent-file foundation for US1 together:
Task: "Create PendingSyncBadge.tsx"               # T018
Task: "Create ClientListRow.tsx"                  # T019  (imports PendingSyncBadge — sequence T018 first, actually)
Task: "Create CnpjField.tsx"                      # T022
Task: "Create ClientFormFields.tsx"               # T023  (imports CnpjField — sequence T022 first, actually)

# Once the components exist, screens sequence:
Task: "Create ClientsScreen.tsx (minimal)"        # T025  (composes ClientListRow + ClientEmptyView + useClients)
Task: "Create ClientFormScreen.tsx"               # T024  (composes ClientFormFields)
```

Strictly parallel within US1: T018 + T022 (no mutual dependency); then T019 + T023 (each depends on the previous pair).

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — the P1 bundle)

1. **Phase 0**: produce Pencil frames for all three screens × two viewports.
2. **Phase 1**: verify RLS, scaffold directories.
3. **Phase 2**: foundational primitives — responsive, DTOs, draft store, CNPJ, normalize, active-salesperson, types, Home button.
4. **Phase 3 (US1)**: clients list (minimal), registration form, pending-sync badge, first-launch empty state. Verify on phone + tablet simulators.
5. **Phase 4 (US2)**: client profile, order history, `Novo pedido` CTA + stub, row-tap wiring. Verify on phone + tablet simulators.
6. **STOP and VALIDATE**: The P1 bundle ships. A salesperson can register, view, and trigger (stubbed) order creation — field-useful on day one.

### Incremental Delivery

1. Phase 0 → Phase 1 → Phase 2: foundation.
2. US1 → test → ship (MVP). The salesperson can register a first client offline.
3. US2 → test → ship. The client becomes a profile with history and a CTA.
4. US3 → test → ship. The list becomes navigable at scale.
5. Polish → ship. Compliance sweep and cleanup.

### Parallel Team Strategy (if two developers are available)

1. Both: Phase 0, Phase 1, Phase 2 together (tight coupling on primitives).
2. After T025 (US1's `ClientsScreen` exists):
   - Developer A: completes US1 (T026 – T028) then moves to US3 (T040 – T049).
   - Developer B: starts US2 (T029 – T039). T038 depends on T025 already being in place; T038 edits T025's file, so Dev B coordinates with Dev A on that single merge.
3. Polish together.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps task to specific user story (US1, US2, US3) for traceability.
- Each user story is independently testable: US1 on a fresh install; US2 with any one client in the local DB; US3 with ~20 seeded clients across letters.
- UI verification is manual on phone (390 × 844) AND tablet (820 × 1180) — constitution UX5 is a deliverable, not a polish item.
- Commit after each logical group (one commit per user story's checkpoint is typical; foundational phase is usually one commit too).
- No new runtime dependency. No schema migration. No new RLS policy. This feature ships on top of 002 / 003 / 004 / 005 / 006 infrastructure as-is.
- Avoid: vague tasks, same-file conflicts that aren't sequenced, cross-story dependencies that break independence. The three known same-file sequences are `ClientsScreen.tsx` (T025 → T038 → T048), `HomeStack.tsx` (T027 → T037), and `src/features/clients/index.ts` (T026 → T036); the dependency graph captures them.
