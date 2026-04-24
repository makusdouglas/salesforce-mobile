# Tasks: Order Email Delivery

**Feature**: 011-order-email-delivery
**Branch**: `011-order-email-delivery`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Design**: [design/screens.md](./design/screens.md)

Tests are generated alongside implementation because plan.md explicitly calls out CI-enforced static guards (`noNetworkOnSend`, `pdfTemplate.nofiscal`, widened `noCatalogWrites`) and the totals-fidelity lock — these belong in the same commits as the code they guard, not as a polish afterthought.

---

## Phase 1 — Setup

- [X] T001 Install the three new Expo modules — `expo-print`, `expo-mail-composer`, `expo-sharing` — via `npx expo install expo-print expo-mail-composer expo-sharing` and verify the dev client rebuilds cleanly on iOS + Android in `package.json` and `ios/Podfile.lock` / `android/app/build.gradle`.
- [X] T002 [P] Register the three new modules in `app.config.ts` under the `plugins` array where needed (`expo-mail-composer` on Android requires `<queries>` for `mailto:` intent; follow the module's README).
- [ ] T003 [P] Add shared Jest test doubles for the send-path at `src/features/orders/send/__tests__/expoStubs.ts` exporting factories for `expo-print`, `expo-mail-composer`, `expo-sharing`, and `expo-file-system` (path + copy + exists + getInfoAsync). Each test file that needs them calls `jest.mock('expo-print', () => stubs.print)` etc. explicitly — Jest's auto-mock `__mocks__` folder is NOT used here because the module names (`expo-*`) do not match a single in-repo path.

---

## Phase 2 — Foundational (blocks every user story)

- [X] T004 Create WatermelonDB migration `src/data/schema/migrations/0011_order_email_delivery.ts` that (a) adds `order_number TEXT NULL` and `pdf_path TEXT NULL` columns to `orders`, (b) creates the new local table `order_number_counters` with columns `year INTEGER PRIMARY KEY` and `next_value INTEGER NOT NULL`, and (c) bumps the Watermelon schema version. Register the migration in `src/data/schema/index.ts`.
- [ ] T005 [P] Write the matching Supabase SQL migration `supabase/migrations/<timestamp>_order_email_delivery.sql` that adds `order_number TEXT` and `pdf_path TEXT` to `public.orders` and creates the partial unique index `CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique ON public.orders (order_number) WHERE order_number IS NOT NULL;`.
- [X] T006 Extend the `Order` model at `src/data/models/Order.ts` with `@field('order_number') orderNumber: string | null` and `@field('pdf_path') pdfPath: string | null` and regenerate the corresponding `_raw` TypeScript types if a central type file is used.
- [X] T007 [P] Create the `OrderNumberCounter` model at `src/data/models/OrderNumberCounter.ts` with `@field('year')` and `@field('next_value')` decorators. Use the Watermelon default string `id` with the convention `id === String(year)` so `findByYear(year)` is an O(1) `collection.find(String(year))`. Register the model in `src/data/database.ts` (models array).
- [X] T008 [P] Create `src/data/repositories/orderNumberCountersRepository.ts` exposing `findByYear(year)` and `upsertNextValue(year, next)` — both are thin wrappers over Watermelon collection APIs and expected to be called **inside** a caller-supplied `database.write(...)` action (document this in a one-line JSDoc).
- [ ] T009 Exclude `pdf_path` from the outbound Supabase payload in `src/data/sync/push/ordersPush.ts` (or wherever `orders` push columns are enumerated). `order_number` MUST remain in the outbound column list. Add an inline code comment referencing FR-011/FR-012 + plan.md R9.
- [ ] T010 Add the hook point for order-number conflict reconciliation in the same `ordersPush.ts` file: when a push to `orders` fails with a unique-violation on `order_number`, the push layer calls an injected callback `onOrderNumberConflict(order)` that (a) fetches existing taken numbers for the year from Supabase, (b) calls `allocateNextNumber({ year, taken })`, (c) rewrites the local `order_number` + renames the local PDF file on disk, (d) retries the push. Keep the helper callable but provide a no-op default so this task can land before T015 / T016 exist.

---

## Phase 3 — User Story 1: Send draft order by email with attached PDF (P1)

**Story goal**: From a ready draft whose client has an email on file, the salesperson taps **Enviar por email**, the OS mail composer opens pre-filled with the PDF attached, and — on confirm + return — the order transitions to `sent` with `order_number`, `pdf_path`, `sent_at_ms` persisted and the `OrderSent` confirmation screen showing.

**Independent test** (from `quickstart.md` Scenario 1 + 4 + 5): open a seeded draft with a client email → verify hint + label → tap send → verify mail composer contents → confirm → verify status flip + OrderSent contents. Covers happy path, retry-after-cancel, and empty-draft block.

### Pure helpers and template (no UI, no I/O)

- [X] T011 [P] [US1] Implement the pure allocator helpers in `src/features/orders/send/allocateNextOrderNumber.ts`: `formatOrderNumber(year, n)`, `parseOrderNumber(s)`, `allocateNextNumber({ year, taken })`, plus the stateful `allocateNextOrderNumber(year, db)` that reads + increments via `orderNumberCountersRepository` inside a caller-supplied transaction. Throw `OrderNumberOverflowError` above 9999.
- [X] T012 [P] [US1] Write the behaviour tests in `src/features/orders/send/allocateNextOrderNumber.test.ts` per contracts/allocateNextOrderNumber.md (padding, monotonicity, year-reset, `allocateNextNumber` with contiguous/sparse/adversarial `taken` inputs). Use `database.write` in-memory test helper (existing pattern in 009 tests) for the stateful function.
- [X] T013 [P] [US1] Implement the tiny filename slug helper in `src/features/orders/send/clientSlug.ts` — strips accents via `.normalize('NFD').replace(/[̀-ͯ]/g, '')`, lowercases, replaces non-alphanumerics with `-`, collapses dashes, trims leading/trailing dashes, truncates to 40 chars. Pure, deterministic. Add `src/features/orders/send/clientSlug.test.ts` with acento, spacing, empty-name, pure-symbol, and length-cap cases. In the same file also export the pure helper `isLikelyEmail(s: string | null): boolean` — returns `true` iff `s` matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (minimal shape check, not RFC-strict). Cover with tests: null, empty, "x", "x@y", "x@y.z", "  a@b.co  " (trims then validates), addresses with accents.
- [X] T014 [P] [US1] Implement the pure HTML builder `renderOrderPdfHtml(input)` in `src/features/orders/send/pdfTemplate.ts`. MUST call `computeOrderTotals` for all numeric cells (never re-implement math). Inline `<style>` only. Header contains `"Documento sem valor fiscal"`; footer contains `"Este documento é um orçamento / proposta comercial. NÃO POSSUI valor fiscal."`. pt-BR formatting via `formatCurrencyBRL` + `formatShortDatePt`. See contracts/pdfTemplate.md.
- [X] T015 [P] [US1] Write `src/features/orders/send/pdfTemplate.test.ts` — property-based seeded orders, assert the HTML contains the order number, non-fiscal marker, salesperson name, client name, one `<tr>` per line with expected `qty × price − disc = total`, order-level discount, grand total — all matching `computeOrderTotals` output exactly.
- [X] T016 [P] [US1] Write `src/features/orders/send/pdfTemplate.nofiscal.test.ts` — two assertions: (a) `fs.readFileSync('pdfTemplate.ts', 'utf8')` does NOT contain any of `['NF-e', 'Nota Fiscal', 'CNPJ:', 'Inscrição Estadual', 'ICMS', 'IPI']`; (b) the rendered HTML for a seeded order also does not contain any of them.

### Service

- [X] T017 [US1] Implement `orderSendService.sendOrder(input)` in `src/features/orders/send/orderSendService.ts` per contracts/orderSendService.md. Flow: load order + items → guard (not found / not draft / empty) → if `order.orderNumber` null then `database.write` to allocate number + persist it → if PDF file missing, call `Print.printToFileAsync(html)` then `FileSystem.copyAsync` to the stable path then persist `pdf_path` inside another `database.write` → decide mail vs share by `isLikelyEmail(order.clientEmail)` (the ONLY place the email shape is evaluated — the hint component reads the same computed value) → await intent → on mail `MailComposerResult.SENT` flip to `sent`; on mail `CANCELLED/SAVED` return `{ kind: 'cancelled', ... }` without status change; on share resolution, treat any non-throwing resolve as `sent` (documented Android limitation — see plan.md R11). Map internal errors to the `SendOrderResult` discriminated union. Export the Portuguese subject and body copy as module-level constants `SUBJECT_TEMPLATE(orderNumber, clientName)` and `BODY_TEMPLATE(salesperson, client)` so T019 can assert them verbatim (FR-022).
- [ ] T018 [US1] Add `ordersService.markSent(orderId, { orderNumber, pdfPath, sentAtMs })` to `src/features/orders/services/ordersService.ts` — canonical status-flip method. Reroute any existing 009 code path that flipped `sent` through this method so both paths converge. Update `ordersService.test.ts` accordingly.
- [X] T019 [US1] Write `src/features/orders/send/orderSendService.test.ts` covering: happy-path email send (asserts `SUBJECT_TEMPLATE` + `BODY_TEMPLATE` exact strings), no-email share, malformed-email → share branch, cancel leaves draft + persisted number + persisted PDF, retry reuses number and PDF, empty-draft throws, not-found/not-draft error branches, share-flow always resolves as `sent` (Android semantics documented). Mock expo modules via T003's stubs.
- [X] T020 [P] [US1] Write `src/features/orders/send/noNetworkOnSend.test.ts` — static scan asserting zero references to `fetch`, `global.fetch`, `@supabase/`, or `@/data/sync/` in `orderSendService.ts`, `allocateNextOrderNumber.ts`, `pdfTemplate.ts`, `clientSlug.ts`, `useSendOrder.ts`, `SendHint.tsx`, `OrderSentScreen.tsx`. Mirror the pattern in `src/features/orders/noCatalogWrites.test.ts`.
- [X] T021 [P] [US1] Widen `src/features/orders/noCatalogWrites.test.ts` scan roots to include `src/features/orders/send/**` and the two new screens so R5 stays locked along the send path.

### Hook + UI

- [X] T022 [US1] Implement `src/features/orders/send/useSendOrder.ts` — a thin React hook wrapping `sendOrder` that exposes `{ send: (orderId) => Promise<SendOrderResult>, isSending: boolean }`. No retries, no extra logic — the service owns all behaviour. Export the underlying `runSendOrder` as a plain function too, matching 010's `runRepeatOrder` split for testability.
- [X] T023 [P] [US1] Create `src/features/orders/components/SendHint.tsx` — inline hint block styled like the existing status hint (zinc-50 fill, rounded 10, Feather `mail` icon + one-line text). Props: `{ recipientEmail: string | null; itemCount: number }`. Renders `"PDF + email para {email}"` when `isLikelyEmail(recipientEmail)`; `"Compartilhar PDF — sem email cadastrado"` when email is null or malformed; `"Adicione itens para enviar"` when `itemCount === 0` (matches FR-018 disabled state with useful empty-state copy per UX3). Pure presentational; imports `isLikelyEmail` from `../send/clientSlug`.
- [X] T024 [US1] Add the `OrderSent` route to `src/app/navigation/types.ts` with params `{ orderId: string; orderNumber: string; pdfPath: string; recipientEmail: string | null; clientId: string }` and register the screen in `src/app/navigation/OrdersStack.tsx`.
- [X] T024b [P] [US1] Create `src/features/orders/send/openStoredPdf.ts` exporting `async function openStoredPdf(orderId: string): Promise<void>` — loads the order, checks `FileSystem.getInfoAsync(order.pdfPath)`; if exists, calls `Sharing.shareAsync(order.pdfPath, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })`; if missing, calls `orderSendService.regeneratePdfForSentOrder(orderId)` (defined in T034, US3) then shares the regenerated path. This is the single choke point that OrderSent T025 and OrderSummary T033 both call for "Ver PDF salvo". In the US1 landing, T034 does not exist yet — stub the regeneration branch as `throw new Error('regeneration not implemented — ship US3')` so the happy path works and the missing-file branch is a graceful failure until US3 lands. Add a placeholder test file; real tests co-land with T035 in US3.
- [X] T025 [US1] Create `src/features/orders/screens/OrderSentScreen.tsx` matching design/order-sent-phone.png + order-sent-tablet.png: large check circle, order number, "PDF compartilhado via email" (or "PDF compartilhado" when recipientEmail null), recipient line, two CTAs **Ver PDF salvo** and **Concluir** (navigates to `ClientProfile` with `clientId`). **Ver PDF salvo** MUST call the shared helper `openStoredPdf(orderId)` exported from `src/features/orders/send/openStoredPdf.ts` (created in T024b) — NOT `Sharing.shareAsync` directly — so the FR-017 regeneration branch works from both OrderSent and OrderSummary. Use `useViewport()` for the phone-vertical / tablet-horizontal CTA row branch.
- [X] T026 [US1] Edit `src/features/orders/screens/OrderSummaryScreen.tsx`: mount `<SendHint recipientEmail={order.clientEmail} />` above the action row; branch send button label (`"Enviar por email"` vs `"Compartilhar PDF"`) on `order.clientEmail`; wire the button's `onPress` to `useSendOrder().send(orderId)` and, on a `sent` result, `navigation.replace('OrderSent', {...})`. Disable the button when `items.length === 0` (FR-018).
- [ ] T027 [US1] Write `src/features/orders/screens/OrderSentScreen.test.tsx` — mount with mock params (email vs null), assert screen text + CTA behaviour. Keep it a smoke test; business logic is in the service.
- [ ] T028 [P] [US1] Update `src/features/orders/screens/OrderSummaryScreen.test.tsx` (or create if missing) to cover the hint/label branch and the disabled-when-empty guard.
- [ ] T029 [US1] Manual QA pass on iOS phone + iPad simulators following quickstart.md Scenario 1, Scenario 4 (cancel + retry), Scenario 5 (empty draft). Check the hint copy, the mail composer pre-fill, the return-to-app transition, and that the order appears as `sent` on the client profile.

**Checkpoint — US1 complete**: the feature delivers R4 for the primary case. Stories US2 and US3 extend the flow and can ship independently.

---

## Phase 4 — User Story 2: Share without an email on file (P2)

**Story goal**: A client with no email still produces a shareable PDF via the OS share sheet; order flips to `sent` on completion.

**Independent test** (quickstart.md Scenario 2): open a draft whose client has no email → verify hint + label → tap → generic share sheet opens with PDF → complete via any channel → verify order `sent` with `pdf_path`, `order_number`, `sent_at_ms` and OrderSent recipient line reading "compartilhado sem email".

> Most of US2's code lands in US1 because the two flows share the service and the screen. US2's tasks are the residual UI copy edge and the fallback test coverage.

- [X] T030 [P] [US2] Verify in `src/features/orders/send/orderSendService.ts` (T017) that the no-email branch correctly calls `Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })`. If the sharing module is unavailable at runtime, return `SendOrderResult { kind: 'error', reason: 'intent_unavailable' }` — covered in `orderSendService.test.ts`.
- [X] T031 [P] [US2] In `OrderSentScreen.tsx`, branch the recipient line: when `recipientEmail` is null, render "compartilhado sem email" instead of the email. Covered in `OrderSentScreen.test.tsx` (T027) with a second case.
- [ ] T032 [US2] Manual QA on iOS phone following quickstart.md Scenario 2 — open a draft whose client has no email, verify the generic share sheet, share to any target (e.g. save-to-Files or AirDrop), return to app, verify `OrderSent`.

**Checkpoint — US2 complete**: every draft in the app is sendable regardless of whether the client has an email.

---

## Phase 5 — User Story 3: Retrieve a previously sent PDF (P2)

**Story goal**: From any order in `sent` status (either the OrderSent confirmation screen or the order detail later), tap **Ver PDF salvo** and the stored PDF opens in the device viewer. If the file is missing, regenerate using the original number.

**Independent test** (quickstart.md Scenario 3): open any `sent` order → tap **Ver PDF salvo** → PDF opens. Manually delete the file → tap again → regeneration produces the same order number.

- [ ] T033 [US3] Add a "Ver PDF salvo" action to `src/features/orders/screens/OrderSummaryScreen.tsx` when the order is in status `sent` (replaces the send button in that state). `onPress` calls the shared `openStoredPdf(orderId)` from `src/features/orders/send/openStoredPdf.ts` (T024b). No new missing-file logic here — the choke point owns it.
- [ ] T034 [US3] Implement `orderSendService.regeneratePdfForSentOrder(orderId)` in `src/features/orders/send/orderSendService.ts`: loads the order + items, re-renders via `renderOrderPdfHtml` using the persisted `order.orderNumber` (never allocate new), writes to the same path, returns the path. Throws if called on a non-`sent` order. Remove the US1 stub from `openStoredPdf.ts` so the regeneration branch now actually regenerates.
- [ ] T035 [US3] Extend `orderSendService.test.ts` with: regenerate happy-path (file was deleted, regenerate reuses same order number, file exists after); regenerate rejects non-sent orders.
- [ ] T036 [US3] Manual QA: from OrderSent tap **Ver PDF salvo** → PDF opens. Delete the file via Files app / adb. Return to the order detail, tap **Ver PDF salvo** → PDF regenerates and opens, order number unchanged.

**Checkpoint — US3 complete**: previously-sent PDFs are always retrievable.

---

## Phase 6 — Cross-cutting: order-number sync reconciliation

> Split from US1 because it's only observable across sync — no single user story surface shows it, but FR-012 is a hard requirement.

- [ ] T037 Wire the `onOrderNumberConflict` callback introduced in T010 to the real implementation: on push conflict, fetch `SELECT order_number FROM orders WHERE order_number LIKE '#YYYY-%'` from Supabase for the year, pass the list to `allocateNextNumber`, rewrite `order.order_number` locally (inside a `database.write`), compute the new PDF filename, rename the on-disk file via `FileSystem.moveAsync`, persist the new `pdf_path`, retry the push.
- [ ] T038 [P] Write `src/features/orders/send/orderSendService.sync.test.ts` — mock the push layer, inject a unique-violation on first try, assert the second try succeeds with a fresh number and the PDF was renamed. Also assert `pdf_path` was NOT in the outbound payload on either attempt.
- [ ] T039 [P] Manual QA Scenario 6 (quickstart.md) — two devices offline, both send, both come online, verify DB uniqueness is preserved.

---

## Phase 7 — Polish

- [ ] T040 [P] Add JSDoc one-liners on every public function in `src/features/orders/send/*.ts` pointing at the corresponding FR or contract section. Keep them short per §9 comment rules.
- [ ] T041 [P] Run the full test suite (`npm test`) and confirm the four CI fail-fast checks listed in quickstart.md all pass.
- [ ] T042 Visual diff the rendered PDF against `design/pdf-template-a4.png`: generate a real PDF from a seeded order on the simulator, open it, compare header / Vendedor-Cliente block / items table / totals card / footer positions and typography. Record findings in the PR description.
- [ ] T042b Measure SC-001: seed a 30-line order on an iOS simulator AND an Android emulator, instrument `sendOrder` with `performance.now()` around PDF render + file copy + intent open, run 5 iterations each, record p95 latency tap-to-composer-visible in the PR description. Flag if p95 > 2000 ms.
- [ ] T043 Update the PR description template to declare the constitution principles this feature touches (R4 — central; P1, P5, R5, UX5) and the migrations added (`0011_order_email_delivery`).

---

## Dependencies

Setup (Phase 1) → Foundational (Phase 2) → US1 (Phase 3) → US2 (Phase 4) → US3 (Phase 5) → Sync reconciliation (Phase 6) → Polish (Phase 7).

- US1 depends on the full Phase 2 foundation (migration + model + counter repo + sync-push column exclusion).
- US2 is a small extension of US1 — its service + UI code lives in US1's files.
- US3 depends on US1's `orderSendService` and `pdfTemplate` but can be built after US1 ships without re-opening US1's PR.
- Phase 6 (sync reconciliation) depends on T010 (callback hook point) + T011 (`allocateNextNumber` pure helper). It can ship in the same PR as US1 or in a follow-up.

## Parallel execution examples

**Phase 2 foundational** — T005, T007, T008 can run concurrently with T004 / T006 as long as file ownership is respected.

**Phase 3 pure helpers + tests** — T011, T013, T014 and their companion tests T012, T015, T016 are all in separate files with no runtime coupling. All six can run in parallel before T017 starts.

**Phase 3 UI** — T023 (SendHint), T024 (navigation types), T027 (test file) can run in parallel with T025 once T022 lands.

**Phase 6** — T038 + T039 after T037 lands.

## Implementation strategy

MVP ships with Phases 1–3 (US1) + Phase 7. That gives R4 for the primary case (client with email). Phases 4 (US2), 5 (US3), and 6 (sync reconciliation) can follow in the same PR or in follow-ups without schema change.

Total tasks: **45**.

- Setup: 3
- Foundational: 7
- US1: 20 (T011–T029 + T024b)
- US2: 3
- US3: 4
- Sync reconciliation: 3
- Polish: 5 (T040, T041, T042, T042b, T043)

MVP scope (US1 only): **30 tasks** (Phase 1 + Phase 2 + Phase 3 + Phase 7).
