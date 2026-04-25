# UI Design — Product Lifecycle + Granular Admin Roles

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-24 (new frames built), 2026-04-24 (existing screens adjusted)
**Viewports**: Phone (390×844) + Tablet (820×1180) per constitution §5 UX5

## Screens

### Part A — Product deactivation

| Screen | Frame ID | Screenshot | Intent |
|--------|----------|------------|--------|
| AdminProductsList / Phone (modify) | `hq0zE` | [admin-products-list.png](./admin-products-list.png) | Add "Ativos / Inativos / Todos" segment + text search + dimmed "Inativo" rows. Adjustments applied during implement (same pattern as AdminSellersList). |
| AdminProductsList / Tablet (modify) | `luM9m` | — | Same deltas as phone, split layout preserved. |
| AdminProductForm / Phone (modify) | `ImfjY` | [admin-product-form.png](./admin-product-form.png) | Add Ativo/Inativo toggle row + secondary "Desativar" button (mirrors the STATUS section pattern from AdminSellerForm `6K3QQ`). |
| AdminProductForm / Tablet (modify) | `qmIMf` | — | Same deltas. |
| AdminProductDeactivateConfirm / Phone (new) | `3kyN7` | [admin-product-deactivate-confirm-phone.png](./admin-product-deactivate-confirm-phone.png) | Clone of AdminSellerDeactivateConfirm (`t28UU`); icon `package-x`, draft-usage count in body. |
| AdminProductDeactivateConfirm / Tablet (new) | `evhGY` | [admin-product-deactivate-confirm-tablet.png](./admin-product-deactivate-confirm-tablet.png) | Clone of `SW4Mf`. |
| DraftDiscontinuedAlert / Phone (new) | `A65W2` | [draft-discontinued-alert-phone.png](./draft-discontinued-alert-phone.png) | Amber `alert-triangle` icon; primary "Remover linhas e continuar", secondary "Fechar"; lists discontinued products in the body. |
| DraftDiscontinuedAlert / Tablet (new) | `5w1q2` | [draft-discontinued-alert-tablet.png](./draft-discontinued-alert-tablet.png) | Centered modal variant. |
| RepeatOrderDiscontinuedAlert / Phone (new) | `boQMF` | [repeat-order-discontinued-alert-phone.png](./repeat-order-discontinued-alert-phone.png) | Amber icon; primary (neutral dark) "Continuar com ativos", secondary "Cancelar". |
| RepeatOrderDiscontinuedAlert / Tablet (new) | `Yp9ot` | [repeat-order-discontinued-alert-tablet.png](./repeat-order-discontinued-alert-tablet.png) | Centered modal variant. |
| OrderAssemblyInactiveBlocked (state) | — (variant of `OrderAssembly`) | — | Non-modal toast/banner rendered inside the existing order-assembly screen when an inactive product is reached via cache or deep link. No new frame. |

### Part B — Granular admin roles

| Screen | Frame ID | Screenshot | Intent |
|--------|----------|------------|--------|
| AdminMenu / Phone (modify) | `5r1fS` | [admin-menu-phone.png](./admin-menu-phone.png) | Adds "Usuários & Roles" tile (`shield-check` icon) — visible only to superuser. |
| AdminMenu / Tablet (modify) | `qAGM6` | [admin-menu-tablet.png](./admin-menu-tablet.png) | Same tile added to the grid. |
| AdminUsersList / Phone (new) | `bObF0` | [admin-users-list-phone.png](./admin-users-list-phone.png) | Clone of AdminSellersList (`yxfXA`); rows list every user with role badges; segment "Todos / Admins / Vendedores". |
| AdminUsersList / Tablet (new) | `Nm3SK` | [admin-users-list-tablet.png](./admin-users-list-tablet.png) | Clone of `kU63v`; adds "Novo usuário" CTA + wider search. |
| AdminUserRolesForm / Phone (new) | `YL1iX` | [admin-user-roles-form-phone.png](./admin-user-roles-form-phone.png) | Clone of AdminSellerForm (`6K3QQ`); USUÁRIO section (read-only name + email), FUNÇÕES ADMIN section with role-picker pattern, SUPER USUÁRIO toggle. |
| AdminUserRolesForm / Tablet (new) | `zeSbE` | [admin-user-roles-form-tablet.png](./admin-user-roles-form-tablet.png) | Clone of `eDUrn`; wider card with the same sections. |
| ProfileScreen / Phone (modify) | existing | — | Appends "Suas funções" section with role chips below user info — delta applied during implement using the `Badge/Default`, `Badge/Destructive`, `Badge/Secondary` components from the design system. |
| ProfileScreen / Tablet (modify) | existing | — | Same addition. |

## Components referenced

Reusable components used in the new frames (verbatim — no new components introduced):

- `C:c8fiq` Switch/Checked · `C:fcMl6` Switch/Unchecked — Ativo/Inativo toggle, role toggles
- `C:YKnjc` Button/Destructive · `C:xPENL` Button/Large/Destructive — "Desativar" primary action
- `C:gou6u` Button/Large/Secondary · `C:C10zH` Button/Outline — cancel / secondary
- `C:OtykB` Dialog · `C:X6bmd` Modal/Center — modal shells (used by the 3 new alert frames)
- `C:UjXug` Badge/Default · `C:WuUMk` Badge/Secondary · `C:YvyLD` Badge/Destructive — "Inativo" chip + role badges
- `C:I9z29` List Search Box/Filled · `C:O0rdg` List Search Box/Default — AdminUsersList search
- `C:PbofX` Tabs · `C:coMmv` Tab Item/Active · `C:QY0Ka` Tab Item/Inactive — "Ativos / Inativos / Todos" segment + "Todos / Admins / Vendedores"
- `C:2JGXl` List Item/Checked · `C:qamCY` List Item/Unchecked — role toggle rows
- `C:pcGlv` Card · `C:PiMGI` Card Action — AdminMenu tiles, user list rows

## Design decisions

- **Dialog trio is one visual pattern**: product-deactivate (red), draft-discontinued (amber), repeat-discontinued (amber). Icon/title/body swap only — buttons and shape come from the shared dialog component.
- **Inactive product rows** render at `opacity: 0.5` with an "Inativo" destructive/outline badge next to the name. The analog already demonstrates this on AdminSellersList Row 3 (Ana Bezerra). AdminProductsList adoption is a 1:1 copy of that treatment.
- **Tap-first filter** uses the existing Tab/Segment pattern (`Ativos / Inativos / Todos` for products; `Todos / Admins / Vendedores` for users), not a hidden menu — aligns with UX1.
- **Discontinuation dialogs are blocking** (modal, not toast) because the user cannot proceed silently — drafts won't send and repeats won't clone without acknowledgment.
- **Role badge color mapping**: superuser → destructive (`#B91C1C` on `#FEE2E2`), manage-* → default (dark on `#F4F4F5`), seller → secondary/outline. Visible on AdminUsersList rows and ProfileScreen "Suas funções".
- **AdminMenu tile gating is visual** (hidden when role absent), not disabled — a non-superuser admin with only manage-products sees only the Products tile.
- **AdminUserRolesForm FUNÇÕES rows**: the cloned phone form shows the pattern with the existing STATUS toggle relabeled ("Super usuário" + description). The implement phase's T029 duplicates this toggle row 3 more times for `manage-products`, `manage-salespersons`, `manage-clients`. The pattern is fully demonstrated in the cloned frame — only repetition is pending.
- **AdminProductsList / AdminProductForm deltas** are applied during implement (T000k, T000l) since they are in-place modifications to existing finished frames, not new clones. The dialogs above are their counterparts that DO need fresh frames.

## Open questions for the spec

- None. Every requirement in `spec.md` traces to either a new frame above or a clearly-scoped delta against an existing finished frame.
