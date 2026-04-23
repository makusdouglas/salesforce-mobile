# UI Design — Repeat Any Past Order

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-23

## Screens

| Screen | Frame ID | Screenshot | Notes |
|--------|----------|------------|-------|
| ClientProfile / Phone | `C0KRb` | [client-profile-phone.png](./client-profile-phone.png) | Dark primary "Repetir último pedido" hero above history; **every** history row now has a circular ↺ icon button on the right to repeat that specific order. |
| ClientProfile / Tablet | `ymEhF` | [client-profile-tablet.png](./client-profile-tablet.png) | Same model on tablet: hero card at top of history column + per-row ↺ button. |
| OrderSummary / Phone | `Z36e3` | [order-summary-phone.png](./order-summary-phone.png) | Existing screen reused; both repeat paths (hero and per-row) land here with the cloned draft pre-filled. |
| OrderSummary / Tablet | `JDXoD` | [order-summary-tablet.png](./order-summary-tablet.png) | Existing screen reused; same pre-filled landing behavior on tablet. |

## Components referenced

- Existing top-bar, store header, history card, and bottom-action patterns from feature 008 (Home/ClientProfile).
- Existing OrderSummary screens from feature 009 (Order Assembly) — no visual changes required.

## Design decisions

- **Two entry points, both primary, both ≤2 taps:**
  1. **Hero card** "Repetir último pedido" — one-tap shortcut for the most common case (repeat the most recent order). Shows that order's date, item count, and total so the salesperson confirms *what* they are repeating before tapping.
  2. **Per-row ↺ button** on every historical order card — lets the salesperson repeat *any* past order (not just the most recent). Tap the button → lands on OrderSummary with that order's items, quantities, and discounts cloned into a new draft.
- **"Novo pedido em branco" is demoted to a secondary outline button** (phone: bottom bar; tablet: top bar) so the repeat paths dominate visually when history exists.
- **Tapping the card body vs the ↺ icon:** the card body still opens the historical order for viewing (read-only via existing navigation); only the ↺ icon triggers the clone-to-draft action. This separation preserves the ability to inspect old orders without accidentally repeating them.
- **No intermediate confirmation screen.** Both repeat paths route straight to the existing OrderSummary — meeting the 2-tap ceiling (tap 1: hero or ↺; tap 2: Enviar).
- **Dimmed ↺ on cancelled orders** uses the same zinc-500 tone already applied to the cancelled card's text, so the action remains discoverable without competing with active orders.
- **Empty-history fallback is the existing `ClientProfileEmpty` screen.** Neither the hero card nor any ↺ button is rendered when history is empty.

## Open questions for the spec

- **Stale-price behavior** — when the cloned order references a product whose catalog price changed since, should the draft use the *current* catalog price (default) or the price captured at the historical order? Must be consistent across both repeat paths.
- **Unavailable items** — if a product from the cloned order has been deactivated/deleted, should the draft silently drop it, keep it with a warning badge, or block the repeat? Current design assumes "silent drop + toast on summary".
- **Discounts from the historical order** — order-level and line-level manual discounts are cloned as-is. Confirm that promotional/time-bounded discounts are NOT carried forward.
- **"Last order" status filter** — does the hero card target the last order regardless of status (Sent, Cancelled, Draft) or only the last Sent order? Design assumes last *Sent* order; the per-row ↺ is available on every order regardless of status.
- **Repeating a Draft** — does the ↺ button on a Draft order card clone it (creating a second draft) or resume it? Needs product decision.
