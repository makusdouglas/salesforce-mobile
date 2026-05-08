# Feature Specification: Admin-side Seller Management

**Feature Branch**: `015-admin-sellers`
**Created**: 2026-04-24
**Status**: Draft
**Roles affected**: `admin` (seller accounts are created/edited but sellers themselves don't use these screens)
**Input**: User description: "Implement admin-side seller management on top of the foundation shipped in feature 14. Admin screens for listing existing sellers, creating a new seller (name, email, initial password or passwordless invite), editing (name, active/inactive flag), and deactivating a seller. Creating a seller requires creating a Supabase Auth user — which needs the service_role key and therefore MUST go through an Edge Function (admin-create-seller) invoked by the client; the client never holds service_role. The Edge Function also inserts the matching row in salespeople and assigns role 'seller' in user_roles atomically. Deactivation flips an active flag and revokes the 'seller' role but preserves the salespeople row for historical order references. RLS ensures only role 'admin' can invoke the Edge Function and write to salespeople or user_roles. Also add a layout for the ADMIN menu landing screen that lists admin areas (Products, Sellers)."

## UI Design *(primordial source)*

**Design source**: [design/screens.md](./design/screens.md) — generated from `layout.pen`

### Screens

| Screen | Phone | Tablet | Intent |
|--------|-------|--------|--------|
| Admin menu landing | [phone](./design/admin-menu-phone.png) | [tablet](./design/admin-menu-tablet.png) | Entry point behind the Admin tab; two cards ("Produtos", "Vendedores") route to each area. |
| Sellers list | [phone](./design/admin-sellers-list-phone.png) | [tablet](./design/admin-sellers-list-tablet.png) | Active + inactive sellers, filter chips (Todos/Ativos/Inativos), row → editor. |
| Seller form (create/edit) | [phone](./design/admin-seller-form-phone.png) | [tablet](./design/admin-seller-form-tablet.png) | Name + email + explicit credential choice (senha inicial vs convite), status toggle, danger zone. |
| Deactivate confirm | [phone](./design/admin-seller-deactivate-phone.png) | [tablet](./design/admin-seller-deactivate-tablet.png) | Destructive overlay naming the seller and reassuring about order history. |

### Design decisions carried into this spec

- Admin areas live behind a single landing screen rather than being spread across the bottom tab, so adding a new admin feature (Sellers) doesn't bloat the tab bar.
- Credential choice at creation is an explicit two-way segmented control so admins see the trade-off rather than defaulting silently.
- Deactivation is a destructive-looking action (red, confirm modal) to reinforce that the seller immediately loses the ability to sign in.
- Reactivation (flipping an inactive seller back to active) is supported from the editor but does **not** restore any historical credentials — the admin must send a new passwordless invite or set a new password.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See every seller at a glance (Priority: P1)

An admin opens the Admin menu, taps "Vendedores", and sees the full list of sellers the company has ever provisioned, with active status clearly distinguished from inactive.

**Why this priority**: Nothing else works without a list view. Before admins can edit or create, they need to know who already exists so they don't accidentally re-provision a seller who was only deactivated.

**Independent Test**: Seed at least one active seller and one inactive seller, log in as admin, navigate Admin → Vendedores, and verify both appear with their correct status badges.

**Acceptance Scenarios**:

1. **Given** the admin is on the Admin menu, **When** they tap the "Vendedores" card, **Then** the sellers list opens and shows all seller accounts grouped or filtered by active/inactive.
2. **Given** the sellers list is open, **When** the admin taps a row, **Then** the editor for that seller opens pre-filled with current name, email and active flag.
3. **Given** the sellers list is empty, **When** the admin opens it, **Then** an empty-state explains "Nenhum vendedor ainda" and offers a prominent "Criar vendedor" call-to-action.

---

### User Story 2 - Provision a new seller end-to-end (Priority: P1)

An admin creates a brand-new seller by entering name and email and choosing either an initial password they type on the admin's behalf, or a passwordless invite (magic-link email) so the seller sets their own password on first sign-in.

**Why this priority**: This is the reason the feature exists. Without it admins have to go to the Supabase dashboard and manually create auth users + salespeople rows + user_roles — an error-prone process that the feature is meant to eliminate.

**Independent Test**: From an admin session, open Admin → Vendedores → "Criar vendedor", fill in a fresh email, pick "Enviar convite", submit, and verify (a) a success state appears with the seller's name, (b) the seller shows up in the list as active, (c) the invited email receives the magic-link email, (d) signing in as that seller succeeds and the home screen greets them by name.

**Acceptance Scenarios**:

1. **Given** valid name + unused email + "Definir senha inicial", **When** the admin submits the form, **Then** the seller is created with the given credentials and shows up in the list as active.
2. **Given** valid name + unused email + "Enviar convite por e-mail", **When** the admin submits, **Then** the seller is created as active, no password is stored on the admin's device, and an invite email is dispatched by Supabase.
3. **Given** the email is already in use by another seller (active or inactive) or by any other Supabase user, **When** the admin submits, **Then** a clear inline error appears ("Este e-mail já está em uso") and no partial record is created.
4. **Given** any step of the atomic creation fails (auth user, salespeople row, or role assignment), **When** the error occurs, **Then** the system rolls back all three so no orphaned auth user or role remains.
5. **Given** a non-admin user attempts to invoke the creation endpoint directly (e.g., via a debugger), **When** the request is received, **Then** it is rejected with a permission error before any write happens.

---

### User Story 3 - Edit a seller's profile (Priority: P2)

An admin opens a seller from the list and updates their display name, or toggles the active flag to disable/re-enable access.

**Why this priority**: Needed in practice (typos on creation, name changes) but not part of the first working slice — the app remains usable with US1 + US2 alone.

**Independent Test**: Create a seller, open the editor, change the name from "Maria" to "Maria Silva", save, and verify the change is reflected in the sellers list and on that seller's next session greeting.

**Acceptance Scenarios**:

1. **Given** the editor is open for an active seller, **When** the admin changes the name and saves, **Then** the new name is persisted and visible in the list.
2. **Given** the editor is open, **When** the admin toggles "Ativo" to off and confirms, **Then** the seller becomes inactive immediately (see US4).
3. **Given** the admin edits an inactive seller, **When** they toggle "Ativo" to on, **Then** the seller is reactivated — their role is re-granted and they can sign in again (provided they still know a valid credential; otherwise admin uses "Enviar novo convite").
4. **Given** the admin tries to change the email field, **When** they attempt to save, **Then** either the field is read-only with a tooltip explaining why, or the change is rejected with a clear message. *(Assumption: email is immutable post-creation to avoid auth-side inconsistency.)*

---

### User Story 4 - Deactivate a seller without losing history (Priority: P2)

An admin deactivates a seller who no longer works at the company; the seller can no longer sign in, but their historical orders remain attributed to them.

**Why this priority**: Closely tied to US3. Useful on day one but the system is still shippable if admins have to contact support for the first offboarding.

**Independent Test**: Create a seller, have them place an order, deactivate them, then (a) confirm the seller cannot sign in, (b) confirm their past orders still show them as the salesperson, (c) confirm no rows in `salespeople` were physically deleted.

**Acceptance Scenarios**:

1. **Given** an active seller, **When** the admin deactivates them from the editor and confirms, **Then** the seller's `seller` role is revoked and their active flag is set to false.
2. **Given** a deactivated seller, **When** they attempt to sign in, **Then** the authentication step succeeds (the auth user still exists) but the app rejects the session with "Conta desativada" because they no longer have the `seller` role.
3. **Given** orders that were placed by a now-deactivated seller, **When** anyone views those orders, **Then** the seller's name is still attached to them (the `salespeople` row was not deleted).
4. **Given** the admin deactivates and immediately reactivates the seller, **When** the reactivation confirms, **Then** the seller's role is restored and they can sign in again without re-onboarding.

---

### User Story 5 - Admin menu as a single entry point (Priority: P3)

An admin opens the Admin bottom-tab and lands on a menu screen listing the admin areas (Produtos, Vendedores) as cards instead of going straight to one area.

**Why this priority**: Organisational polish. If Sellers shipped as another bottom-tab sibling of Products, the product would still work — but every new admin area would either collide with a tab or force a redesign. The menu screen is cheap now and prevents that churn.

**Independent Test**: Log in as admin, tap the Admin tab, and verify you see a landing screen with two cards ("Produtos", "Vendedores") and that tapping each routes correctly. Logging in as a non-admin must not show the Admin tab at all.

**Acceptance Scenarios**:

1. **Given** the admin taps the Admin tab, **When** the screen renders, **Then** two cards ("Produtos" and "Vendedores") are visible with a short description under each.
2. **Given** a dual-role user (admin + seller), **When** they open Admin → Vendedores, **Then** their own seller record is listed and editable (but they cannot deactivate themselves — see Edge Cases).
3. **Given** a seller-only user, **When** the app renders the tab bar, **Then** the Admin tab is not visible at all.

### Edge Cases

- **Admin deactivates their own seller record (dual-role user)**: the app must refuse and explain why ("Você não pode desativar a si mesmo"). Otherwise they'd lose their own access.
- **Admin toggles active on a seller who has pending unsynced orders**: deactivation proceeds — orders are seller-attributed but the inactive flag doesn't rewrite history.
- **Network drop mid-creation**: the Edge Function is atomic; the client shows a retry affordance and never a partial "half-created" seller.
- **Invited seller never opens the magic link**: their record stays active but unusable; the admin can "Reenviar convite" from the editor.
- **Seller tries to sign in after deactivation**: handled by US4 AS2 (session rejected client-side with "Conta desativada").
- **Admin enters an email that matches a non-seller Supabase user (e.g., an admin-only account)**: rejected with "Este e-mail já pertence a outro usuário" — no attempt to retrofit a role onto an existing user.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Admin tab MUST render a landing menu screen with at least two cards ("Produtos", "Vendedores"); a non-admin MUST NOT see the Admin tab or reach any admin route.
- **FR-002**: The sellers list MUST show every seller ever created (active or inactive), with name, email, active/inactive status, and optionally a last-activity hint.
- **FR-003**: The sellers list MUST provide a visible path to create a new seller and to open each seller in the editor.
- **FR-004**: The create-seller form MUST require a non-empty name and a syntactically-valid email, and MUST force the admin to choose between (a) typing an initial password or (b) sending a passwordless invite.
- **FR-005**: Creating a seller MUST be atomic across three effects — provisioning the auth user, inserting the `salespeople` row, and assigning the `seller` role — such that any failure leaves zero of them in place.
- **FR-006**: Creating a seller MUST be done server-side using a service-role credential that the client never possesses, exposed to the client only as an invokable endpoint.
- **FR-007**: The server-side endpoint MUST reject any caller that does not have the `admin` role.
- **FR-008**: The sellers list, create form, and editor MUST be unreachable (and their write paths MUST be rejected) for any caller that is not an admin, enforced at the database level as well as the UI level.
- **FR-009**: The editor MUST allow editing the name and toggling the active flag; the email field MUST NOT be editable post-creation.
- **FR-010**: Deactivating a seller MUST revoke the `seller` role immediately AND flip an `active` flag on the `salespeople` row; it MUST NOT delete the `salespeople` row.
- **FR-011**: Reactivating a seller MUST restore the `seller` role and set `active` back to true, without recreating any historical data.
- **FR-012**: A deactivated seller MUST NOT be able to obtain a session with `seller` privileges; the app session layer MUST treat missing `seller` role as "Conta desativada".
- **FR-013**: Past orders attributed to a seller MUST continue to display that seller's name after deactivation.
- **FR-014**: An admin MUST NOT be able to deactivate or delete their own seller record from this screen; the UI MUST disable the action and the server MUST reject it.
- **FR-015**: Attempting to create a seller with an email that already exists in Supabase Auth MUST fail cleanly with a user-readable error and MUST NOT create or modify any record.
- **FR-016**: When an invite-based creation is chosen, the invite email MUST be sent by Supabase (magic link) with no password stored client-side or on the admin's device.
- **FR-017**: All admin-side writes to seller-related data MUST be reflected across devices via the existing sync engine within the app's standard sync window.

### Key Entities

- **Seller**: A user who places orders on behalf of the company. Represented by three linked artifacts: a Supabase Auth user (owns credentials/sign-in), a `salespeople` row (owns the business profile — name, id used for order attribution, active flag), and a `user_roles` entry assigning the `seller` role.
- **Admin**: A user with the `admin` role (from feature 014); the only actor who can reach the sellers screens or invoke the create endpoint.
- **Invite**: A short-lived, one-time-use link emailed to a newly-created seller that lets them set their first password.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can provision a new, usable seller end-to-end in under 90 seconds from opening the app to the seller being listed as active.
- **SC-002**: 100% of seller-creation attempts either fully succeed (all three linked records present) or fully fail (zero records present) — never partial.
- **SC-003**: 100% of non-admin attempts to reach seller-management endpoints or screens are rejected, verified by an automated RLS/permissions test suite.
- **SC-004**: Deactivating a seller prevents their next sign-in attempt from obtaining a seller session in under 10 seconds (time for role-revocation to propagate).
- **SC-005**: Deactivating a seller preserves 100% of their historical order attribution — zero orders become orphaned or re-attributed.
- **SC-006**: After one admin training session, admins can create, edit and deactivate sellers without assistance (qualitative: measured by zero support escalations in the first sprint post-launch).

## Assumptions

- The `admin` role, the `user_roles` table, and the `is_admin()` RLS helper shipped in feature 014 are reused as-is; this feature does not redefine them.
- The `salespeople` table already exists (from prior features) and has or can gain a boolean `active` column; a migration adds it if missing.
- Email addresses are immutable post-creation for this feature. If an email must change, the admin deactivates the old seller and creates a new one — this is acceptable because email changes are rare.
- Passwordless invites rely on Supabase's built-in invite flow (`inviteUserByEmail`); no custom email templates are required for v1, but the existing project branding in Supabase applies.
- The Edge Function runtime (Supabase Edge Functions / Deno) and a service-role secret are available in all relevant environments (dev, preview, production).
- Only one admin-menu card per admin area for now ("Produtos", "Vendedores"); adding more cards later is a trivial follow-up and not part of this spec.
- The bottom-tab visibility rules introduced in feature 014 already hide the Admin tab from non-admins; this feature only adds content behind that tab.
- Sync propagation between devices uses the existing pull trigger added in feature 014; no new sync mechanics are introduced here.
