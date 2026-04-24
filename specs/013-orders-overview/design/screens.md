# UI Design — orders-overview

**Source**: [../../../layout.pen](../../../layout.pen)
**Captured**: 2026-04-24

## Screens

| Screen | Frame ID | Screenshot | Notes |
|--------|----------|------------|-------|
| OrdersList / Phone | `ywhNl` | [orders-list-phone.png](./orders-list-phone.png) | Top bar → month scrubber → summary (Faturado / Recebido / Pendente + progress) → status filter chips (Todos, Rascunhos, Pendente, Pago, Cancelados) → order rows showing client, total, status chip, payment chip, timestamp. |
| OrderDetail / Phone | `q9zUp` | [order-detail-phone.png](./order-detail-phone.png) | Read-only mirror of OrderSummary: top bar (order number + Enviado/Cancelado chip), client card (no Trocar), items list marked "Somente leitura", totals, receipts section with payment chip, footer with **Ver PDF** + **Lançar recebimento**. |
| OrdersList / Tablet | `ggUNH` | [orders-list-tablet.png](./orders-list-tablet.png) | Split layout: left pane (420 px) = month scrubber + summary + filters + list; right pane = detail preview of the selected order with stacked totals & receipts. Top bar hosts a search field. |
| OrderDetail / Tablet | `FY5dB` | [order-detail-tablet.png](./order-detail-tablet.png) | Full-screen fallback when deep-linked / accessed directly: wide top bar with title + both status chips + CTAs, two-column body (items left, totals & receipts right 320 px). |

## Design decisions

- **Payment status is UI-only.** Reuses the exact chip palette introduced in feature 012 — green `Pago` / yellow `Parcial · R$ …` / orange `Pendente` / red `Cancelado` / gray `Rascunho`. Never written back to `orders.status`.
- **Summary card aggregates only over the active filter window** (month + status chip + text query). Receipts count toward `Recebido` only when they belong to **sent** orders within the window — drafts and canceled orders are excluded from financial rollups.
- **Single timestamp column** per row: `atualizado` for drafts (uses `updated_at`), `enviado` for sent (uses `sent_at`), `cancelado` for canceled (uses `canceled_at`). Matches existing convention in feature 007 client history.
- **Tablet split panel** chosen over a navigation push so the seller can scrub the list and compare rows while inspecting a detail. On phone, tapping a sent/canceled row pushes a standalone OrderDetail; drafts push OrderDraft as today.
- **Read-only "Somente leitura" label** on items + no mutation controls in OrderDetail (no `Editar`, no discount widgets) — the same screen is reached from three entry points and must behave identically on all of them.
- **Receipts card inside OrderDetail** re-uses the 012 receipts list visual but strips the tap-to-retry affordance — the full list lives on `OrderReceiptsScreen` (accessible via the existing `Lançar recebimento` CTA in the footer).

## Open questions for the spec

- Month scrub range: cap at "earliest order the seller owns" or allow arbitrary backwards scrolling? (Default: cap, to avoid empty screens.)
- Search scope: client name + order number (#2041) confirmed. Should it also match items (e.g. "Pão francês")? (Default: **no** — would require joining order_items in the observable query and bloats the list pipeline.)
- Entry-point behavior on tablet: when accessed via the Home "Atividade recente" card or a deep-link, do we land on OrdersList/Tablet (split) or OrderDetail/Tablet (full)? (Default: OrdersList/Tablet with the row pre-selected — keeps the list in context.)
