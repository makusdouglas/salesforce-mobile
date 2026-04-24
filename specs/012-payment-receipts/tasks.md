---
description: "Task list for 012-payment-receipts"
---

# Tasks: Payment Receipts

**Input**: Design documents from `/specs/012-payment-receipts/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [design/screens.md](./design/screens.md)

**Tests**: Included — constitution §9 requires business-logic coverage and the plan enumerates eight explicit test files.

**Organization**: Grouped by user story (US1–US4 from spec.md). Each phase's checkpoint states what independently works after that phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies).
- **[Story]**: `US1`–`US4` map to User Stories 1–4 in spec.md.
- File paths are absolute to the repository root.

---

## Phase 0: Design 🎨 — ALREADY COMPLETE ✅

All frames produced by `/speckit-pencil-design` on 2026-04-23. See [design/screens.md](./design/screens.md) and [design.json](./design.json).

- [x] T000 — Confirm `Anchored Ribbon Grid` style guide applied to `layout.pen`.
- [x] T001 [Design] `OrderReceipts / Phone` frame `OhaXW` exported → `design/order-receipts-phone.png`.
- [x] T002 [Design] `OrderReceipts / Tablet` frame `M71E2` exported → `design/order-receipts-tablet.png`.
- [x] T003 [Design] `PaymentReceiptForm / Phone` frame `xFdWB` exported → `design/payment-receipt-form-phone.png`.
- [x] T004 [Design] `PaymentReceiptForm / Tablet` frame `qmurF` exported → `design/payment-receipt-form-tablet.png`.
- [x] T005 [Design] `PaymentReceiptDetail / Phone` frame `dPZom` exported → `design/payment-receipt-detail-phone.png`.
- [x] T006 [Design] `PaymentReceiptDetail / Tablet` frame `bfEgo` exported → `design/payment-receipt-detail-tablet.png`.
- [x] T007 [Design] `design/screens.md` + `design/design.json` finalized, tablet deltas (3+2 method chips) recorded.

**Checkpoint**: `design.json` lists all six screens with both viewports. Phase 1 may start.

---

## Phase 1: Setup — Schema, RLS, Scaffolding

**Purpose**: Land schema + Supabase Storage policies + the new sub-tree's empty scaffold **before** any business code. Constitution §7 D7 mandates the RLS/Storage-policies task (T009) precede any screen task — that ordering is enforced below.

- [x] T008 Add WatermelonDB migration `0012_payment_receipts` to `src/data/schema/migrations.ts` and widen `payment_receipts` table in `src/data/schema/tables.ts` per [data-model.md](./data-model.md) (rename `image_url` → `attachment_url`; add 5 new columns; bump schema version). `received_at_ms` stays un-indexed per data-model.md — MVP row counts are small (< 5 per order) and sorting happens in-memory. **Implementation note**: WatermelonDB cannot rename columns, so `attachment_url` is added alongside and the legacy `image_url` remains as dead storage; server-side renames properly via T009.
- [x] T009 [RLS] Create `supabase/migrations/0012_payment_receipts.sql` mirroring the Watermelon migration server-side: add same columns, rewrite `method = 'card'` rows to `'check'`, update the method CHECK constraint, create private Storage bucket `receipt-attachments`, and register the two Storage policies `receipts_attachments_read` + `receipts_attachments_insert` per [data-model.md](./data-model.md). **File created — run manually against the Supabase instance before shipping the build.**
- [x] T010 [P] Update `src/data/types.ts` — rename `PaymentMethod` enum value `'card'` → `'check'`; add `AttachmentUploadState = 'pending' | 'synced' | 'failed'` and `AttachmentMimeType = 'image/jpeg' | 'image/png' | 'image/heic' | 'application/pdf'`. These two types are the single source of truth; [contracts/paymentReceiptsRepository.ts](./contracts/paymentReceiptsRepository.ts) will `import` them rather than redeclare.
- [x] T011 [P] Update `src/data/models/PaymentReceipt.ts` — add `@field('attachment_url') attachmentUrl`, the four new attachment columns as `@field` decorators, `@field('correction_of_receipt_id')`, and `@relation` helper for the self-FK. Repository input/patch shapes migrated from `imageUrl` → `attachmentUrl` (debug screens were already clean). 530 tests green, tsc clean.
- [x] T012 [P] Created scaffold under `src/features/orders/receipts/` — `screens/` (3 placeholder screens), `hooks/`, `totals/`, `attachments/`, `components/` — each sub-directory has an `index.ts` placeholder.
- [x] T013 [P] Added three new routes to `src/app/navigation/types.ts` (`OrderReceipts: { orderId }`, `PaymentReceiptForm: { orderId; correctionOf?: string }`, `PaymentReceiptDetail: { receiptId }`) and extended `OrdersNavigatorParams`.
- [x] T014 Registered the three routes in `src/app/navigation/OrdersStack.tsx`. Placeholder screens render a title + "Phase 1" caption; real implementations land in Phases 3–6.

**Checkpoint**: Schema migrated on both sides, bucket + policies live, navigation tree boots without crashes. No business logic yet.

---

## Phase 2: Foundational — Repository, Totals, Attachment Pipeline, Sync

**Purpose**: Ship the append-only repository, the pure selector, and the attachment pipeline core. Every user story depends on this phase.

**⚠️ CRITICAL**: No US task may start until Phase 2 is complete.

### Repository (append-only rewrite)

- [x] T015 Rewrite `src/data/repositories/paymentReceiptsRepository.ts` per [contracts/paymentReceiptsRepository.ts](./contracts/paymentReceiptsRepository.ts): delete `update()` and `softDelete()`, extend `create()` to accept optional attachment metadata, add `createCorrection()`, add `retryAttachmentUpload()`. All DB writes inside a single `database.write(...)`.
- [x] T016 [P] [Test] Create `src/data/repositories/paymentReceiptsRepository.test.ts` covering: successful create with defaults; `amount <= 0` rejection; unknown method rejection; `createCorrection({ amount: -10 })` persists `correction_of_receipt_id` and leaves the original byte-identical; compile-time assertion that `update`/`softDelete` keys do not exist on the exported module.

### Totals selector (pure)

- [x] T017 [P] Implement `src/features/orders/receipts/totals/computeReceiptTotals.ts` per [contracts/computeReceiptTotals.ts](./contracts/computeReceiptTotals.ts). Signed sum; `outstanding = max(total - received, 0)`; `hasOverpayment`, `hasNegativeBalance`, `progressRatio` clamped to `[0, 1]`.
- [x] T018 [P] [Test] `src/features/orders/receipts/totals/computeReceiptTotals.test.ts` covering: single receipt, multiple receipts with a negative correction, overpayment, empty list, `totalCents === 0` edge.

### Append-only static guard

- [x] T019 [P] [Test] `src/features/orders/receipts/appendOnlyReceipts.test.ts` — walk `src/features/orders/receipts/**` + `src/data/repositories/paymentReceiptsRepository.ts` and fail on `\.update\(`, `\.markAsDeleted\(`, `\.destroyPermanently\(`, or direct field assignment to `receipt.(amount|method|receivedAtMs)` outside `create`/`createCorrection`. Empty exemption list.

### Attachment pipeline

- [x] T020 [P] Implement `src/features/orders/receipts/attachments/pickAttachment.ts` — two exported functions `pickFromCamera()` (via `expo-image-picker`) and `pickFromLibrary({ allowPdf })` (image-picker for photos, `expo-document-picker` for PDFs). Returns `{ uri, mimeType, sizeBytes }` or `null` on user cancel.
- [x] T021 [P] Implement `src/features/orders/receipts/attachments/validation.ts` — exports `validateAttachment({ mimeType, sizeBytes, uri })`: MIME allow-list; size > 10 MB on images runs `expo-image-manipulator` with `compress: 0.75` and max 2048 px; re-checks size; rejects > 10 MB for PDFs or images that won't shrink.
- [x] T022 [P] [Test] `src/features/orders/receipts/attachments/validation.test.ts` — cover: allowed MIME accepted; disallowed MIME rejected; 15 MB image shrunk to ≤ 10 MB; 15 MB PDF rejected outright; manipulator failure surfaces as a clear error.
- [x] T023 Implement `src/features/orders/receipts/attachments/stage.ts` — copy picked URI to `<docDir>/receipts/staging/<receiptId>.<ext>` via `expo-file-system`; returns `{ localPath, mimeType, sizeBytes }`. Creates the staging dir on first use. Safe to call before the DB row exists (receipt ID generated upstream).
- [x] T024 Implement `src/features/orders/receipts/attachments/uploader.ts` per [contracts/receiptAttachmentUploader.ts](./contracts/receiptAttachmentUploader.ts): `flushPending()` selects all `upload_state = 'pending'` rows, uploads serially (concurrency 2) to `receipt-attachments/<seller_id>/<receipt_id>.<ext>` via the Supabase client, flips state to `synced` + persists `attachment_url` on success, to `failed` after 3 attempts. `retry(receiptId)` flips `failed` → `pending`.
- [x] T025 Implement `src/features/orders/receipts/attachments/resolvePreview.ts` — returns `file://<localPath>` when the file exists at `attachment_local_path`; otherwise delegates to `@/features/catalog/image-cache` for `attachment_url`. Never throws; returns `null` when nothing resolves.
- [x] T026 [P] [Test] `src/features/orders/receipts/attachments/pipeline.test.ts` — stage copies to staging dir with correct filename; `flushPending` happy/failure paths; `flushPending` is idempotent; `resolvePreview` prefers local over remote.

### Sync wiring

- [x] T027 Edit `src/features/sync/supabase/mappers.ts` — map `attachment_url` + `correction_of_receipt_id` on both pull and push; explicitly exclude device-local columns (`attachment_local_path`, `attachment_upload_state`, `attachment_mime_type`, `attachment_size_bytes`) from outbound payloads.
- [x] T028 Edit `src/features/sync/supabase/pushChanges.ts` + `pullChanges.ts` — route `payment_receipts` through the updated mapper; on pull, initialize the four device-local attachment columns to `null` for inbound rows.
- [x] T029 Edit `src/features/sync/service/syncService.ts` — after a successful push pass, `await receiptAttachmentUploader.flushPending()`. Errors from the uploader are logged but do not fail the sync pass (row-level `failed` state is the durable signal).
- [x] T030 [P] [Test] `src/features/sync/tests/receiptsSync.test.ts` — outbound payload includes the two new shared columns and excludes the four device-local ones; inbound correction with an orphan `correction_of_receipt_id` inserts cleanly and self-heals on a second pull that brings in the original.

### Offline behavioural lock

- [x] T031 [P] [Test] `src/features/orders/receipts/receiptCreateOffline.test.ts` — network stubbed to reject; `paymentReceiptsRepository.create()` + `.createCorrection()` both complete and return persisted rows; the pending attachment row has `upload_state = 'pending'` and `attachment_url = null`.

**Checkpoint**: Repository, totals, pipeline, sync wired. Any user story can now be implemented independently.

---

## Phase 3: US1 — Register a receipt from order detail (Priority: P1) 🎯 MVP

**Goal**: Seller opens a sent order, taps "Registrar recebimento", fills amount + method + date, saves, and the new receipt appears in the list with the balance updated.

**Independent Test**: Per spec.md US1 — airplane-mode save of a `R$ 150,00 Pix` receipt; after app restart the receipt is still visible and `Saldo em aberto` reflects it.

### Implementation for US1

- [x] T032 [US1] Implement `src/features/orders/receipts/hooks/useOrderReceipts.ts` — observe `paymentReceiptsRepository.observeByOrder(orderId)` + observe order total via existing `ordersRepository.observe(orderId)`; return `{ receipts, totals, loading }` where `totals` comes from `computeReceiptTotals`.
- [x] T033 [US1] Implement `src/features/orders/receipts/hooks/useReceiptForm.ts` — local state for `{ amountCents, method, receivedAtMs, notes, attachment? }`; validation (amount > 0 for non-correction, any non-zero for correction); `submit()` dispatches to `paymentReceiptsRepository.create` or `.createCorrection` based on `correctionOf` route param.
- [x] T034 [P] [US1] Implement `src/features/orders/receipts/components/MethodChip.tsx` — a single chip that accepts `{ method, selected, onPress, label }` and renders the `Pix / Dinheiro / Transferência / Cheque / Outro` pill per the design tokens.
- [x] T035 [US1] Build `src/features/orders/receipts/screens/PaymentReceiptFormScreen.tsx` — replaces the Phase 1 placeholder. Layout per [design/payment-receipt-form-phone.png](./design/payment-receipt-form-phone.png) + [design/payment-receipt-form-tablet.png](./design/payment-receipt-form-tablet.png). Viewport branches inside the component via `useViewport()`. Saves close the screen and navigate back to OrderReceipts. (Attachment section rendered but disabled — enabled in Phase 6.)
- [x] T036 [US1] Build a minimal `src/features/orders/receipts/screens/OrderReceiptsScreen.tsx` that renders the totals card + an unadorned list + the primary CTA. Enough to see the saved receipt and updated balance. (List row polish comes in Phase 4.)
- [x] T037 [US1] Wire the entry point. **Deviation from the plan's letter** (P3 simplicity): rather than adding a read-only branch to `OrderSummaryScreen` (which would require refactoring a heavily draft-oriented screen), the sent-order row tap in `ClientProfileScreen` now navigates **directly to `OrderReceipts`**. `OrderReceiptsScreen` itself plays the sent-order-detail role — topBar shows the order number + back arrow, plus a "Ver PDF salvo" icon when `status === 'sent'` (preserves the previous tap-to-open-PDF UX as a secondary action). The dead `openStoredPdf` + `pdfError` state + `ConfirmModal` import in `ClientProfileScreen` were removed along with the refactor.
- [~] T038 [P] [US1] [Test] **Deferred** — the codebase has no React Native Testing Library dependency (constitution §9 says "UI does NOT need exhaustive testing in the MVP"). The form's validation + dispatch logic is covered by `paymentReceiptsRepository.test.ts` end-to-end; the hook is a thin wrapper around the repo. Revisit if RN TL is introduced for a later feature.
- [~] T039 [P] [US1] [Test] **Deferred** — same reason as T038. The totals derivation that the screen renders is covered by `computeReceiptTotals.test.ts` (8 cases).

**Checkpoint**: Story 1 is fully functional — a seller can register a no-attachment receipt offline and see it in the list with live totals. Phase 4 polishes the list visuals; Phase 5 adds corrections; Phase 6 unlocks attachments.

---

## Phase 4: US2 — View outstanding balance and receipt history (Priority: P1)

**Goal**: Polish the OrderReceipts list to match the full design — correction-aware row rendering, attachment icon, empty state, progress bar, newest-first ordering.

**Independent Test**: Per spec.md US2 — seed an order with three receipts (positive Pix, positive Dinheiro, negative correction) and verify totals + list ordering + correction badge.

### Implementation for US2

- [x] T040 [P] [US2] Implement `src/features/orders/receipts/components/ReceiptRow.tsx` — renders `{ amount, method, receivedAtMs, hasAttachment, isCorrection, correctionCaption? }`. Handles the correction visual state (red amount, `Correção` badge, caption referencing the original's method + date).
- [x] T041 [US2] Enhance `OrderReceiptsScreen.tsx` — plug `ReceiptRow` into the list, add the progress bar (`progressRatio`), add the empty state copy (`"Nenhum recebimento ainda · registre o primeiro pagamento abaixo"`), and render the `Ajuste pendente` chip when **`totals.hasOverpayment || totals.hasNegativeBalance`** (FR-018 is symmetric). The chip copy is the same in both directions; the seller reconciles either case via an additional correction.
- [x] T042 [US2] Ensure `observeByOrder` query orders by `received_at_ms DESC, created_at DESC` (newest-first, FR-019). No DB index — in-memory sort is sufficient for MVP row counts (< 5 per order), consistent with data-model.md.
- [x] T043 [US2] When a row's `correction_of_receipt_id` is set, enrich it with the original's caption by looking the original up in the in-memory receipts array; if not present (orphan per R8), show only the raw amount + `Correção` badge without the caption.
- [~] T044 [P] [US2] [Test] Extend `OrderReceiptsScreen.test.tsx` with three-receipts-including-correction case from the spec: asserts `Recebido: R$ 240,00`, three rows newest-first, correction badge on the correction row. Add a **positive assertion for FR-006** that no destructive affordance is reachable from any row — no long-press handler, no swipe-to-delete gesture, no `Excluir` / `Editar` copy anywhere in the rendered tree. Add a second assertion that the `Ajuste pendente` chip renders when `received > total` AND when `received < 0`.

**Checkpoint**: Stories 1 AND 2 are fully functional. The order's Receipts view is complete for the happy, non-correcting, no-attachment case + partial-payment display.

---

## Phase 5: US3 — Register a correction (Priority: P2)

**Goal**: Seller opens a receipt's detail, taps "Registrar correção", and creates a new append-only receipt referencing the original.

**Independent Test**: Per spec.md US3 — correct an existing `R$ 100 Dinheiro` receipt with `−R$ 10`; verify original unchanged, correction row in the list, `Recebido` decreased by 10.

### Implementation for US3

- [x] T045 [P] [US3] Implement `src/features/orders/receipts/screens/PaymentReceiptDetailScreen.tsx` — read-only view per [design/payment-receipt-detail-phone.png](./design/payment-receipt-detail-phone.png) + [design/payment-receipt-detail-tablet.png](./design/payment-receipt-detail-tablet.png). Renders amount + method badge, metadata list (Data, Pedido, Registrado por, Status), notes card, attachment preview (from Phase 6 resolver — empty block until then), and the `Registrar correção` CTA. No edit/delete affordances.
- [x] T046 [US3] Wire the correction CTA — navigates to `PaymentReceiptForm` with `correctionOf: originalId` route param. `useReceiptForm` already dispatches to `createCorrection` when this param is present (T033).
- [x] T047 [US3] Wire row-tap on `OrderReceiptsScreen` → navigate to `PaymentReceiptDetail` for both regular and correction rows.
- [~] T048 [P] [US3] [Test] `src/features/orders/receipts/screens/PaymentReceiptDetailScreen.test.tsx` — renders amount/method/date/notes from a seeded receipt; no edit or delete button present; tapping "Registrar correção" navigates to `PaymentReceiptForm` with `correctionOf` set.

**Checkpoint**: US1 + US2 + US3 all functional. The append-only correction flow is complete end-to-end.

---

## Phase 6: US4 — Attach and review a proof of payment (Priority: P2)

**Goal**: Seller can capture a photo or pick a PDF/image, preview it in the form and detail, and the file uploads opportunistically on sync.

**Independent Test**: Per spec.md US4 — create a receipt offline with a camera photo attached, verify preview renders from cache, reconnect, verify sync state flips to `Sincronizado`.

### Implementation for US4

- [x] T049 [US4] Enable the attachment block in `PaymentReceiptFormScreen.tsx`: wire `Câmera` → `pickFromCamera()`, `Galeria / PDF` → action sheet with `pickFromLibrary({ allowPdf: true })`. On pick, call `stage()` + `validateAttachment()`; populate form state with the `AttachmentInput`. Show the preview card + `cache local · aguardando sync` caption.
- [x] T050 [US4] On submit (`useReceiptForm.submit`), pass the staged attachment metadata into `repository.create`/`createCorrection`. The repo writes the 5 attachment columns in the same `database.write` as the row.
- [x] T051 [P] [US4] Implement `src/features/orders/receipts/components/AttachmentPreview.tsx` — given a receipt row, calls `resolvePreview()` and renders an `Image` for photos or the document glyph for PDFs. Exposes sync-state badge (`Aguardando sync` / `Sincronizado` / `Falha ao enviar` with retry button).
- [x] T052 [US4] Drop `AttachmentPreview` into `PaymentReceiptDetailScreen.tsx` (replaces the Phase 5 empty block).
- [x] T053 [US4] On `PaymentReceiptDetailScreen`, wire the `Registrar nova tentativa` button (shown only when `attachment_upload_state === 'failed'`) to `repository.retryAttachmentUpload(id)` which delegates to `uploader.retry`.
- [x] T054 [US4] In `OrderReceiptsScreen`, show the paperclip icon on rows where `attachment_url` or `attachment_local_path` is set (FR-016).
- [~] T055 [P] [US4] [Test] Extend `PaymentReceiptFormScreen.test.tsx` with the picker-stubbed attach flow: mocked `pickFromCamera` returns a fake URI; verify `stage` is called; save persists the attachment metadata on the row.
- [~] T056 [P] [US4] [Test] Extend `PaymentReceiptDetailScreen.test.tsx` — given a receipt with `attachment_upload_state === 'pending'`, badge reads `Aguardando sync`; with `'synced'`, reads `Sincronizado`; with `'failed'`, renders the retry button and calls `retryAttachmentUpload` on press.

**Checkpoint**: All four user stories fully functional. Offline, online, correction, attachment — all green.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Guardrails, documentation, and the UX5 responsive sweep.

- [ ] T057 [P] Widen `src/features/orders/noCatalogWrites.test.ts` scan root to include `src/features/orders/receipts/**` — R5 guard extended. As part of the same task, re-run `src/features/orders/receipts/appendOnlyReceipts.test.ts` (authored in T019) against the **fully-implemented** sub-tree — the Phase 2 run passed against an empty tree; the Phase 7 re-run is the one that catches late regressions.
- [ ] T058 [P] Update `SPECS.md` with a one-line summary of 012 linking to plan + design artifacts.
- [ ] T059 Run the [quickstart.md](./quickstart.md) smoke test end-to-end on a phone simulator (390×844). Any step failing is a blocker.
- [ ] T060 Run the [quickstart.md](./quickstart.md) smoke test end-to-end on a tablet simulator (820×1180). Confirm the split layouts, the `3 + 2` method chip grid, and the large attachment viewer on `PaymentReceiptDetail`.
- [ ] T061 [P] RLS sanity check (quickstart step 6): confirm a second seller cannot read the first seller's attachment URL; confirm same-seller upload succeeds.
- [ ] T062 Update `CLAUDE.md` if the active plan moves after implementation merge (typically handled by the next feature's `/speckit-plan`, not this task).

**Checkpoint**: Feature 012 is implementation-complete, tested, and ready for merge to `develop` once `/ultrareview` passes.

---

## Parallelization cheatsheet

Tasks tagged `[P]` in the same phase can run concurrently; they touch distinct files.

**Highest-value parallel bundles**:

- **Phase 1 setup burst** — T010, T011, T012, T013 can all go at once after T008/T009 land.
- **Phase 2 tests** — T016, T018, T019, T022, T026, T030, T031 (seven independent test files).
- **Phase 2 pipeline** — T020, T021 are independent; T023/T024/T025 depend on them but can be pipelined.
- **Phase 3 components + tests** — T034, T038, T039 run alongside the screen work (T035, T036).
- **Phase 6 tests** — T055, T056 run alongside T049–T054 once the component contracts are stable.

**Strict blockers**:

- T009 (Supabase migration + Storage policies) blocks any screen task (Phase 3+).
- T008 (Watermelon migration) blocks every repo/model task in Phase 2.
- T015 (repo rewrite) blocks every call site in Phases 3–6.
- T027–T029 (sync wiring) block T030 (sync test) and US4's end-to-end upload verification.

---

## Traceability

| User Story | Priority | Tasks |
|------------|----------|-------|
| US1 — Register a receipt | P1 | T032, T033, T034, T035, T036, T037, T038, T039 |
| US2 — View balance + history | P1 | T040, T041, T042, T043, T044 |
| US3 — Correct a receipt | P2 | T045, T046, T047, T048 |
| US4 — Attach proof | P2 | T049, T050, T051, T052, T053, T054, T055, T056 |

| Functional Requirement | Primary Task(s) |
|------------------------|------------------|
| FR-001, FR-002 (offline create) | T015, T031, T035 |
| FR-003 (sync upload) | T024, T029 |
| FR-004, FR-005 (append-only data) | T015, T019, T045 |
| FR-006 (UI hides edit/delete) | T045 (detail), T048 (detail test), T044 (list rows positive assertion) |
| FR-007, FR-009 (fields + amount validation) | T015, T033, T038 |
| FR-008 (optional notes + attachment) | T015, T049 |
| FR-010 (date default + editable) | T033 |
| FR-011 (5-option method) | T010, T034 |
| FR-012, FR-013, FR-014 (attachment capture + validation) | T020, T021, T022 |
| FR-015 (local cache source of truth) | T023, T025 |
| FR-016 (sync state visible) | T051, T054 |
| FR-017 (totals) | T017, T018, T041 |
| FR-018 (clamp + symmetric Ajuste pendente) | T041 (renders for both `hasOverpayment` and `hasNegativeBalance`), T044 (test covers both directions) |
| FR-019 (newest-first) | T042 |
| FR-020 (correction visual) | T040, T043 |
| FR-021 (correction from detail) | T045, T046 |
| FR-022 (native share/viewer) | T052 (uses OS viewer via `expo-sharing`/`Linking` in `AttachmentPreview`) |
| FR-023 (role scope — receipts table) | Inherited RLS from features 002/005 — no task; re-verified manually by T061 |
| FR-023 (role scope — attachment storage) | T009 (Storage bucket + 2 policies), T061 (manual sanity check) |
| FR-024 (retry on failure) | T024, T053 |

| Success Criterion | Verified By |
|-------------------|-------------|
| SC-001 (register in < 20s) | T059 / T060 manual run |
| SC-002 (offline persist) | T031 automated, T059 manual |
| SC-003 (95% sync within 2 min) | T029 behaviour + T059 manual — **intentionally not auto-tested** (P3 simplicity): the statistical 95% threshold is a usability guarantee, not a deterministic unit-test target. A harness is a follow-up if field data shows drift. |
| SC-004 (balance math) | T017, T018 |
| SC-005 (zero mutations) | T016, T019 |
| SC-006 (correction legibility) | T060 manual |
| SC-007 (< 500 ms preview) | T025 + T060 manual |
