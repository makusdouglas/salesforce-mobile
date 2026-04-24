# UI Design — Payment Receipts

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-23

## Screens

| Screen | Frame ID | Screenshot | Notes |
|--------|----------|------------|-------|
| Order Receipts / Phone | `OhaXW` | [order-receipts-phone.png](./order-receipts-phone.png) | Receipts list for a sent order, with totals card (Total / Recebido / Saldo), progress bar, rows showing amount + method badge + date + attachment icon, and primary "Registrar recebimento" footer CTA. |
| Order Receipts / Tablet | `M71E2` | [order-receipts-tablet.png](./order-receipts-tablet.png) | Split layout: totals card + append-only hint on the left, receipts list on the right; CTA promoted into topBar. |
| Payment Receipt Form / Phone | `xFdWB` | [payment-receipt-form-phone.png](./payment-receipt-form-phone.png) | Capture form: Valor (R$), Método segmented (Pix / Dinheiro / Transf. / Cheque / Outro), Data, Observações (optional), Comprovante (camera / gallery buttons + preview card), footer "Salvar recebimento". |
| Payment Receipt Form / Tablet | `qmurF` | [payment-receipt-form-tablet.png](./payment-receipt-form-tablet.png) | Two-column split: Valor / Método / Data left, Observações (textarea) + Comprovante with offline-sync banner right; save action promoted into topBar. |
| Payment Receipt Detail / Phone | `dPZom` | [payment-receipt-detail-phone.png](./payment-receipt-detail-phone.png) | Receipt view: big amount + method badge, metadata list (Data, Pedido, Registrado por, Status=Sincronizado), Observações, full-width attachment preview with download, and a bordered "Registrar correção" CTA in the footer with the append-only rule as caption. |
| Payment Receipt Detail / Tablet | `bfEgo` | [payment-receipt-detail-tablet.png](./payment-receipt-detail-tablet.png) | Split: large attachment viewer fills the left column, right column shows amount card, metadata card, notes, and immutability hint; "Compartilhar" and "Registrar correção" actions promoted into topBar. |

## Components referenced

- Layout conventions reused from existing `OrderSent` / `OrderSummary` frames (topBar 56/64h, FAFAFA background, card fills #FFFFFF with 12px radius + #E4E4E7 border, primary button #171717 cornerRadius:12 height 48).
- Typography per project style guide: Funnel Sans (headings), Inter (body/textarea), Geist (captions/labels).
- No new reusable components created — all chips, rows and cards are composed inline. Promoting these to `C:ReceiptRow`, `C:MethodChip`, `C:SummaryCard` is deferred to a later pass if they appear in other screens.

## Design decisions

- **Append-only correction UX**: corrections surface as a dedicated row in the receipt list with a negative amount, `Correção` badge (destructive palette), and a caption referencing the original receipt. This makes append-only history visible without a destructive "edit" affordance.
- **Totals card is primordial**: on both viewports the first thing the salesperson sees is Total / Recebido / Saldo + a progress bar, so partial payments are legible before scrolling the list.
- **Método as a 5-chip segmented**: phone uses 3+2, tablet uses 3+2 after a first pass of 5-in-a-row was visibly cramped in the 320px left column.
- **Attachment**: two entry points (Câmera / Galeria-PDF) on one row, plus a preview card once a file is picked. Metadata line shows file name, size, and sync status (`cache local · aguardando sync`) to make the R3-style offline upload behavior visible in-UI.
- **Offline-first signal**: tablet form surfaces a warm-toned banner ("Salvo offline — será enviado ao Supabase Storage no próximo sync.") since desktop real estate allows it; phone reuses the preview caption instead.
- **Entry point**: the list screen doubles as the "order detail → receipts tab". Not wiring a separate OrderDetail now; the `#2026-0412` reference in the topBar + back arrow is enough to anchor it in the flow. If post-clarify the order detail becomes a distinct screen, this frame becomes the receipts tab inside it.
- **Date input**: shown as a selector row with chevron/calendar icon rather than a native picker mock; real screen will invoke the platform date picker.

## Open questions for the spec

- **Entry point from Order history**: should the Receipts screen be reached from the existing `OrderSent` (feature 011) confirmation, from an Order history/detail list, or both? [NEEDS CLARIFICATION]
- **Overpayment handling**: what is the expected UI when cumulative receipts > order total? Clamp? Show negative saldo? [NEEDS CLARIFICATION]
- **Correction UX**: is "Corrigir" an action inside a receipt's detail view, or a top-level "+ Correção" CTA? Current design assumes the former. [NEEDS CLARIFICATION]
- **Attachment constraints**: max file size and allowed MIME types (photo, PDF) — align with R3 media pipeline limits? [NEEDS CLARIFICATION]
- **Method "Outro" free-text**: should "Outro" open a text field for a label (e.g., "boleto"), or stay as an opaque category? [NEEDS CLARIFICATION]
- ~~**Receipt detail screen**~~ — resolved: `PaymentReceiptDetail / Phone` (`dPZom`) and `/ Tablet` (`bfEgo`) added with an attachment viewer and a "Registrar correção" CTA that creates a new append-only receipt referencing this one.
