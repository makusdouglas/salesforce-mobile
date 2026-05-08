# Quickstart — Admin-side Seller Management

A minimal happy-path walk-through you can run locally once tasks.md is done. Use this to sanity-check the implementation end-to-end.

## Prerequisites

- Supabase local project running (`supabase start`) OR a remote dev project with migrations `0001`–`0015` applied.
- At least one admin row in `user_roles` (either seeded by `supabase/seeds/0014_first_admin.sql` or inserted manually).
- App running against that Supabase (check `.env` for the right `SUPABASE_URL` / `SUPABASE_ANON_KEY`).
- The `SUPABASE_SERVICE_ROLE_KEY` secret set on the Edge Function environment (`supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`).
- Edge Function deployed: `supabase functions deploy admin-create-seller`.

## 1. Sign in as admin

1. Cold-start the app.
2. Unlock with your PIN / biometrics.
3. Sign in with the admin email + password.
4. Verify the **Admin** tab appears in the bottom tab bar (dual-role check).

## 2. Land on the Admin menu

1. Tap the Admin tab.
2. Expected: the **"Área administrativa"** heading renders with two cards — **Produtos** and **Vendedores**.
3. The Produtos card routes to the existing (feature 014) products list — unchanged behaviour.

## 3. Open the empty sellers list

1. Tap the Vendedores card.
2. If no sellers have been created yet, the empty state reads **"Nenhum vendedor ainda"** with a primary **"Criar vendedor"** CTA.
3. If any exist, the list is pre-filtered to "Todos"; toggle "Ativos" / "Inativos" works.

## 4. Provision a seller — invite mode

1. Tap "Criar vendedor" (phone FAB / tablet toolbar button).
2. Fill `name = "Maria Silva"`, `email = "maria@empresa.com"`.
3. Leave the credential picker on **"Enviar convite por e-mail"** (default).
4. Tap **Salvar**. A blocking spinner appears for ~1 s.
5. Expected: success returns to the list; Maria appears as **Ativo**.
6. Check the Supabase Auth dashboard — a new user exists with an invite sent.
7. Check `public.salespeople` — one new row, `active = true`.
8. Check `public.user_roles` — one new `(user_id, 'seller')` row.
9. Confirm the invited email received the magic link (local: check Supabase Inbucket at `http://localhost:54324`).

## 5. Provision a seller — password mode

1. Repeat step 4 with `email = "joao@empresa.com"`, picking **"Definir senha inicial"** and typing a password ≥ 8 chars.
2. Expected: João appears in the list; the provided password works for a fresh sign-in on a second device.

## 6. Edit a seller

1. Tap Maria's row. The editor opens, pre-filled.
2. Change the name to "Maria Silva Rodrigues". Tap Salvar.
3. Expected: list updates; Maria signs in next and the home greeting uses the new name.

## 7. Deactivate a seller

1. Open João's editor.
2. Tap **"Desativar vendedor"**.
3. Confirm the destructive modal ("Desativar João Pereira?").
4. Expected:
   - João's row now renders at 75% opacity with an **Inativo** badge.
   - João's open session (if any) is rejected on the next network-requiring action with "Conta desativada".
   - A sign-in attempt as João succeeds at the Auth layer but the app rejects the session (missing `seller` role).
   - Past orders placed by João still show his name.

## 8. Reactivate

1. Filter the list to **Inativos**.
2. Tap João's row → toggle **Ativo** back on → Salvar.
3. Expected: João can sign in again (using his existing password; the invite was already consumed).

## 9. Self-deactivation guard

1. Sign in as an admin who also has the `seller` role (dual-role user).
2. Go to Admin → Vendedores → open your own row.
3. Expected: the **Ativo** toggle is disabled with a tooltip "Você não pode desativar a si mesmo". The destructive button is also disabled.
4. Attempt to hit the RPC directly (`supabase.rpc('deactivate_seller', { p_auth_user_id: auth.uid() })`) — expect `cannot_deactivate_self`.

## 10. Non-admin cannot reach any of this

1. Sign in as a seller-only account.
2. Verify the Admin tab does **not** render.
3. Attempt a deep-link to `AdminSellersList` route (e.g., via the dev menu): expect the navigator to fall back to the sellers' home.
4. Attempt to call `listSellers()` via a debug hook: expect `RLS` to return 0 rows.
5. Attempt to call `admin-create-seller` with a seller JWT: expect **403 not_admin**.

If every step above passes, the feature is behaving to spec.
