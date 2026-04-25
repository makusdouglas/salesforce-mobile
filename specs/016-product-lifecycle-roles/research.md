# Phase 0 Research — Product Lifecycle + Granular Admin Roles

**Date**: 2026-04-24
**Feature**: `016-product-lifecycle-roles`

## Unknowns extracted from Technical Context

The plan's Technical Context carried no `NEEDS CLARIFICATION` markers. Research below captures the decisions behind the non-obvious technical choices that emerged while writing the plan.

## R-001 — Soft delete vs. hard delete for product deactivation

- **Decision**: Soft delete via `products.active boolean default true` and `products.deactivated_at timestamptz`.
- **Rationale**: Hard delete would cascade into `order_items` and break feature 13's requirement to render discontinued lines verbatim in historical orders (FR-014). A soft flag preserves referential integrity and costs only two columns. This matches the pattern already used for `salespeople.active` (feature 15).
- **Alternatives considered**:
  - *Hard delete + historical snapshot column on `order_items`*: would require copying name/price/thumbnail into every order line, a schema change with three months of tech debt. Rejected per P3 (MVP simplicity).
  - *Status enum* (`active` / `discontinued` / `draft`): overkill — every decision so far is binary. The CHECK constraint is trivial; a richer enum is easy to add later if needed.

## R-002 — Where to run the "drafts using this product" count

- **Decision**: Run a direct authenticated SELECT against Supabase from the admin client at the moment the deactivation modal opens.
- **Rationale**: Admin flows are online per P6, so a network round-trip is acceptable. The query is `SELECT count(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = $1 AND o.status = 'draft'`, which is a single primary-key join and fast even without extra indexes. Running this on the client via the existing `supabase.from('orders')...` path avoids a new Edge Function or RPC.
- **Alternatives considered**:
  - *Server-side view with a materialised count*: premature optimisation; the order volume at MVP scale does not justify it.
  - *Compute the count on the seller's WatermelonDB and ship it via sync*: rejected because the admin needs the global count across all sellers, not just the admin's own drafts.

## R-003 — Diacritic-insensitive search on the client

- **Decision**: Normalise both the query and the compared field via `String.prototype.normalize('NFD').replace(/\p{Diacritic}/gu, '')` before a lowercase `includes` check.
- **Rationale**: The catalog size at MVP is ≤ 500 products; client-side filter is instant and avoids a server round-trip. Matches the approach used in feature 7's client search on `clients.name`.
- **Alternatives considered**:
  - *Postgres `unaccent()` extension + RPC*: more work, more server dependency, and the catalog is already on-device for the admin via the list read.
  - *Trigram indexes*: useful at 10k+ rows, not at 500.

## R-004 — Enum widening strategy for `user_roles.role`

- **Decision**: Keep `user_roles.role` as `text` with a CHECK constraint; widen the constraint in migration 0016 from `role in ('admin','seller')` to `role in ('seller','manage-products','manage-salespersons','manage-clients','superuser')`. Migrate existing `admin` rows to `superuser` in the same transaction.
- **Rationale**: Postgres native `enum` types are rigid — ALTER TYPE requires a follow-up ALTER COLUMN and cannot be done inside a transaction. A CHECK constraint is trivially reversible and plays well with RLS functions that accept `text`.
- **Alternatives considered**:
  - *Native enum*: migration hazard; rejected.
  - *Join table keyed on `roles.id`*: over-engineered for five fixed values that change rarely.

## R-005 — Single-superuser safeguard implementation

- **Decision**: A deferrable Postgres `AFTER DELETE OR UPDATE ON user_roles` trigger that raises `RAISE EXCEPTION 'at_least_one_superuser_required'` when the resulting row count for `role='superuser'` would be zero.
- **Rationale**: Client-side checks alone are bypassable (direct SQL via the dashboard, or a race where two superusers demote themselves simultaneously). A trigger is the only safe floor. `DEFERRABLE INITIALLY DEFERRED` lets the superuser-swap pattern ("demote old, promote new") run in a single transaction.
- **Alternatives considered**:
  - *Client-only guard*: inadequate; RLS and dashboard direct writes bypass it.
  - *SELECT count + explicit lock before each DELETE*: more code and more race-prone than a trigger.

## R-006 — `is_<role>()` helper functions

- **Decision**: Add per-role SQL helper functions — `is_superuser()`, `is_manage_products()`, `is_manage_salespersons()`, `is_manage_clients()`, `is_seller()` — that wrap `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = '<role>')`. Keep `is_admin()` from feature 014 but redefine it as `is_superuser()` so no policy that references `is_admin()` has to be rewritten during the migration window.
- **Rationale**: Policy bodies read cleanly (`is_superuser() OR is_manage_products()`) and the per-helper definition makes unit-testing straightforward. Keeping `is_admin()` as an alias for `is_superuser()` during the migration prevents breaking any policy we have not gotten to yet.
- **Alternatives considered**:
  - *Single `has_role(text)` function*: works but makes policy text noisier (`has_role('manage-products')` vs. `is_manage_products()`).
  - *Drop `is_admin()` in this migration*: risky because other features' migrations may reference it. Defer to a follow-up migration after this feature ships.

## R-007 — Seller-side inactive-product enforcement path

- **Decision**: Two layers — (1) catalog queries filter `active = true` at the WatermelonDB layer in `src/features/catalog/catalogSelectors.ts`; (2) order-assembly's `addLine` helper checks the product's `active` flag before persistence and refuses with an error that the UI converts into a banner. Draft open runs a fresh `SELECT * FROM products WHERE id IN (...) AND active = false` against WatermelonDB to detect newly-inactive lines.
- **Rationale**: Filtering in the selector is the single place the catalog grid/list reads from, so no UI component gets a stale reference. The `addLine` guard is defense-in-depth for deep links and cached taps. The draft-open re-check is needed because deactivation might have happened after the draft was created.
- **Alternatives considered**:
  - *Trigger a sync pull on every catalog open*: defeats P1 offline-first. Rejected.
  - *Push notification to the seller device on deactivation*: push notifications are in the "out of scope" list (§8).

## R-008 — Alert UX pattern for discontinued items in drafts and repeat flow

- **Decision**: Both alerts use the existing `Modal/Center` component with an `Alert/Default` body. Primary action buttons are destructive-style ("Remover linhas e continuar" / "Continuar com ativos") because they mutate the user's working state. Secondary is "Fechar" / "Cancelar".
- **Rationale**: Keeps visual consistency with AdminSellerDeactivateConfirm (the same pattern already used for a similar "this has consequences" moment). Cognitive load is minimal — two buttons, one sentence of body copy, and a bulleted list of affected items.
- **Alternatives considered**:
  - *Inline banner above the draft summary*: can be missed; does not force acknowledgment. Rejected because FR-010 and FR-011 require blocking until resolved.
  - *Automatic removal with an undo toast*: silently dropping lines violates the user-stated "never silently drop" principle from the command args.

## R-009 — Role changes propagating mid-session

- **Decision**: On app focus (AppState `active`) and on each successful sync pull, the session module re-reads `user_roles` for the current user and updates `session_state.roles`. The root navigator listens to `session_state.roles` and re-evaluates tile visibility.
- **Rationale**: Avoids forcing re-login for a role change (SC-007). The existing session module already exposes `session_state` as a reactive store from feature 014, so this is a one-line subscriber addition.
- **Alternatives considered**:
  - *Poll `user_roles` every N seconds*: wasteful; focus + sync covers 100% of the practical cases.
  - *Server-side invalidation via JWT claims*: JWTs are cached 60 minutes by default; claim-based invalidation would require rotating the access token, which is heavier than a focus-triggered SELECT.

## R-010 — Migration rollout ordering

- **Decision**: Migration 0016 runs column additions, role data rewrite, CHECK widening, helper function (re)definitions, and RLS rewrites in a single transaction. No application restart is required.
- **Rationale**: Running in a single transaction keeps the surface atomic — we either have the new role model or the old one. Legacy clients (pre-feature-016 app binaries) continue to work because `is_admin()` is redefined as `is_superuser()` and the migration turns every `admin` row into `superuser` before the constraint change.
- **Alternatives considered**:
  - *Two-phase migration* (column-add first, role-rewrite later): complicates rollback and expands the migration window. Not worth it at our scale.

## Open items

None. All decisions above are finalised; no downstream task needs further research.
