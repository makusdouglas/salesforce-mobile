# Quickstart — Payment Receipts (Feature 012)

End-to-end smoke test the feature **on-device** once `/speckit-implement` has shipped the tasks.

## Prerequisites

- Dev-client build of the app, iOS or Android simulator (tablet + phone both smoke-tested per UX5).
- A signed-in seller account with at least one sent order (feature 011). If none exists, run the 011 quickstart first.
- Optional: a second Supabase auth session signed in as a different seller, used to confirm RLS blocks cross-seller attachment reads.

## 1. Schema migration ran cleanly

- Launch the app. On first launch after the 012 build the WatermelonDB version bumps from N to N+1.
- Confirm via the Debug screen (`/_debug/DatabaseInspectorScreen`) that `payment_receipts` now has the nine business columns (`order_id`, `amount`, `method`, `received_at_ms`, `attachment_url`, `attachment_local_path`, `attachment_mime_type`, `attachment_size_bytes`, `attachment_upload_state`, `correction_of_receipt_id`, `notes`) plus the sync columns.
- Confirm Supabase-side via the dashboard that `payment_receipts` has the same shape and the bucket `receipt-attachments` exists with the two policies enabled.

## 2. Register a receipt offline (US1 + US2)

1. Put the device in airplane mode.
2. Open a sent order → "Recebimentos". Verify the totals card shows `Recebido = R$ 0,00` and `Saldo em aberto = Total`.
3. Tap "Registrar recebimento". Fill `R$ 150,00`, method `Pix`, keep today's date, skip notes and attachment. Save.
4. Verify the list shows the new row at the top with the Pix badge; totals recalculate live (Recebido = R$ 150,00).
5. Kill the app and relaunch (still offline). The receipt must still be there.

**Pass criterion**: creation and list rendering happen entirely offline; the receipt survives an app restart without any sync.

## 3. Register with an attachment (US4)

1. Still offline, from the same order, register a second receipt of `R$ 100,00` (method `Dinheiro`), this time attaching a camera photo.
2. Verify the form's preview card shows the photo + the caption `cache local · aguardando sync`.
3. Save. In the receipts list, the new row shows a paperclip icon.
4. Tap the row → detail screen. The photo preview renders. The sync badge reads `Aguardando sync`.
5. Turn airplane mode off. Wait for sync (or tap the sync indicator on Home to force it).
6. Reopen the detail. The sync badge now reads `Sincronizado`.
7. Cross-check in the Supabase dashboard Storage browser: the file exists at `receipt-attachments/<seller_id>/<receipt_id>.jpg`.

**Pass criterion**: the attachment renders from local cache before and after sync; the remote object is present under the expected path.

## 4. Register a correction (US3)

1. On the R$ 100,00 Dinheiro receipt's detail screen, tap "Registrar correção".
2. In the form, enter `−10,00`, method `Dinheiro`, default date. Save.
3. Verify the list now has three rows: the Pix receipt, the Dinheiro receipt (unchanged), and a new correction row with the Correção badge, negative amount in red, and the caption referencing the original.
4. Verify totals: `Recebido = R$ 240,00`, `Saldo = Total − 240`.
5. Navigate back to the original Dinheiro receipt's detail. The original amount is still `R$ 100,00` — the correction did not mutate it.

**Pass criterion**: the original receipt is byte-identical before and after the correction; the correction row is visually distinct.

## 5. Append-only guarantee

- Open the app's debug inspector and attempt, via the available console, to call `paymentReceiptsRepository.update(id, { amount: 1 })` on any receipt. This must fail with a TypeScript/runtime error: the method is not exported.
- Confirm the static test `appendOnlyReceipts.test.ts` passes: `npm test -- appendOnlyReceipts`.

**Pass criterion**: the append-only rule is enforced at both the code surface and the CI layer.

## 6. RLS sanity check

- Sign in as a **different** seller on a second device.
- Attempt to fetch the first seller's attachment URL directly (paste into a browser without an auth header, or via `fetch` in the Supabase Studio SQL editor as the other auth session). Must 403.
- On the second seller's own order, register a receipt with an attachment and verify the upload succeeds — their own RLS path matches.

**Pass criterion**: the bucket's SELECT policy blocks cross-seller reads; INSERT policy allows same-seller writes.

## 7. Responsive UX5 check

- Repeat steps 2–4 on a tablet simulator (820 × 1180). Layout switches to the split columns defined in the design (totals left, list right on OrderReceipts; amount+method+date left, observations+attachment right on Form; attachment viewer left, metadata right on Detail).

**Pass criterion**: phone and tablet both render without overflow, truncation, or layout regressions. Method chips on tablet use the `3 + 2` layout, not `5-in-a-row`.
