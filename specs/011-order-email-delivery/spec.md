# Feature Specification: Order Email Delivery

**Feature Branch**: `011-order-email-delivery`
**Created**: 2026-04-23
**Status**: Draft
**Roles affected**: `seller` (primary) — admins inherit seller capabilities per constitution §5 UX6
**Input**: User description: "Implement order-to-email delivery per constitution R4. On the order summary, a 'Send' action generates a PDF locally with expo-print (no server render, no delivery service like SendGrid/Resend), then opens the device's share sheet / mail intent with the client's email in To, a pre-filled subject, a templated body, and the PDF attached. The salesperson confirms and sends from their own mail account; on return to the app, the order transitions to status 'sent' with the PDF path and timestamp recorded locally. PDF template MUST include: salesperson, client, items, per-line and order discounts, totals, and a human-readable order number. No fiscal-invoice formatting — this is a quote/intent document."

## UI Design *(primordial source)*

**Design source**: [design/screens.md](./design/screens.md) — generated from `layout.pen`

### Screens

| Screen | Screenshot | Intent |
|--------|------------|--------|
| OrderSummary / Phone | [order-summary-phone.png](./design/order-summary-phone.png) | Existing summary + inline "PDF + email para {client.email}" hint; primary button relabeled **Enviar por email**. |
| OrderSummary / Tablet | [order-summary-tablet.png](./design/order-summary-tablet.png) | Same hint + relabel in the right-column action stack. |
| OrderSent / Phone | [order-sent-phone.png](./design/order-sent-phone.png) | Full-screen confirmation after return from OS share sheet: large check, order number `#2026-0412`, "PDF compartilhado via email" + recipient line, **Ver PDF salvo** (secondary) + **Concluir** (primary) CTAs. |
| OrderSent / Tablet | [order-sent-tablet.png](./design/order-sent-tablet.png) | Same content with side-by-side CTAs. |
| PDF Template / A4 | [pdf-template-a4.png](./design/pdf-template-a4.png) | Reference A4 layout for the generated quote PDF — header (order #, date, non-fiscal marker), Vendedor/Cliente block, line-item table (qty, product, unit price, discount, line total), right-aligned totals card, non-fiscal footer. |

### Design decisions carried into this spec

- **One tap away from the mail intent.** Send button remains the primary action from 009; this feature adds PDF generation + share sheet behind it without changing the salesperson's interaction until the OS intent appears.
- **Recipient visibility before the tap.** An inline hint above the send button shows exactly which email the PDF will go to. If the client has no email on file, the hint swaps to "Compartilhar PDF — sem email cadastrado" and the button label becomes "Compartilhar PDF" (same frame, conditional copy).
- **Confirmation is a full screen, not a modal.** After the app returns from the share sheet the user lands on `OrderSent`, giving the salesperson closure and a stable deep-link target for the stored PDF.
- **Human-readable order number.** `#YYYY-NNNN` format where NNNN is a per-year counter, generated at send-intent and persisted on the order.
- **Quote, not invoice.** The PDF header and footer carry a prominent "Documento sem valor fiscal" marker so the document cannot be mistaken for a nota fiscal.
- **Totals mirror the on-screen summary.** Per-line unit price, per-line discount, order-level discount, and total all read from the same totals function that drives the summary — no separate source of truth for the PDF.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send draft order by email with attached PDF (Priority: P1)

A salesperson finishes reviewing an order draft on the summary screen. They see the client's email rendered in the hint above the send button, confirming the PDF is about to go to the right person. They tap **Enviar por email**. The app generates a PDF quote, opens the OS share sheet with the client's email pre-filled in To, a Portuguese subject and templated body pre-composed, and the PDF attached. The salesperson confirms in their own mail app and returns to the app. The order is now marked `sent`, the stored PDF is retrievable, and the salesperson sees a confirmation screen with the order number.

**Why this priority**: This is the entire feature — without it, R4 cannot be delivered. Nothing else in the feature has value without this flow.

**Independent Test**: Open a draft whose client has an email on file; tap **Enviar por email**; verify the share sheet appears with the correct recipient, subject, body, and attached PDF; confirm in the mail app; on return, verify the order status is `sent`, the sent timestamp is recorded, the PDF exists on device, and the confirmation screen shows the order number.

**Acceptance Scenarios**:

1. **Given** a draft order with valid client email and at least one line item, **When** the salesperson taps **Enviar por email**, **Then** the system generates a PDF locally, opens the share sheet pre-populated with the client's email as recipient, a Portuguese subject including the order number, a templated body, and the PDF attached.
2. **Given** the share sheet is open and the salesperson completes sending through their mail app, **When** the app is foregrounded again, **Then** the order status transitions from `draft` to `sent`, the sent timestamp is recorded locally, and the PDF file path is stored on the order row.
3. **Given** the order has been marked `sent`, **When** the user returns to the app, **Then** the `OrderSent` screen appears with the human-readable order number, the recipient email, and the two CTAs "Ver PDF salvo" and "Concluir".

---

### User Story 2 - Share a quote PDF when the client has no email on file (Priority: P2)

A salesperson drafts an order for a walk-in client whose record does not include an email address. The hint slot shows "Sem email cadastrado" and the primary button reads **Compartilhar PDF**. Tapping it generates the same PDF and opens the OS share sheet in generic-share mode (no pre-filled recipient), so the salesperson can still send via WhatsApp, Bluetooth, AirDrop, or an ad-hoc email typed by hand.

**Why this priority**: This is a realistic field scenario — clients are often added on the spot with incomplete data. Blocking the send here would undermine R4.

**Independent Test**: Open a draft whose client has no email; verify the hint copy and button label match the design; tap the button; verify the generic share sheet opens with the PDF attached; complete via any channel; verify the order still transitions to `sent` exactly as in Story 1.

**Acceptance Scenarios**:

1. **Given** a draft order whose client has no email on file, **When** the summary screen renders, **Then** the hint reads "Compartilhar PDF — sem email cadastrado" and the primary button reads **Compartilhar PDF**.
2. **Given** the button is tapped, **When** the share sheet opens, **Then** the PDF is attached and no recipient is pre-filled.
3. **Given** the salesperson completes any share channel and returns to the app, **When** the app is foregrounded, **Then** the order transitions to `sent` with the same post-send state as Story 1.

---

### User Story 3 - Retrieve a previously sent PDF from the order (Priority: P2)

A salesperson needs to re-send or review the PDF of an order they already sent earlier today. From the `OrderSent` screen (immediately after send) or from the order detail view later, they tap **Ver PDF salvo** and the locally stored PDF opens in the device's default viewer.

**Why this priority**: Closes the loop on "where did I send that quote". Without it, salespeople would regenerate and risk sending a slightly different-numbered PDF.

**Independent Test**: Open any order already in `sent` status; tap **Ver PDF salvo**; verify the stored PDF opens; confirm that the order number and totals in the PDF match the ones recorded on the order.

**Acceptance Scenarios**:

1. **Given** an order in `sent` status with a stored PDF path, **When** the user taps **Ver PDF salvo**, **Then** the PDF opens in the device's default viewer.
2. **Given** the stored PDF file is missing from the device (e.g., cleared by the OS), **When** the user taps **Ver PDF salvo**, **Then** the app offers to regenerate the same PDF from the persisted order data, preserving the original order number.

---

### Edge Cases

- **Salesperson cancels the share sheet without sending.** The order MUST remain in `draft`; no sent timestamp, no status change. The already-generated PDF may be discarded or kept in a temp location — either is acceptable provided it does not collide with a later successful send.
- **Order number collisions across offline devices.** Two salespeople on separate devices, both offline, each send an order on the same day before syncing. The local counter could produce the same `#YYYY-NNNN`. The app MUST generate numbers that are unique per year across all devices after sync, with a conflict-resolution rule spelled out at implementation time.
- **Client email is malformed.** The app MUST detect an obviously invalid address (fails basic shape check) and either fall back to generic-share mode (same as Story 2) or block the tap until corrected. Design assumes fallback.
- **Draft has zero line items.** The send action MUST be disabled — the PDF would be meaningless and the on-screen summary already blocks send in this case today.
- **Client record is soft-deleted between draft open and send tap.** The PDF still renders with a snapshot of the client data from the order row (same rule as 009 — draft carries its own snapshot). No silent failure.
- **Device storage exhausted during PDF generation.** The send action MUST surface a user-visible error and leave the order in `draft`.
- **App is killed while the share sheet is open.** On next launch the order remains in `draft` (no ghost "sent" state). The previously generated PDF may be cleaned up lazily.
- **Second tap on "Enviar por email" after a successful send.** The button MUST be hidden or replaced on the `OrderSent` screen. Returning to the order detail in `sent` status MUST NOT re-open the share sheet; instead the UI offers "Ver PDF salvo" and (out of scope for v1) a separate "Reenviar" action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate the order PDF fully on-device, with no round-trip to a server and no dependency on a third-party mail-delivery service.
- **FR-002**: System MUST open the device's share sheet with the PDF attached when the salesperson taps the send action.
- **FR-003**: When the client has an email on file, the share sheet MUST be opened with an explicit mail intent so the client email is pre-filled in the To field, a Portuguese subject containing the order number is pre-filled, and a templated Portuguese body is pre-filled.
- **FR-004**: When the client has no email on file (or the email is malformed), the share sheet MUST open in generic-share mode with the PDF attached and no pre-filled recipient.
- **FR-005**: The summary screen MUST display an inline hint above the send button showing which email the PDF will be sent to, or "Sem email cadastrado" when none is on file, before the user taps.
- **FR-006**: The send button label MUST be "Enviar por email" when an email is on file and "Compartilhar PDF" otherwise, with no other label variations.
- **FR-007**: The PDF MUST include, in this order: header with order number and date and the non-fiscal marker; salesperson name; client name and contact details; line-item table with quantity, product name, unit price, per-line discount, and line total; order-level discount; subtotal and grand total; and a non-fiscal footer disclaimer.
- **FR-008**: The PDF MUST NOT include any visual element, copy, or formatting that would allow it to be mistaken for a nota fiscal (no CNPJ "emitente/destinatário" blocks, no tax codes, no fiscal legal language).
- **FR-009**: The PDF MUST render currency as `R$ X,YZ` with comma as decimal separator and dates as short `pt-BR` form (e.g., "12 abr 2026").
- **FR-010**: The PDF totals MUST be computed by the same function that produces the on-screen order summary totals; the PDF MUST NOT reimplement discount or total math.
- **FR-011**: System MUST allocate a human-readable order number in the format `#YYYY-NNNN` where YYYY is the calendar year of the send-intent and NNNN is a zero-padded 4-digit per-year counter, generated locally at send-intent time and persisted on the order.
- **FR-012**: Order numbers MUST be unique per calendar year across all synced devices after conflict resolution. Collisions produced by offline concurrent allocation MUST be reconciled deterministically at sync time without losing either order record.
- **FR-013**: When the app returns to the foreground after the share sheet has been open, the order MUST transition from `draft` to `sent`, and the sent timestamp, PDF file path, and order number MUST be persisted locally.
- **FR-014**: If the salesperson cancels or dismisses the share sheet without completing the send, the order MUST remain in `draft` with no timestamp change and no status change.
- **FR-015**: The app MUST persist the generated PDF on device storage with a filename of the form `pedido-<order-number>-<client-slug>.pdf` in a location that survives app restart.
- **FR-016**: From an order in `sent` status, the user MUST be able to re-open the previously stored PDF in the device's default viewer via a "Ver PDF salvo" action.
- **FR-017**: If the stored PDF is missing from disk when "Ver PDF salvo" is tapped, the app MUST offer to regenerate the same PDF from the persisted order data and reuse the original order number; it MUST NOT allocate a new number.
- **FR-018**: The send action MUST be disabled when the order has zero line items.
- **FR-019**: The confirmation screen (`OrderSent`) MUST display the order number, the recipient email (or "compartilhado sem email" when none), and both CTAs "Ver PDF salvo" and "Concluir".
- **FR-020**: Tapping "Concluir" on the confirmation screen MUST navigate the user back to the client's order history (or the home dashboard if the flow entered from there), matching the existing post-send navigation pattern in 009.
- **FR-021**: The PDF generation and share-sheet invocation MUST complete with no network request; the feature MUST be fully operational in airplane mode.
- **FR-022**: The share-sheet subject line MUST be `Pedido #YYYY-NNNN - {Client Name}` (pt-BR) and the body MUST be a short fixed Portuguese template referencing the salesperson and greeting the client by name.

### Key Entities

- **Order** *(existing from 009)*: Gains three new persisted fields — `order_number` (string, `#YYYY-NNNN` format), `pdf_path` (string, on-device file path), and `sent_at_ms` (already present in 009, now actually populated on successful send).
- **Order Number Counter** *(new)*: A per-year counter source. Each calendar year has its own next-value pool; on send-intent the next value is allocated and marked used locally. Sync reconciles collisions deterministically. Not user-visible.
- **Generated PDF** *(derived artifact, not a DB entity)*: A file on device storage referenced by `pdf_path`. Treated as disposable/regenerable — truth lives on the order row.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From tapping **Enviar por email** on a ready draft to the share sheet appearing, fewer than 2 seconds elapse on mid-range mobile hardware for an order of up to 30 line items.
- **SC-002**: 100% of orders that complete the share-sheet flow transition to `sent` with a persisted order number, PDF path, and sent timestamp — zero silent failures in happy-path flows.
- **SC-003**: 0% of generated PDFs contain fiscal-invoice markers or copy that could be confused with a nota fiscal, verified by visual review of the PDF template and a checklist covering CNPJ blocks, tax codes, and fiscal legal language.
- **SC-004**: The PDF totals exactly match the on-screen summary totals in 100% of orders, verified by property-based testing over randomized orders.
- **SC-005**: After full device sync across two offline-concurrent sends on the same day, order numbers remain unique per calendar year in 100% of reconciled pairs.
- **SC-006**: A salesperson can go from "draft ready" to "shared" (share sheet dismissed after send) in at most 3 taps (send button, mail app send, return to app) — matching constitution UX2 spirit for terminal actions.

## Assumptions

- The flow uses the device's native share/mail intent; the salesperson sends from their own configured mail account. The app does not own, store, or proxy credentials for any external mail service.
- Clients may or may not have an email on file. The feature falls back to generic-share mode when they do not, matching the screens.md design decision; it does not block send nor prompt for an email mid-flow.
- The PDF is a quote/intent document only. It is explicitly NOT a fiscal document and does not need to follow SEFAZ, NF-e, or any Brazilian fiscal invoice rules.
- Order number format is fixed at `#YYYY-NNNN`. Year rolls over on calendar year boundary using device local time.
- Order number allocation happens at send-intent (tap of the send button), not at draft creation. If the share sheet is cancelled the allocated number is kept on the draft so retries use a stable filename; the number is not recycled.
- Locale scope for v1 is pt-BR only (currency `R$` with comma decimal, dates like "12 abr 2026"). Other locales are out of scope.
- PDF files are stored in the app's sandboxed document/cache directory and survive app restarts for at least the app's installed lifetime; OS-triggered eviction is acceptable because FR-017 allows regeneration.
- The existing totals function (`computeOrderTotals`, established in 009) is reused verbatim for PDF rendering; any change to totals math is out of scope for this feature.
- `OrderSent` navigation on "Concluir" mirrors the post-send pattern already in 009. If 009 navigates back to the client profile, this feature does the same.
- Reenviar (resend) is explicitly out of scope for v1. The only v1 post-send action is "Ver PDF salvo".
- Offline-concurrent order number collisions require a deterministic reconciliation rule at sync time. The rule itself is an implementation concern (plan phase), but the *requirement* of uniqueness per calendar year is in scope.
