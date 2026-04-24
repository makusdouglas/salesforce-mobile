# Feature Specification: Payment Receipts

**Feature Branch**: `012-payment-receipts`
**Created**: 2026-04-23
**Status**: Draft
**Roles affected**: `seller` (primary). Admins inherit access via the dual-role rule (constitution §7 D7, §5 UX6).
**Input**: User description: "Implement payment-receipt recording against the payment_receipts entity. From an order detail, the salesperson registers a receipt with amount, method (cash, pix, transfer, check, other), date, optional notes, and an optional photo or pdf captured via camera or picked from the library. Files upload to Supabase Storage on next sync and are cached locally via expo-file-system (same pattern as R3). Offline creation is mandatory — everything persists locally and syncs opportunistically. A receipt is append-only; corrections are new receipts with a reference back to the original."

## UI Design *(primordial source)*

**Design source**: [design/screens.md](./design/screens.md) — generated from `layout.pen`

### Screens

| Screen | Screenshot | Intent |
|--------|------------|--------|
| Order Receipts / Phone | [order-receipts-phone.png](./design/order-receipts-phone.png) | Receipts list for a sent order: totals (Total/Recebido/Saldo), progress bar, receipt rows with amount + method badge + date + attachment icon, "Registrar recebimento" footer CTA, append-only corrections surfaced as dedicated rows. |
| Order Receipts / Tablet | [order-receipts-tablet.png](./design/order-receipts-tablet.png) | Split layout: totals + immutability hint left, receipts list right, CTA promoted into topBar. |
| Payment Receipt Form / Phone | [payment-receipt-form-phone.png](./design/payment-receipt-form-phone.png) | Capture form: amount (R$), method segmented control (Pix/Dinheiro/Transf./Cheque/Outro), date, optional notes, optional attachment (camera / gallery-PDF) with preview + offline-sync caption. |
| Payment Receipt Form / Tablet | [payment-receipt-form-tablet.png](./design/payment-receipt-form-tablet.png) | Two-column split: amount/method/date left, notes (textarea) + attachment block with offline-sync banner right; save promoted into topBar. |
| Payment Receipt Detail / Phone | [payment-receipt-detail-phone.png](./design/payment-receipt-detail-phone.png) | Read-only receipt view: big amount + method badge, metadata, notes, full-width attachment preview, "Registrar correção" footer CTA with append-only caption. |
| Payment Receipt Detail / Tablet | [payment-receipt-detail-tablet.png](./design/payment-receipt-detail-tablet.png) | Split: large attachment viewer left, metadata + notes + immutability hint right; "Compartilhar" and "Registrar correção" in topBar. |

### Design decisions carried into this spec

- **Append-only correction model is visible in the UI**: corrections render as distinct rows in the list (negative amount + "Correção" badge, caption referencing the original) and are only reachable from an existing receipt's detail — there is no edit/delete affordance.
- **Totals card is primordial**: Total do pedido / Recebido / Saldo em aberto (with progress bar) is the first element of the receipts list on both viewports; partial payments must be legible before the list is scanned.
- **Method selection is a 5-option segmented control** with fixed options; no free-text override on "Outro" in the UI (see FR-011 and clarification).
- **Attachment is optional**, never required. The capture row shows two entry points (Câmera, Galeria/PDF) and collapses into a preview card once a file is picked; the preview's caption exposes sync state ("cache local · aguardando sync" or "Sincronizado") so the offline-first behavior is discoverable.
- **Entry point is `OrderSummaryScreen` in read-only mode (status === `sent`)**. That screen already exists and today renders a "draft → sent ao enviar" hint when the order is sent; this feature extends the sent-state footer with a `Recebimentos` action (and keeps the existing `Ver PDF salvo` action). The seller reaches the sent-state `OrderSummary` by tapping a past-order row in `ClientProfileScreen` (today that tap calls `openStoredPdf` directly; this feature rewires the primary tap to navigate into `OrderSummary`, with the per-row PDF shortcut preserved as a secondary affordance). No new `OrderDetailScreen` is introduced — that would violate UX5 by shipping an undesigned screen.
- **Date defaults to today** but is always editable (backdating is allowed for offline captures done after the fact).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Register a receipt against a sent order (Priority: P1)

The salesperson opens a sent order, sees the outstanding balance, and registers a receipt by typing an amount, picking a method, confirming the date, optionally adding a note and/or attaching a proof (photo from the camera or a PDF/image from the library). On save, the receipt appears in the order's receipts list, the balance updates immediately, and the entire record persists offline.

**Why this priority**: This is the feature's core value. Without it there is no way to record that a customer paid — everything else (corrections, viewing history, attachments) assumes at least one receipt exists.

**Independent Test**: With the device in airplane mode, open a sent order, register one receipt of any amount with method = Dinheiro, save, and verify the new receipt appears in the list and the Saldo em aberto value decreases by the registered amount. Restart the app (still offline) and confirm the receipt is still there.

**Acceptance Scenarios**:

1. **Given** a sent order with Total R$ 420,00 and no receipts, **When** the seller registers a receipt of R$ 150,00 with method "Pix" and today's date, **Then** the order's Recebido shows R$ 150,00, Saldo em aberto shows R$ 270,00, and the receipt appears at the top of the list with a "Pix" badge.
2. **Given** the seller is offline, **When** they save a valid receipt, **Then** the receipt is persisted locally and rendered immediately, and the attachment (if any) is cached locally for upload on the next sync.
3. **Given** the seller fills amount and method but leaves notes and attachment empty, **When** they save, **Then** the receipt is created successfully (notes and attachment are optional).
4. **Given** the seller attaches a photo from the camera, **When** they save, **Then** the receipt list row shows a paperclip icon and the detail screen renders the photo.

---

### User Story 2 — View outstanding balance and receipt history for an order (Priority: P1)

From an order detail, the salesperson opens the Receipts view and sees Total do pedido, Recebido, and Saldo em aberto at the top, followed by a chronological list of receipts (newest first). Each row shows the amount, payment method badge, date, and an indication when an attachment is present. Tapping a row opens the receipt detail view.

**Why this priority**: Users must be able to confirm what has been registered before deciding to add another receipt or a correction. Without this view, Story 1 is write-only and unverifiable in the field.

**Independent Test**: Open an order with 2+ pre-existing receipts and verify that Total / Recebido / Saldo values match the sum of the receipt amounts and that the list renders each receipt with the correct amount, method, and date. Tap a row and verify the detail screen opens.

**Acceptance Scenarios**:

1. **Given** an order with three receipts (R$ 150 Pix, R$ 100 Dinheiro, and a −R$ 10 correction), **When** the seller opens the Receipts view, **Then** Recebido shows R$ 240,00 and the list shows three rows ordered newest-first, with the correction row visually marked ("Correção" badge, negative amount).
2. **Given** an order with no receipts, **When** the seller opens the Receipts view, **Then** Recebido shows R$ 0,00, Saldo em aberto equals Total, the list is empty, and the "Registrar recebimento" CTA is shown.
3. **Given** a receipt with an attachment that has not yet been synced, **When** the seller opens its detail view, **Then** the attachment preview renders from the local cache and the sync indicator reads "Aguardando sync".

---

### User Story 3 — Correct a previously-registered receipt (Priority: P2)

When a receipt was registered with a wrong amount, method, or date, the salesperson opens the original receipt's detail view and taps "Registrar correção". A new receipt capture form opens, pre-linked to the original. The seller enters the correcting amount (positive to add, negative to reverse) and saves. The original stays intact; the new receipt is stored with a reference to the original and is visually labelled as a correction in the list.

**Why this priority**: Required by the domain rule ("receipts are append-only; corrections are new receipts with a reference back to the original"), but real-world frequency is much lower than creation and viewing.

**Independent Test**: From an existing receipt's detail, trigger "Registrar correção", register a −R$ 10,00 entry, and verify: (a) the original receipt is still present and unchanged, (b) the new correction row appears in the list with the "Correção" badge and a caption referencing the original, (c) Recebido decreases by R$ 10,00.

**Acceptance Scenarios**:

1. **Given** the seller taps "Registrar correção" on a R$ 100 Dinheiro receipt, **When** they save a −R$ 10 correction, **Then** the order's Recebido recalculates to (original total − 10) and a correction row appears with a caption that references the original receipt's method and date.
2. **Given** any existing receipt, **When** viewing it, **Then** no "editar" or "excluir" affordance is present (append-only is enforced at the UI level).

---

### User Story 4 — Attach and review a proof of payment (photo or PDF) (Priority: P2)

When registering a receipt, the salesperson can capture a photo with the device camera or pick a photo/PDF from the library. The file is cached locally, previewed in the form and later in the receipt detail, and uploaded to remote storage on the next successful sync. Until the upload completes, the local cache is the source of truth for preview rendering.

**Why this priority**: Enables the business audit requirement (a receipt with a visible proof is worth more than one without) but the feature still delivers value without attachments for P1/P2 flows.

**Independent Test**: Offline, create a receipt with a camera photo attached. Verify the preview renders immediately on both the form and detail screens. Reconnect, trigger a sync, and verify the attachment's sync state changes to "Sincronizado" without visual regression.

**Acceptance Scenarios**:

1. **Given** the seller is offline, **When** they capture a camera photo and save the receipt, **Then** the photo renders from the local cache on the list row (icon) and on the detail screen (preview), and the sync indicator reads "Aguardando sync".
2. **Given** a previously-synced receipt with a remote attachment, **When** the local cache has been evicted and the device is online, **Then** the detail screen fetches and renders the remote file without blocking the rest of the UI.
3. **Given** the seller picks a PDF from the library, **When** they save, **Then** the preview thumbnail shows a document glyph and the file name + size are visible.

### Edge Cases

- **Offline-only sessions**: a seller may create multiple receipts, with and without attachments, entirely offline. All of them must render, participate in totals, and be reachable by detail tap while offline. None are lost when the app restarts.
- **Overpayment**: cumulative receipts may exceed the order total. The UI must not block saving; Saldo em aberto displays R$ 0,00 (clamped) and a visible "Ajuste pendente" indicator surfaces the overpayment (see FR-018).
- **Correction that exceeds the original balance**: negative corrections may push Recebido below zero (e.g. full reversal of a partial prepayment). Saldo em aberto clamps at Total; the totals card shows the same "Ajuste pendente" indicator — FR-018 covers both the `received > total` and `received < 0` ends of the clamp.
- **Attachment upload failure after retries**: the receipt itself remains valid and listed; only the attachment is flagged as "Falha ao enviar" with a manual retry action.
- **Storage quota for cached files**: the local cache follows the same eviction rules as R3 (product photos); evicted remote-synced files refetch transparently on next open.
- **Receipt registered on the wrong order**: not supported. Since receipts are append-only, the only remedy is a full-reversal correction on the wrong order plus a new receipt on the correct one. This is by design.
- **Date in the future**: allowed (some methods like post-dated cheques require a future date); no validation blocks it.
- **Amount = 0**: rejected at form-validation time with an inline error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow the seller to register a payment receipt against any order, from that order's detail → Receipts view.
- **FR-002**: System MUST persist every receipt locally at save time, without requiring network connectivity, so that offline creation is never blocked.
- **FR-003**: System MUST synchronize locally-created receipts (and their attachments) to the remote backend opportunistically on the next successful sync, using the same local-cache + upload pattern as the R3 product-photo pipeline.
- **FR-004**: System MUST treat receipts as append-only at the data layer — there is no edit or delete operation for existing receipts.
- **FR-005**: System MUST represent a correction as a new receipt that carries a reference to the receipt it corrects; the original receipt remains unchanged.
- **FR-006**: System MUST prevent the UI from exposing any edit or delete affordance on an existing receipt (the only write paths are "create" and "create-as-correction").
- **FR-007**: A receipt MUST capture the following fields: amount (monetary value), payment method (one of: Dinheiro, Pix, Transferência, Cheque, Outro), date, and a reference to the order.
- **FR-008**: A receipt MAY optionally capture free-text notes and a single attachment (photo or PDF).
- **FR-009**: System MUST reject a receipt whose amount is zero or missing with an inline validation message. Negative amounts are only accepted when the receipt is created via the correction flow.
- **FR-010**: System MUST default a new receipt's date to "today" in the device's local time zone and MUST allow the seller to change it to any past or future date before saving.
- **FR-011**: The payment method selector MUST present exactly these five options, with no free-text field: Dinheiro, Pix, Transferência, Cheque, Outro. The label "Outro" is opaque — no additional detail is captured.
- **FR-012**: Attachments MUST be capturable via the device camera or picked from the device's photo/file library (both paths MUST surface as first-class entry points in the capture form).
- **FR-013**: Accepted attachment MIME types are image (JPEG, PNG, HEIC) and PDF; other types MUST be rejected with an inline error.
- **FR-014**: Individual attachment file size MUST NOT exceed 10 MB at pick time; larger files are rejected with an inline error directing the user to capture a new photo or pick a smaller file.
- **FR-015**: System MUST cache attachments locally via the device's file system and render previews from the cache until a successful remote upload occurs. After upload, the cache remains authoritative for preview; on cache eviction, the remote copy is re-fetched transparently.
- **FR-016**: For each receipt, the UI MUST expose its current sync state (pending / synced / failed) both in the detail view (badge) and indirectly in the list (an attachment icon is shown regardless of sync state; sync failures surface in the detail).
- **FR-017**: The order Receipts view MUST show, at the top: order Total, sum of receipts (Recebido), and Saldo em aberto = max(Total − Recebido, 0), along with a progress indicator of Recebido / Total.
- **FR-018**: When cumulative receipts exceed the order total OR drop below zero after corrections, Saldo em aberto MUST clamp at R$ 0,00 (no negative display) and the totals card MUST show an "Ajuste pendente" indicator so the seller can reconcile via an additional correction. The indicator is symmetric: the same chip renders in both directions.
- **FR-019**: The receipts list MUST render receipts newest-first by receipt date, with ties broken by creation timestamp.
- **FR-020**: A correction row in the list MUST render visibly distinct from a regular receipt (distinct badge colour, caption referencing the original), and the original row MUST remain in place unchanged.
- **FR-021**: From a receipt's detail view, the seller MUST be able to initiate a correction; doing so opens the capture form with the correction's reference to the original pre-populated.
- **FR-022**: System MUST allow the seller to share or open the attached proof (photo/PDF) from the receipt detail, using the device's native share sheet / file viewer — no in-app viewer is required.
- **FR-023**: Receipts MUST be visible to the same roles that already see the parent order (role guard follows the constitution's dual-role rule; no new permissions are introduced).
- **FR-024**: A receipt that fails to sync after the standard retry budget MUST remain fully usable locally and surface a manual retry action in its detail view.

### Key Entities *(data involved)*

- **PaymentReceipt** — an immutable record of a payment (or correction) against an order. Attributes: amount, payment method (enum of 5), receipt date, optional notes, optional attachment reference, order reference, optional reference to the receipt it corrects, created-by, created-at, sync state. No update or delete semantics — only create.
- **Attachment** — optional binary artefact linked 1:1 to a PaymentReceipt. Attributes: local cache path, remote storage path (populated after sync), MIME type, size, upload state. Files are produced by the device camera or picked from the library.
- **Order (existing)** — a receipt always belongs to exactly one order; the order's Total is the reference against which Recebido and Saldo em aberto are derived. This feature does not modify the Order entity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A seller can register a receipt (amount + method only, no attachment) in under 20 seconds from opening an order detail.
- **SC-002**: 100% of receipts saved offline are preserved across app restarts and are visible in the order's receipts list without manual sync.
- **SC-003**: When connectivity is restored, at least 95% of pending receipts (and their attachments) reach the remote backend within 2 minutes of the first successful sync attempt, without seller action.
- **SC-004**: The outstanding balance shown in the order's Receipts view matches Total − Recebido (clamped at 0) on every screen render, with 0 tolerance across all test orders.
- **SC-005**: Zero existing receipts are ever mutated or deleted by this feature; all corrections manifest as new records that reference the original. Auditable via the stored reference chain.
- **SC-006**: In usability testing, sellers identify a correction row in the list versus a regular receipt on first glance in at least 90% of trials, with no onboarding.
- **SC-007**: 100% of attachments rendered in the UI — whether still pending upload or already synced — display a preview within 500 ms of opening the detail view, given a warm local cache.

## Assumptions

- The order entity and the sync engine (feature 005) already exist and are operational; this feature extends them. The app has **no dedicated `OrderDetailScreen`** — instead, `OrderSummaryScreen` doubles as the sent-order detail when `order.status === 'sent'`, which is where this feature mounts its `Recebimentos` entry point.
- The R3 product-photo media pipeline (feature 006) is the reference implementation for local caching + opportunistic upload; it is reused rather than reimplemented.
- The device's native camera and file-picker APIs are available and the user has granted the necessary permissions. Permission onboarding is out of scope and reuses the app's existing permission-prompt pattern.
- Attachment remote storage is Supabase Storage; its availability and per-object size/MIME rules are compatible with FR-013 and FR-014.
- Currency is Brazilian Real (R$); this feature does not introduce multi-currency support.
- Time zone for date defaults is the device's local time zone; no server-side coercion is performed by this feature.
- Seller identity (for `created_by`) is taken from the already-authenticated session; no additional login prompt is introduced.
- The "Outro" method label stays opaque for this release; a future feature may introduce a controlled sub-list of extra methods. Until then, sellers standardize verbally on what "Outro" means.
- Overpayment is a seller-reconcilable anomaly, not a system error; the UI surfaces it (FR-018) but does not block save (per the append-only rule, a correction is the only remediation path).
- The only doorway into the receipts view is the sent-state `OrderSummaryScreen`, reached from `ClientProfileScreen`'s order-history row tap. The post-send `OrderSent` confirmation screen does not gain a `Recebimentos` CTA in this release.
