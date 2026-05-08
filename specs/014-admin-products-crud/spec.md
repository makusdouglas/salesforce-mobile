# Feature Specification: Admin role + products/variants CRUD

**Feature Branch**: `014-admin-products-crud`  
**Created**: 2026-04-24  
**Status**: Draft  
**Roles affected**: `admin` (new) and `admin + seller (dual-role)` (constitution §7 D7 and §5 UX6)  
**Input**: User description: "Implement the ADMIN role foundation and the products/variants CRUD per constitution v1.0.0 D7, UX6, P6. Product registration has two entry paths: manual and via barcode. Barcode flow looks up the product first — if it already exists, route the admin to edit that product; if it's new, pre-fill the form with the scanned code. Writes go straight to Supabase (online-required, P6, no WatermelonDB queue). RLS restricts INSERT/UPDATE/DELETE to role='admin'. After any admin write, trigger a sync pull so feature-5 seller cache updates."

## UI Design

**Design source**: [design/screens.md](./design/screens.md) — generated from `layout.pen`

### Screens

| Screen | Screenshot | Intent |
|--------|------------|--------|
| Admin Products List / Phone | [admin-products-list-phone.png](./design/admin-products-list-phone.png) | Admin sees every product with thumbnail, name, category, base price; taps a row to edit or "Novo" to add. |
| Admin Products List / Tablet | [admin-products-list-tablet.png](./design/admin-products-list-tablet.png) | Same list with search field and an explicit "Editar" per row. |
| Admin Product Source / Phone | [admin-product-source-phone.png](./design/admin-product-source-phone.png) | Modal chooser after tapping "Novo": "Cadastro manual" vs "Escanear código de barras". |
| Admin Product Source / Tablet | [admin-product-source-tablet.png](./design/admin-product-source-tablet.png) | Tablet version of the source chooser. |
| Admin Barcode Scanner / Phone | [admin-barcode-scanner-phone.png](./design/admin-barcode-scanner-phone.png) | Camera scan with torch toggle and manual-entry fallback input. |
| Admin Barcode Scanner / Tablet | [admin-barcode-scanner-tablet.png](./design/admin-barcode-scanner-tablet.png) | Tablet version of the scanner. |
| Admin Barcode Match / Phone | [admin-barcode-match-phone.png](./design/admin-barcode-match-phone.png) | "Produto já cadastrado" state with matched product preview + CTA to edit. |
| Admin Barcode Match / Tablet | [admin-barcode-match-tablet.png](./design/admin-barcode-match-tablet.png) | Tablet version of the match state. |
| Admin Product Form / Phone | [admin-product-form-phone.png](./design/admin-product-form-phone.png) | Create/edit form: image, name, barcode (with inline "Escanear"), description, category, base price, variants inline. |
| Admin Product Form / Tablet | [admin-product-form-tablet.png](./design/admin-product-form-tablet.png) | Split layout: image + change CTA on the left, fields (incl. barcode) + variants on the right. |

### Design decisions carried into this spec

- Admin surfaces reuse the app's neutral palette (no dedicated admin theme).
- The Admin entry is a **peer tab**, not a mode toggle. Dual-role users see both the seller home AND the Admin tab simultaneously (UX6).
- "Novo" does NOT jump into the form — it first opens a **source chooser** so manual and barcode flows are both first-class entry paths.
- The barcode flow is **check-then-create**: a scanned or typed code always hits Supabase first; if a product with that barcode exists, the admin is routed to edit it (no silent duplication), otherwise the form opens pre-filled with the scanned code.
- Camera scan has a mandatory typed-entry fallback on the same screen so a denied camera permission doesn't block registration.
- The product form carries a `barcode` field — optional on manual creation, editable once scanned, and enforced unique across live (non-deleted) products.
- Variants render inline inside the form so admins can review + edit without leaving the screen.
- Image picker shows a dashed drop zone on empty state; once uploaded, the fill is the image and the CTA becomes "Trocar imagem".
- Price inputs use a numeric keyboard; the `R$` prefix sits in the label only.

## User Scenarios & Testing

### User Story 1 - Admin sees a dedicated tab without blocking the seller flow (Priority: P1)

A user with `role='admin'` opens the app and lands on the same seller home as anyone else; an additional **Admin** tab is visible in the root navigator. A user with only `role='seller'` never sees the Admin tab. Dual-role users keep full seller access AND gain the Admin tab at the same time — no mode toggle, no reload.

**Why this priority**: Without the role foundation and the tab gate there is nowhere to put the CRUD, and no way to keep sellers out of admin-only surfaces. Everything else in this feature depends on it.

**Independent Test**: Sign in three users (seller-only, admin-only, dual-role); verify only admin-only and dual-role see the Admin tab; verify the dual-role user can go from a seller order → tap Admin tab → see the product list without losing the seller session.

**Acceptance Scenarios**:

1. **Given** a signed-in user with only `role='seller'`, **When** the root navigator renders, **Then** the Admin tab is not present.
2. **Given** a signed-in user with `role='admin'` (and no seller role), **When** the root navigator renders, **Then** the Admin tab is visible and the user can open the products list.
3. **Given** a signed-in user with both `role='admin'` and `role='seller'`, **When** the root navigator renders, **Then** the seller home and the Admin tab are both accessible simultaneously, without any toggle or restart.
4. **Given** any signed-in user, **When** the session is refreshed, **Then** the visible tabs still reflect the latest roles retrieved from the server.

---

### User Story 2 - Admin creates a product manually, with image and variants (Priority: P1)

An admin taps "Novo", picks "Cadastro manual" from the source chooser, fills in name, description, category, base price, picks an image from the device, and saves. The image is resized and uploaded to Supabase Storage; the URL is stored on the product row. The admin can also add/edit variants (attribute label + price) inline on the same screen. Saving is immediate and online-only.

**Why this priority**: Core reason the Admin tab exists — without it, there is no way to maintain the catalogue consumed by sellers. Manual path MUST work even without a camera or a barcode on the product.

**Independent Test**: As an admin, create a new product via the manual path with an image and two variants (no barcode). Verify a row exists in `products` with a public image URL and null `barcode`, two rows in `product_variants`, and the image bucket contains the uploaded asset.

**Acceptance Scenarios**:

1. **Given** an admin opening the source chooser, **When** they pick "Cadastro manual", **Then** the product form opens empty (no barcode pre-fill).
2. **Given** an admin on the form with no image selected, **When** they tap the drop zone, select an image, and save, **Then** the image is resized client-side, uploaded to Supabase Storage, and the stored URL appears on the product record.
3. **Given** an admin editing an existing product, **When** they add, rename, or remove a variant and save, **Then** the corresponding rows in `product_variants` are inserted / updated / deleted in a single consistent operation.
4. **Given** a successful admin save, **When** the server confirms the write, **Then** the app triggers the sync pull used by feature 5 so seller devices refresh their local cache next time they open the catalogue.
5. **Given** an admin on the form with fields filled but an offline device, **When** they tap Save, **Then** the app surfaces a clear "Você está offline — conecte-se para salvar" error and does NOT enqueue the write (P6).

---

### User Story 3 - Admin registers a product via barcode (check-then-create) (Priority: P1)

An admin taps "Novo", picks "Escanear código de barras", and points the camera at a product. When a code is detected (or typed manually), the app queries Supabase for a product with that barcode. If no product matches, the form opens pre-filled with the scanned code so the admin finishes the fields and saves. If a product already exists, the admin is routed to the **Barcode Match** screen that shows the matched product and lets them open it for editing — the duplicate flow is blocked by design.

**Why this priority**: The barcode path is the quickest way to add a large shelf; without "check-then-create" the catalogue would fill with duplicates whenever two admins scan the same product.

**Independent Test**: Seed one product with `barcode='7891234567890'`. Scan/type that code → verify the Match screen shows the existing product and Save is not offered. Scan/type a new code → verify the form opens with the code in the `barcode` field and Save creates a new row carrying that code.

**Acceptance Scenarios**:

1. **Given** the scanner screen and a product whose barcode is NOT in the catalogue, **When** a code is detected, **Then** the form opens with the `barcode` field pre-filled and editable.
2. **Given** the scanner screen and a product whose barcode IS in the catalogue, **When** a code is detected, **Then** the Barcode Match screen renders with the matched product preview and CTAs "Editar este produto" / "Escanear outro código".
3. **Given** the scanner screen with a denied camera permission, **When** the admin types a code manually and taps "Verificar código", **Then** the same check-then-route logic runs (match → Match screen; no match → pre-filled form).
4. **Given** the product form opened from a barcode scan, **When** the admin edits the barcode field and saves, **Then** the stored barcode is the edited value (the field is not locked).
5. **Given** two admins saving different products with the same barcode at roughly the same time, **When** the second save reaches the server, **Then** it fails (unique constraint at the DB layer) and the UI surfaces "Este código já está em uso" so the admin can resolve it.

---

### User Story 4 - Sellers cannot modify the catalogue even with the app (Priority: P1)

A seller who discovers the product/variant tables or API should not be able to insert, update, or delete rows. Row-level security rejects any write attempt unless the caller carries `role='admin'`.

**Why this priority**: Any CRUD without proper RLS makes the whole feature unsafe — a curious seller or a compromised token could vandalize the catalogue.

**Independent Test**: Using a seller-only JWT, run INSERT/UPDATE/DELETE statements against `products` and `product_variants`; verify every attempt fails with a permission error while SELECT still succeeds (read-only access preserved).

**Acceptance Scenarios**:

1. **Given** a seller-only user, **When** they attempt any mutation on `products` or `product_variants`, **Then** Supabase rejects the statement via RLS.
2. **Given** an admin user, **When** they mutate those tables, **Then** the statements succeed.
3. **Given** an anonymous (unauthenticated) caller, **When** they attempt any read or write, **Then** every statement is rejected.

---

### User Story 5 - Admin browses the product list (Priority: P2)

An admin opens the Admin tab and sees all existing products with thumbnail, name, category, and base price. They can search by name or category (tablet) and tap a row to edit or the "Novo" CTA to trigger the source chooser.

**Why this priority**: Important for usability once there are many products, but not blocking for an MVP with a handful of items.

**Independent Test**: Seed 10 products with varied categories; open the list; verify every product is rendered, sorted predictably, and that tapping "Editar" opens the correct form pre-filled.

**Acceptance Scenarios**:

1. **Given** at least one product, **When** the admin opens the Admin tab, **Then** the list renders rows with thumbnail, name, category and base price.
2. **Given** the tablet layout, **When** the admin types in the search field, **Then** the list filters to rows whose name or category contains the query (case-insensitive).
3. **Given** an empty catalogue, **When** the admin opens the list, **Then** an empty state invites them to tap "Novo" to create the first product.

---

### Edge Cases

- **Offline write attempt**: The Save button stays enabled for affordance, but the attempt shows a clear offline error and does NOT queue the write locally (constitution P6). The form keeps the user's input so they can retry after reconnecting.
- **Offline barcode lookup**: The barcode lookup is an online call. If the device is offline when the admin taps "Verificar código", the app shows "Você está offline — conecte-se para verificar" and does NOT route anywhere; the admin can cancel or retry.
- **Camera permission denied / unsupported device**: The scanner screen degrades to "manual entry only" — the reticle disappears, the typed-entry row is promoted visually, and a compact "Permitir câmera" CTA surfaces the OS prompt.
- **Scanned code matches a soft-deleted product**: Treated as "no match" — the form opens pre-filled so the admin can re-create a live product carrying that code. The soft-deleted row stays in place for historical orders.
- **Duplicate barcode at save time**: If two admins race to create the same barcode, the second save fails on the DB unique constraint. The UI shows "Este código já está em uso" and offers "Ver produto existente" which navigates to the Match screen.
- **Image upload failure**: If Supabase Storage upload fails, the admin sees an actionable error and the product row is NOT created/updated — the whole save is atomic from the user's point of view.
- **Role revocation mid-session**: When the session state refreshes and the `admin` role is no longer present, the Admin tab disappears on next render; if the admin was on an admin screen, they are navigated back to the seller home. Any in-flight admin write receives an RLS rejection.
- **Dual-role first login**: A user who becomes dual-role after their session was issued sees the Admin tab as soon as the session is refreshed (either via re-login or via an explicit refresh of roles post-login).
- **Variant deletion with references**: Historical order lines carry a denormalized snapshot, so deleting a variant does NOT break past order detail rendering.
- **Very large image**: Images are client-side resized via manipulator before upload so uploaded assets stay bounded (≤ a few hundred KB). Original device images are never stored.
- **Concurrent admins editing the same product**: Last write wins.

## Requirements

### Functional Requirements

#### Role foundation

- **FR-001**: The system MUST persist a `user_roles(user_id, role)` relationship in Supabase such that a single user can carry multiple roles (at minimum `admin` and `seller`).
- **FR-002**: The first admin MUST be seeded via a manual migration (no self-service admin signup in MVP).
- **FR-003**: After a successful login, the app MUST expose the signed-in user's roles in its session state so that UI gates can react without hitting the network.
- **FR-004**: The root navigator MUST render an "Admin" tab if and only if the signed-in user carries `role='admin'`; if the role is missing, the tab MUST NOT be rendered.
- **FR-005**: Users carrying both `admin` and `seller` MUST see the seller home AND the Admin tab simultaneously — no mode toggle, no "switch role" UI (constitution §5 UX6).

#### Products CRUD — manual path

- **FR-006**: The Admin tab MUST open a products list showing, for each product, a thumbnail, name, category, and base price, with an action to edit and a primary CTA ("Novo") that opens the source chooser.
- **FR-007**: The "Novo" CTA MUST open a **source chooser** with two options: "Cadastro manual" (opens an empty form) and "Escanear código de barras" (opens the barcode scanner).
- **FR-008**: The product form MUST accept: name, description, category, base price, barcode (optional), and one image.
- **FR-009**: The image MUST be chosen via the OS image picker and resized client-side before upload so that uploaded assets stay within a bounded size budget.
- **FR-010**: The image MUST be uploaded directly to Supabase Storage, and the resulting public URL MUST be stored on the product row.
- **FR-011**: The product form MUST allow admins to manage variants inline: each variant has an attribute label (free-text string) and a price.
- **FR-012**: Saving the form MUST persist the product and all its variants atomically from the admin's perspective (no partial state visible on success).

#### Products CRUD — barcode path

- **FR-013**: The barcode scanner MUST accept both a camera scan (primary) and a typed fallback on the same screen so a denied camera permission does not block registration.
- **FR-014**: When a barcode is submitted (scanned or typed), the app MUST query Supabase for a live (non-soft-deleted) product with that `barcode` before routing anywhere.
- **FR-015**: If the barcode matches an existing product, the app MUST route to a **Barcode Match** screen that displays the matched product and offers to open it for editing; it MUST NOT create a duplicate.
- **FR-016**: If the barcode does not match any existing product, the app MUST route to the product form with the `barcode` field pre-filled and editable.
- **FR-017**: The `barcode` column on `products` MUST carry a database-level unique constraint (scoped to live rows) so concurrent duplicates are rejected by the DB, not only by the client.
- **FR-018**: If a save fails because of the barcode uniqueness constraint, the UI MUST surface "Este código já está em uso" and offer a path to the existing product.

#### Shared — online behavior & consistency

- **FR-019**: Admin writes and the barcode lookup MUST hit Supabase directly (online-required path) and MUST NOT be enqueued in the seller-side offline queue (constitution P6).
- **FR-020**: When the device is offline, the app MUST display a clear Portuguese error message for both Save and barcode lookup, and MUST preserve user input so the admin can retry after reconnecting.
- **FR-021**: Supabase Row-Level Security on `products` and `product_variants` MUST allow INSERT/UPDATE/DELETE only to callers carrying `role='admin'`; other callers MUST retain their existing read access.
- **FR-022**: After any successful admin write (product or variant create/update/delete), the app MUST trigger the feature-5 sync pull so seller devices refresh their local cache.
- **FR-023**: Role evaluation MUST refresh at session boundary events (login, session refresh) so newly granted or revoked roles take effect without a manual app restart.

### Key Entities

- **UserRole**: Binds an authenticated user to a role label. `user_id` references the Supabase auth user; `role` is a short string (`admin`, `seller`). A user may carry multiple `UserRole` rows.
- **Product**: Catalogue item owned by admins. Attributes: name, description, category, base price, image URL (Supabase Storage), `barcode` (optional, unique among live rows), and timestamps. Read by sellers via feature 5; written only by admins.
- **ProductVariant**: Sub-item of a Product. Attributes: attribute label (free-text), price, parent product FK. Created / updated / deleted by admins alongside the parent product.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A seller-only user can never mutate a product or a variant — every such attempt is rejected at the database layer (100% of attempts).
- **SC-002**: Scanning a known barcode routes to the existing product within one round-trip — no duplicate `products` row is ever created from the barcode flow.
- **SC-003**: Scanning a new barcode takes the admin from scanner to a pre-filled form in a single server call.
- **SC-004**: An admin can register a complete product (with image, barcode, two variants) from an empty form in under 2 minutes on a typical mobile connection.
- **SC-005**: After an admin saves, every seller device refreshes its local catalogue within one sync cycle.
- **SC-006**: Dual-role users reach both the seller home and the Admin tab in a single tap, with zero mode-switch screens in between.
- **SC-007**: Uploaded product images are bounded in size (client-side resize) so the average catalogue image stays under a few hundred KB.

## Assumptions

- Constitution v1.0.0 is authoritative: D7 (role-guarded surfaces), UX6 (dual-role sees both simultaneously, no toggle), P6 (admin writes are online-required and do NOT use the WatermelonDB push queue).
- The existing authentication stack (feature 3) already provides a post-login hook where role state can be fetched and exposed to the UI.
- Feature 5 (sync engine) already exposes a way to trigger a pull; this feature only needs to call it after admin writes.
- Supabase Storage is already configured for the project; this feature adds (or reuses) a bucket for product images with public read access appropriate for a seller-facing catalogue.
- Variant attributes are a single free-text label in MVP (e.g. "Pequeno · 500g"); structured attribute key/value pairs are out of scope.
- The barcode scanner uses the Expo camera stack (`expo-camera` or equivalent already permitted under §3) with a typed fallback when the camera is unavailable — listing the library name is part of the plan, not the spec.
- Admin-facing error copy is in Portuguese, consistent with the rest of the app.
- Historical orders keep enough denormalized variant data that deleting a variant does not break past order detail rendering.
- MVP-shaped data volumes (dozens, not thousands, of products) — pagination of the admin list is deferred.
