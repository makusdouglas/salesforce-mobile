# Quickstart — Order Assembly (developer QA walkthrough)

Goal: manually exercise the full 009 feature end-to-end on both viewports, confirming the constitution invariants (R5, UX1, D4, P5) hold and the six Pencil frames match their implementations.

## Preconditions

- Main branch + `009-order-assembly` merged locally.
- Simulator/device running a clean app install (so migration v3 runs).
- Supabase project has the 009 DDL applied (see `research.md` R-004).
- A seeded salesperson is signed in, with at least 1 client and 3 distinct products with variants priced in BRL.

## Happy path — phone (390 × 844)

1. Open the client profile for a seeded client. Verify the "Novo pedido" CTA sits in the bottom action region.
2. Tap "Novo pedido". Expected: app navigates to `OrderDraft`; a new `orders` row exists with `status = 'draft'`, `discountAmount = 0`, `discountMode = 'amount'`.
3. Tap "Adicionar item do catálogo" → Catalog opens in order-context with a sticky bottom bar reading "0 itens · R$ 0,00 · Voltar ao pedido".
4. Tap a product → `ProductDetail`. Primary CTA reads "Adicionar ao pedido". Tap it. `AddToOrder` opens as a modal.
5. Pick a variant, tap `+` twice (qty = 2). The preview shows "Total da linha: R$ X" (derive by hand: 2 × unitPrice). Tap "Adicionar ao pedido". Modal dismisses; back on `OrderDraft` you see one line with qty 2, no discount chip.
6. Back to catalog, add two more products (one with qty 1, one with qty 3). Confirm the running total in the footer equals the hand-derived subtotal.
7. On line 2, tap the "Adicionar desconto" link → opens `AddToOrder` scoped to the line (or inline discount row, per final implementation). Set `%` mode, 10%. Save. Verify: green discount chip appears on the line; line total displays green (post-discount) with the original amount in grey strikethrough; `products.price` in the DB is unchanged (assert via the Watermelon dev inspector or the `noCatalogWrites` test).
8. Tap "Continuar" → `OrderSummary`. Breakdown shows: Subtotal, "Descontos por item" (green row), Total. No order-level row yet because order discount is 0.
9. Tap the `%` segment → switch to `R$` mode → type `5.00` on the keyboard (allowed in `R$` mode per UX1). Verify: "Desconto do pedido" row appears reading "−R$ 5,00"; total decreases by 5.00.
10. Tap "Salvar rascunho". Confirm navigation back to `OrderDraft` (or to Home — per final impl). Kill the app from the OS task switcher.
11. Reopen the app. Home's "Drafts in progress" shows 1 entry with the client name, item count 3, and the correct total. Tap it.
12. `OrderDraft` reopens with all three lines, the 10% line-2 chip, qty values intact, order-discount preserved. **This validates SC-002 (100% recovery).**
13. Tap "Continuar" → `OrderSummary` → "Enviar pedido". Verify: status becomes `sent`, `sentAtMs` populated; the draft disappears from Home "Drafts in progress".

## Cancel path — phone

1. Create a second draft with 1 item.
2. On `OrderDraft`, trigger the cancel affordance (design: tap "Cancelar rascunho" → button morphs into "Confirmar cancelamento"; tap again within 3s).
3. Verify: status = `canceled`, `canceledAtMs` populated; draft disappears from Home "Drafts in progress".

## Empty-draft path — phone

1. From client profile, tap "Novo pedido".
2. On `OrderDraft` with 0 items, verify: the empty-state hint is shown ("Adicione itens do catálogo para começar"); the "Enviar pedido" CTA is disabled.
3. Tap "Enviar pedido" — nothing happens. Try calling `ordersService.send(orderId)` from the dev console — expect `EmptyDraftError`.

## Tablet (820 × 1180) — abbreviated

Repeat the happy path + the cancel path on a tablet simulator. Verify:

- `OrderDraft / Tablet` uses the two-column layout (items left, summary sidebar right).
- `AddToOrder / Tablet` uses the two-column layout (product hero left, controls card right).
- `OrderSummary / Tablet` uses the two-column layout (items + order discount left, totals + CTAs right).
- All buttons and steppers remain tappable, sized correctly, no overflow.

## R5 audit

Run the `noCatalogWrites` test:

```bash
npm test -- noCatalogWrites
```

Expected: 0 references to catalog-table write APIs under `src/features/orders/**`. Also run the persistence test:

```bash
npm test -- ordersService.persistence
```

Expected: catalog row versions before and after a full assembly flow are identical.

## D4 audit

Run in the dev REPL (or temporarily wire `src/dev/auditStatuses.ts` to a dev-only screen):

```sql
SELECT DISTINCT status FROM orders;
```

Expected: subset of `{'draft', 'sent', 'canceled'}`. Any other value is a bug.

## Sync smoke

1. Ensure the device is online.
2. Force a sync via the home pull-to-refresh.
3. Verify in the Supabase dashboard: the new rows have `status` and `discount_mode` populated correctly. No NULL in either column.

## UI QA checklist (per frame)

Compare the running app against each of the six exported screenshots at 100% zoom on the target viewport. Any deviation greater than typography metrics or system chrome is a bug; file and fix before marking the feature complete.

## Exit criteria

- All 6 screens match their Pencil frames on both viewports.
- Happy path, cancel path, and empty-draft path all behave as above.
- `noCatalogWrites` + `ordersService.persistence` + `ordersService.transitions` + `computeOrderTotals` tests all pass.
- Sync smoke shows new columns populated correctly on Supabase.
- Home drafts list (008) correctly reflects draft count + totals.
