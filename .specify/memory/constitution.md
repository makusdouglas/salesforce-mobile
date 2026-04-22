<!--
SYNC IMPACT REPORT
==================
Version change: 0.3.0 → 1.0.0
Bump rationale: MAJOR. D2 is redefined (the catalog is no longer strictly
read-only in the app — the ADMIN role writes to it). P4 is broadened
(in-app UI may replace Supabase dashboard when justified). A new principle
(P6), a new UX rule (UX6), and a new security rule (D7) are introduced.
Together these remove the app's single-role assumption and establish
role-based authorization as a first-class concern.

Added:
  - §2 Core Principles: P6 — Admin is online-first
  - §5 UX Rules: UX6 — Dual-role visibility
  - §7 Security and Authentication: D7 — Role-based authorization
  - §3 Mandatory Stack: `expo-image-picker` and `expo-image-manipulator`
    under a new "Required for admin features" grouping
  - §9 Code Conventions: admin-feature screens live under
    `src/features/admin/<domain>/`, parallel to
    `src/features/<domain>/` (seller)

Redefined:
  - §6 D2 — "Catalog is read-only in the app" → "Catalog is read-only in
    the app FOR VENDEDOR; ADMIN may create/edit/delete via the in-app
    admin module." Dashboard remains an escape hatch.
  - §6 D3 — "A client may be registered by either the salesperson or the
    admin" → reworded to reflect that admin now registers inside the app.
  - §2 P4 — "Reuse free tools before building" broadened with an
    explicit exception: in-app admin UI MAY replace a Supabase dashboard
    workflow when justified in the feature's plan.
  - Governance compliance scope expanded from P1–P5 to P1–P6.

Prior bumps:
  - 0.2.0 → 0.3.0: added §5 UX5 "Layouts serve phone and tablet".
  - 0.1.2 → 0.2.0: added §7 Security & Authentication (D5, D6) and the
    corresponding mandatory dependencies in §3.
  - 0.1.1 → 0.1.2: renamed DB entity/table/column/status identifiers to
    English to align with §9 "English in code".
  - 0.1.0 → 0.1.1: full translation of the document from Portuguese to
    English.

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — new "Role & Authorization
       Check" gate added. Features that affect role-visible surfaces must
       declare affected roles, RLS policies introduced, and their
       offline-impact classification per P6.
  - ✅ .specify/templates/spec-template.md — header metadata gains an
       optional "Roles affected" field under the Feature Branch block.
  - ✅ .specify/templates/tasks-template.md — Phase 1 Setup receives a
       reminder that admin features MUST include an RLS-policies task
       before their first screen task.

Follow-up TODOs: none. D7 explicitly scopes concrete RLS policies to each
admin-feature plan (starting with 013-admin-products), so the
constitution does not enumerate them.
-->

# External Sales App Constitution

This document defines the project's inviolable principles. Every spec, plan,
or task MUST respect them. Changes here require deliberate review, not casual
edits.

## 1. Product Identity

### What it is

A mobile app for B2B external salespeople visiting small retailers (corner
stores and similar) to present a visual catalog, assemble intent orders, send
quotes by email as PDFs, and record payment receipts. It operates in the
field, without depending on connectivity.

Starting with v1.0.0 the same app also hosts an admin surface for the
role that configures the business (products, variants, photos, sellers,
clients). The admin surface is online-first (see P6) and coexists with the
salesperson surface via dual-role visibility (see UX6).

### What it is NOT

Not an ERP. Not a real-time inventory system. Not an e-commerce platform. Not
a full CRM tool. Does not manage commissions, routes, or quotas. Does not
issue fiscal invoices.

If a proposed feature signals a drift from this identity, it MUST be rejected
or deferred to an explicit v2.

## 2. Core Principles

### P1 — Offline-first is non-negotiable

The app MUST work 100% without internet during field use. Every critical
operation (open catalog, register client, assemble order, generate PDF,
record receipt) MUST run against the local database. Internet is required
only for sync, initial login, and sending email.

**Consequence**: no screen may have a blocking spinner waiting on the
network. No business operation depends on a server response.

**Scope**: P1 governs VENDEDOR (salesperson) field operations. ADMIN
registrations may require internet; see P6.

### P2 — Local database is the source of truth during a session

The salesperson's device is authoritative over what they created since the
last sync. Supabase is a consolidated mirror, not the origin during field
work. Sync conflicts MUST be resolved with a "last-write-wins" strategy
based on timestamp, documented in the plan of every feature that touches
sync.

### P3 — MVP simplicity over architectural elegance

This is a solo project, with a R$50/month budget, serving 1–2 salespeople.
Any decision that optimizes for "future scale" before the MVP is validated is
sunk cost. When there are two ways to solve a problem and one is simpler, the
simpler option SHOULD be chosen and the reason documented in the feature's
plan.

### P4 — Reuse free tools before building

The Supabase dashboard replaces an admin panel. Supabase Auth replaces a
custom login flow. Supabase Storage replaces upload infrastructure. A custom
interface MUST only be built when the salesperson needs it — the admin uses
the stack's native tools.

**Exception (introduced in v1.0.0)**: in-app admin UI MAY replace a
Supabase dashboard workflow when (a) the admin workflow benefits from the
mobile UX, or (b) RLS already permits the operation. The justification goes
in the feature's plan under Constitution Check. The Supabase dashboard
remains a valid escape hatch for schema-level or bulk operations that the
in-app UI does not cover.

### P5 — Salesperson data is sacred

An order built in the field MUST NOT be lost. The risk of losing local data
(reinstall, device replacement, crash) MUST be mitigated by frequent sync
when internet is available and by a manual export/emergency backup option
available in the MVP.

### P6 — Admin is online-first

Operations performed by the ADMIN role (registrations, photo upload,
catalog changes) MAY require internet. P1 (offline-first) governs VENDEDOR
field operations, not ADMIN registrations.

**Rationale**: ADMIN workflows involve Storage uploads and authoritative
writes to shared tables. Making them online-first keeps RBAC, RLS, and
image upload simple — no push queue, no client-side catalog conflict
resolution, no divergence between what the admin sees and what the
Supabase row contains.

**Consequences for admin feature plans:**

- Direct Supabase writes are the default path. Admin code MUST NOT route
  through WatermelonDB's push queue.
- Admin screens MAY show a blocking "saving…" spinner while a write is in
  flight; this does not violate P1 because it is not a field operation.
- On connectivity loss during an admin flow, the app MUST surface a
  salesperson-language error (not a stack trace) and let the admin retry
  when back online. Local drafts of admin forms MAY be preserved to avoid
  data loss between retries.
- After any admin write, the feature SHOULD trigger a sync pull so the
  seller-side local cache propagates the change on next connect.

## 3. Mandatory Stack

### Required

- React Native with Expo (managed workflow; dev build allowed when a library
  requires it)
- WatermelonDB for reactive local persistence on top of SQLite
- Supabase for auth, remote Postgres database, image storage, and the admin
  dashboard
- expo-print or equivalent for local PDF generation of the order
- `expo-secure-store` for persisting the Supabase refresh token in the
  OS-level secure enclave (Keychain on iOS, EncryptedSharedPreferences on
  Android). See §7 D5.
- `expo-local-authentication` for biometric unlock and PIN fallback on app
  open. See §7 D6.
- TypeScript across all application code

### Required for admin features (introduced in v1.0.0, first used in 013)

- `expo-image-picker` — admin photo selection from camera/library for
  product and variant images. See §7 D7 and §6 D2.
- `expo-image-manipulator` — image resize before upload to Supabase
  Storage, to keep bundle/transfer sizes predictable. See §7 D7.

Each of the two libraries above MUST be introduced in the plan of the
feature that first uses them (013-admin-products) with a one-line
justification under Constitution Check.

### Forbidden in the MVP

- A custom backend (Node, Go, etc.) — Supabase covers the case
- Firebase — decision already made, do not revisit in the MVP
- Device-to-device P2P connections (Bluetooth, Wi-Fi Direct, Nearby) — out of
  scope
- Heavy state-management libraries (Redux, MobX) — Zustand or Context + hooks
  are enough
- Heavy UI libraries that bloat the bundle — prefer simple in-house
  components or NativeWind/Tamagui if needed

### Allowed with justification

Any native library that requires a dev build (does not run in Expo Go) MUST
include a one-line justification in the plan of the feature that introduced
it.

## 4. Architecture Rules

### R1 — WatermelonDB is the single data layer on the client (for VENDEDOR)

VENDEDOR components MUST NOT fetch directly from Supabase at runtime. They
read from WatermelonDB. Sync is a separate process, executed at defined
moments (login, manual pull-to-refresh, after creating an order when
internet is available).

**Admin exception (per P6)**: ADMIN screens MAY read and write directly to
Supabase via the client SDK, because admin operations are online-first and
need the latest server-side state. Admin code MUST NOT push through
WatermelonDB; it writes straight to Supabase and triggers a pull so the
seller-side cache picks the change up on next sync.

### R2 — Minimalist data model

MVP entities: `salespeople`, `clients`, `products`, `product_variants`,
`orders`, `order_items`, `payment_receipts`. Nothing beyond that without
going through a spec.

**v1.0.0 addition**: the `user_roles (user_id, role)` table is added as
supporting infrastructure for D7. It is not a business entity (no business
feature lists it), but it is part of the minimal data model the admin
module assumes. Defined in detail in the plan of 013-admin-products.

### R3 — Images live in Supabase Storage with local cache

Product photos and receipt images MUST NOT be stored in the database. They
live in Storage with a referenced URL. Local cache via expo-file-system
ensures offline access.

### R4 — PDF generation is local, email sending is via the system's email client

No email delivery service (SendGrid, Resend) is integrated in the MVP. The
PDF is generated locally and the device share sheet / email intent is opened
with recipient, subject, and the PDF attachment pre-filled. The salesperson
confirms and sends from their own email account.

### R5 — Discounts belong to the order, not the catalog

The catalog has fixed prices. Discounts are applied at order time, at two
levels: per line item and overall order. A discount MUST be stored on the
`order_item` and `order`, and MUST never alter the `product`.

## 5. UX Rules

### UX1 — Tap, not type

The salesperson is standing, inside a small store, holding a phone. Critical
flows MUST prioritize tap selection, fast search, and increment/decrement.
Typing is reserved for notes and mandatory fields during registration.

### UX2 — Repeating the previous order is a first-class citizen

In the client's history, repeating the last order (with or without changes)
MUST be a 1–2 tap path, not a hidden operation.

### UX3 — Useful empty states

First launch without a catalog, a client without history, an order in draft
— each empty state MUST point to the next step in the salesperson's language,
not the system's.

### UX4 — Sync feedback that is discreet but present

The salesperson MUST know, without asking, whether their data is synced. A
sync status indicator sits on the home screen — never a modal or alert.

### UX5 — Layouts serve phone and tablet

Every screen MUST be designed and implemented for two target viewports.
Tablets are a first-class deliverable, not an adaptation after the fact.

**Baseline viewports** (portrait orientation only in the MVP):

- **Phone**: 390 × 844 pt (iPhone 14 / modern Android reference)
- **Tablet**: 820 × 1180 pt (iPad 11" reference)

**Required behavior:**

- **Design time** — `/speckit-pencil-design` MUST produce one Pencil frame
  per screen per viewport (phone AND tablet) and export both screenshots.
  The design summary (`screens.md`) MUST list the tablet variant alongside
  the phone variant for every screen.
- **Plan time** — `plan.md` "Structure Decision" MUST describe the
  responsive strategy (shared components + viewport-conditional layout)
  when the feature introduces new screens.
- **Implementation time** — each screen component MUST render correctly on
  a phone AND on a tablet simulator before the task is marked complete.
  Layout changes between viewports (stack → split, column count, padding,
  typography scale) MUST be explicit in the code, not accidental.
- Landscape orientation is OUT of scope for the MVP and MUST NOT be
  targeted by design or implementation.

**Rationale**: the sales team already uses tablets in some stores for
larger catalog browsing; shipping phone-only would force a rework later
and violate P3 (simplicity) by accumulating hidden tech debt.

### UX6 — Dual-role visibility

A signed-in user carries one or more roles (see §7 D7). The app's visible
surface MUST be a direct function of those roles, with no mode toggle and
no context switch:

- A user with only the `seller` role sees the current VENDEDOR home and
  field flows. The Admin tab is not rendered.
- A user with only the `admin` role sees only the Admin tab/section. The
  VENDEDOR home and field flows are not rendered as primary navigation.
- A user with BOTH roles sees the VENDEDOR app PLUS an extra "Admin" tab
  in the root navigator. Both surfaces coexist in the same session.

**Required behavior:**

- Role detection runs once per session, right after the user's roles are
  available in `session_state` (post-login). Navigation tree is built from
  that snapshot; it MUST NOT re-fetch on every screen.
- Admin affordances (the tab itself, buttons, links) MUST be hidden —
  not merely disabled — for users who lack the `admin` role. This is UX
  affordance, not authorization; RLS enforces actual security (D7).
- The app MUST NOT surface a "switch to admin mode" control. Dual-role
  users can navigate from VENDEDOR flows into the Admin tab directly via
  the tab bar.

**Rationale**: a solo project often means one person wears both hats. A
toggle adds friction without safety benefit — RLS already prevents a
non-admin from performing admin operations. Keeping both surfaces visible
to dual-role users mirrors how they already think about the work.

## 6. Data and Synchronization Rules

### D1 — Sync is pull + push, in that order

When syncing: first pull server changes (catalog, clients registered by the
admin, orders from other salespeople on the same base), then push local
changes.

### D2 — Catalog is read-only in the app for VENDEDOR

The VENDEDOR MUST NOT register or edit products or variants. Those
operations are performed by the ADMIN role via the in-app admin module
(starting with 013-admin-products) or, for schema-level and bulk tasks,
via the Supabase dashboard. If the VENDEDOR spots a catalog error in the
field, they report it to the admin out-of-band (channel TBD, out of MVP
scope).

**Client enforcement**: the VENDEDOR surface MUST expose zero
create/edit/delete affordances on `products` or `product_variants` — not
behind long-press, not in debug menus. See 006-product-catalog.

**Server enforcement**: RLS on `products` and `product_variants` MUST
reject any INSERT/UPDATE/DELETE from a user lacking the `admin` role.
Specific policies are defined in the plan of 013-admin-products.

### D3 — A client may be registered by VENDEDOR or ADMIN

Two entry points:

- **VENDEDOR, in the field, offline**: creates a `client` row in
  WatermelonDB; the row syncs upstream via the normal push path (D1) when
  connectivity returns.
- **ADMIN, in the in-app admin module, online**: writes directly to the
  Supabase `clients` table via the admin CRUD (see 015-admin-clients).

Duplicate-registration conflicts (same CNPJ) MUST be resolved manually by
the ADMIN — either via the in-app admin module or via the Supabase
dashboard. The MVP does not need automatic deduplication.

### D4 — Orders use simple local statuses

`draft`, `sent` (email dispatched), `canceled`. No complex workflow. Evolve
later if needed.

## 7. Security and Authentication

### D5 — Authentication is online-one-time + offline-persistent

Login is an online event. Every subsequent action is offline-trusted against
a locally persisted credential.

**Required behavior:**

- Initial login MUST require internet. The app authenticates against Supabase
  Auth, receives `access_token` + `refresh_token`, and persists the
  `refresh_token` in `expo-secure-store` (Keychain / EncryptedSharedPreferences).
- The refresh token TTL is **90 days**. Refreshing it extends the window;
  going 90 days without any successful refresh forces a re-login.
- All VENDEDOR business operations (catalog, clients, orders, PDFs,
  receipts) MUST run offline against the local database. The app MUST NOT
  validate the token on every action. ADMIN operations follow P6 and are
  online-first.
- When connectivity returns, the app MUST silently refresh the access token
  in background and, if successful, run a sync pass (per D1). The salesperson
  does not see this.
- If the refresh token is rejected (expired, revoked, user banned), the app
  MUST queue the failed sync, keep local data intact, and prompt re-login on
  the next network-requiring action. Offline data MUST NOT be discarded on
  auth failure.
- The password MUST NEVER be persisted on the device. It is typed once at
  login and discarded after the token exchange.

**Server-side authorization:** Supabase Row Level Security is the final
authority. Local "auth" is a convenience for offline UX; server RLS validates
identity and permission on every sync push. This covers the case where a
stolen device with a still-valid refresh token tries to push malicious data.

### D6 — Mandatory local lock

Independent of server authentication, the app MUST require a local unlock on
every cold start (and after a configurable inactivity timeout, MVP default:
5 minutes).

**Required behavior:**

- Biometric unlock (via `expo-local-authentication`) is the **preferred**
  primary mechanism when the device supports it and the salesperson has
  enrolled.
- A 4–6 digit PIN is a **mandatory fallback** and MUST always be offered.
  Reasons: wet/dirty hands in a store, sensor failure, device without a
  biometric sensor. The PIN path MUST NOT require network.
- The PIN is set by the salesperson on first run, stored hashed (never plain)
  in `expo-secure-store`. The app MUST provide a reset path that requires
  full re-login against Supabase.
- Failed biometric attempts MUST fall back to the PIN screen immediately, not
  block the user.
- Local lock is complementary to D5 — it does NOT replace Supabase auth. It
  protects catalog and client data from casual access to a lost or stolen
  device.

### D7 — Role-based authorization

Introduced in v1.0.0 to enable the ADMIN surface.

**Role model:**

- A Supabase Auth user MAY carry one or more roles. The MVP defines two:
  `admin` and `seller`.
- Roles live in a server-side table `user_roles (user_id uuid references
  auth.users, role text check (role in ('admin','seller')), primary key
  (user_id, role))`. The concrete migration is defined in the plan of
  013-admin-products.
- After a successful login (D5), the client reads the caller's roles once
  and mirrors them into the local session state as `session_state.roles[]`.
  Roles are re-read whenever a new access token is issued.

**Authorization boundary:**

- Supabase Row Level Security is the final authority. Writes to
  `products`, `product_variants`, `salespeople`, `clients`, and
  `user_roles` MUST be permitted only when `auth.uid()` carries the
  role(s) required by the specific policy. Per-table policies are defined
  in the plan of each admin feature (013, 014, 015).
- The client hides admin affordances from users without the `admin` role
  (see UX6). This is UX convenience, not a security control. A
  non-admin user who bypasses the client and calls Supabase directly MUST
  be rejected by RLS.

**Bootstrapping the first admin:**

- The first admin row in `user_roles` MUST be seeded via a one-time SQL
  migration executed by the project owner against Supabase. There is no
  in-app bootstrap flow. Subsequent admins and sellers are created by an
  existing admin via 014-admin-sellers.

**Operations requiring elevated privileges** (creating a Supabase Auth
user, assigning roles to a fresh account) MUST go through a Supabase Edge
Function that holds the `service_role` key. The client MUST NEVER carry
`service_role`.

## 8. Out of Scope in the MVP

Listed explicitly to prevent scope creep:

- Multiple named catalogs per salesperson
- Per-client price tables
- Inventory control
- Sales reports and dashboards
- Commission management
- Routes and visit scheduling
- External ERP integration
- Push notifications
- Chat between salesperson and admin
- Printing to Bluetooth printers
- Customer digital signature on the order
- Multi-tenant / multi-company mode
- Automatic duplicate-client detection and merge (D3 defers to manual
  admin action)
- Admin role self-assignment or self-promotion (D7 requires existing
  admin action or SQL migration)
- Bulk import of products/clients via the app (dashboard remains the
  right tool for bulk)
- Offline admin mode (P6 fixes admin as online-first)

Reintroducing any of the above MUST require an explicit review of this
constitution.

## 9. Code Conventions

- Identifiers in English in code; Portuguese in UI strings
- Components in `PascalCase`, hooks in `useCamelCase`, utilities in
  `camelCase`
- Folder structure by feature, not by type: `src/features/orders/`, not
  globally separated `src/components/` + `src/hooks/`
- Admin-feature screens live under `src/features/admin/<domain>/`, parallel
  to `src/features/<domain>/` which belongs to VENDEDOR. Example:
  `src/features/catalog/` (seller-facing catalog, read-only) and
  `src/features/admin/products/` (admin-facing products CRUD) coexist.
  Shared UI primitives remain under `src/components/` as today.
- Tests: MUST prioritize business-logic tests (discount calculation, PDF
  generation, sync merge, RLS policy contracts). UI does NOT need
  exhaustive testing in the MVP.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`)

## Governance

This constitution supersedes any ad-hoc practice. Specs, plans, and tasks
MUST verify compliance with P1–P6 and with the rules in sections 3–7 before
moving forward.

### Amendments

Any change to a principle (P1–P6) or rule (R, UX, D) MUST follow:

1. A recorded issue or discussion making the reason and impact explicit.
2. An update to this constitution with a Sync Impact Report at the top.
3. A version bump per the policy below.
4. Propagation to affected templates (`plan-template.md`, `spec-template.md`,
   `tasks-template.md`) in the same commit.

### Versioning of this Constitution

- **MAJOR**: incompatible removal or redefinition of a principle or
  governance rule (e.g., abandoning offline-first, changing the role
  model established in D7).
- **MINOR**: a new principle, a new section, or a material expansion of an
  existing rule.
- **PATCH**: clarifications, wording fixes, non-semantic refinements
  (translations included).

### Periodic review

A mandatory review already occurred after the catalog module's first full
spec → plan → tasks → implement cycle (feature 006). Subsequent reviews
are trigger-based: a new feature outside current scope, a new stack
element, a data-loss incident, or a role-model change.

### Compliance in PRs

Every PR MUST declare, in its description, which principles/rules it touches
and why. Violations without a justification recorded in the plan's
`Complexity Tracking` section MUST be rejected in review. Admin-feature
PRs MUST additionally declare the RLS policies added or changed, so that
D7 coverage is reviewable.

**Version**: 1.0.0 | **Ratified**: 2026-04-18 | **Last Amended**: 2026-04-22
