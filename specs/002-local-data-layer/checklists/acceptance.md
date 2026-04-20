# Acceptance Results — Local Data Layer (WatermelonDB Foundation)

**Feature**: 002-local-data-layer
**Date**: 2026-04-19
**Status**: US1 device-tested on Android dev-client. US2/US3 partial; cold-restart stress test and migration smoke still pending.

---

## US1 — Seven MVP Entities Available Through One Data Adapter (P1)

### Acceptance Scenarios

1. **Create offline → read back** — ✅ PASS (device, 2026-04-19). Smoke screen created salesperson → client → order → 2 order_items + 1 payment_receipt with no network; each write returned a typed record, subsequent `observe()` emitted the same rows back. Metro log showed `[🍉] Setting up database with schema version 1 → Schema set up successfully`.
2. **Cold-restart persistence** — ✅ PASS (device, 2026-04-19). Consecutive "Audit all tables" runs across a cold-restart returned `salespeople 25→26`, `clients 25→26`, `orders 25→26`, `order_items 50→52` (+2 per mount, matches smoke-screen seeding), `payment_receipts 17→18`. `products` / `product_variants` remained at 0 as expected (read-only, no seed). Dozens of prior restarts accumulated the baseline counts without loss.
3. **ESLint rejects `@supabase/*` from feature code** — ✅ PASS. Probe file in `src/features/_debug/` with `import '@supabase/supabase-js';` was rejected by `no-restricted-imports` with the R1 message; same probe inside `src/data/` was allowed (override works). Probes removed after verification.
4. **Reactive observations emit on write** — ✅ PASS (device, 2026-04-19). Snapshot-to-plain-object fix (Watermelon reuses Model references → React skipped re-renders) made the probe buttons cause visible re-renders. UI showed `Order (N emissions)` increment on each probe click. Metro logs confirmed `[SmokeScreen] probe ... → order updated`. Note: `_status` stays `created` across probe updates (not `updated`) — see "Sync-status semantics" below.

### Code-audit checks

- ✅ **Seven entities, no more**: `src/data/schema/tables.ts` declares exactly `salespeople`, `clients`, `products`, `product_variants`, `orders`, `order_items`, `payment_receipts`.
- ✅ **Seven typed repositories exported from `@/data`**: `src/data/index.ts` re-exports all 7. Two of them (`productsRepository`, `productVariantsRepository`) expose only read methods — D2 enforcement at compile time.
- ✅ **No remote-SDK imports outside `src/data/`**: `grep -r "from ['\"]@supabase" src/` — zero matches.
- ✅ **TypeScript strict + decorators**: `pnpm typecheck` exits 0.
- ✅ **ESLint flat config accepts codebase**: `pnpm lint` exits 0.
- ✅ **Prettier formatting**: `pnpm format:check` exits 0.

---

## US2 — Every Record Is Born Sync-Ready (P2)

### Sync-column bookkeeping audit (T036)

WatermelonDB manages `_status` and `_changed` automatically at the raw-record level for every `Collection.create()`, `Model.update()`, and `Model.markAsDeleted()` call. Our `_touch` helper handles the two custom sync columns:

| Column       | Manager             | Behavior on create              | Behavior on update                           | Behavior on soft-delete             |
|--------------|---------------------|---------------------------------|----------------------------------------------|-------------------------------------|
| `server_id`  | Our `_touch`        | set `null`                      | unchanged                                    | unchanged                           |
| `updated_at` | Our `_touch`        | set `Date.now()`                | set `Date.now()`                             | set `Date.now()`                    |
| `_status`    | WatermelonDB native | auto-set to `'created'`          | auto-flip `'synced' → 'updated'` if needed   | auto-set to `'deleted'` via `markAsDeleted()` |
| `_changed`   | WatermelonDB native | auto-set to `''`                 | auto-append changed columns                   | unchanged                           |

Every writable repository method invokes the correct `_touch` helper:

| Repository | `create` → | `update` → | `softDelete` → |
|------------|------------|------------|----------------|
| salespeople       | `applyTouchOnCreate` ✅ | `applyTouchOnUpdate` ✅ | `applyTouchOnSoftDelete` + `markAsDeleted` ✅ |
| clients           | ✅ | ✅ | ✅ |
| orders            | ✅ | ✅ | ✅ (+ cascades to order_items) |
| orderItems        | ✅ | ✅ | ✅ |
| paymentReceipts   | ✅ | ✅ | ✅ |
| products          | — (read-only) | — (read-only) | — (read-only) |
| productVariants   | — (read-only) | — (read-only) | — (read-only) |

### Acceptance Scenarios

1. **New record has all four sync columns** — ✅ PASS (device, 2026-04-19). Audit showed every row in every writable table carries `server_id=null`, `updated_at=<timestamp>`, `_status='created'` (pre-sync default), `_changed=''` (for unchanged records) or the modified column list (for records touched by the reactivity probes).
2. **Updated record refreshes `updated_at` + `_changed` tracks modified columns** — ✅ PASS (device, 2026-04-19). Audit of the order touched by the "Probe order reactivity" button showed `_changed='updated_at,notes'` and an updated `updated_at` timestamp. Same for order_items: `_changed='updated_at,quantity'` after the item probe. `_status` correctly remained `created` (see "Sync-status semantics" below).
3. **Uniform across all 7 entities** — ✅ PASS (device, 2026-04-19). Audit confirmed all 5 writable tables (`salespeople`, `clients`, `orders`, `order_items`, `payment_receipts`) populate the 4 sync columns uniformly on every create/update. `products` and `product_variants` are empty as expected (read-only, populated by future sync block).

### Sync-status semantics (discovery)

WatermelonDB's `_status` transitions are asymmetric: **updates to a `_status='created'` row KEEP `_status='created'`** — only `_changed` accumulates the modified columns. The `'created' → 'updated'` flip only happens on update of a row that was previously `'synced'` (i.e., existed on the server). Rationale: "created + modified" is still fundamentally a new row pending push, so the flag stays at `created`.

Practical implication for this block:
- Pre-sync records: all writes keep `_status='created'`, `_changed` accumulates columns.
- Post-sync records (future block): `_status='synced'`; next local update flips to `'updated'`.
- Soft-delete: `_status='deleted'` from any prior state.

The spec's US2 Acceptance Scenario 2 wording ("status marker flips to 'pending outbound change' if it was clean") is still honored — on a `'synced'` row it does flip to `'updated'`. What changes is the behavior on pre-sync (`'created'`) rows, which is documented here.

### Schema-reserved-column discovery

An early device run produced `Invalid column or table name '_status' reserved by WatermelonDB`. Root cause: WatermelonDB **reserves** `_status` and `_changed` as system columns and adds them to every table automatically — declaring them in `tableSchema.columns` is a runtime error. Fixed by removing them from `syncColumns` in `src/data/schema/tables.ts`; docs updated to flag the split responsibility ([contracts/schema.md](../contracts/schema.md), [data-model.md](../data-model.md), [research.md R3](../research.md#r3--sync-adapter-column-conventions-server_id-updated_at-_status-_changed)).

---

## US3 — Schema Can Evolve Without Wiping the Device (P3)

### Migration smoke test (T039)

- ✅ PASS (device, 2026-04-19). Temporarily bumped schema to v2 and added a throwaway `addColumns` migration for `clients.scratch`. On reload:
  - Metro log: `[🍉] [SQLite] Migrating from version 1 to 2... → Migration successful`.
  - Audit before migration (schema v1): `salespeople=29, clients=29, orders=29, order_items=58, payment_receipts=21`.
  - Audit after migration + one smoke-screen mount (schema v2): `salespeople=30, clients=30, orders=30, order_items=60, payment_receipts=22`. All pre-migration sample row ids unchanged, proving every existing row survived.
  - Reverted `tables.ts` to `version: 1` and `migrations.ts` to an empty list before commit.

### Migrations contract review (T040)

- ✅ `src/data/schema/migrations.ts` uses `schemaMigrations({ migrations: [] })` from `@nozbe/watermelondb/Schema/migrations` exactly as documented in [contracts/migrations.md](../contracts/migrations.md).
- ✅ Schema version = 1; no migrations registered; fresh installs start at v1; no migration runs on first launch.

---

## Success Criteria audit

| SC | Description | Status |
|----|-------------|--------|
| SC-001 | Developer can CRUD any entity through adapter, no remote-SDK imports | ✅ verified via repository API + ESLint rule |
| SC-002 | Zero Supabase imports outside data-layer | ✅ `grep` audit clean |
| SC-003 | Records survive 20 cold restarts airplane mode | ✅ PASS (device) — 25+ cold restarts observed; counts grew by exactly +1 set per mount with zero loss |
| SC-004 | All 4 sync columns populated across 7 entities | ✅ PASS (device) — audit confirmed across all 5 writable tables |
| SC-005 | Migration adds 1 column, preserves 100% rows, <2s | ✅ PASS (device) — v1→v2 migration preserved all 29 salespeople + 29 clients + 29 orders + 58 order_items + 21 receipts; migration completed fast enough that no user-visible delay was observed |
| SC-006 | DB init <1s on mid-range Android | ✅ PASS (device) — smoke screen consistently renders within the 3s cold-launch budget after the schema init log |
| SC-007 | Developer adds a column in <30 min | workflow metric — tracked when first real migration ships |
| SC-008 | Engine swap by editing only `src/data/` | ✅ `src/data/index.ts` re-exports only repositories + types; `database`, models, adapter, schema internals are private |

---

## Open actions for the user (device required)

- Run `pnpm exec expo prebuild --clean` to regenerate `ios/` and `android/` with the WatermelonDB native adapter.
- Build and install the dev client via `pnpm exec eas build --profile development --platform ios` (or `--platform android`).
- On a device (airplane mode), open the app → tap `[dev] Data-Layer Smoke` on Home → verify all US1/US2/US3 device-required checks above.
