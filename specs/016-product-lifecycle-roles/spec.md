# Feature Specification: Product Lifecycle + Granular Admin Roles

**Feature Branch**: `016-product-lifecycle-roles`
**Created**: 2026-04-24
**Status**: Draft
**Roles affected**: `admin` (multi-role: `superuser` / `manage-products` / `manage-salespersons` / `manage-clients`) + `seller` (consumes the inactive-product rules)
**Input**: User description: "Ship two tightly related admin refinements on top of features 6, 9, 10, 14, 15. PART A — product deactivation lifecycle; PART B — granular admin roles replacing the single 'admin' flag."

## UI Design *(primordial source)*

**Design source**: [design/screens.md](./design/screens.md) — generated from `layout.pen`

### Screens

| Screen | Screenshot | Intent |
|--------|------------|--------|
| AdminProductsList (modify) | [admin-products-list.png](./design/admin-products-list.png) | Adds "Mostrar inativos" tap-first filter, free-text search, dimmed inactive rows with "Inativo" chip |
| AdminProductForm (modify) | [admin-product-form.png](./design/admin-product-form.png) | Adds Ativo/Inativo toggle row + secondary "Desativar" button |
| AdminProductDeactivateConfirm (new) | [analog](./design/admin-seller-deactivate-confirm-analog.png) | Clone of AdminSellerDeactivateConfirm; shows count of drafts using the product |
| DraftDiscontinuedAlert (new) | — | Modal on draft open listing discontinued lines; primary "Remover linhas e continuar" |
| RepeatOrderDiscontinuedAlert (new) | — | Modal before clone listing discontinued products; primary "Continuar com ativos" |
| AdminMenu (modify) | [admin-menu.png](./design/admin-menu.png) | Adds "Usuários & Roles" tile (superuser only); all tiles gated by role |
| AdminUsersList (new) | [analog](./design/admin-sellers-list-analog.png) | Clone of AdminSellersList; rows show role badges; search + role filter chip |
| AdminUserRolesForm (new) | [analog](./design/admin-seller-form-analog.png) | Clone of AdminSellerForm; toggle list of admin-grade roles |
| ProfileScreen (modify) | — | Appends "Suas funções" section with role chips |

Every screen has Phone + Tablet variants per constitution §5 UX5.

### Design decisions carried into this spec

- New screens are textual-delta clones of existing, finished analogs — layout, spacing, typography, and components are inherited verbatim.
- Inactive filter uses the existing Tab/Segment pattern (tap-first), not a hidden menu — aligns with UX1.
- Discontinuation dialogs are **blocking modals**, not toasts, because the user must acknowledge before proceeding.
- Role badges use a fixed color mapping (superuser → destructive, manage-* → default, seller → secondary) reused on AdminUsersList rows and the ProfileScreen "Suas funções" section.
- AdminMenu tiles are **hidden** (not disabled) when the required role is absent.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin deactivates a product so it disappears from the seller catalog (Priority: P1)

A product-manager admin (`manage-products` or `superuser`) discovers that a SKU has been discontinued by the supplier. They open the product in `AdminProductForm`, flip the Ativo toggle to Inativo, confirm in a dialog that surfaces how many drafts currently include the product, and expect every seller's catalog — after the next sync — to stop offering it.

**Why this priority**: The entire reason to ship this lifecycle is to stop sellers from placing orders for products that can't be fulfilled. Without this, sellers keep adding inactive SKUs to drafts and customers receive invalid quotes.

**Independent Test**: Sign in as an admin with `manage-products`, deactivate one product, pull-to-refresh on a seller device, confirm the product is absent from the catalog grid and no longer addable to a new draft.

**Acceptance Scenarios**:

1. **Given** an active product P exists, **When** the admin toggles it to Inativo and confirms, **Then** `products.active` becomes `false`, `products.deactivated_at` is set to the confirmation timestamp, and the row in `AdminProductsList` renders dimmed with an "Inativo" chip.
2. **Given** the admin initiates deactivation of product P, **When** the confirmation dialog opens, **Then** it MUST display the number of draft orders across all sellers that currently include P (zero-safe — the dialog still opens when count is 0).
3. **Given** product P has been deactivated and the seller device has completed the next sync pull, **When** the seller opens the catalog, **Then** P MUST NOT appear in the grid, search results, or category filters.
4. **Given** product P is inactive, **When** the admin reopens `AdminProductForm` for P and toggles back to Ativo, **Then** `products.active` becomes `true`, `products.deactivated_at` is cleared, and P reappears in seller catalogs on the next sync.

---

### User Story 2 — Seller cannot add or send a discontinued product, with clear acknowledgment (Priority: P1)

A seller opens a draft on a bus ride (offline). The draft was started before an admin deactivated one of its line items. The seller must understand what's wrong and how to resolve it without contacting support.

**Why this priority**: Silent failures (or letting a discontinued line ship in a quote) destroy the data-integrity guarantee the feature is supposed to provide. This story protects every draft, repeat-order, and manual-add path.

**Independent Test**: With a seller logged in, create a draft containing product P, sync, deactivate P as admin, sync the seller again, reopen the draft, verify the alert fires and the send action stays blocked until the line is removed.

**Acceptance Scenarios**:

1. **Given** a draft order D contains a now-inactive product P, **When** the seller opens D, **Then** a modal lists each discontinued line by product name and offers "Remover linhas e continuar" as the primary action and "Fechar" as secondary.
2. **Given** the seller dismisses the modal without removing lines, **When** they tap the send/email action, **Then** sending MUST be blocked and an inline message explains the draft still contains discontinued items.
3. **Given** a seller is on the order-assembly screen and invokes "repeat last order" from a source order that contains discontinued products, **When** the pre-clone dialog appears, **Then** it lists every discontinued line by name and offers "Continuar com ativos" (clones only still-active lines) and "Cancelar" (no draft created) — the flow MUST NEVER silently drop lines.
4. **Given** a seller attempts to add product P via a deep link or cached reference on the catalog screen, **When** P is inactive, **Then** the add control MUST block the action and surface a non-modal banner "Produto descontinuado".
5. **Given** a sent or canceled order O contains discontinued lines, **When** the seller opens OrderDetail or a payment receipt linked to O, **Then** the discontinued lines render verbatim (historical record) — the alert MUST NOT fire on immutable history.

---

### User Story 3 — Superuser assigns granular admin roles to a teammate (Priority: P1)

An organization owner (superuser) wants to give a teammate access to manage products only — not sellers or clients. Today the system has a single `admin` flag that grants everything; the teammate would see every admin screen including sensitive seller/client data.

**Why this priority**: The whole point of the granular-roles scope is to support delegation without over-sharing. Until this ships, every admin is effectively a superuser.

**Independent Test**: Sign in as a superuser, open "Usuários & Roles", select a user, toggle on `manage-products`, sign in as that user on another device, confirm only the Products tile appears under the Admin tab.

**Acceptance Scenarios**:

1. **Given** a user U with no admin-grade roles, **When** the superuser toggles `manage-products` on in `AdminUserRolesForm` and saves, **Then** U's `user_roles` table gains the row and U's next session shows the Admin tab with only the Products tile.
2. **Given** a user U carries `manage-salespersons`, **When** U signs in, **Then** the Admin tab shows only the Sellers tile; the Products, Clients, and "Usuários & Roles" tiles MUST NOT render.
3. **Given** a user U carries `superuser`, **When** U signs in, **Then** every admin-grade tile renders — including "Usuários & Roles" — and every RLS-protected admin operation succeeds.
4. **Given** a non-superuser admin U, **When** U opens the Admin tab, **Then** the "Usuários & Roles" tile MUST NOT appear and any attempt to reach the AdminUsersList route directly MUST be blocked by the navigator.
5. **Given** a legacy user L with role `admin` from feature 14, **When** the data migration runs, **Then** L's role becomes `superuser` and every legacy capability remains intact.

---

### User Story 4 — Admin finds a product fast among many (Priority: P2)

An admin managing a 500-SKU catalog needs to locate one product to edit or deactivate. Scrolling alone is too slow.

**Why this priority**: Quality-of-life for the admin workflow. Not required for correctness, but the list becomes unusable at scale without search + filter.

**Independent Test**: Populate ≥ 50 products (mix of active/inactive), open AdminProductsList, use the search bar and the "Mostrar inativos" toggle, verify filtered results in under 1 second.

**Acceptance Scenarios**:

1. **Given** AdminProductsList is open, **When** the admin types into the search input, **Then** the list filters to products whose name or category contains the query (case-insensitive, diacritic-insensitive).
2. **Given** AdminProductsList is open with the default filter, **When** the admin views the list, **Then** only active products MUST appear.
3. **Given** AdminProductsList is open, **When** the admin taps "Mostrar inativos", **Then** inactive products join the list, rendered dimmed with an "Inativo" chip; tapping the chip/filter again returns to the active-only view.
4. **Given** the combined filter (search + "Mostrar inativos" on) yields zero matches, **When** the results render, **Then** an empty state explains the filters and offers to reset them.

---

### User Story 5 — User sees their own active roles (Priority: P3)

Every signed-in user wants to know which capabilities they currently have, both for self-awareness and to confirm a role grant from a superuser.

**Why this priority**: Transparency and trust. Not blocking for feature correctness but materially reduces support questions like "why can't I see X?".

**Independent Test**: Sign in as any user, open the profile screen, verify a "Suas funções" section lists every role as a chip with the agreed color mapping.

**Acceptance Scenarios**:

1. **Given** any signed-in user, **When** they open the profile screen, **Then** a "Suas funções" section lists each active role as a chip with human-readable labels in Portuguese ("Gerenciar produtos", "Gerenciar vendedores", "Gerenciar clientes", "Super usuário", "Vendedor").
2. **Given** the user has no roles, **When** they open the profile screen, **Then** the section renders a friendly empty state ("Sem funções atribuídas") — the section MUST NOT disappear silently.

---

### Edge Cases

- **Offline deactivation attempt by admin**: admin operations are online-required (constitution P6). If the admin triggers deactivate while offline, surface the existing offline-guard and do nothing — do NOT queue the write.
- **Draft containing an inactive product is opened mid-sync**: if the background pull flips a product to inactive while the draft screen is visible, the alert MUST fire on the next user interaction (focus event) rather than only on initial mount.
- **Repeat-last-order where ALL source lines are inactive**: the dialog lists every discontinued line and the "Continuar com ativos" button is disabled; only "Cancelar" is available. No empty draft is created.
- **Product reactivation**: a reactivated product reappears in seller catalogs on next sync. Existing drafts that were blocked by the alert can now be sent without changes.
- **Superuser demotes themselves**: if the only remaining superuser removes their own `superuser` role, the system MUST block the save (client + RLS) — at least one superuser MUST always exist.
- **Concurrent role toggles**: two superusers edit the same user simultaneously; last-write-wins on the `user_roles` table per row, per standard sync conflict rules (constitution D1).
- **Stale session after role change**: if a user's roles change mid-session, the navigator re-evaluates tile visibility on next app focus or sync; the user does NOT need to re-login.
- **Legacy `admin` role during migration window**: RLS must accept BOTH `admin` and `superuser` during the migration so in-flight sessions do not break; the migration then rewrites all `admin` rows to `superuser`.
- **Deactivating a product while a draft is being assembled**: the active order-assembly screen SHOULD refresh its catalog list on next focus; lines already added to the active draft remain visible but the send action blocks with the same alert as existing-draft open.
- **Search query with special characters**: search MUST handle whitespace, punctuation, and diacritics gracefully (e.g., "Café Espresso" matches "cafe espresso").

## Requirements *(mandatory)*

### Functional Requirements

#### Part A — Product lifecycle

- **FR-001**: The `products` entity MUST gain an `active` boolean column (default `true`) and a nullable `deactivated_at` timestamp column; both MUST be synced to every seller device via the existing sync engine (feature 5).
- **FR-002**: `AdminProductForm` MUST expose an Ativo/Inativo toggle control and a secondary "Desativar" action that opens a confirmation modal.
- **FR-003**: The deactivation confirmation modal MUST display the count of draft orders (status `draft`) across all sellers that currently include the product.
- **FR-004**: On confirmation, the system MUST set `active=false` and `deactivated_at=NOW()` in a single atomic Supabase UPDATE; on reactivation, `active=true` and `deactivated_at=NULL`.
- **FR-005**: `AdminProductsList` MUST default to showing only active products, with a tap-first filter control ("Ativos" / "Inativos" / "Todos") to include inactive rows.
- **FR-006**: `AdminProductsList` MUST include a free-text search input that filters on product name and category (case-insensitive, diacritic-insensitive).
- **FR-007**: Inactive rows in `AdminProductsList` MUST render dimmed (50% opacity) with an "Inativo" badge next to the name.
- **FR-008**: The seller-side catalog (feature 6) MUST exclude inactive products from the grid, search results, and any category filter.
- **FR-009**: The seller-side order-assembly screen (feature 9) MUST block the add action for inactive products and surface a non-modal banner "Produto descontinuado" when an inactive product is reached via a cached reference or deep link.
- **FR-010**: When a seller opens an existing draft containing one or more inactive products, the system MUST present a modal listing each discontinued line by name, offering "Remover linhas e continuar" (primary) and "Fechar" (secondary).
- **FR-011**: The draft MUST NOT be sendable while it contains any inactive product; the send action MUST remain disabled with an inline explanation until the inactive lines are removed.
- **FR-012**: When "repeat last order" (feature 10) is invoked against a source order containing one or more inactive products, the system MUST present a modal listing the discontinued products and offer "Continuar com ativos" (clones only still-active lines) and "Cancelar". The flow MUST NEVER silently drop lines.
- **FR-013**: If every line in the source order is inactive, the "Continuar com ativos" action MUST be disabled — only "Cancelar" is available.
- **FR-014**: Historical sent and canceled orders (feature 13) and their payment receipts (feature 12) MUST render discontinued line items verbatim without triggering the discontinuation alerts — history is immutable.
- **FR-015**: Admin writes to `products.active` MUST trigger the existing post-write sync pull (feature 14) so seller-side caches update on their next pull-to-refresh.

#### Part B — Granular admin roles

- **FR-016**: The `user_roles` table MUST accept the following role values: `seller`, `manage-products`, `manage-salespersons`, `manage-clients`, `superuser`. A user MAY hold zero, one, or more of these rows.
- **FR-017**: A data migration MUST rewrite every existing `user_roles` row with `role = 'admin'` to `role = 'superuser'`. No admin user MAY lose capability as a result of this migration.
- **FR-018**: The root navigator MUST show the "Admin" tab when the signed-in user carries at least one admin-grade role (`manage-products`, `manage-salespersons`, `manage-clients`, or `superuser`).
- **FR-019**: The Admin tab's tile grid MUST render each tile only when the user carries the required role: Products tile → `manage-products` or `superuser`; Sellers tile → `manage-salespersons` or `superuser`; Clients tile → `manage-clients` or `superuser`; "Usuários & Roles" tile → `superuser` only.
- **FR-020**: Direct-route attempts to admin sub-screens MUST be blocked by the navigator for users lacking the required role (defense-in-depth alongside RLS).
- **FR-021**: `AdminUsersList` MUST list every user (admins + sellers), with role badges per row, a free-text search input, and a role filter chip.
- **FR-022**: `AdminUserRolesForm` MUST show read-only user identification (name, email) and a toggle list of the four admin-grade roles; the `seller` role MUST NOT be editable here (it remains managed by feature 15).
- **FR-023**: Only users with `superuser` MUST be able to insert/update/delete rows in `user_roles`. This MUST be enforced both in the navigator (tile visibility + route guard) and in Supabase RLS.
- **FR-024**: Every RLS policy that previously checked `role = 'admin'` MUST be updated to accept both `superuser` and the relevant module-specific role: products/product_variants → `manage-products` or `superuser`; salespeople → `manage-salespersons` or `superuser`; clients → `manage-clients` or `superuser`.
- **FR-025**: A superuser MUST NOT be able to remove their own `superuser` role if doing so would leave the system with zero superusers; this MUST be enforced in both the form (pre-save guard) and RLS (trigger or constraint).
- **FR-026**: The profile screen MUST render a "Suas funções" section listing the signed-in user's active roles as chips with human-readable Portuguese labels.
- **FR-027**: Role changes MUST take effect on the user's next app focus or sync pull without requiring re-login.
- **FR-028**: During the migration window, RLS policies MUST accept BOTH `admin` and the new roles to prevent breaking in-flight sessions. After the migration completes, the legacy `admin` check SHOULD be removed in a follow-up migration (tracked separately; not in this feature's scope).

### Key Entities

- **Product (extended)**: The existing `products` row gains `active: boolean` (default true) and `deactivated_at: timestamptz | null`. All existing columns and constraints unchanged.
- **UserRole (extended)**: The existing `user_roles(user_id, role)` table now accepts a broader enum of role values. Legacy `admin` rows are migrated to `superuser`.
- **Draft Usage Count (derived, not persisted)**: A count of draft-status orders referencing a product, computed on demand from the server at the moment the deactivation dialog opens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After deactivating a product, the SKU disappears from 100% of seller catalogs within the seller's next successful sync (typically under 30 seconds of active connectivity).
- **SC-002**: Across all drafts that contain an inactive product, 100% show the discontinuation modal on next open, and 0% permit sending while inactive lines remain.
- **SC-003**: Admins locate a specific product in `AdminProductsList` (among 500+ SKUs) in under 3 seconds using search + filter, measured from tap into the list to the target row being visible.
- **SC-004**: A superuser can grant or revoke a single admin-grade role for another user in under 30 seconds, measured from tapping the user in `AdminUsersList` to the toast "Funções atualizadas".
- **SC-005**: 0% of non-superuser admins see the "Usuários & Roles" tile or reach `AdminUsersList` via any navigation path.
- **SC-006**: After the migration, 100% of users previously holding `admin` retain every prior capability via `superuser`, with 0 regressions reported in the first post-deploy week.
- **SC-007**: 100% of seller sessions that were mid-session when a role changed pick up the new role state on next app focus without requiring a logout.

## Assumptions

- Admin operations remain online-required per constitution P6. Deactivation and role changes are NOT queued for offline execution — they fail fast when connectivity is absent.
- The existing sync engine (feature 5) is the only path by which `active` / `deactivated_at` and `user_roles` reach seller devices. No push channel, no server-pushed invalidation.
- Draft-usage count in the deactivation dialog is a point-in-time read from Supabase (admin is online). It is not re-fetched if the admin lingers on the dialog — accepted as a reasonable trade-off.
- "Historical sent/canceled orders render discontinued lines verbatim" relies on the existing immutability rule in feature 9 (status transitions only: draft → sent → canceled). Sent orders are never edited.
- The `seller` role continues to be managed exclusively through feature 15's `admin-create-seller` Edge Function and deactivation flow. This feature does NOT introduce a path to grant `seller` from `AdminUserRolesForm`.
- The single-superuser safeguard (FR-025) enforces a floor of 1 superuser in the system at all times. Organizations that want zero superusers are out of scope.
- Text search on products uses client-side filtering over the already-pulled catalog (feature 6's local cache). No server-side search endpoint is required.
- Diacritic-insensitive matching uses a normalized-text helper in the client; Supabase collation settings are not changed in this feature.
- Legacy-role backward compatibility (FR-028) lives only until the data migration runs to completion; long-term, the codebase converges on the granular roles.
- No new external dependencies beyond what features 6, 9, 10, 14, 15 already ship.
