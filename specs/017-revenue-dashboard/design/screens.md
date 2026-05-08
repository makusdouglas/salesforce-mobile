# UI Design — Revenue Dashboard

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-25
**Style guide**: Anchored Ribbon Grid · Funnel Sans (headings) / Inter (body) / Geist (captions) · Lavender Cream palette · Basic Roundness · Gentle Lift

## Screens

| Screen | Frame ID | Screenshot | Intent |
|--------|----------|------------|--------|
| RevenueDashboard / Phone (admin) | `mgkvx` | [revenue-dashboard-phone.png](./revenue-dashboard-phone.png) | Full admin scope on phone — top bar + Vendedor/Período filters + KPI band + trend + seller ranking + top clients/products + aging |
| RevenueDashboard / Tablet (admin) | `2LUrw` | [revenue-dashboard-tablet.png](./revenue-dashboard-tablet.png) | Full admin scope on tablet — same panels with top clients/products side-by-side per FR-022 |
| RevenueDashboardSeller / Phone | `VKBOc` | [revenue-dashboard-seller-phone.png](./revenue-dashboard-seller-phone.png) | Seller scope on phone — no filter bar, no seller ranking; everything else identical |
| RevenueDashboardSeller / Tablet | `limaj` | [revenue-dashboard-seller-tablet.png](./revenue-dashboard-seller-tablet.png) | Seller scope on tablet — same panels, two-column top clients/products |

## Components referenced

This screen uses base shapes (frames, rectangles, ellipses, text, lucide icons) rather than the design-system component library — chart panels need pixel control. Design-system primitives borrowed for visual consistency:

- `lucide` icons for: `chevron-left` (back), `refresh-cw` (refresh), `users` (vendedor filter), `calendar` (período filter), `chevron-down` (chip dropdown), `arrow-up-right` / `arrow-down-right` (delta indicators).
- Color tokens follow the established `#FAFAFA` background, `#FFFFFF` cards, `#0A0A0A` text, `#737373` muted text, `#E4E4E7` borders, `#16A34A` positive deltas / Recebido series, `#DC2626` negative deltas / >90 aging, `#F59E0B` Pendente / 31–60 aging, `#EA580C` 61–90 aging — same scheme used by features 13 and 14.

## Design decisions

- **Single-screen, role-conditional layout**: One scrollable screen that hides Vendedor filter + seller ranking in seller scope. Avoids a second screen and keeps both code paths in one view tree (simplifies FR-001..FR-004).
- **Stacked tri-color trend bars**: Each month is one column with three stacked segments (Faturado on top, Recebido in middle/green, Pendente on bottom/orange). The legend names all three series. Active month label is bold (current "abr"). Tap target = full column.
- **KPI grid is 2+2+1 on phone, 2+2+1 (full-width) on tablet** — keeps tap targets large; the "Nº pedidos enviados" KPI gets its own row because it's a count, not a currency amount.
- **Aging bar chart uses horizontal proportional bars within each row** — easier to scan than 4 vertical bars on phone, and color-codes severity (green → amber → orange → red as bucket age grows).
- **Seller ranking on admin phone uses the first row as the implicit 100% "scale"** (Ana Lima fills the row, others scale relative to her). Saves vertical space vs. separate axis.
- **Filter chips**: Primary chip ("Todos") is solid black; "Período" chip is outlined. Visually establishes that vendedor is the default filter and período is secondary.
- **Comparison toggle ("Comparar com ano anterior")** sits above the chart, switched off by default. When on the chart adds a fainter overlay (not rendered in this static design but described in spec FR-013).
- **Empty states** (FR-040): each panel has a Portuguese empty-state copy — not visualized in this v1 design pass; will be handled in implementation.

## Open questions for the spec

None. The user's input was unusually thorough — every design decision derives from the description plus existing conventions in features 13/14. The placeholder flag was removed from all four frames after the design was finalized.
