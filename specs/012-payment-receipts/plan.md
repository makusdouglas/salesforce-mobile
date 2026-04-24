# Implementation Plan: Payment Receipts

**Branch**: `012-payment-receipts` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-payment-receipts/spec.md`

## Summary

Deliver constitution R3 + R2's `payment_receipts` entity end-to-end: the seller opens a sent order's Receipts view, registers a receipt (amount, method, date, optional notes, optional photo/PDF), and sees the order's balance update instantly. Everything happens **offline-first** — creation never blocks on network, attachments cache via `expo-file-system`, and a new opportunistic uploader flushes them to Supabase Storage on the next sync (same *philosophy* as R3 but on the upload direction, which is net-new to the app). Corrections are a separate write path that creates a new receipt referencing the original — no existing receipt is ever mutated.

**Schema is already half-built.** `src/data/models/PaymentReceipt.ts` + the `payment_receipts` table exist from the original skeleton (feature 002). This plan widens them with (a) a self-FK `correction_of_receipt_id`, (b) an attachment block (`attachment_local_path`, `attachment_mime_type`, `attachment_size_bytes`, `attachment_upload_state`), (c) renames the method enum entry `card` → `check` (FR-011) via a one-shot migration, and (d) removes the `update()` and `softDelete()` surfaces from `paymentReceiptsRepository` — append-only is enforced at the repo boundary, not just by convention.

**Three screens, six frames.** All six Pencil frames (`OrderReceipts / {Phone,Tablet}`, `PaymentReceiptForm / {Phone,Tablet}`, `PaymentReceiptDetail / {Phone,Tablet}`) were produced by `/speckit-pencil-design` on 2026-04-23 and are the primordial UI source. A new sub-tree `src/features/orders/receipts/` hosts the screens, the form hook, the totals selector, and the attachment pipeline. Navigation extends the existing `OrdersStack` with three new routes: `OrderReceipts`, `PaymentReceiptForm`, `PaymentReceiptDetail`.

**Entry point: existing `OrderSummaryScreen` in sent mode.** No new "OrderDetailScreen" is introduced — that would violate UX5 by shipping an undesigned screen. Instead, this feature extends the sent-state branch of `OrderSummaryScreen` (the screen already renders a `statusNote` block when `order.status === 'sent'` — see `src/features/orders/screens/OrderSummaryScreen.tsx:251`) with a `Recebimentos` action alongside the existing `Ver PDF salvo` CTA from 011. The path into the sent-state summary is `ClientProfileScreen` order-history row tap, which today calls `openStoredPdf(row.id)` directly; this feature rewires the row's primary tap to `navigation.navigate('Orders', { screen: 'OrderSummary', params: { orderId } })`, preserving the existing PDF button as a per-row shortcut for UX2 (fast reprint without entering the detail).

**One new subsystem — `receiptAttachments/`.** This is the first time the seller-side of the app *uploads* a file to Supabase Storage (R3 has only covered download-and-cache of catalog photos). The pipeline is minimal: (1) `pickFromCamera()` / `pickFromLibrary()` via `expo-image-picker` + `expo-document-picker`, (2) `stage(file)` copies the picked URI to `<documentDir>/receipts/staging/<id>.<ext>` and records metadata, (3) `uploadPending()` runs inside the existing sync push pass, streams the staged file to Storage bucket `receipt-attachments/<seller_id>/<receipt_id>.<ext>`, flips `attachment_upload_state` from `pending` to `synced`, and persists the returned public URL. Preview rendering prefers the local staging path; on cache eviction after sync, it falls back to the returned URL via the existing catalog `image-cache` module (read path is re-usable; write path is net-new).

**Totals are a pure selector.** `computeReceiptTotals(order, receipts)` returns `{ total, received, outstanding, hasOverpayment }` with `outstanding = max(total - received, 0)` and `hasOverpayment = received > total`. Corrections participate as regular receipts (their amount can be negative), so the selector is a straight sum. The UI reads the same selector on all three screens; the "ajuste pendente" indicator (FR-018) is just `hasOverpayment === true`.

**Correction is a separate repository method, not a flag.** `createCorrection({ originalId, amount, method, date, notes?, attachment? })` writes a new row with `correction_of_receipt_id = originalId`. The UI surfaces correction affordances only from a receipt's detail view (FR-021). Nowhere in the code can an existing receipt's `amount`, `method`, or `received_at_ms` be mutated — enforced by (a) the repo's absent `update()`, (b) a static test `appendOnlyReceipts.test.ts` that scans the receipts sub-tree for forbidden mutation patterns, (c) the sync engine's pull path which already uses `create-or-skip-by-id` semantics (no existing-row mutations except for the non-business sync columns).

**Sync engine integration is additive.** `pushChanges` already walks `payment_receipts`; it now additionally includes the four new attachment columns plus `correction_of_receipt_id` in the outbound payload and, after a successful row push, calls `receiptAttachmentUploader.flushPending()` to stream any staged files. `pullChanges` learns the new columns via its existing generic mapper; no conflict resolution work is needed because receipts are append-only (no two-device race can produce diverging mutations on the same row).

**Responsive strategy.** Same `useViewport()` hook + 768pt threshold as 008–011. All three new screens render identical logical content with viewport-conditional layout branches inside each component — vertical stack on phone, two-column split on tablet. The capture form's method chips are `3 + 2` on phone and `3 + 2` on tablet (confirmed during design — `5-in-a-row` was visibly cramped in the tablet left column at 320pt).

## Technical Context

**Language/Version**: TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (inherited from 001–011).

**Primary Dependencies**:

- `@nozbe/watermelondb` — reused. One migration that adds five columns to `payment_receipts` and rewrites the `method` enum sentinel.
- `@supabase/supabase-js` — reused. New Storage bucket `receipt-attachments` (private; RLS on).
- `@react-navigation/native-stack` — reused. Adds three new routes to `OrdersStack`: `OrderReceipts`, `PaymentReceiptForm`, `PaymentReceiptDetail`.
- `expo-file-system` — reused. Staging directory `<documentDir>/receipts/staging/` parallels 011's `orders/` directory.
- **NEW — `expo-image-picker`**. Constitution §3 lists it under "Required for admin features" for the admin photo surface (013); this is the first **seller-side** use. One-line justification under Constitution Check.
- **NEW — `expo-document-picker`**. Picks PDFs from the file library — the image picker does not cover PDFs natively on iOS. Expo SDK module, no native additions beyond the existing dev-client build.
- **NEW — `expo-image-manipulator`**. Constitution §3 pairs this with `expo-image-picker`; we use it only to shrink images > 10 MB down to the size cap (FR-014) rather than rejecting them outright — a better UX for on-device captures.
- `@/features/catalog/image-cache` — reused **for the read path only**. The existing download + cache helpers resolve remote URLs of *already-synced* attachments. The upload path is new and lives under `src/features/orders/receipts/attachments/`.
- `@/features/sync/service/syncService` — EDIT: inside `pushPayload`, after the `payment_receipts` rows are accepted by Supabase, invoke `receiptAttachmentUploader.flushPending()`. Additive; no restructuring.
- `@/data/repositories/paymentReceiptsRepository` — EDIT: delete `update()` and `softDelete()`. Add `createCorrection()`. Extend `create()` input with optional attachment metadata.
- **No new Supabase Edge Function. No `service_role` usage from the client.**

**Storage**:

- **Schema migration** (`0012_payment_receipts.sql` — one file, one version bump):
  - `payment_receipts` adds: `correction_of_receipt_id TEXT NULL` (FK to self, indexed), `attachment_local_path TEXT NULL`, `attachment_mime_type TEXT NULL`, `attachment_size_bytes INTEGER NULL`, `attachment_upload_state TEXT NULL CHECK (attachment_upload_state IN ('pending','synced','failed') OR attachment_upload_state IS NULL)`.
  - `payment_receipts.image_url` is renamed to `attachment_url` to reflect that the value may now also be a PDF URL.
  - The method enum sentinel `card` is rewritten to `check` across existing rows (dev-fixture data only; MVP has no production rows yet).
  - WatermelonDB schema version bumps from N → N+1; migration is `addColumns` + `renameColumn` + an app-side data fixup pass that runs in the first `database.write(...)` after version change.
- **Supabase-side** (same migration):
  - Mirror column additions + rename + method fixup on the Postgres `payment_receipts` table.
  - `receipt-attachments` Storage bucket created (`PRIVATE`, RLS enabled):
    - Path convention: `receipt-attachments/<seller_id>/<receipt_id>.<ext>`.
    - **Policies** (two): (a) `SELECT` allowed when `auth.uid()` owns the receipt via the parent order's `seller_id`; (b) `INSERT` allowed under the same ownership check. `UPDATE` and `DELETE` are not permitted (append-only parity with the row itself).
  - `attachment_upload_state` + `attachment_local_path` are **device-local columns**. The sync engine excludes them from the outbound `payment_receipts` payload (same pattern as 011's `pdf_path`).
- **Receipt ID** is a ULID generated locally at create time (same `generateId()` as the rest of the repos), so the Storage path is knowable before the upload succeeds.

**Testing** (constitution §9 — business-logic first):

1. **`paymentReceiptsRepository.test.ts`** — append-only contract.
   - `create()` inserts a row with default `received_at_ms = Date.now()` when omitted; rejects `amount <= 0`; rejects unknown methods.
   - `createCorrection({ originalId, amount: -10, method: 'cash' })` persists a row with `correction_of_receipt_id = originalId`; the original row is untouched (field-by-field equality check before and after).
   - There is no `update()` or `softDelete()` export (compile-time guarantee is TypeScript + a positive assertion in the test that those keys do not exist on the repo module).
   - Negative amounts are only accepted via `createCorrection` (`create()` rejects negative as validation error).

2. **`computeReceiptTotals.test.ts`** — pure selector.
   - Single receipt: `received = amount`, `outstanding = max(total - amount, 0)`.
   - Multiple receipts including a negative correction: sum is the signed sum.
   - Overpayment: `received > total` ⇒ `outstanding = 0` AND `hasOverpayment = true`.
   - Empty list: `received = 0`, `outstanding = total`, `hasOverpayment = false`.

3. **`appendOnlyReceipts.test.ts`** — static scan.
   - Walks `src/features/orders/receipts/**` and `src/data/repositories/paymentReceiptsRepository.ts` and fails if any file contains: `\\.update\\(`, `\\.markAsDeleted\\(`, `\\.destroyPermanently\\(`, or `receipt\\.(amount|method|receivedAtMs)\\s*=` (direct assignment to immutable fields after create).
   - Exemption list is empty by design. If a future feature legitimately needs to update a receipt, this test and the repo must change together.

4. **`receiptAttachmentPipeline.test.ts`** — staging + upload semantics.
   - `stage(pickedUri)` copies the file to `<documentDir>/receipts/staging/<receipt_id>.<ext>`, records `local_path`, `mime`, `size`, and sets `upload_state = 'pending'`. The original URI is not touched (picker-owned).
   - `flushPending()` selects rows with `upload_state = 'pending'`, calls the Storage upload mock, flips to `'synced'` on success and persists `attachment_url`; flips to `'failed'` after N retry exhaustion (N=3 attempts, exponential backoff, same budget as the rest of the sync engine).
   - `flushPending()` is idempotent: a row already in `'synced'` is skipped; a `'failed'` row is retried only when explicitly re-queued via `retryUpload(receiptId)`.
   - Preview resolver prefers `attachment_local_path` if the file exists at that path; otherwise routes through the catalog image-cache for `attachment_url`.

5. **`receiptAttachmentValidation.test.ts`** — size & MIME gates.
   - Images > 10 MB go through `expo-image-manipulator` to a lower quality and are accepted; PDFs > 10 MB are rejected (manipulator does not re-encode PDFs).
   - MIME allow-list: `image/jpeg`, `image/png`, `image/heic`, `application/pdf`. Everything else surfaces an inline error message (FR-013).

6. **`receiptsSync.test.ts`** — push/pull contract with the new columns.
   - Push: outbound payload for a receipt includes `correction_of_receipt_id` and `attachment_url` but **excludes** `attachment_local_path`, `attachment_upload_state`, `attachment_size_bytes`, `attachment_mime_type` (device-local).
   - Pull: incoming receipts with `correction_of_receipt_id` are inserted with the reference intact; a correction whose original has not yet arrived is kept in an "orphan" state and visually shows the raw amount + "Correção" badge without the original-receipt caption until the original syncs in.

7. **Screen smoke** (React Native Testing Library):
   - `OrderReceiptsScreen.test.tsx`: given a seeded order with three receipts (one positive Pix, one positive cash, one negative correction), renders totals, progress bar, and three rows in the right order; correction row has the "Correção" badge and caption.
   - `PaymentReceiptFormScreen.test.tsx`: amount validation surfaces inline error on `0`; save with valid inputs closes the screen and enqueues the receipt; attachment pick flow is stubbed at the picker boundary.
   - `PaymentReceiptDetailScreen.test.tsx`: renders amount, method, date, notes, attachment preview (from local cache); tapping "Registrar correção" navigates to the form with the `originalId` param; absence of edit/delete buttons is asserted.

8. **Static guards extended**:
   - `noCatalogWrites.test.ts` (from 010/011) adds `src/features/orders/receipts/**` to its scan root — the receipts feature must never write to products or variants.
   - No `noNetworkOnReceiptCreate.test.ts` equivalent of 011's: the create path legitimately touches the attachment-staging file APIs and the *sync engine* (which may upload). The offline guarantee is instead expressed as a behavioural test — `receiptCreateOffline.test.ts` airplane-mode mocks the network and asserts that `create()` completes and returns a persisted row.

UI verification is manual against all six Pencil frames on both viewports, covering the four user stories (register, view balance, correct, attach).

**Target Platform**: iOS 13+ and Android 7+ (inherited). `expo-image-picker` + `expo-document-picker` + `expo-image-manipulator` all run in the existing dev-client build with no additional native work.

**Project Type**: Mobile app — feature-module extension under `src/features/orders/receipts/` parallel to `src/features/orders/send/` (011). One Supabase-side migration (schema + Storage bucket + policies).

**Performance Goals**:

- **SC-001 (< 20 s register a no-attachment receipt)**: form has three tap-only fields (method segmented control, date row, "Registrar" CTA) plus the amount keyboard input. Realistic budget: 4 s form open, 10 s type+pick, 2 s save, 2 s list refresh. Well under 20 s.
- **SC-007 (< 500 ms attachment preview on detail open, warm cache)**: preview resolver reads `attachment_local_path` directly (no IPC). `FileSystem.getInfoAsync` + `Image` render on a warm cache is ~50 ms. Trivially under 500 ms.
- Uploads are not user-facing; they run inside the sync push without a blocking spinner.

**Constraints**:

- **Offline-first (P1)**: creation + listing + detail + correction all run fully offline. Only the `flushPending()` step needs network, and it lives inside the sync engine — a send-path-style `noNetworkOnReceiptCreate.test.ts` is replaced by a behavioural test that runs the create path with the network stubbed to reject. Pass.
- **R3 — images live in Storage with local cache**: the *read* side reuses `@/features/catalog/image-cache`; the *write* side is a new minimal staging+upload pipeline that materializes the same outcome (remote authoritative URL + local cache available offline). The constitution language "local cache via expo-file-system ensures offline access" is satisfied by the staging path being both the capture destination and the preview source.
- **R1 WatermelonDB as the seller data layer**: all writes go through `database.write(...)`. No receipt component reads Supabase directly.
- **R2 seven entities**: `payment_receipts` is already part of R2; this plan widens columns, not entities.
- **D1 sync pull then push**: receipts always participate in the standard cycle; the new upload step is inside push, after row acceptance, so a failed upload does not hold up other rows.
- **D4 order statuses unchanged**: receipts do not alter order status. An order stays `sent` regardless of receipt balance.
- **UX5 phone + tablet**: six frames shipped, responsive strategy documented above.
- **UX6 dual-role visibility / D7 role-based authorization**: seller-only surfaces. No new RLS policies on the table itself (receipts already follow the parent order's ownership rule via existing RLS from 002/005). **New** RLS: the two Storage policies on the `receipt-attachments` bucket — recorded in the Role & Authorization Check below.
- **§9 English in code / Portuguese in UI**: identifiers, file names, error classes, and log keys English; all screen copy + inline errors Portuguese, centralized per screen.

**Scale/Scope**:

- **New files (~14)**: `src/features/orders/receipts/screens/OrderReceiptsScreen.tsx`, `.../PaymentReceiptFormScreen.tsx`, `.../PaymentReceiptDetailScreen.tsx`; `.../hooks/useOrderReceipts.ts`, `.../hooks/useReceiptForm.ts`; `.../totals/computeReceiptTotals.ts` + `.test.ts`; `.../attachments/pickAttachment.ts`, `.../attachments/stage.ts`, `.../attachments/uploader.ts`, `.../attachments/resolvePreview.ts`, `.../attachments/validation.ts`, `.../attachments/pipeline.test.ts`, `.../attachments/validation.test.ts`; `.../appendOnlyReceipts.test.ts`.
- **Existing files edited (~8)**: `src/data/repositories/paymentReceiptsRepository.ts` (remove update/softDelete, add createCorrection, extend create), `src/data/models/PaymentReceipt.ts` (new fields + renamed image_url → attachment_url), `src/data/types.ts` (PaymentMethod enum: `card` → `check`), `src/data/schema/tables.ts` (+ 5 columns, rename), `src/data/schema/migrations.ts` (+ migration entry), `src/features/sync/supabase/pushChanges.ts` (+ new columns), `src/features/sync/supabase/pullChanges.ts` (+ new columns), `src/features/sync/service/syncService.ts` (+ `flushPending()` call), `src/app/navigation/OrdersStack.tsx` (+ 3 routes), `src/app/navigation/types.ts` (+ route params).
- **DB migrations**: **1 Watermelon** (`0012_payment_receipts`) + **1 Supabase** (SQL: column additions, rename, enum fixup, bucket creation, 2 Storage policies).
- **0 new Supabase Edge Functions. 2 new Storage RLS policies.**

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | Create / view / correct paths are zero-network. Uploads are deferred to the sync push. Behavioural test `receiptCreateOffline.test.ts` locks it. |
| P2 Local DB is source of truth | ✅ | Pass | Receipt writes hit WatermelonDB first; upload + URL assignment happen during push. |
| P3 MVP simplicity | ✅ | Pass | One migration, one Storage bucket, three expo modules (all Expo-managed), one new sub-tree. Totals are a pure selector; correction is a repository method; append-only is a repo-boundary rule (not a runtime guard). |
| P4 Reuse free tools | ✅ | Pass | Uploads go straight to Supabase Storage via the SDK — no third-party upload infra. |
| P5 Salesperson data is sacred | ✅ | Pass | Receipts persist locally before any network attempt. Attachment staging copy is made at stage time, so a picker-owned temporary URI disappearing does not cost data. |
| P6 Admin is online-first | N/A | — | Seller-only feature. |
| §3 Mandatory — Expo managed + dev client | ✅ | Pass | Three new expo modules, all running in the existing dev client. |
| §3 Mandatory — WatermelonDB | ✅ | Pass | All seller-side writes via Watermelon. |
| §3 Mandatory — Supabase | ✅ | Pass | Schema migration + Storage bucket + 2 RLS policies. |
| §3 Mandatory — **`expo-image-picker`** | ✅ | **First seller-side use** | Constitution §3 lists it under admin-features; justified for sellers here as the only in-process path to the device camera and photo library. |
| §3 Mandatory — **`expo-image-manipulator`** | ✅ | Pass | Shrinks images exceeding 10 MB before upload (FR-014) — a better UX than a hard reject. |
| §3 Mandatory — **`expo-document-picker`** (new) | ✅ | Pass with one-line justification | Picks PDFs from the OS file library — the image picker does not cover PDFs on iOS. Expo SDK module, no native additions. |
| §3 Forbidden — custom backend / Firebase / heavy state mgmt / heavy UI libs | ✅ | Pass | None introduced. |
| R1 WatermelonDB is the single data layer (VENDEDOR) | ✅ | Pass | Repository gates all writes. Sync engine owns the only direct Supabase interaction. |
| R2 Seven entities | ✅ | Pass | `payment_receipts` is already listed. Column additions are widening, not a new entity. |
| **R3 Images in Storage with local cache** | ✅ | **Central invariant** | Read path reuses catalog `image-cache`. Write path is new but follows the same philosophy: local file is the staging + preview source, Storage is the authoritative remote. |
| R4 PDF local, email via system client | N/A | — | No PDF generation in this feature. |
| R5 Discounts on order + order_item, never on product | ✅ | Pass | Receipts do not touch catalog or pricing. Widened `noCatalogWrites.test.ts` scan. |
| UX1 Tap, not type | ✅ | Pass | Method is a 5-chip segmented control; date is a picker row; attachment is a two-button chooser. Only amount and optional notes are typed. |
| UX2 Repeat previous order is first-class | N/A | — | Shipped in 010. |
| UX3 Useful empty states | ✅ | Pass | Empty receipts list shows the primary CTA directly (FR-002 in US2 acceptance); form with no attachment shows the two capture entry points prominently. |
| UX4 Sync feedback discreet | ✅ | Pass | Attachment sync state surfaces in the receipt detail as a small badge; failed uploads offer a manual retry inside the detail view — no modals. |
| UX5 Layouts serve phone and tablet | ✅ | Pass | Six frames shipped: `OrderReceipts`, `PaymentReceiptForm`, `PaymentReceiptDetail` × phone + tablet. Responsive strategy documented in Structure Decision. |
| UX6 Dual-role visibility | N/A | — | Seller surfaces only. |
| D1 Sync pull then push | ✅ | Pass | Receipts use the existing cycle; the `flushPending()` upload step runs after successful row push. |
| D2 Catalog read-only for VENDEDOR | ✅ | Pass | Feature never writes catalog tables. |
| D4 Orders use simple local statuses | ✅ | Pass | Receipts do not alter order status. |
| D5 / D6 Auth + biometric | N/A | — | No auth-surface change. |
| D7 Role-based authorization | ⚠️ partial | Pass with notes | No new policies on `payment_receipts` itself (existing order-ownership RLS already covers it). **Two new** Storage policies on the `receipt-attachments` bucket — declared in the Role & Authorization Check below. |
| §9 English in code / Portuguese in copy | ✅ | Pass | Services, hooks, types, errors in English; form copy, method labels, date formatting, and error messages in Portuguese, centralized per screen. |

**Gate result: PASS.** No Complexity Tracking entries required.

## Role & Authorization Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Does this feature expose or touch role-guarded surfaces?** Yes — it adds two Storage RLS policies on the new `receipt-attachments` bucket.

| Check | Value / Status | Notes |
|-------|----------------|-------|
| Roles affected | `seller` | Admins inherit via dual-role rule (UX6) but no admin-specific screen exists. |
| New or modified RLS policies (per table) | 2 policies on Storage bucket `receipt-attachments` — `receipts_attachments_read`, `receipts_attachments_insert` | Migration file: `supabase/migrations/0012_payment_receipts.sql`. Both policies check that `auth.uid()` matches the `seller_id` on the parent order, via a sub-select that joins `payment_receipts → orders`. No UPDATE or DELETE policy — Storage objects are append-only by omission. |
| Edge Functions introduced (service_role usage) | none | Storage writes go directly through the user-scoped Supabase client; no elevation needed. |
| Offline classification per P6 | offline-first | Creation, listing, detail, and correction all work offline. Only attachment upload needs network, and it is deferred to sync. |
| Client-side affordance visibility rule (UX6) | Sellers see all receipt affordances on any order they own; admins with the seller role (dual-role) see the same; admins without the seller role never reach the OrdersStack where these screens live. | Consistent with the constitution's default — the feature introduces no new visibility branches. |
| Dual-role user impact | None specific. A dual-role user sees the receipts view on any order they authored. | |

## Design Prerequisite

*GATE: Must pass before any implementation task is generated.*

**Does this feature have a UI?** Yes.

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | Spec §"UI Design" lists 6 screens (3 × 2 viewports). |
| `design/screens.md` exists | ✅ | [specs/012-payment-receipts/design/screens.md](./design/screens.md) |
| Phone frames cover all screens | ✅ | `OrderReceipts / Phone` (`OhaXW`), `PaymentReceiptForm / Phone` (`xFdWB`), `PaymentReceiptDetail / Phone` (`dPZom`) |
| Tablet frames cover all screens | ✅ | `OrderReceipts / Tablet` (`M71E2`), `PaymentReceiptForm / Tablet` (`qmurF`), `PaymentReceiptDetail / Tablet` (`bfEgo`) |
| Responsive strategy documented below | ✅ | `useViewport()` hook + 768pt threshold; per-screen layout branches inside the same component file; method chips laid out `3 + 2` on both viewports (5-in-a-row was visibly cramped on tablet at 320pt left column and was fixed during design). |

**`design.json` path**: [specs/012-payment-receipts/design.json](./design.json)

## Project Structure

### Documentation (this feature)

```text
specs/012-payment-receipts/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── paymentReceiptsRepository.ts
│   ├── receiptAttachmentUploader.ts
│   └── computeReceiptTotals.ts
├── design/              # from /speckit-pencil-design
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── navigation/
│       ├── OrdersStack.tsx              # EDIT: +3 routes
│       └── types.ts                     # EDIT: +3 route param types
├── data/
│   ├── models/
│   │   └── PaymentReceipt.ts            # EDIT: rename image_url → attachment_url; add 5 fields
│   ├── repositories/
│   │   └── paymentReceiptsRepository.ts # EDIT: remove update/softDelete; add createCorrection; extend create
│   ├── schema/
│   │   ├── tables.ts                    # EDIT: +5 columns on payment_receipts; enum sentinel fixup
│   │   └── migrations.ts                # EDIT: + 0012 migration
│   └── types.ts                         # EDIT: PaymentMethod enum: card → check
├── features/
│   ├── orders/
│   │   └── receipts/                    # NEW sub-tree
│   │       ├── screens/
│   │       │   ├── OrderReceiptsScreen.tsx
│   │       │   ├── PaymentReceiptFormScreen.tsx
│   │       │   └── PaymentReceiptDetailScreen.tsx
│   │       ├── hooks/
│   │       │   ├── useOrderReceipts.ts
│   │       │   └── useReceiptForm.ts
│   │       ├── totals/
│   │       │   ├── computeReceiptTotals.ts
│   │       │   └── computeReceiptTotals.test.ts
│   │       ├── attachments/
│   │       │   ├── pickAttachment.ts     # camera + gallery + document pickers
│   │       │   ├── stage.ts              # copy picked URI to <docDir>/receipts/staging/
│   │       │   ├── uploader.ts           # flushPending() + retryUpload()
│   │       │   ├── resolvePreview.ts     # local path first, URL fallback via catalog image-cache
│   │       │   ├── validation.ts         # MIME + size gates; invokes expo-image-manipulator for > 10 MB images
│   │       │   ├── pipeline.test.ts
│   │       │   └── validation.test.ts
│   │       ├── components/
│   │       │   ├── MethodChip.tsx
│   │       │   ├── ReceiptRow.tsx
│   │       │   └── AttachmentPreview.tsx
│   │       └── appendOnlyReceipts.test.ts
│   └── sync/
│       ├── service/
│       │   └── syncService.ts           # EDIT: call uploader.flushPending() after push accept
│       └── supabase/
│           ├── pushChanges.ts           # EDIT: include new columns (exclude device-local)
│           ├── pullChanges.ts           # EDIT: map new columns
│           └── mappers.ts               # EDIT: method enum + attachment fields
└── noCatalogWrites.test.ts              # EDIT: widen scan root to include receipts/

supabase/
└── migrations/
    └── 0012_payment_receipts.sql        # NEW: DDL + bucket + 2 Storage policies
```

**Structure Decision**: Feature-module layout under `src/features/orders/receipts/`, parallel to `src/features/orders/send/` (011). All three screens import the same `useViewport()` hook from `src/features/catalog/responsive/` and branch layout locally; no separate tablet-only components. The attachment pipeline is its own folder so it can be unit-tested as a self-contained module — the sync engine only imports its public `flushPending()` and `retryUpload()` functions. The new code **never** lives under `src/features/admin/` — this is a seller feature end-to-end.

## Complexity Tracking

*No Constitution Check violations; section intentionally empty.*
