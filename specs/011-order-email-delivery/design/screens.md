# UI Design — Order Email Delivery

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-23

## Screens

| Screen | Frame ID | Screenshot | Notes |
|--------|----------|------------|-------|
| OrderSummary / Phone | `Z36e3` | [order-summary-phone.png](./order-summary-phone.png) | Existing screen — adds a "PDF + email para {client.email}" hint block above the action row; send button relabeled "Enviar por email". |
| OrderSummary / Tablet | `JDXoD` | [order-summary-tablet.png](./order-summary-tablet.png) | Same hint block in the right-column action stack; send button relabeled. |
| OrderSent / Phone | `K99dc` | [order-sent-phone.png](./order-sent-phone.png) | NEW confirmation state rendered after the salesperson returns from the OS share sheet — large check, order number `#2026-0412`, "PDF compartilhado via email" + recipient line, "Ver PDF salvo" (secondary) + "Concluir" (primary) bottom CTAs. |
| OrderSent / Tablet | `qWpse` | [order-sent-tablet.png](./order-sent-tablet.png) | Same content, two-column CTA row (both buttons side by side at the bottom). |
| PDF Template / A4 | `6iIjz` | [pdf-template-a4.png](./pdf-template-a4.png) | Reference layout for the generated quote PDF — header (order #, date, "Documento sem valor fiscal" marker), two-column Vendedor/Cliente block, line-item table (qty, product, unit price, discount, line total), right-aligned totals card (subtotal, per-item discounts, order discount, total), non-fiscal disclaimer footer. |

## Components referenced

- Existing button, card, and divider patterns from features 008 / 009 (`Enviar pedido` dark button, outlined secondary, alert cards).
- New inline hint block styled like the existing status hint (zinc-50 fill, rounded 10, mail icon + one-line text).

## Design decisions

- **One tap away from the mail intent.** The send button (`Enviar por email`) is the same primary dark button from 009 — this feature adds the share-sheet + PDF generation behind it, but the user interaction is identical until the OS intent appears.
- **Recipient visibility BEFORE the tap.** A small inline hint above the send button shows exactly which email the PDF will go to. If the client has no email, the same slot swaps to "Compartilhar PDF — sem email cadastrado" and the button label becomes "Compartilhar PDF" (same frame, conditional copy — kept in the spec, not mocked as a separate frame to avoid redundancy).
- **Confirmation screen is NOT a modal.** `OrderSent` is a full screen the app navigates to after `Linking` / `Share` returns. This gives the salesperson a moment of closure and a stable deep-link target for "show me the PDF I sent" without stacking dialogs.
- **Order number is human-readable.** `#YYYY-NNNN` where NNNN is a per-year counter. Generated locally at send time and persisted on the order row.
- **PDF is a quote/proposal document, not a fiscal invoice.** The A4 layout includes a prominent "Documento sem valor fiscal" marker in the header and a matching footer disclaimer so the document cannot be mistaken for a nota fiscal.
- **Prices and discounts mirror the summary.** Per-line unit price, per-line discount (percent shown as "−10%", amount shown as "−R$ 3,90"), order-level discount, and total — all read from the same `computeOrderTotals` function that drives the on-screen summary.

## Open questions for the spec

- **Client without email**: confirm the swap-to-generic-share behaviour vs. blocking the send until an email is captured. Design assumes swap (generic share), spec to confirm.
- **Retry after a share-sheet cancel**: the salesperson may dismiss the OS share sheet without actually sending. We need to define whether the draft stays in `draft` (no status change) — design assumes yes. Confirm that the order number is still pre-generated at send-intent (so the PDF filename is stable across retries) or only on confirmed-sent.
- **PDF filename**: design assumes `pedido-<orderNumber>-<client-slug>.pdf`. Confirm.
- **Order number collision**: the year-scoped counter needs a local allocator. Confirm whether pre-sync drafts on two devices can collide and what conflict resolution looks like.
- **i18n / locale**: dates on the PDF use `pt-BR` short form ("12 abr 2026"); currency is `R$` with comma decimal. Confirm these are the only locale variants in scope.
