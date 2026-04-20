<!--
SYNC IMPACT REPORT
==================
Version change: 0.2.0 → 0.3.0
Bump rationale: MINOR bump. A new UX rule (UX5) is introduced that elevates
tablet support to a first-class deliverable across design and
implementation. No principle was removed or redefined; no prior rule's
meaning was changed.

Added:
  - §5 UX Rules: UX5 — Layouts serve phone and tablet
    - Every screen must ship phone AND tablet frames in Pencil and must
      render correctly on both form factors in React Native.
    - Landscape orientation remains out of scope for the MVP.

Governance update:
  - Compliance scope unchanged (§3–§7). UX5 surfaces at Constitution Check
    via the plan template without schema changes.

Prior bumps:
  - 0.1.2 → 0.2.0: added §7 Security & Authentication (D5, D6) and the
    corresponding mandatory dependencies in §3.
  - 0.1.1 → 0.1.2: renamed DB entity/table/column/status identifiers to
    English to align with §9 (formerly §8) "English in code".
  - 0.1.0 → 0.1.1: full translation of the document from Portuguese to
    English.

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check still
       derives from this file at plan time; UX5 surfaces automatically.
  - ✅ .specify/templates/spec-template.md — unaffected.
  - ✅ .specify/templates/tasks-template.md — unaffected.
  - ✅ .specify/extensions/pencil/commands/speckit.pencil.design.md —
       updated in the same change to generate phone+tablet frames.
  - ✅ .specify/extensions/pencil/pencil-config.yml — updated in the same
       change to declare the target viewports.

Follow-up TODOs: none. UX5 pins concrete baseline viewports (phone
390×844 pt, tablet 820×1180 pt, portrait-only).
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

### P5 — Salesperson data is sacred

An order built in the field MUST NOT be lost. The risk of losing local data
(reinstall, device replacement, crash) MUST be mitigated by frequent sync
when internet is available and by a manual export/emergency backup option
available in the MVP.

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

### R1 — WatermelonDB is the single data layer on the client

Components MUST NOT fetch directly from Supabase at runtime. They read from
WatermelonDB. Sync is a separate process, executed at defined moments (login,
manual pull-to-refresh, after creating an order when internet is available).

### R2 — Minimalist data model

MVP entities: `salespeople`, `clients`, `products`, `product_variants`,
`orders`, `order_items`, `payment_receipts`. Nothing beyond that without
going through a spec.

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

## 6. Data and Synchronization Rules

### D1 — Sync is pull + push, in that order

When syncing: first pull server changes (catalog, clients registered by the
admin, orders from other salespeople on the same base), then push local
changes.

### D2 — Catalog is read-only in the app

The salesperson MUST NOT register or edit products. The admin does that via
the Supabase dashboard. If the salesperson spots a catalog error, they report
it outside the app (channel TBD, out of MVP scope).

### D3 — A client may be registered by either the salesperson or the admin

Duplicate registration conflicts (same CNPJ, for example) MUST be resolved by
manual merge in the admin dashboard. The MVP does not need automatic
deduplication.

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
- All business operations (catalog, clients, orders, PDFs, receipts) MUST run
  offline against the local database. The app MUST NOT validate the token on
  every action.
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

Reintroducing any of the above MUST require an explicit review of this
constitution.

## 9. Code Conventions

- Identifiers in English in code; Portuguese in UI strings
- Components in `PascalCase`, hooks in `useCamelCase`, utilities in
  `camelCase`
- Folder structure by feature, not by type: `src/features/orders/`, not
  globally separated `src/components/` + `src/hooks/`
- Tests: MUST prioritize business-logic tests (discount calculation, PDF
  generation, sync merge). UI does NOT need exhaustive testing in the MVP.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`)

## Governance

This constitution supersedes any ad-hoc practice. Specs, plans, and tasks
MUST verify compliance with P1–P5 and with the rules in sections 3–7 before
moving forward.

### Amendments

Any change to a principle (P1–P5) or rule (R, UX, D) MUST follow:

1. A recorded issue or discussion making the reason and impact explicit.
2. An update to this constitution with a Sync Impact Report at the top.
3. A version bump per the policy below.
4. Propagation to affected templates (`plan-template.md`, `spec-template.md`,
   `tasks-template.md`) in the same commit.

### Versioning of this Constitution

- **MAJOR**: incompatible removal or redefinition of a principle or
  governance rule (e.g., abandoning offline-first).
- **MINOR**: a new principle, a new section, or a material expansion of an
  existing rule.
- **PATCH**: clarifications, wording fixes, non-semantic refinements
  (translations included).

### Periodic review

A mandatory review after the first spec → plan → tasks → implement cycle for
the catalog module completes. Subsequent reviews are trigger-based (a new
feature outside current scope, a new stack element, a data-loss incident).

### Compliance in PRs

Every PR MUST declare, in its description, which principles/rules it touches
and why. Violations without a justification recorded in the plan's
`Complexity Tracking` section MUST be rejected in review.

**Version**: 0.3.0 | **Ratified**: 2026-04-18 | **Last Amended**: 2026-04-19
