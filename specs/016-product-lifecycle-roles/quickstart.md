# Quickstart — Product Lifecycle + Granular Admin Roles

**Feature**: `016-product-lifecycle-roles`

A smoke-test walkthrough a reviewer can follow in ~10 minutes to verify the feature end-to-end.

## Prerequisites

- Running the app at commit `HEAD` of `016-product-lifecycle-roles` on a simulator or device.
- Supabase has migration `0018_product_lifecycle_and_granular_roles.sql` applied. **Apply order matters**: run 0002–0017 first, then `seeds/0014_first_admin.sql` (so the user_roles table holds at least one admin row), THEN 0018. The `enforce_at_least_one_superuser` trigger installed by 0018 will reject every subsequent `user_roles` mutation if the table is empty when the trigger attaches — see the header comment in `0018_*.sql`.
- Two Supabase Auth users exist:
  - `owner@acme.test` — previously held `role = 'admin'` (legacy), now `superuser` after migration.
  - `prod@acme.test` — no roles yet.
- At least one product exists in the catalog (seeded or created via Admin Products in feature 014).
- At least one seller device logged in as a distinct user with `role = 'seller'`.

## 1. Verify the legacy admin migration (SC-006)

1. Sign in as `owner@acme.test`.
2. Open the Profile screen → the "Suas funções" section lists a single chip "Super usuário" (destructive style).
3. Tap the Admin tab — every tile renders (Produtos, Vendedores, Clientes, Usuários & Roles).
4. **Pass**: legacy admin is a superuser; no regression.

## 2. Grant a scoped role (US3)

1. As `owner@acme.test`, open Admin → "Usuários & Roles".
2. Tap `prod@acme.test`. The detail screen lists four role toggles: `manage-products`, `manage-salespersons`, `manage-clients`, `superuser`.
3. Toggle `manage-products` on, save. Expect a toast "Funções atualizadas".
4. Sign out and sign in as `prod@acme.test`.
5. The Admin tab renders with only the Products tile; "Usuários & Roles", Vendedores, and Clientes tiles MUST NOT appear.
6. **Pass**: granular role gates tiles correctly.

## 3. Deactivate a product (US1)

1. As `prod@acme.test`, open Admin → Produtos.
2. Tap a product. On the form, flip the Ativo toggle to Inativo and tap Desativar.
3. The confirmation modal shows "N rascunho(s) usam este produto" where N is the current count (may be 0).
4. Tap Confirmar. The form closes; the list row is now dimmed with an "Inativo" chip.
5. **Pass**: deactivation writes `active = false` and stamps `deactivated_at`.

## 4. Verify filter + search (US4)

1. On Admin → Produtos, the default filter is "Ativos". The inactive product from step 3 MUST NOT appear.
2. Tap the "Mostrar inativos" segment / "Todos" chip. The inactive product appears, dimmed.
3. Type part of the product's name in the search bar. The list filters in under 1 second.
4. **Pass**: filter and search behave as specified.

## 5. Seller catalog reflects deactivation (US1 follow-up)

1. Switch to the seller device.
2. Pull to refresh. Wait for the sync pill to go green.
3. Open the Catálogo. The deactivated product MUST NOT appear in the grid or in any category.
4. Use the seller search — the deactivated product MUST NOT appear in results.
5. **Pass**: propagation within the 30 s target (SC-001).

## 6. Draft with discontinued line (US2)

1. On the seller device, before step 5, create a draft containing the product that will be deactivated. Do not send it.
2. Perform steps 3–5.
3. Open the draft. A modal appears listing the discontinued line. Tap "Fechar" (do not remove).
4. Tap the Send action. It MUST remain disabled with an inline message about discontinued items.
5. Tap the draft item row → "Remover" (or open the alert again and tap "Remover linhas e continuar"). The line is gone; the Send action re-enables.
6. Send the draft. It completes normally.
7. **Pass**: draft is blocked until cleaned.

## 7. Repeat last order with a discontinued product (US2)

1. Still on the seller device, open a client profile whose last sent order included the now-inactive product.
2. Tap "Repetir último pedido".
3. A dialog appears: "Alguns produtos foram descontinuados — [name]. Continuar com os itens ativos?".
4. Tap "Continuar com ativos". A new draft opens with only the still-active items.
5. **Pass**: repeat flow never silently drops lines.

## 8. Historical order unchanged (US2 edge case)

1. Open the sent order from step 7's source. It MUST render every line verbatim, including the discontinued one. No alert fires.
2. **Pass**: history is immutable (FR-014).

## 9. Single-superuser safeguard (US3 edge case)

1. Sign in as `owner@acme.test` (the only superuser).
2. Open "Usuários & Roles" → self.
3. Toggle `superuser` off, save. Expect an inline error "Não é possível remover: o sistema precisa de pelo menos um Super usuário".
4. **Pass**: FR-025 holds.

## 10. Role mid-session change (US3 follow-up)

1. Sign in as `prod@acme.test`.
2. On another device, sign in as `owner@acme.test` and revoke `manage-products` from `prod@acme.test`.
3. Return to `prod@acme.test`'s device and briefly background the app, then foreground it.
4. The Admin tab MUST disappear without requiring a logout.
5. **Pass**: session re-evaluates roles on focus (SC-007).

## Pass criteria summary

All 10 steps MUST pass. If any step fails, capture a screenshot + the app's log output and file the regression before merging.
