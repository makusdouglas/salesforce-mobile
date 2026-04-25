# Research — Admin-side Seller Management

**Purpose**: Resolve every technical choice needed to implement the spec, so the plan and tasks can rely on confirmed decisions. Since the spec produced zero `[NEEDS CLARIFICATION]` markers, this file records the non-obvious decisions made during planning rather than research debt.

## Decision 1 — How to provision a seller atomically

- **Decision**: A single Supabase Edge Function (`admin-create-seller`) executes the three writes in order (Auth user → `salespeople` row → `user_roles` entry) inside a `BEGIN / COMMIT` with explicit cleanup of the auth user if later steps fail.
- **Rationale**: The Auth user cannot be created by a Postgres trigger — only the Supabase Admin API can, and that requires `service_role`. An Edge Function is the only place `service_role` can live outside the Supabase dashboard. Doing the Postgres writes inside a transaction after the Auth call gives us best-effort atomicity; the Auth call is the only step that cannot be rolled back transparently, so on failure of step 2 or 3 we call `supabase.auth.admin.deleteUser()` before surfacing the error to the client.
- **Alternatives considered**:
  - *Client-side orchestration with three sequential calls*: rejected — client would need `service_role` (D7 violation) and could fail between steps leaving orphaned records.
  - *Database trigger on `salespeople` insert*: rejected — triggers cannot call the Supabase Admin API; they'd still require a separate Edge Function, adding indirection without benefit.
  - *Two-step UI ("create on dashboard, then finish in app")*: rejected — fails FR-005 (atomicity) and SC-002 (zero partial states).

## Decision 2 — Initial credential: password vs invite

- **Decision**: The admin picks at create time. Both branches call the same Edge Function; the function detects which branch based on the presence of `password` in the body and calls `supabase.auth.admin.createUser({ password })` or `supabase.auth.admin.inviteUserByEmail(email)` accordingly.
- **Rationale**: Spec FR-004 forces an explicit two-way choice. Supporting both from one function keeps the client simple (one call) and lets us share the atomic rollback path.
- **Alternatives considered**:
  - *Only invite-by-email*: rejected — admins without reliable seller email addresses (some sellers use shared business emails) would be blocked.
  - *Only initial-password*: rejected — typing a password for someone else is insecure UX; invite is strictly better for sellers who own their email.

## Decision 3 — How deactivation revokes access

- **Decision**: A single SQL path inside the sellers-API client module does two writes in one RPC: `DELETE FROM user_roles WHERE user_id = $1 AND role = 'seller'` and `UPDATE salespeople SET active = false WHERE id = $1`. Wrapped in a PostgREST-compatible stored function `public.deactivate_seller(auth_user_id uuid)` to keep it atomic without a second Edge Function.
- **Rationale**: Deactivation does not need `service_role` — both tables are writable by admins via existing RLS. A database-side function keeps the two writes atomic and lets RLS enforce admin-only access without trusting the client to send both calls.
- **Alternatives considered**:
  - *Client sends two separate PostgREST calls*: rejected — if the second call fails, the seller has lost their role but `active` is still true; the list view would mislead the admin.
  - *Re-use the `admin-create-seller` Edge Function with a `mode: 'deactivate'` body*: rejected — conflates two flows into one function, adding branch complexity without a security benefit.

## Decision 4 — Reactivation rules

- **Decision**: A mirror stored function `public.reactivate_seller(auth_user_id uuid)` that does `INSERT INTO user_roles (user_id, role) VALUES ($1, 'seller') ON CONFLICT DO NOTHING` + `UPDATE salespeople SET active = true WHERE id = $1`. Does **not** reset the Auth user's password or regenerate an invite link — that is a separate admin action ("Enviar novo convite") in the seller editor.
- **Rationale**: Reactivation is the dual of deactivation at the authorisation layer but explicitly *not* at the credentials layer. If the inactive seller no longer remembers their password, they use the existing "Esqueci minha senha" flow. Keeping credentials out of reactivation keeps D7 simple.
- **Alternatives considered**:
  - *Reactivation triggers an auto-password-reset email*: rejected — surprising UX, and many reactivations happen for sellers who still know their password.

## Decision 5 — Self-deactivation guard

- **Decision**: Enforced at both layers.
  - Client: form disables the toggle + "Desativar vendedor" button when `seller.auth_user_id === session.user.id`, with a tooltip ("Você não pode desativar a si mesmo").
  - Server: `public.deactivate_seller()` raises an exception if `auth_user_id = auth.uid()`.
- **Rationale**: Client-side alone is insufficient (D7 — RLS is the final authority). Server-side alone gives a confusing UX (button is tappable but errors). Both layers is the pattern already used in feature 014.

## Decision 6 — Listing inactive sellers

- **Decision**: Default filter is "Todos" — inactive rows are shown at 75% opacity with a neutral "Inativo" badge. The segmented control lets the admin narrow to active or inactive.
- **Rationale**: Admins benefit from seeing churn; hiding inactives by default would force them to toggle every time. The visual dimming signals status without requiring an extra colour.
- **Alternatives considered**:
  - *Hide inactives by default*: rejected — a hidden list is where bugs go to die; an admin might recreate an email thinking the old seller is gone, then hit the "email already in use" error with no context.

## Decision 7 — Email immutability

- **Decision**: The email field is read-only after creation. If the email must change, the admin deactivates the old seller and creates a new one.
- **Rationale**: Changing the email on an Auth user + `salespeople` row + issuing a new confirmation email is a flow with its own edge cases (inflight sessions, pending invites, already-confirmed old email). None of those edges contribute to the MVP's core value. Deferring saves complexity with a known escape hatch.
- **Alternatives considered**:
  - *Allow email edit via an additional Edge Function path*: rejected — flagged as a "nice to have" for a future feature, not MVP.

## Decision 8 — Admin menu as a new screen

- **Decision**: Introduce `AdminMenuScreen` as the entry point behind the Admin tab, replacing the current direct route to `AdminProductsListScreen`.
- **Rationale**: Adding Sellers as a second tab-bar sibling would bloat the bottom tab and force a redesign the moment a third admin area appears. A single menu page scales linearly (one more card = one more row) and matches the pattern used elsewhere in the app.
- **Alternatives considered**:
  - *Second bottom tab*: rejected — UX regression, bar becomes crowded on phone.
  - *Dropdown inside the existing Products screen*: rejected — conflates two features in one screen; breaks deep-linking.

## Non-decisions

- **Master-admin / scoped admin roles**: Explicitly out of scope for this feature. User asked for a richer role model mid-flight; that work is deferred to feature 016 (to be specified) and will amend constitution D7. The 2-role model (`admin`, `seller`) stays intact here.
