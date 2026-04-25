# UI Design — admin-sellers

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-24

## Screens

| Screen | Frame ID (phone / tablet) | Screenshot (phone) | Screenshot (tablet) | Notes |
|--------|---------------------------|--------------------|---------------------|-------|
| Admin menu landing | `5r1fS` / `qAGM6` | [phone](./admin-menu-phone.png) | [tablet](./admin-menu-tablet.png) | Entry point under the Admin tab. Two cards: "Produtos" (package icon) and "Vendedores" (users icon). Phone stacks vertically; tablet stacks vertically at higher density (20pt corner, 24pt padding) so a 3rd card later wouldn't break the layout. |
| Sellers list | `yxfXA` / `kU63v` | [phone](./admin-sellers-list-phone.png) | [tablet](./admin-sellers-list-tablet.png) | Segmented filter (Todos / Ativos / Inativos). Phone has a compact topBar with a `+` icon; tablet has a primary "Novo vendedor" button in the topBar plus a search field. Inactive rows render at 75% opacity with a neutral "Inativo" badge; active rows get a green "Ativo" badge. |
| Seller form (create) | `6K3QQ` / `eDUrn` | [phone](./admin-seller-form-phone.png) | [tablet](./admin-seller-form-tablet.png) | Phone: vertical sections (Dados, Credencial, Status, danger zone). Tablet: centered 640pt card with Nome+E-mail in a horizontal row and credential choice presented as two picker cards (key icon / mail icon). Both variants show the credential choice as a required, two-way decision — no silent default. |
| Deactivate confirm | `t28UU` / `SW4Mf` | [phone](./admin-seller-deactivate-phone.png) | [tablet](./admin-seller-deactivate-tablet.png) | Destructive confirmation overlay. Red user-x icon, destructive red primary button. Copy names the seller explicitly ("Desativar Maria Silva?") and clarifies that historical orders keep the seller's name. |

## Components referenced

- None — all screens are built from primitive frames/text/icons so they stay self-contained; no dependency on the shadcn component library frames (`C:*`) imported into the file.

## Design decisions

- **Admin landing as a menu page, not a tab-bar sibling.** Avoids tab-bar bloat as more admin areas appear. Cards use neutral surfaces with a subtle border instead of shadow so they don't compete with the home dashboard's visual weight.
- **Filter as segmented control, search as separate row (tablet only).** Phone hides search behind the topBar; tablet surfaces it because there's space. This matches the product-list pattern shipped in feature 014.
- **Credential choice as a required two-card picker** (tablet) / **pill segmented control** (phone) rather than a dropdown — the admin sees both consequences before picking, and one option is pre-selected so the form stays single-decision if they skim.
- **Status toggle + danger zone are distinct controls.** The inline "Ativo" switch is reversible / idempotent. The separate "Desativar vendedor" button shares the same underlying action but forces a confirmation modal. Rationale: the switch feels lightweight for reactivation; the button carries the psychological weight needed for intentional offboarding.
- **Inactive rows at 75% opacity**, not hidden. An admin browsing "Todos" should see churn at a glance without having to switch filters.
- **Deactivation copy names the seller** ("Desativar Maria Silva?") to prevent wrong-row mistakes in long lists, and explicitly reassures about order history to remove hesitation.

## Open questions for the spec

- None — all requirements resolvable from these screens. The spec at `../spec.md` already encodes the self-deactivation guard and the invite-vs-password choice surfaced in these designs.
