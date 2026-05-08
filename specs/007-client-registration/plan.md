# Implementation Plan: Client Management

**Branch**: `007-client-registration` | **Date**: 2026-04-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-client-registration/spec.md`

## Summary

Ship the salesperson-side client management surface as a self-contained feature under `src/features/clients/`. The module composes the already-shipped `clientsRepository` from 002 (schema v2 already carries every column the spec needs — `name`, `tax_id`, `phone`, `email`, `address_line`, `notes`, `salesperson_id`), 005's sync machinery (`useSyncStatus`, `onPullToRefresh`, auto-push of locally-created rows), and 003's `useSession` hook. No WatermelonDB schema bump, no new library, no Supabase-side operational change — the offline-first foundation is entirely reused.

Three screens are introduced: `ClientsScreen` (list + tap-first search / filter + first-launch empty state), `ClientFormScreen` (register a new client offline), and `ClientProfileScreen` (store identity + order history + primary "New order" CTA). Each ships phone (390 × 844 pt) and tablet (820 × 1180 pt) portrait variants (UX5) via a local `useViewport()` hook at a 768 pt breakpoint — same pattern catalog already uses, intentionally duplicated rather than promoted to a shared module until a third feature asks for it (P3).

The `ClientFormScreen` treats save as a synchronous local write: `clientsRepository.create({ salespersonId, name, taxId, addressLine, notes, phone, email })` → list re-renders immediately from the WatermelonDB observation → 005's auto-push drains the row on the next successful sync pass. A per-row "pending sync" indicator reads WatermelonDB's own `_raw._status` field (`'created'` = unsynced, `'synced'` = pushed); no new column, no parallel state. Form draft persistence is a module-level singleton (`clientDraftStore`) — in-memory only, cleared on explicit save / cancel, survives app backgrounding within the same session (spec Assumption explicitly limits scope to one session).

The "New order" CTA navigates to a **stub route** (`NewOrder: { clientId: string }`) registered on `HomeStack`. Until the orders feature (future 008) replaces it, the stub screen in this feature says "Preparando pedido para [client]… módulo em breve" and offers a back button. This preserves the spec's hand-off semantic (FR-018) and the navigation edge is already in place when 008 lands — it only needs to swap the target component.

`salespersonId` resolution is handled by a tiny local hook `useActiveSalespersonId()` that observes `salespeopleRepository.observeAll()` and returns the id of the row whose `email` matches `useSession().email`. If no match exists (bootstrap gap — first run on a device that has never synced), the `ClientFormScreen` surfaces a salesperson-language blocking state asking the user to sync and retry. The `SessionSnapshot` shape is NOT changed — per P3, extending session state for one feature's convenience isn't warranted.

Search and filter are three composable pure functions in `src/features/clients/search/`: a diacritic-insensitive `normalize.ts` (same semantics as catalog's — deliberately duplicated), a `matches.ts` that tests a client against a query (name primary, CNPJ secondary per spec Assumption), and a `filter.ts` that composes query + tap filter. The tap filter dimensions are two: (a) a `Recente` chip showing clients with `updatedAt` in the top-10 (proxy for recency since the schema has no dedicated `created_at` column; for new clients `updatedAt === creation time`), and (b) an alphabetic initial-letter chip row derived from the unique first letters present in the current client list. If fewer than two distinct letters exist the chip row hides entirely and the UI degrades to text search (spec Assumption).

Entry into the module is through `HomePlaceholderScreen`: a new `Ver clientes` primary button is added above the existing `Ver catálogo` button, routing to `Clients`.

## Technical Context

**Language/Version**: TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (inherited from 001–006).

**Primary Dependencies**:

- `@nozbe/watermelondb` — **already installed** (002). Clients module reads and writes via `clientsRepository` (already shipped) and reads orders via `ordersRepository.observeByClient(clientId)` + `orderItemsRepository` (for total computation).
- `@react-navigation/native-stack` — **already installed** (001). Three new screens register onto the existing `HomeStack`; one additional stub route (`NewOrder`) is declared as a forward reference for the future orders feature.
- `react-native` core `useWindowDimensions()` — already in use across the app; inherited.
- `@/features/sync` — **already in place** (005). This feature subscribes to `useSyncStatus()` read-only (to render the header indicator) and inspects WatermelonDB's `_raw._status` per row for the pending-sync badge. No sync-engine code is modified.
- `@/features/auth` — **already in place** (003). Reads `useSession().email` to resolve the active salesperson.
- `@/data` — existing `clientsRepository`, `ordersRepository`, `orderItemsRepository`, `salespeopleRepository`, and models from 002.
- Dev: existing Jest + ts-jest; no new dev tooling.

**No new dependency added.** This is the first feature since 001 that ships without a package change.

**Storage**:

- **Client rows** — WatermelonDB `clients` table from 002. Schema already at v2 with every column the spec needs. **No migration in this feature.**
- **Order rows** — WatermelonDB `orders` + `order_items` (read-only references for the profile's history). Schema unchanged.
- **Salesperson rows** — WatermelonDB `salespeople` (read-only in this feature, for email → id resolution). Schema unchanged.
- **Form draft** — module-level singleton `clientDraftStore` in `src/features/clients/drafts/`. Backed by a plain in-memory object, never persisted to disk or AsyncStorage. Cleared on save or explicit cancel. Survives app backgrounding within the process lifetime only (spec Assumption explicitly limits scope to one session).
- **Supabase-side** — none. The `clients` table and its RLS policies are expected to already allow the owning salesperson to INSERT / SELECT their own rows from 005's sync bootstrap. Phase 0 research verifies this; the feature does NOT author new policies.

**Testing**: Constitution §9 — business-logic coverage first, UI does not need exhaustive tests in MVP. Ship unit tests for:

1. **Diacritic-insensitive normalize** (`normalize.test.ts`): `"São Paulo" → "sao paulo"`, `"açaí" → "acai"`, `"ÁRVORE" → "arvore"`, casing-insensitive, empty / whitespace input handled.
2. **Client matching** (`matches.test.ts`): name match primary; CNPJ match secondary (digits-only normalize before compare); name-empty + CNPJ-only query matches; query substring in the middle of the name matches.
3. **Composable filter** (`filter.test.ts`): text query + letter chip + recent chip compose as intersection; empty filters return the full list; recent chip ranks by `updatedAt` descending and returns the top-10; letter chip matches on first letter of normalized name.
4. **Draft store** (`clientDraftStore.test.ts`): `set` then `get` returns the same object; `clear` wipes to `null`; `subscribe` fires on set + clear; multiple subscribers receive updates; no cross-test state leak via `__resetForTests`.
5. **CNPJ format validator** (`cnpj.test.ts`): accepts 14 digits bare; accepts formatted (`12.345.678/0001-99`); normalizes to digits-only; rejects wrong-count (< 14 or > 14 digits); empty input is "valid" (the field is optional per spec FR-008); no checksum validation (spec explicitly defers that to the admin).
6. **Order history derivation** (`orderHistory.test.ts`): total = Σ(item.quantity × item.unitPrice − item.discountAmount) − order.discountAmount, clamped at ≥ 0; canceled orders marked as such; empty-items order has total = 0 (clamped from negative after discount); ordering is `createdAtMs` descending.
7. **Active salesperson resolution** (`useActiveSalespersonId.test.ts`): returns the id when a salesperson row's email matches the session email; returns `null` while the session is unauthenticated; returns `null` when no salesperson row matches (bootstrap gap) so the caller can surface a blocking state.

8. **Contact-field split** (`contactSplit.test.ts`): empty / whitespace input both null; phone-only line; email-only line; phone + email on separate lines in either order; `@`-bearing line routed to email; multiple phone lines joined with space; per-line trim.

UI is verified by manual walkthrough against the acceptance scenarios in spec.md, on a phone simulator (390 × 844) and an iPad simulator (820 × 1180). No Pencil frames exist for this feature because the `/speckit-pencil-design` hook was not run before spec authoring — the Design Prerequisite gate below flags this explicitly and the first task in tasks.md will be `Run /speckit-pencil-design` before any implementation task begins.

**Target Platform**: iOS 13+ and Android 7+ (inherited). No platform-specific API introduced.

**Project Type**: Mobile app — feature module addition on top of 002 data, 003 auth, 004 lock gate, 005 sync engine, and 006 catalog (aesthetic + responsive reference). No backend code. No Supabase schema change.

**Performance Goals**:

- `ClientFormScreen` save returns control to the salesperson in under 300 ms on both baseline viewports (SC-002), measured offline against a local database with up to 200 existing clients. Achieved by the single `clientsRepository.create` write which the 002 benchmarks already put well inside this budget.
- `ClientsScreen` first-fold render under 500 ms on a cold app start on both baseline viewports, measured against the same 200-client local database. Achieved by reading straight from the WatermelonDB observation — no async joins at list time.
- A salesperson locates a known client among 200 rows in under 10 seconds using only tap filters (SC-005). Design target; the implementation's responsibility is rendering the chip row within the first-fold budget and updating the list synchronously on chip tap (pure-function filter, no async boundary).
- No blocking full-screen spinner on any screen at any point (SC-008, constitution P1). The form's save path is synchronous from the salesperson's perspective. The list and profile render whatever is already local, even during a sync pass.

**Constraints**:

- **Offline-first (P1)**: every salesperson-facing screen MUST render and save against WatermelonDB only. No network call on any primary path in this feature. The pending-sync badge is a read-through of local state; it does not initiate any request.
- **Duplicate-CNPJ policy (D3, FR-007)**: the form MUST NOT compare against existing rows. Save is unconditional. Conflict resolution is the admin's responsibility, post-sync, outside this app.
- **Read-only orders reference (R1)**: this feature reads order rows to render history but MUST NOT mutate them. The "New order" CTA's stub does not create any order — it only navigates. When the orders feature (008) replaces the stub, creation ownership stays with that feature.
- **Role visibility (UX6 / D7)**: the Clients module lives on `HomeStack`, which is the VENDEDOR navigation surface. It is naturally invisible to `admin`-only users (who would see a different root navigator per UX6 once 013 ships). No additional client-side role gate is added in this feature; the architectural separation is enough until the dual-role navigator lands.
- **Portrait-only (UX5)**: landscape is out of scope; `app.json` already locks orientation (inherited).
- **Language (constitution §9)**: user-visible copy is Portuguese; identifiers are English. All copy in this feature is written fresh in this plan's Phase 1 artifacts.

**Scale/Scope**:

- **~24 new source files + 8 unit-test files** under `src/features/clients/`. Breakdown: 3 screen components (`ClientsScreen`, `ClientFormScreen`, `ClientProfileScreen`), 1 stub screen (`NewOrderStubScreen`), 9 presentational components (`ClientListRow`, `ClientEmptyView`, `ClientNoMatchesView`, `ClientFormFields`, `CnpjField`, `PendingSyncBadge`, `OrderHistoryList`, `OrderHistoryRow`, `OrderHistoryEmptyView`), 7 hooks (`useClients`, `useClientsFilter`, `useClientDraft`, `useClientOrderHistory`, `useActiveSalespersonId`, `useObservableClient`, `useViewport`), 3 search modules (`normalize`, `matches`, `filter`), 1 draft-store module (`clientDraftStore`), 1 CNPJ-validator module (`cnpj.ts`), 1 contact-split module (`splitContact.ts`), 1 barrel `index.ts`, 1 responsive breakpoints module. Test files: `normalize.test.ts`, `matches.test.ts`, `filter.test.ts`, `clientDraftStore.test.ts`, `cnpj.test.ts`, `orderHistory.test.ts`, `useActiveSalespersonId.test.ts`, `contactSplit.test.ts`.
- **0 existing 002 files receive edits** — data layer is ready as-is.
- **3 navigation/home files receive edits**: `src/app/navigation/HomeStack.tsx` gains four routes (`Clients`, `ClientForm`, `ClientProfile`, `NewOrder`); `src/app/navigation/types.ts` adds their param list entries; `src/features/home/screens/HomePlaceholderScreen.tsx` gains a `Ver clientes` primary button wired to `navigation.navigate('Clients')`, placed above the existing `Ver catálogo` button.
- **0 package changes**. `package.json` is untouched.
- **0 Supabase-side operational changes**. RLS already permits the salesperson to INSERT / SELECT their own `clients` rows (Phase 0 research confirms).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | List, form, and profile all read from WatermelonDB (FR-003, FR-019). Save is a single local write with no network round-trip (FR-011). Pending-sync badge is a local read-through of `_raw._status`. The "New order" CTA stub is a pure navigation — no network. |
| P2 Local DB is source of truth | ✅ | Pass | Clients created on this device appear immediately in the list (FR-004). Push is 005's responsibility and remains last-write-wins. This feature introduces no parallel truth. |
| P3 MVP simplicity | ✅ | Pass | No schema migration. No new dependency. No structured sub-forms (address and contact are single free-text blocks per spec Assumption). No in-app duplicate detection (D3 / FR-007). No in-app client edit or delete (spec Assumption). Draft store is in-memory only. `useViewport` duplicated from catalog rather than extracted — promotion to a shared module deferred until a third feature asks for it. |
| P4 Reuse free tools | ✅ | Pass | Admin-side client CRUD and CNPJ-merge remain with the Supabase dashboard (D3) and the future 015-admin-clients feature. No admin UI built here. |
| P5 Salesperson data is sacred | ✅ | Pass | Offline-created clients appear in the list with a pending-sync badge that is honest about their unsynced state (spec edge case explicitly). The draft form's in-session persistence (FR-010) protects against accidental navigation-away loss. The feature never discards form input implicitly — cancel requires an explicit user action. |
| P6 Admin is online-first | N/A | — | This feature is VENDEDOR-only. No admin screens, no `src/features/admin/` code. Admin-side client CRUD is deferred to future 015. |
| §3 Mandatory — Expo managed + dev client | ✅ | Pass | No new native module. No dev-client change. |
| §3 Mandatory — WatermelonDB | ✅ | Pass | `clients` reads and writes go through the existing repository. Order-history reads observe existing collections via existing repository methods. |
| §3 Mandatory — Supabase | ✅ | Pass | Admin dashboard already owns `clients` CRUD for conflict-merge (D3). Sync push covers the client create path. No direct Supabase call from this feature. |
| §3 Mandatory — `expo-file-system` | N/A | — | No image storage in this feature. |
| §3 Mandatory — `expo-secure-store` | N/A | — | No secret persisted by this feature. |
| §3 Mandatory — `expo-local-authentication` | N/A | — | Unlock is 004's responsibility; clients screens mount inside `<LockGate>` on `HomeStack`. |
| §3 Mandatory — `expo-image-picker` / `expo-image-manipulator` | N/A | — | No photo upload in this feature (those libraries are first used by admin feature 013). |
| §3 Forbidden — custom backend / Firebase / heavy state mgmt | ✅ | Pass | No backend. No Firebase. Filter state is local React state + pure functions. Draft state is a module-level singleton — same pattern 005 uses for `syncStatusStore` and catalog uses for `imageCache`. |
| §3 Forbidden — heavy UI libraries | ✅ | Pass | RN core components only. Reuses the shadcn-neutral visual language already established in auth / lock / catalog screens. |
| §3 Allowed with justification — dev-build native lib | N/A | — | No new native module. |
| R1 WatermelonDB is the single client data layer (VENDEDOR) | ✅ | Pass | All reads and the single write go through 002 repositories. No direct Supabase call in runtime code. |
| R2 Seven entities | ✅ | Pass | No new entity. Uses existing `clients`, `orders`, `order_items`, `salespeople`. |
| R3 Images in Storage + local cache | N/A | — | No images in this feature. |
| R4 PDF local, email via share sheet | N/A | — | Not touched. |
| R5 Discounts on order, not catalog | ✅ | Pass | Order history derives totals using order + order-item `discountAmount`; this feature reads the existing discount fields and does not introduce any catalog-side discount surface. |
| §5 UX1 Tap, not type | ✅ | Pass | Filter chips (Recente + alphabetic initials) are the primary narrowing mechanism (FR-020); the text field is the secondary fallback (FR-021). Tap-to-open profile. "New order" is a single dominant tap target on the profile. |
| §5 UX2 Repeat previous order | N/A | — | "Repeat last order" belongs to the future orders feature. This feature only lists history; the one-tap repeat path is out of scope. |
| §5 UX3 Useful empty states | ✅ | Pass | Three distinct empty states: (a) first-launch clients list with a `Cadastrar primeiro cliente` CTA (FR-026, distinct from the no-match state per FR-027); (b) search/filter "no matches" state with a reset control (FR-025); (c) profile order-history empty state pointing to the `Novo pedido` CTA (FR-016). All in salesperson language — copy drafted in this plan's artifacts. |
| §5 UX4 Discreet sync feedback | ✅ | Pass | Global sync status remains 005's `<SyncStatusIndicator>` on every header. Per-row pending-sync badges in the clients list are a small dot + label, never modal. |
| §5 UX5 Phone AND tablet layouts | ⚠️ | Conditional pass | Responsive strategy is documented below (768 pt breakpoint via `useViewport`). However, Pencil frames do NOT exist for this feature yet — the `/speckit-pencil-design` pre-hook was not run before spec authoring. The Design Prerequisite gate below flags this and tasks.md Phase 0 will include `Run /speckit-pencil-design` as the FIRST item before any Setup task. Implementation MUST NOT begin before phone + tablet frames exist for all three primary screens (list, form, profile); in-screen sub-states (first-launch empty, no-matches, pending-sync row, history-empty) do not require separate frames. |
| §6 D1 Pull then push | N/A | — | Sync is 005's concern. This feature writes a local row; 005's existing push drains it. |
| §6 D2 Catalog read-only in app | N/A | — | Not touched. |
| §6 D3 Admin-side merge for duplicates | ✅ | Pass | **This feature is the seller-side implementation of D3.** FR-007 prohibits in-app duplicate detection. Save is unconditional. Admin merge lives in the future 015 feature (or in the Supabase dashboard as D3 permits). |
| §6 D4 Simple order statuses | ✅ | Pass | Order-history rows render `draft` / `sent` / `canceled` (FR-015). No lifecycle logic — status is read and displayed. |
| §7 D5 Online-one-time + offline-persistent | ✅ | Pass | This feature does no auth work. Field writes are offline-trusted; sync push revalidates via Supabase Auth + RLS when connectivity returns. |
| §7 D6 Mandatory local lock | ✅ | Pass | `HomeStack` is gated by `<LockGate>` (inherited from 004). Client screens sit inside `HomeStack`; unlock is a precondition for any render. |
| §7 D7 Role-based authorization | ✅ | Pass | See the Role & Authorization section below. Writes to `clients` rely on existing RLS from 005's bootstrap; no new policies are authored. |
| §9 English identifiers | ✅ | Pass | Every new file, type, function, component, variable name in English. Portuguese appears only in user-visible strings (form labels, chip labels, empty-state copy, error messages). Copy centralized in the screens and empty-state components, not scattered. |

**Gate status (pre-research)**: CONDITIONAL PASS. Zero principle violations. One Design Prerequisite gap (Pencil frames missing) that is handled by making `/speckit-pencil-design` the first tasks.md entry in Phase 0. No Complexity Tracking entries needed.

## Role & Authorization Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Does this feature expose or touch role-guarded surfaces?** Yes — the feature writes to the `clients` table, which D7 places under RLS. The surface itself is VENDEDOR-only (no admin UI), but any INSERT on `clients` goes through Supabase RLS on sync push.

| Check | Value / Status | Notes |
|-------|----------------|-------|
| Roles affected (admin / seller / dual-role) | `seller` (VENDEDOR) only | No admin screens, no admin affordances. Admin-side client CRUD and CNPJ merge are deferred to 015-admin-clients per D3. |
| New or modified RLS policies (per table) | **None introduced by this feature** | `clients` INSERT / SELECT policies allowing the owning salesperson are assumed in place from 005's sync bootstrap and the admin's initial Supabase setup (see `specs/005-sync-engine/contracts/supabase-schema.md` lines 105–107). Phase 0 research **verifies** the policies exist against the dev Supabase. If they are missing, the gap is a prerequisite for this feature and blocks shipping — it is documented in [research.md §R-009](./research.md) and will be surfaced as the first Phase 1 Setup task if verification fails. No migration file is authored here because authoring RLS without a concrete dev-env gap would violate P3. |
| Edge Functions introduced (service_role usage) | none | Sync push uses the salesperson's own JWT. No service-role call from this feature. |
| Offline classification per P6 (online-required / offline-first / mixed) | **offline-first** | Field work per D3 and P1. Every salesperson-facing screen saves and reads against WatermelonDB synchronously. The feature never blocks on the network. |
| Client-side affordance visibility rule (UX6) | Clients module is visible only from `HomeStack` | `HomeStack` is the VENDEDOR navigation surface. Once 013 ships the dual-role navigator per UX6, admin-only users will not see `HomeStack` and therefore cannot reach these screens. No additional client-side role check is added in this feature. |
| Dual-role user impact | Neutral — dual-role users see the Clients module as part of their VENDEDOR tab | No admin affordances to hide. When 015 adds the admin-side client CRUD it lives under `src/features/admin/clients/`, not here. Both surfaces coexist without cross-referencing. |

## Design Prerequisite

*GATE: Must pass before any implementation task is generated.*

**Does this feature have a UI?** Yes — three primary screens (list, form, profile) plus a fourth stub screen (`NewOrder`) that will be replaced by the future orders feature. Each primary screen has a phone and a tablet variant per UX5.

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | Three primary screens × two viewports = six target frames, plus four in-screen sub-states (first-launch empty, no-matches, pending-sync row, order-history empty) that do not require dedicated frames. |
| `design/screens.md` exists | ⚠️ | **Pencil design session was NOT run before spec authoring.** No `design/` directory, no `design.json`, no frames. |
| Phone frames cover all screens | ⚠️ | Missing. |
| Tablet frames cover all screens | ⚠️ | Missing. |
| Responsive strategy documented below | ✅ | `useViewport()` returns `'phone' \| 'tablet'` from `useWindowDimensions().width >= 768`. Each screen reads the viewport once and branches its layout inline — single-column stack on phone, split pane or multi-column on tablet. Same pattern as auth / lock / catalog screens; deliberate duplication of the hook per P3 (Structure Decision point 2). |

**Consequence**: tasks.md Phase 0 MUST begin with a single blocking task `Run /speckit-pencil-design to produce phone + tablet frames for ClientsScreen, ClientFormScreen, ClientProfileScreen (six frames total) before any Setup task starts`. This plan establishes the architecture and artifacts; the screens' visual composition is authored during the Pencil session and reflected in the components before implementation. Once the design session runs, this plan will not need to be updated — the screens.md + design.json artifacts will live alongside this plan and the Pencil hook will update `spec.md`'s UI Design section automatically.

## Project Structure

### Documentation (this feature)

```text
specs/007-client-registration/
├── plan.md                                 # This file
├── research.md                             # Phase 0 — nine research items: salespersonId resolution, CNPJ validator shape, recency definition, order total arithmetic, draft-store scope, pending-sync badge source, new-order CTA stub strategy, useViewport duplication decision, clients RLS verification
├── data-model.md                           # Phase 1 — existing Client entity (no change) + derived DTOs (ClientListItemDTO, ClientProfileDTO, OrderHistoryRowDTO), draft shape, filter state shape
├── quickstart.md                           # Phase 1 — how HomeStack mounts Clients, how the form resolves the active salesperson, how the profile reads order history, how to seed clients for a simulator demo, how the NewOrder stub swaps out when 008 ships
├── contracts/
│   ├── clients-service.md                  # Public surface of the feature barrel: screens, hook shapes, route param types
│   ├── client-draft-store.md               # clientDraftStore singleton API (get, set, clear, subscribe), lifecycle, test-reset hatch
│   ├── search-filter.md                    # normalize / matches / filter pure-function contracts, composition rules, tiebreakers, recent-top-K semantics
│   ├── order-history.md                    # useClientOrderHistory hook shape, OrderHistoryRowDTO, total-computation rules, "New order" hand-off contract (stub -> 008 swap)
│   └── responsive.md                       # Local useViewport hook, TABLET_MIN_WIDTH = 768, per-screen layout-branch rules (stack vs split, chip row density, form field spacing)
├── checklists/
│   └── requirements.md                     # Spec quality checklist (from /speckit-specify)
└── tasks.md                                # Phase 2 — /speckit-tasks output (NOT created here; first entry MUST be "Run /speckit-pencil-design")
```

### Source Code (repository root)

The clients feature sits as a peer of `src/features/auth/`, `src/features/lock/`, `src/features/sync/`, `src/features/home/`, and `src/features/catalog/` under `src/features/`, exposed through a single barrel. Exactly three modules outside the feature folder reach into it: `src/app/navigation/HomeStack.tsx` (registers `Clients`, `ClientForm`, `ClientProfile`, `NewOrder` routes), `src/app/navigation/types.ts` (adds route param types), and `src/features/home/screens/HomePlaceholderScreen.tsx` (adds one primary button). Zero 002 files are modified.

```text
.
└── src/
    ├── app/
    │   └── navigation/
    │       ├── HomeStack.tsx                          # MODIFIED — registers 'Clients', 'ClientForm', 'ClientProfile', 'NewOrder' screens with Portuguese titles
    │       └── types.ts                               # MODIFIED — adds Clients, ClientForm, ClientProfile, NewOrder param entries to HomeStackParamList
    └── features/
        ├── home/
        │   └── screens/
        │       └── HomePlaceholderScreen.tsx          # MODIFIED — adds primary 'Ver clientes' Pressable above the existing 'Ver catálogo' button
        └── clients/
            ├── index.ts                                # NEW — public barrel: ClientsScreen, ClientFormScreen, ClientProfileScreen, NewOrderStubScreen, route types
            ├── screens/
            │   ├── ClientsScreen.tsx                  # NEW — top bar + search + chip row + list OR empty state; branches by local-count
            │   ├── ClientFormScreen.tsx               # NEW — top bar + form fields + save CTA; reads/writes clientDraftStore; resolves salespersonId via useActiveSalespersonId
            │   ├── ClientProfileScreen.tsx            # NEW — top bar + identity block + order-history list + primary 'Novo pedido' CTA; tablet uses split pane
            │   └── NewOrderStubScreen.tsx             # NEW — temporary stub until 008 ships; route param clientId; says 'módulo em breve', shows back button
            ├── components/
            │   ├── ClientListRow.tsx                  # NEW — row: name + (optional) tax id + address snippet + PendingSyncBadge
            │   ├── ClientEmptyView.tsx                # NEW — first-launch empty state with 'Cadastrar primeiro cliente' CTA
            │   ├── ClientNoMatchesView.tsx            # NEW — zero-results state with a reset control
            │   ├── ClientFormFields.tsx               # NEW — the 5 form fields (name required, CNPJ optional with CnpjField, address, contact, notes)
            │   ├── CnpjField.tsx                      # NEW — text input with mask-friendly accept (strip non-digits on commit, inline format-error hint)
            │   ├── PendingSyncBadge.tsx               # NEW — small dot + 'Aguardando envio' label; renders when client._raw._status !== 'synced'
            │   ├── OrderHistoryList.tsx               # NEW — vertical list of OrderHistoryRow; wraps OrderHistoryEmptyView
            │   ├── OrderHistoryRow.tsx                # NEW — date + status pill + total; canceled status visually distinct (FR-015)
            │   └── OrderHistoryEmptyView.tsx          # NEW — 'Nenhum pedido ainda. Toque em Novo pedido para começar.'
            ├── hooks/
            │   ├── useClients.ts                      # NEW — observes clientsRepository.observeByOwner(salespersonId); returns { clients, hasAny }
            │   ├── useClientsFilter.ts                # NEW — local state { query, activeFilter }; activeFilter is 'recent' | { kind: 'letter', value: string } | null; returns filtered[] + reset()
            │   ├── useClientDraft.ts                  # NEW — reads/writes clientDraftStore; returns { draft, setDraft, clearDraft }
            │   ├── useClientOrderHistory.ts           # NEW — observes ordersRepository.observeByClient(clientId) joined with order items; returns OrderHistoryRowDTO[] sorted most-recent-first
            │   ├── useActiveSalespersonId.ts          # NEW — observes salespeopleRepository.observeAll() + session.email; returns { salespersonId: string | null, status: 'resolving' | 'ready' | 'missing' }
            │   ├── useObservableClient.ts             # NEW — useState + useEffect wrapper over clientsRepository.observe(clientId); used by ClientProfileScreen and NewOrderStubScreen
            │   └── useViewport.ts                    # NEW — returns 'phone' | 'tablet' based on useWindowDimensions().width >= 768 (duplicated from catalog per P3)
            ├── drafts/
            │   └── clientDraftStore.ts               # NEW — module-level singleton: get, set, clear, subscribe, __resetForTests
            ├── search/
            │   ├── normalize.ts                      # NEW — NFD + diacritic strip + toLowerCase; pure (duplicated from catalog per P3)
            │   ├── matches.ts                        # NEW — name primary, CNPJ secondary (digits-only); pure
            │   └── filter.ts                        # NEW — applyFilter({ clients, query, activeFilter }); empty filters return full list; recent sorts by updatedAt desc top-10; letter matches on normalized first char
            ├── cnpj/
            │   └── cnpj.ts                           # NEW — normalize(raw) → digits-only; isValidFormat(raw) → boolean (14 digits); pure; no checksum
            ├── contact/
            │   └── splitContact.ts                   # NEW — splits free-text "Contato" into { phone, email } on save; pure
            ├── responsive/
            │   └── breakpoints.ts                   # NEW — TABLET_MIN_WIDTH = 768 (duplicated from catalog per P3)
            └── tests/
                ├── normalize.test.ts                 # NEW — diacritic/case-insensitive
                ├── matches.test.ts                   # NEW — name primary, CNPJ secondary
                ├── filter.test.ts                    # NEW — compose query + filter; recent top-K; letter match
                ├── clientDraftStore.test.ts          # NEW — set/get/clear/subscribe, __resetForTests
                ├── cnpj.test.ts                      # NEW — format validation, normalization
                ├── orderHistory.test.ts              # NEW — total arithmetic, empty items, ordering
                ├── useActiveSalespersonId.test.ts    # NEW — resolves via session email, null on missing, null on unauthenticated
                └── contactSplit.test.ts              # NEW — free-text contact → phone/email split heuristic
```

**Structure Decision**: The clients feature is structured around four architectural levers that keep it well-bounded and match the patterns already established by 003 / 004 / 005 / 006:

1. **Three layers inside the feature**: presentation (`screens/`, `components/`), logic (`hooks/`, `search/`, `drafts/`, `cnpj/`), and layout primitives (`responsive/`). `useActiveSalespersonId` and `useClientOrderHistory` are the only hooks that reach outside the feature (into `@/features/auth` and `@/data`); all other imports are local.

2. **Responsive strategy = local `useViewport()` hook + inline layout branches**. `useViewport()` returns `'phone' | 'tablet'` by dividing `useWindowDimensions().width` at 768 pt. Each screen reads the viewport once and branches inline — single-column stacked list vs. wider content paddings on the list screen; single-column stacked form vs. two-column form layout (name / CNPJ on row 1, address / contact on row 2, notes full-width) on tablet; stacked identity-then-history on phone vs. side-by-side identity + history split on tablet. **The `useViewport` hook and `breakpoints.ts` are deliberately duplicated from the catalog feature, not imported across features, to preserve feature isolation. A shared `src/app/responsive/` extraction is pre-approved when a third feature needs the hook; it is not done here to avoid refactoring catalog's imports for a zero-user-value move (P3).**

3. **Draft state is a module-level singleton, not a React Context**. `clientDraftStore` is three functions (`get`, `set`, `clear`) + a `subscribe` on top of a private object. `useClientDraft` is a thin `useSyncExternalStore` wrapper. No Context = no provider, no re-render storms when the form mounts, and a clean test seam via `__resetForTests`. Same pattern 003's `sessionStore`, 004's `lockStore`, 005's `syncStatusStore`, and 006's `imageCache` already follow.

4. **Clients are displayed through projection DTOs**, not `Client` model instances. `useClients` returns `ClientListItemDTO[]`; `ClientProfileScreen` reads a `ClientProfileDTO`; order-history rows are `OrderHistoryRowDTO`. This isolates the UI from WatermelonDB's mutation methods (components cannot accidentally call `.update()` or `.markAsDeleted()`), keeps `_raw._status` access centralized in the DTO derivation, and simplifies snapshot tests — pure data, no framework wrapper.

**Rejected alternatives**:

- **Extend `SessionSnapshot` with `salespersonId`** — rejected by P3. Adding a field to session state for one feature's convenience changes a cross-cutting contract (003 and every consumer of `useSession`) to save one hook in one module. The `useActiveSalespersonId` observation is ~15 lines and colocated with the feature that uses it. If a second feature needs the salesperson id later, the session extension can be revisited once the pattern is worn in.
- **Promote `useViewport` and `TABLET_MIN_WIDTH` to `src/app/responsive/` now** — considered and rejected. The extraction touches catalog's imports for a theoretical future third consumer. Per P3, the rule is "extract when a third feature asks, not before". Documented in Structure Decision point 2 so the next feature's plan knows the extraction is pre-approved.
- **Persist the form draft via AsyncStorage** — rejected by the spec's own Assumption ("long-term draft recovery … is not required in the MVP"). In-memory only is deliberately the right scope — protects against "I tabbed away for 20 seconds", not "I lost my phone for a week". P3 + spec boundary alignment.
- **Run the `/speckit-pencil-design` hook during plan authoring to unblock the Design Prerequisite gate here** — rejected because the user's `/speckit-plan` invocation is authoring the plan, not the design. Running Pencil inside the plan skill would shadow the normal `/speckit-specify` → optional Pencil pre-hook flow and entangle two skills. Instead, tasks.md Phase 0 explicitly blocks on a Pencil run as its first entry — the architecture here does not depend on which frames Pencil produces, only on the fact that they exist before implementation.
- **Create a fourth `Order` draft row when the salesperson taps "New order"** — rejected. Creating a draft every time the CTA is tapped would litter `orders` with empty drafts and pollute the client's history area the next time they open the profile. The stub screen is pure navigation; the orders feature (008) will own order-draft creation.
- **Wire the "New order" CTA to `Alert.alert('Em breve')` instead of a dedicated stub screen** — rejected for UX reasons. A modal alert on the primary screen CTA is a cliff-edge "coming soon" message. The stub screen is a small, polite, navigable surface that the orders feature can swap into without the salesperson ever noticing a visual discontinuity at the moment of ship.
- **Compute `recentThresholdDays` instead of "top-K by `updatedAt`"** — considered. A "last 7 days" threshold is more semantically meaningful than "top-10" but requires a wall-clock comparison that can be brittle when the device clock drifts. Top-K is time-insensitive and always produces a useful-size chip result (never zero, never a huge list). Phase 0 research locks in top-10 and revisits if field data suggests a threshold works better.
- **Introduce a `created_at_ms` column on `clients` so recency is exact** — rejected by P3. A schema bump for a heuristic is not proportionate. `updated_at` is a good enough recency proxy because (a) new clients have `updated_at === creation time`, (b) edits are out of scope in this feature, and (c) admin-side edits via the dashboard are rare in practice.
- **Gate the ClientsScreen entry on `useActiveSalespersonId` resolving to ready** — rejected. A salesperson could have clients from a prior session even if the salesperson row is mid-sync on first launch. The list screen reads `observeByOwner(salespersonId)` and gracefully shows the empty state when salespersonId is null; the form screen is the one that blocks, because it cannot create without an id. This split honors P1 (list never blocks on anything) and gives a precise blocking UX where it's actually needed (form save).
- **Implement an inline "mark client as edited by me" flag to distinguish dirty local rows from remotely updated rows** — rejected. WatermelonDB's `_raw._status` already distinguishes `created` (local insert not pushed), `updated` (local edit not pushed — not reachable from this feature because edits are out of scope), and `synced`. No parallel state.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified.**

None. Gate passed pre-research with zero principle violations. The Design Prerequisite conditional is handled by blocking tasks.md Phase 0 on `/speckit-pencil-design`.

## Phase 1 post-design re-check

After Phase 1 artifacts (research.md, data-model.md, contracts/, quickstart.md) were drafted, the Constitution Check table is re-evaluated. Items surfaced during Phase 1 and not moving the gate:

1. **RLS verification (research §R-009)** completed against the dev Supabase: existing `clients` INSERT / SELECT policies allow the owning salesperson to create and read their own rows. No new RLS policy is authored in this feature. The Phase 1 Setup "verify RLS" task remains in tasks.md as a sanity check, not as a migration.
2. **Order-total arithmetic (research §R-004)** resolved: total = Σ(item.quantity × item.unitPrice − item.discountAmount) − order.discountAmount, clamped at ≥ 0 to avoid surfacing negative totals when a data anomaly exists. Matches what the future orders feature is expected to display.
3. **Duplication of `useViewport` and `normalize`** is flagged as a pending refactor after a third consumer lands (any future feature under `src/features/` that needs either). A one-line TODO lives in the respective duplicated files pointing at the catalog original.

**Gate status (post-design)**: PASS. Zero violations. Design Prerequisite remains ⚠️ until the `/speckit-pencil-design` run completes; tasks.md blocks implementation until then.
