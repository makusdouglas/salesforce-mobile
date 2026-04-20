# Implementation Plan: Local Data Layer (WatermelonDB Foundation)

**Branch**: `002-local-data-layer` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-local-data-layer/spec.md`

## Summary

Install WatermelonDB as the sole client-side data layer, define schema version 1 covering the seven MVP entities from constitution R2 (`salespeople`, `clients`, `products`, `product_variants`, `orders`, `order_items`, `payment_receipts`) with their relationships, require the four sync-readiness columns (`server_id`, `updated_at`, `_status`, `_changed`) on every table, add an empty migrations registry, and expose one typed repository per entity through a single barrel so features never import the remote-database SDK. No UI, no sync work, no business logic — this block is the plumbing every later feature plugs into.

## Technical Context

**Language/Version**: TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (inherited from 001).
**Primary Dependencies**: `@nozbe/watermelondb` (latest stable compatible with RN 0.83 / React 19.2 / Expo SDK 55). Dev: `@nozbe/with-observables` only if a later feature needs HOC-style reactive bindings (not installed in this block — hooks alone are enough). Supabase JS client is **not** installed here; it arrives with the sync block.
**Storage**: Local SQLite via WatermelonDB's SQLiteAdapter (JSI mode on iOS, JSI mode on Android when available). Schema version **1** ships with this feature; the migrations registry is created empty.
**Testing**: Manual verification of CRUD for each entity via a throwaway screen (aligned with constitution §9 — test investment goes to business logic, not plumbing). The originally planned Jest unit test for the `_touch` helper was dropped at implementation time: WatermelonDB's built-in sync machinery already manages `_status` and `_changed` automatically, which leaves `_touch` with only two trivial assignments (`serverId = null`, `updatedAt = Date.now()`) — not worth the Jest config investment. The full bookkeeping is instead audited in [checklists/acceptance.md](./checklists/acceptance.md) and exercised end-to-end by the smoke screen.
**Target Platform**: iOS 13+ and Android 7+ (inherited from 001).
**Project Type**: Mobile app, data layer addition to the existing Expo managed-workflow scaffold.
**Performance Goals**: Database init under 1 s on a mid-range Android device (SC-006). Single-record CRUD under 50 ms, list query (≤1000 rows) under 100 ms (internal budgets, not user-visible).
**Constraints**: Offline-first (P1, FR-011). No network dependency. WatermelonDB requires native modules → this feature promotes the app from Expo Go to an **EAS development build / dev client** (permitted by constitution §3 "Allowed with justification" — see research R1). The `index.ts` entry file needs WatermelonDB's Babel decorator support enabled.
**Scale/Scope**: ~20–25 new source files: 7 model classes + 7 repositories + 1 database singleton + 1 adapter config + 1 schema file + 1 migrations file + 1 shared types file + 1 barrel + 1 Babel config update + 1 app config plugin update. Zero UI.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | All reads/writes against local SQLite; FR-011 enforces zero network at the adapter surface. |
| P2 Local DB is source of truth | ✅ | Pass | This feature *is* the local DB. The adapter surface is the single write path for every later feature. |
| P3 MVP simplicity | ✅ | Pass | One typed repository per entity, thin wrappers over WatermelonDB Collections. No generic `forEntity("…")` API, no DI container, no service layer on top of repositories. |
| P4 Reuse free tools | N/A | — | Admin registration of catalog happens in Supabase dashboard — out of scope here. |
| P5 Salesperson data sacred | ✅ | Pass | Migrations preserve existing rows (FR-006); soft-deletes via `_status='deleted'` (FR-014) keep unsynced deletions recoverable. |
| §3 Mandatory — WatermelonDB | ✅ | Pass | This is the feature that installs it. |
| §3 Mandatory — Expo managed workflow | ⚠️ Justified | Pass | WatermelonDB requires native modules → app moves from Expo Go to an **EAS development build / dev client**. Constitution §3 explicitly permits this: "dev build allowed when a library requires it". Justification captured in research R1. |
| §3 Mandatory — Supabase, expo-print, expo-secure-store, expo-local-authentication | Deferred | Pass | None installed here. Each arrives with its owning feature block. |
| §3 Forbidden — custom backend, Firebase, Redux/MobX, heavy UI | ✅ | Pass | None introduced. WatermelonDB has its own reactive layer, so no state library is needed. |
| R1 WatermelonDB is the single client data layer | ✅ | Pass | Core of the feature. Feature-level enforcement via (a) ESLint rule forbidding `@supabase/supabase-js` imports outside `src/data/` and (b) SC-002 audit. |
| R2 Minimalist data model — exactly 7 entities | ✅ | Pass | Schema contains exactly the 7 MVP tables. No eighth table without a spec amendment. |
| R3 Images in Supabase Storage with local cache | ✅ | Pass | Only URL string columns for `image_url` on `product` and `image_url` on `payment_receipt`. No blob columns. |
| R4 PDF local, email via share sheet | N/A | — | No PDF in this block. |
| R5 Discounts on order, not catalog | ✅ | Pass | `discount_amount` column on `orders` and `order_items`. Zero discount columns on `products` or `product_variants`. Enforced by schema (missing column → compile-time error if a feature tries to write it). |
| §5 UX1–UX4 | N/A | — | No UI in this block. |
| §6 D1 Pull then push | N/A | — | Sync deferred. |
| §6 D2 Catalog read-only in app | ✅ | Pass | `productsRepository` and `productVariantsRepository` expose only read methods (`findById`, `query`, `observe…`). No `create` / `update` / `delete` methods on those two repositories. |
| §6 D3 Client registration conflicts | N/A | — | Deferred to sync block; repository exposes create/update freely. |
| §6 D4 Order statuses draft/sent/canceled | ✅ | Pass | `status` column on `orders` is a string constrained by a TS literal union `'draft' \| 'sent' \| 'canceled'` in the model typing. |
| §7 D5/D6 Auth | N/A | — | Auth deferred. No token columns in this schema. |
| §9 Code Conventions — English identifiers | ✅ | Pass | Every table, column, class, file name is English. Portuguese does not appear in the data layer. |

**Gate status (pre-research)**: PASS with one justified deviation (Expo dev client), which §3 explicitly permits.

## Project Structure

### Documentation (this feature)

```text
specs/002-local-data-layer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output — the seven entities in detail
├── quickstart.md        # Phase 1 output — "how a feature uses the repositories"
├── contracts/
│   ├── repository.md    # Adapter surface the rest of the app depends on
│   ├── schema.md        # Full schema version 1 (columns, types, indexes, relations)
│   └── migrations.md    # How future migrations are authored
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output — /speckit-tasks
```

### Source Code (repository root)

New files land under `src/data/` — an app-level directory sibling to `src/app/`. This respects constitution §9 (no global type-based folders) because `src/data/` is a bounded infrastructure concern, not a type-split of feature code.

```text
.
├── app.json                             # MODIFIED — add "@nozbe/watermelondb/DatabaseBridge" plugin entries if needed
├── babel.config.js                      # MODIFIED — add "@babel/plugin-proposal-decorators" (legacy: true) for Watermelon @field/@relation
├── eas.json                             # NO CHANGE (profiles from 001 stay valid)
├── eslint.config.js                     # MODIFIED — add rule: no import of "@supabase/supabase-js" outside src/data/
├── package.json                         # MODIFIED — add @nozbe/watermelondb, @babel/plugin-proposal-decorators (dev), expo-dev-client
└── src/
    ├── app/                             # existing (from 001)
    ├── features/                        # existing (from 001)
    └── data/                            # NEW — the data layer
        ├── index.ts                     # public barrel — re-exports every repository + types
        ├── database.ts                  # Database singleton (new Database({ adapter, modelClasses }))
        ├── adapter.ts                   # SQLiteAdapter config (JSI true, schema, migrations)
        ├── schema/
        │   ├── tables.ts                # appSchema({ version: 1, tables: [...] }) with all 7 tableSchema definitions inline
        │   └── migrations.ts            # schemaMigrations({ migrations: [] }) — empty at v1
        ├── models/
        │   ├── index.ts                 # barrel
        │   ├── Salesperson.ts
        │   ├── Client.ts
        │   ├── Product.ts
        │   ├── ProductVariant.ts
        │   ├── Order.ts
        │   ├── OrderItem.ts
        │   └── PaymentReceipt.ts
        ├── repositories/
        │   ├── index.ts                 # barrel
        │   ├── salespeopleRepository.ts
        │   ├── clientsRepository.ts
        │   ├── productsRepository.ts               # READ-ONLY surface (D2)
        │   ├── productVariantsRepository.ts        # READ-ONLY surface (D2)
        │   ├── ordersRepository.ts
        │   ├── orderItemsRepository.ts
        │   └── paymentReceiptsRepository.ts
        └── types.ts                     # OrderStatus union, SyncStatus union, shared ids
```

**Structure Decision**: `src/data/` sits alongside `src/app/` and `src/features/`. It is importable by any feature through the single barrel `src/data/index.ts` — features write `import { clientsRepository } from '@/data'` (path alias to be added to `tsconfig.json`). Every WatermelonDB Model, the `Database` singleton, and the SQLite adapter are **not** exported from the barrel — they stay private implementation detail inside `src/data/`. This enforces SC-008 (swap the engine by editing only `src/data/`).

Rejected alternatives:
- **Each feature owns its own repository under `src/features/<feature>/data/`** — violates R1 by spreading data access across features and making the "single data layer" rule impossible to enforce.
- **A single generic `repository.forTable("clients")`** — loses TypeScript's ability to catch shape-mismatched reads and writes at compile time; the per-entity typed repositories are strictly better for FR-013.
- **Service layer between repositories and features (e.g., `ClientService`)** — premature abstraction (P3). Business logic goes into feature hooks, which can compose multiple repositories. No service layer until a concrete feature proves the need.

## Phase 1 post-design re-check

After Phase 1 artifacts (data-model, contracts, quickstart) were drafted, nothing contradicts the Constitution Check table above. The ESLint rule enforcing R1 moved from "nice to have" to a definite task on the backlog (see tasks block). The two read-only repositories (products, product_variants) confirm D2 by construction — they simply do not expose write methods.

**Gate status (post-design)**: PASS.

## Complexity Tracking

One justified deviation is recorded in the Constitution Check table:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Promotes app from Expo Go to EAS dev client (adds native-module dependency) | WatermelonDB's SQLite adapter is a native module (required by constitution §3 mandatory stack). Expo Go cannot load it. | There is no simpler local-DB option that satisfies both (a) constitution §3 (WatermelonDB mandated) and (b) reactive queries + sync-adapter support we will need in the sync block. AsyncStorage / MMKV are not relational. expo-sqlite is relational but non-reactive and has no sync adapter. |
