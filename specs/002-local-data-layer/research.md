# Phase 0 — Research: Local Data Layer (WatermelonDB Foundation)

**Feature**: 002-local-data-layer
**Date**: 2026-04-19
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [.specify/memory/constitution.md](/.specify/memory/constitution.md)

This file resolves every non-trivial choice the plan depends on. Each item ends with a single decision; no `NEEDS CLARIFICATION` marker leaves this phase unresolved.

---

## R1 — WatermelonDB + Expo SDK 55 compatibility and dev-client requirement

**Decision**: Install `@nozbe/watermelondb` latest stable and promote the app from Expo Go to an **EAS development build** (a.k.a. dev client) via `expo-dev-client`. Keep `eas.json` profiles from block 001 — `development` profile becomes a dev client, `preview` and `production` are unaffected.

**Rationale**:

- WatermelonDB ships native iOS (Objective-C / Swift) and Android (Kotlin) adapters; they are not part of the Expo Go runtime, so a dev client is required.
- Constitution §3 allows this explicitly: *"dev build allowed when a library requires it"*. This library requires it, so the deviation is within bounds.
- Expo's own docs recommend the dev-client path for any managed-workflow project that needs a non-Expo-Go native module — this is the standard, supported route.
- No further native configuration is needed for iOS/Android beyond what `expo prebuild` generates from the WatermelonDB config. Babel decorator support is added as a dev dependency (see R4).

**Alternatives considered**:

- **expo-sqlite** — relational, bundled with Expo Go (no dev client), but *not reactive* (every consumer has to poll or re-query on change) and has *no sync adapter*. Fails FR-012 (reactive reads) and would force us to re-implement sync machinery ourselves. Also violates constitution §3 which names WatermelonDB specifically.
- **AsyncStorage / MMKV** — key-value stores, not relational. Cannot express the foreign-key relationships in R2 without hand-rolling them. Rejected.
- **Realm** — relational + reactive, but forbidden by implication (constitution §3 names WatermelonDB and Supabase; Realm has its own sync product that would conflict with Supabase RLS). Rejected.
- **Bare workflow (eject)** — heavier setup than dev client, no additional capabilities for our use case. Rejected.

---

## R2 — WatermelonDB version pin

**Decision**: Pin to the latest **WatermelonDB 0.28.x** line (or newer if released at install time). Use whatever the published peer-range declares for React Native; RN 0.83.4 / React 19.2.0 are in-range.

**Rationale**: 0.28 is the first line that cleanly supports the New Architecture and recent React Native releases, matching our SDK 55 baseline. JSI mode is the default on both platforms in this line.

**Alternatives considered**: 0.27 and earlier — rejected, lag behind the RN-New-Arch compatibility window.

---

## R3 — Sync-adapter column conventions (`server_id`, `updated_at`, `_status`, `_changed`)

**Decision**: Every table carries these four columns with these exact names and types:

| Column       | Type            | Nullable | Default                                  | Declared by us? | Notes |
|--------------|-----------------|----------|------------------------------------------|-----------------|-------|
| `server_id`  | `string`        | yes      | `null`                                   | **yes** — in `tableSchema.columns` | Populated on first successful sync. |
| `updated_at` | `number`        | no       | `Date.now()` on insert; updated on write | **yes** — in `tableSchema.columns` | Milliseconds since epoch. Bumps on any field change. |
| `_status`    | `string` (enum) | no       | `'created'`                              | **NO** — reserved by WatermelonDB | Values: `'created' \| 'updated' \| 'deleted' \| 'synced'`. Declaring this in `tableSchema.columns` triggers a runtime error. |
| `_changed`   | `string`        | no       | `''`                                     | **NO** — reserved by WatermelonDB | Comma-separated list of column names pending outbound sync. Same reserved story as `_status`. |

**Rationale**: The underscored names (`_status`, `_changed`) are **not** our invention — they are WatermelonDB's built-in sync-machinery columns. The engine adds them to every table automatically; our job is to **not redeclare them** in `tableSchema.columns`. This was the source of an early implementation bug ("Invalid column or table name '_status' reserved by WatermelonDB") — only the two custom columns go in our schema file.

The non-underscored pair (`server_id`, `updated_at`) are custom columns we add on top — Watermelon doesn't require them, but the sync block will need them:

- `server_id` lets us reconcile "this local row is the same as that remote row" without relying on Watermelon's internal local ids.
- `updated_at` is the tiebreaker for last-write-wins (constitution P2).

FR-003's four sync-readiness fields are still fully satisfied — the responsibility is split: we own `server_id` + `updated_at`, WatermelonDB owns `_status` + `_changed`.

**Alternatives considered**:

- Stick to Watermelon's built-in `last_modified` / `_status` only — insufficient, no remote-id tracking. Rejected.
- Name the remote id `remote_id` instead of `server_id` — arbitrary preference; the feature description asks for `server_id`, so we use that.

---

## R4 — Decorator support (Babel)

**Decision**: Add `@babel/plugin-proposal-decorators` as a **dev dependency** with `{ legacy: true }` to `babel.config.js`. This enables the `@field`, `@relation`, `@children`, `@date`, `@readonly`, `@immutableRelation` decorators used in Watermelon Model classes.

**Rationale**: WatermelonDB documents the legacy decorator transform as the supported path. The Expo Babel preset does not enable it by default, so we add it explicitly. No TypeScript `experimentalDecorators` flag is needed — Babel handles the transform; TS only needs to accept the syntax, which it does under `"experimentalDecorators": true` in `tsconfig.json`.

**Action**: add `"experimentalDecorators": true` and `"emitDecoratorMetadata": false` (metadata is unused) to `tsconfig.json` extension; update `babel.config.js` with the plugin in legacy mode.

**Alternatives considered**:

- Stage-3 decorators (non-legacy) — currently not fully supported by WatermelonDB's decorator implementation. Rejected.
- Plain (non-decorator) model definitions — WatermelonDB supports this but the docs, examples, and community all use decorators; swimming against the stream costs us ergonomics with zero gain. Rejected.

---

## R5 — Repository shape (per-entity typed vs. generic)

**Decision**: One typed repository per entity, exported from `src/data/index.ts`. Each repository is a plain object with methods specific to that entity's needs; it **closes over the Database singleton** at import time so features never pass a database handle around.

```ts
// Example shape (not code to paste — see contracts/repository.md)
export const clientsRepository = {
  findById(id: string): Promise<Client | null> { ... },
  query(): Query<Client> { ... },
  observeAll(): Observable<Client[]> { ... },
  create(input: ClientInput): Promise<Client> { ... },
  update(id: string, patch: Partial<ClientInput>): Promise<Client> { ... },
  softDelete(id: string): Promise<void> { ... },
};
```

**Rationale**: Typed repositories catch wrong-shaped writes at compile time (FR-013). The closure over the Database singleton means features cannot accidentally instantiate a second database or point at the wrong one. Read-only repositories (`productsRepository`, `productVariantsRepository`) simply omit `create` / `update` / `softDelete`, so attempts to write the catalog from feature code are compile-time errors — this is how D2 is enforced.

**Alternatives considered**:

- **A single `repository.forEntity('clients')` function** — stringly-typed, fails FR-013's compile-time-typing requirement. Rejected.
- **Per-feature data facades (`src/features/orders/data.ts`)** — violates R1; the whole point of the rule is a single layer. Rejected.
- **A class-based `Repository<T>` base class** — premature abstraction (P3). We can refactor to one if a concrete duplication emerges; until then, plain objects win.

---

## R6 — Soft delete, hard delete, and sync-readiness

**Decision**: The public `softDelete(id)` method sets `_status = 'deleted'` and updates `updated_at`; it does **not** remove the row. Hard delete is performed only by a private helper reachable from the sync block, and only on rows where `_status === 'synced'` and `server_id !== null` (i.e., the remote confirmed the deletion).

**Rationale**: Constitution P5 — salesperson data is sacred. An unsynced delete must survive a reinstall-before-sync just as much as an unsynced create must. The only safe moment to evict a row is after the server confirms it; everything else is a soft delete.

**Alternatives considered**:

- Hard-delete immediately and maintain a separate "pending deletions" table — adds complexity (P3), more failure modes, no benefit. Rejected.
- Never hard-delete — unbounded growth over time. Rejected.

---

## R7 — Order status domain

**Decision**: `orders.status` is a plain string column in the schema; the Model's `@field` accessor narrows it to a TypeScript literal union `'draft' | 'sent' | 'canceled'`. No database-level CHECK constraint — WatermelonDB schema doesn't support those; the TS type is the enforcement layer.

**Rationale**: Matches constitution D4 verbatim. Adding more states later is a migration + a union update, no schema drama.

---

## R8 — `updated_at`, `created_at`, and Watermelon's built-ins

**Decision**: WatermelonDB gives every Model two built-in hidden columns, `created_at` and `last_modified`, that it manages automatically. We **still** declare our own `updated_at` because:

- Watermelon's `last_modified` is in its own units and is not guaranteed to be the value we want for last-write-wins reconciliation.
- The feature description asks for `updated_at` by name (FR-003), not `last_modified`.
- The sync adapter's reference design uses `updated_at`.

**Action**: every model sets `updated_at = Date.now()` on every write via a small helper (`touch()`). A unit test on this helper is the one piece of Jest we add (optional, small).

---

## R9 — Indexes and query performance

**Decision**: Add indexes on all foreign-key columns and on `server_id`:

| Table              | Indexed columns |
|--------------------|-----------------|
| `clients`          | `salesperson_id`, `server_id` |
| `product_variants` | `product_id`, `server_id` |
| `orders`           | `client_id`, `salesperson_id`, `status`, `server_id` |
| `order_items`      | `order_id`, `product_variant_id`, `server_id` |
| `payment_receipts` | `order_id`, `server_id` |
| `salespeople`      | `server_id` |
| `products`         | `server_id` |

**Rationale**: These are the columns every query in the future feature blocks will filter by (list all clients for the current salesperson, list orders for a client, resolve a row by its remote id during sync). Adding indexes now is cheaper than adding them in a later migration over a populated device.

**Alternatives considered**: Add indexes lazily as queries appear — wastes migration budget later; rejected for a handful of foreign keys where the indexing decision is obvious up front.

---

## R10 — Images are URLs only

**Decision**: `products.image_url` is a nullable string. `payment_receipts.image_url` is a nullable string. No `image_blob`, `image_bytes`, or `image_data` columns anywhere.

**Rationale**: Constitution R3 + FR-008. Local caching of the image bytes (when the catalog block fetches the image over HTTP) is expo-file-system territory, out of scope for the data layer.

---

## R11 — ESLint enforcement of R1 ("no Supabase imports outside src/data/")

**Decision**: Add an ESLint rule via `no-restricted-imports`:

```js
{
  paths: [{
    name: "@supabase/supabase-js",
    message: "Direct Supabase imports are forbidden outside src/data/. See constitution R1."
  }],
  patterns: ["@supabase/*"]
}
```

…applied **globally across `src/**`** with an override excluding `src/data/**`. The global-with-exception scoping auto-covers any future top-level directory (e.g. `src/lib/`, `src/shared/`) without further config edits, which matters because new directories would otherwise silently bypass the rule.

**Rationale**: SC-002 is the acceptance criterion for R1, and the only way to keep the rule from rotting is to let the linter enforce it on every commit. This rule ships *now* even though Supabase is not installed yet — when a future block adds `@supabase/supabase-js`, the rule already protects the rest of the tree.

**Alternatives considered**:

- A CI-only grep step — brittle, bypasses local feedback. Rejected.
- Wait until Supabase is installed to add the rule — rule rot risk; the cost of adding it now is one ESLint config entry. Rejected.

---

## R12 — Path alias `@/data`

**Decision**: Add a `paths` entry to `tsconfig.json`:

```json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }
```

Wire the matching alias into Babel via `babel-plugin-module-resolver` so runtime imports match.

**Rationale**: Features import `from '@/data'`, cleaner than relative paths. Sets a precedent for `@/features`, `@/app` as needed. Zero runtime cost.

**Alternatives considered**: Keep relative imports — works but noisy (`../../../data`). Rejected.

---

## Summary of decisions → plan updates

- Dev client: required → `expo-dev-client` added to dependencies, `development` EAS profile becomes a dev client (block 001's profile stays valid, just rebuilds with the new native module).
- Babel decorators: required → `@babel/plugin-proposal-decorators` added, `babel.config.js` edited.
- Path alias: required → `tsconfig.json` + `babel-plugin-module-resolver` added.
- ESLint: required → `no-restricted-imports` rule added to `eslint.config.js`.
- All four sync columns on every table: required → encoded in `contracts/schema.md`.

No unresolved `NEEDS CLARIFICATION` remains.
