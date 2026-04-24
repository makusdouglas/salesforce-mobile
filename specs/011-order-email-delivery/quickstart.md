# Quickstart — Order Email Delivery

## Goal

Verify end-to-end that a draft order becomes a `sent` order via a locally-generated PDF handed to the device's mail or share intent, and that retries + missing-email fallback + stored-PDF retrieval all behave as specified.

## Preconditions

- Dev client running on a device or simulator with a configured Mail account (for Story 1) and/or any share target (for Story 2).
- A seeded draft order with ≥ 1 line item and a client whose email is populated.
- A second seeded draft for the same seller with a client whose email is empty.
- A prior `sent` order (can be created by running Story 1 once) — for Story 3.

## Scenario 1 — Send with email (Story 1, FR-001/002/003/005/006/007/013/019)

1. Open the draft for the client with an email.
2. Observe the hint above the send button: `"PDF + email para <email>"`.
3. Observe the button label: `"Enviar por email"`.
4. Tap **Enviar por email**.
5. Within 2 s the device mail composer opens with:
   - To: the client's email pre-filled
   - Subject: `Pedido #YYYY-NNNN - <Client Name>`
   - Body: the templated Portuguese greeting referencing the salesperson
   - Attachment: the generated PDF
6. Send from the mail app. Return to the app.
7. **Expected**: the app navigates to `OrderSent`, which shows:
   - The order number `#YYYY-NNNN`
   - `"PDF compartilhado via email"` and the recipient line
   - Buttons **Ver PDF salvo** (secondary) and **Concluir** (primary).
8. Tap **Concluir** → lands on the client profile's order history. The order now appears as `sent`.

## Scenario 2 — Generic share (Story 2, FR-004/006/019)

1. Open the draft for the client without an email.
2. Observe the hint: `"Compartilhar PDF — sem email cadastrado"`.
3. Observe the button label: `"Compartilhar PDF"`.
4. Tap **Compartilhar PDF**.
5. The OS share sheet opens with the PDF attached and no recipient pre-filled.
6. Complete via any channel (WhatsApp, AirDrop, copy-to-mail, etc.). Return to the app.
7. **Expected**: `OrderSent` screen with recipient line reading `"compartilhado sem email"`.

## Scenario 3 — Re-open stored PDF (Story 3, FR-016/017)

1. From a client's profile, open any order already in `sent` status.
2. Tap **Ver PDF salvo**.
3. **Expected**: the stored PDF opens in the device's default viewer, showing the same order number and totals recorded on the order row.
4. **Regeneration branch**: manually delete the file at the order's stored `pdf_path`, return to the order, tap **Ver PDF salvo**.
5. **Expected**: the app regenerates the PDF with the same order number; a new file lands at the same path; the viewer opens it.

## Scenario 4 — Cancel the share sheet (Edge case, FR-014/015)

1. From a draft with a valid email, tap **Enviar por email**.
2. When the mail composer opens, tap the close/cancel button without sending.
3. **Expected**: the app returns to `OrderSummary`. The order is still `draft`. The hint and button are unchanged.
4. Tap **Enviar por email** again.
5. **Expected**: the same order number is reused; the same PDF filename is reused (no duplicate file on disk); the composer opens exactly as before.

## Scenario 5 — Empty draft blocks send (FR-018)

1. Open a draft with zero line items.
2. **Expected**: the send button is disabled; the hint slot either hides or shows a neutral "Adicione itens para enviar" copy.

## Scenario 6 — Order-number uniqueness across offline sync (FR-012)

1. Disable sync on two devices A and B signed in as the same seller.
2. Take both offline.
3. Send an order on A (draft becomes `#YYYY-0042`, say) and an order on B (draft becomes `#YYYY-0042` — same number because both devices' local counters were at 41).
4. Bring A online, run sync. A's order is pushed with `#YYYY-0042`.
5. Bring B online, run sync.
6. **Expected**: B's push detects the conflict, rewrites B's order to `#YYYY-0043` locally, renames the stored PDF file accordingly, and the push succeeds. The mail the salesperson already sent from B will *not* be rewritten — the old PDF is out there with `#YYYY-0042` in the filename/body. That is a known and accepted limitation of a local allocator; the invariant preserved here is **database uniqueness**, not post-hoc email correction.

## Fail-fast checks (CI)

- `npm test -- src/features/orders/send` — all 9+ test files pass.
- `npm test -- noCatalogWrites` — no send-path file touches catalog writes.
- `npm test -- noNetworkOnSend` — no send-path file imports `fetch`, `@supabase/`, or `@/data/sync/`.
- `npm test -- pdfTemplate.nofiscal` — no fiscal-invoice markers in the PDF template.
