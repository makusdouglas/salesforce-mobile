# UI Design — Order Assembly

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-23

## Screens

| Screen | Frame ID | Screenshot | Notes |
|--------|----------|------------|-------|
| OrderDraft / Phone | `Pt4Eg` | [order-draft-phone.png](./order-draft-phone.png) | Cart list with +/- qty steppers, line-level discount chip, footer subtotal + "Continuar". |
| AddToOrder / Phone | `JOHsf` | [add-to-order-phone.png](./add-to-order-phone.png) | Product sheet: variant chips, large qty stepper (no keyboard), %/R$ line-discount segmented control, live line-total preview, "Adicionar ao pedido". |
| OrderSummary / Phone | `Z36e3` | [order-summary-phone.png](./order-summary-phone.png) | Review step: client header, collapsed item list, order-level %/R$ discount stepper, totals breakdown, "Salvar rascunho" + "Enviar pedido". |
| OrderDraft / Tablet | `lmZZr` | [order-draft-tablet.png](./order-draft-tablet.png) | Two-column: item cards (left) + sticky summary sidebar with "Continuar" (right). |
| AddToOrder / Tablet | `8DyNk` | [add-to-order-tablet.png](./add-to-order-tablet.png) | Two-column: product hero + variants (left) + controls card with stepper, line discount, preview and CTA (right). |
| OrderSummary / Tablet | `JDXoD` | [order-summary-tablet.png](./order-summary-tablet.png) | Two-column: client header + item list + order discount (left) + totals + "Enviar pedido" / "Salvar rascunho" + status note (right). |

## Components referenced

- Design-system primitives inherited from [`layout.pen`](../../../layout.pen): top-bar pattern (56/64 px, `#FFFFFF` on `#E4E4E7` bottom stroke), card pattern (`#FFFFFF` + 1 px `#E4E4E7` stroke + 12–16 px radius), status chip (`#FEF3C7` + `#CA8A04`), success discount chip (`#ECFDF5` + `#A7F3D0` + `#047857`).
- Qty stepper: custom horizontal frame with pill radius, minus ghost, qty cell, filled primary plus button (`#171717`). Reused across OrderDraft rows, AddToOrder main stepper, and its discount stepper.
- Segmented control (`%` / `R$`): pill-shaped pair inside a `#F5F5F5` track; active segment is white with border.
- Dashed-outline "Adicionar item" CTA: stroke `#D4D4D8` with `dashPattern: [4, 4]`.

## Design decisions

- **+/- steppers are the primary path; direct numeric input is a supported secondary path (UX1).** Quantity can be edited either with the +/- stepper or by tapping the number to open the keyboard. For discounts: `%` mode is stepper-only (to prevent typos in an unbounded percent field); `R$` mode accepts a typed value directly. The stepper always stays visible so the salesperson never has to use a keyboard — but is not blocked from one.
- **Discounts are visual metadata on line / order, never on product prices (R5).** The product unit price stays immutable in every display ("R$ 39,00 / un"). Discounts show as green chips, green line-items, or green rows in totals. The AddToOrder footer and OrderSummary overallDisc card both carry an explicit "Os preços de catálogo não são alterados" note.
- **Status transitions visible in the UI.** The topbar "Rascunho" chip is present on OrderDraft (both viewports). OrderSummary/Tablet has a footer hint "Status: draft → sent ao enviar" to make the transition explicit to the salesperson. `canceled` is not surfaced in these flows; it lives in a later admin/history view.
- **Persistence (D4).** The "Salvar rascunho" secondary action appears on OrderSummary. OrderDraft's status chip shows "Salvo agora"; OrderDraft/Tablet header says "3 itens · salvo localmente". This implies rascunhos are persisted after each mutation; the Home "Drafts in progress" list (already in 008) is the recovery entry point.
- **Entry from client profile.** `ClientProfile / Phone` and `ClientProfile / Tablet` (existing frames `C0KRb`, `ymEhF`) already reserve a `bottomAction` region. The design assumes a primary "Novo pedido" CTA docks there; no new client-profile frame was required.
- **Two-column tablet layout.** AddToOrder/Tablet and OrderSummary/Tablet both use a primary/sidebar split. This keeps the summary and CTA visible while the salesperson edits the order — critical for offline draft assembly where restart resilience is a feature, not an exception.

## Open questions for the spec

- **Tax display.** Totals currently show subtotal → discounts → total. Whether tax (IVA/ICMS) appears, and whether it is computed before or after order-level discount, is not decided by the design. Spec must clarify.
- **Line-discount cap.** The design allows free typing on the stepper; spec should state the maximum allowed per-line discount (e.g., 100 % / full unit price) and the validation rule.
- **Overall-order discount on item with existing line discount.** The design stacks both (Descontos por item + Desconto do pedido). Spec must confirm stacking is allowed and define the order of application for the final total.
- **Minimum order total.** Whether an empty (0-item) draft is allowed to be sent, and whether drafts with items but total R$ 0 can be sent, needs a spec answer.
- **Canceled status entry.** Where does the salesperson cancel a draft? A confirmation affordance (long-press, menu, swipe) was not drawn; spec must choose.
