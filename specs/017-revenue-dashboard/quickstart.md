# Quickstart — Revenue Dashboard (017)

This is the developer's "I want to run this feature locally and validate it" guide. Follow top to bottom.

## Prerequisites

- pnpm install completed (one new dep: `react-native-gifted-charts`).
- Supabase migration `0020_revenue_dashboard.sql` applied to the dev database.
- Existing demo data with at least 2 sellers, 2 months of orders, and partial receipts on some orders.

## 1. Install the new dep

```bash
pnpm add react-native-gifted-charts
```

No native config — Expo SDK 55 already includes `react-native-reanimated` and `react-native-svg` as transitive deps from existing libs.

## 2. Apply the migration

```bash
pnpm supabase db push        # or: psql ... -f supabase/migrations/0020_revenue_dashboard.sql
```

Smoke-test the role guard from `psql` while connected as a non-admin user:

```sql
select * from public.admin_revenue_kpis(null, current_date);
-- expected: ERROR  42501: insufficient_privilege
```

Switch to an admin role and retry:

```sql
select * from public.admin_revenue_kpis(null, current_date);
-- expected: 5 rows (one per KPI label).
```

## 3. Run the app

```bash
pnpm start
```

Sign in as a user with admin grade (or with both admin and seller roles for the dual-role flow).

## 4. Validate admin scope

1. AdminHome → tap **Receita** card. Confirm: top bar reads "Receita"; vendedor chip = "Todos"; período = current month.
2. Wait ≤ 3 s for KPIs/panels (SC-001 budget).
3. Verify all five KPIs have absolute values + signed delta with up/down icon.
4. Trend chart: 12 months, three series (legend matches colors).
5. Toggle "Comparar com ano anterior". When prior-year window has data, fainter overlay appears; otherwise toggle is disabled with hint copy.
6. Tap a month on the trend chart → OrdersOverview opens, filtered to that month, vendedor = "Todos".
7. Tap a seller bar in the ranking → vendedor filter on this screen jumps to that seller; every panel re-renders within 2 s (SC-005).
8. With a seller selected, tap a month again → OrdersOverview opens with both filters (month + seller).
9. Top clients: tap row 1 → opens client profile.
10. Top products: tap row 1 → opens AdminProductForm for that product.
11. Aging: confirm bars colored green / amber / orange / red as described in design.
12. Switch to "Todos" → all panels return to aggregated values.

## 5. Validate seller scope

1. Sign out, sign in as a seller (or use the seller home of a dual-role user).
2. Seller home: confirm new **Minha receita** tile sits next to Catálogo, Clientes, Pedidos, Rascunhos.
3. Put device in airplane mode.
4. Tap **Minha receita** → screen renders ≤ 1 s with all panels (SC-002), no spinner stuck on a network call.
5. Confirm seller ranking is **not** present and there is **no** vendedor filter chip.
6. Tap a month on the trend chart → OrdersOverview opens, scoped to the seller's own orders.
7. Tap a top product → catalog detail (feature 6) opens.

## 6. Validate sparse-data + empty states

Switch to a seller account with zero orders:

- KPIs: all `R$ 0,00`, deltas all "—".
- Trend chart: empty-state illustration with Portuguese copy (no broken chart).
- Top clients / top products: empty-state copy.
- Aging: "Sem pendências em aberto." instead of four empty bars.

## 7. Run the test suite

```bash
pnpm test src/features/revenue
pnpm test src/features/admin/revenue
```

All derivations + the admin client wrapper must be green.

## 8. Type check + lint

```bash
pnpm typecheck
pnpm lint
```

## 9. Manual viewport pass

Repeat steps 4 and 5 on a tablet simulator (iPad 11" portrait). Confirm:

- Top clients + top products render side-by-side.
- KPI band is legible with no horizontal scroll.
- Trend chart bars are spaced (not crammed).

## 10. Verify zero-write claim

Open the Supabase dashboard → `orders` and `payment_receipts` row counts before and after a 5-minute exploration of the dashboard. Counts must be identical (SC-009).

---

If any step fails, do not proceed to PR. The acceptance bar for this feature is "all 10 steps pass on both phone and tablet".
