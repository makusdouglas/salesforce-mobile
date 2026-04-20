# Data Model — Local Data Layer (Schema Version 1)

**Feature**: 002-local-data-layer
**Schema version**: **1**
**Date**: 2026-04-19
**Status**: Ships with this feature — no migration required (fresh install starts at v1).

---

## Sync-readiness columns (present on every table)

Per [spec.md FR-003](./spec.md#functional-requirements) and [research.md R3](./research.md#r3--sync-adapter-column-conventions-server_id-updated_at-_status-_changed), every one of the seven MVP tables carries these four columns. They are intentionally *not* repeated in each table section below.

| Column       | Type            | Nullable | Default         | Indexed | Manager   | Notes |
|--------------|-----------------|----------|-----------------|---------|-----------|-------|
| `server_id`  | string          | yes      | `null`          | yes     | **us**    | Remote (Supabase) row id. `null` until first successful sync-push. Declared in `tableSchema.columns`. |
| `updated_at` | number (ms)     | no       | `Date.now()`    | no      | **us**    | Refreshed on every write via the `_touch` helpers. Tiebreaker for last-write-wins. Declared in `tableSchema.columns`. |
| `_status`    | string          | no       | `'created'`     | no      | **WatermelonDB** | Enum: `'created' \| 'updated' \| 'deleted' \| 'synced'`. **Reserved system column — added to every table automatically. Do NOT declare in `tableSchema.columns`** (runtime error: "reserved by WatermelonDB"). |
| `_changed`   | string          | no       | `''`            | no      | **WatermelonDB** | Comma-separated list of column names with outbound-pending changes. Same reserved-column story as `_status`. |

**Practical consequence**: only two columns appear in `src/data/schema/tables.ts` per entity (`server_id`, `updated_at`). The other two are invisible in our schema code but present in every row, managed end-to-end by Watermelon's sync machinery.

---

## Entities

### 1. `salesperson` — one row per user of the app

| Column   | Type   | Nullable | Default | Indexed | Notes |
|----------|--------|----------|---------|---------|-------|
| `name`   | string | no       | —       | no      | Display name. |
| `email`  | string | no       | —       | no      | The email used for Supabase Auth (populated by the future auth block). |

**Relationships**:
- `hasMany('clients')` — via `clients.salesperson_id`
- `hasMany('orders')`  — via `orders.salesperson_id`

**Uniqueness**: `email` is expected to be unique per-app — enforced at the admin / Supabase level, not by the local schema. In the MVP the app is single-user per device, so typically one row exists.

**Lifecycle notes**: created by the future auth block on first successful login, never deleted from the app.

---

### 2. `client` — retailers the salesperson visits

| Column            | Type   | Nullable | Default | Indexed | Notes |
|-------------------|--------|----------|---------|---------|-------|
| `salesperson_id`  | string | no       | —       | yes     | FK → `salespeople.id` (Watermelon's local id). |
| `name`            | string | no       | —       | no      | Trade name or business name. |
| `tax_id`          | string | yes      | `null`  | no      | CNPJ for Brazil; nullable because MVP allows quick-add clients without it. |
| `phone`           | string | yes      | `null`  | no      | Free text; no format validation at this layer. |
| `email`           | string | yes      | `null`  | no      | Used later to pre-fill the order-PDF share sheet. |
| `address_line`    | string | yes      | `null`  | no      | Single-line address. MVP does not split into street/city/state. |
| `notes`           | string | yes      | `null`  | no      | Free text. |

**Relationships**:
- `belongsTo('salesperson')` via `salesperson_id`
- `hasMany('orders')`          via `orders.client_id`
- `hasMany('payment_receipts')` — transitively through orders (Watermelon does not define transitive relations; features query through `orders`).

**Validation (enforced by the `clientsRepository`, not the schema)**:
- `name` must be a non-empty trimmed string.
- `salesperson_id` must reference an existing salesperson row.

**Lifecycle notes**: created from a new-client screen (future block) or pulled down on sync. Soft-deletable.

---

### 3. `product` — catalog item (READ-ONLY on the app — D2)

| Column        | Type    | Nullable | Default | Indexed | Notes |
|---------------|---------|----------|---------|---------|-------|
| `name`        | string  | no       | —       | no      | Product name. |
| `description` | string  | yes      | `null`  | no      | Short description shown in the catalog. |
| `image_url`   | string  | yes      | `null`  | no      | URL in Supabase Storage; bytes cached locally later via expo-file-system (out of scope here). |
| `unit`        | string  | yes      | `null`  | no      | e.g. `'unit'`, `'kg'`, `'box'`. Free-text in MVP. |

**Relationships**: `hasMany('product_variants')` via `product_variants.product_id`.

**Lifecycle notes**: only created and updated by sync pulls (D2). `productsRepository` exposes no write methods; the only writes happen inside `src/data/` during a sync pull.

---

### 4. `product_variant` — a specific SKU of a product

| Column       | Type    | Nullable | Default | Indexed | Notes |
|--------------|---------|----------|---------|---------|-------|
| `product_id` | string  | no       | —       | yes     | FK → `products.id`. |
| `label`      | string  | no       | —       | no      | e.g. `'Caixa 12un'`, `'Pacote 500g'`. |
| `price`      | number  | no       | `0`     | no      | Unit price in the salesperson's currency, stored as a floating-point number of minor currency units is **not** how we store it — we store a plain number of **major** units (e.g., 12.50 for R$ 12,50). Future precision issue will be addressed if it appears. |
| `barcode`    | string  | yes      | `null`  | no      | Optional, for future scan features. |

**Relationships**:
- `belongsTo('product')` via `product_id`
- `hasMany('order_items')` via `order_items.product_variant_id`

**Lifecycle notes**: READ-ONLY on the app (D2), same as `product`.

**Note on discounts**: `product_variant` intentionally has **no** `discount_*` columns. Per constitution R5, catalog rows are fixed-price and discounts are an order-time concept.

---

### 5. `order` — an intent-order assembled in the field

| Column            | Type    | Nullable | Default    | Indexed | Notes |
|-------------------|---------|----------|------------|---------|-------|
| `client_id`       | string  | no       | —          | yes     | FK → `clients.id`. |
| `salesperson_id`  | string  | no       | —          | yes     | FK → `salespeople.id`. Denormalized for quick per-salesperson filtering. |
| `status`          | string  | no       | `'draft'`  | yes     | Enum `'draft' \| 'sent' \| 'canceled'` (D4). |
| `discount_amount` | number  | no       | `0`        | no      | Order-level absolute discount, in major currency units (R5). |
| `notes`           | string  | yes      | `null`     | no      | Free text — space for salesperson observations. |
| `created_at_ms`   | number  | no       | `Date.now()` | no    | Explicit createdAt separate from Watermelon's hidden one, for the UI. |
| `sent_at_ms`      | number  | yes      | `null`     | no      | Timestamp when `status` flipped to `'sent'`. |
| `pdf_uri`         | string  | yes      | `null`     | no      | Local filesystem URI of the generated PDF (populated by the future PDF block). |

**Relationships**:
- `belongsTo('client')` via `client_id`
- `belongsTo('salesperson')` via `salesperson_id`
- `hasMany('order_items')` via `order_items.order_id`
- `hasMany('payment_receipts')` via `payment_receipts.order_id`

**State transitions**:

```text
draft ──► sent        (via ordersRepository.markSent(id))
draft ──► canceled    (via ordersRepository.cancel(id))
sent  ──► canceled    (allowed — salesperson cancels an already-sent order)
canceled ──► (terminal)
sent     ──► sent     (idempotent re-send; does not change updated_at? — yes it does, because the sent_at_ms gets refreshed on re-send)
```

No other transitions are permitted. The repository enforces them; the schema does not.

**Validation (repository-level)**:
- `discount_amount >= 0`
- `client_id` references an existing client
- `salesperson_id` references an existing salesperson

---

### 6. `order_item` — a single line on an order

| Column               | Type   | Nullable | Default | Indexed | Notes |
|----------------------|--------|----------|---------|---------|-------|
| `order_id`           | string | no       | —       | yes     | FK → `orders.id`. |
| `product_variant_id` | string | no       | —       | yes     | FK → `product_variants.id`. |
| `quantity`           | number | no       | `1`     | no      | Integer count; schema allows floats in case a variant is sold by weight later, but the repository rejects `<= 0`. |
| `unit_price`         | number | no       | `0`     | no      | Captured **at the time the item was added to the order** — not a live link to the variant's current price. This prevents a catalog price update from silently rewriting an already-assembled order. |
| `discount_amount`    | number | no       | `0`     | no      | Line-level absolute discount, in major currency units (R5). |

**Relationships**:
- `belongsTo('order')` via `order_id`
- `belongsTo('product_variant')` via `product_variant_id`

**Validation (repository-level)**:
- `quantity > 0`
- `unit_price >= 0`
- `discount_amount >= 0`
- `discount_amount <= unit_price * quantity` (a line discount cannot exceed the line subtotal — rejected at write time)

**Lifecycle notes**: tied to its order. Removed on order deletion (cascade handled by the repository, not the schema — Watermelon does not support DB-level ON DELETE CASCADE; the `ordersRepository.softDelete(id)` method also soft-deletes the order's items).

---

### 7. `payment_receipt` — a recorded receipt of payment

| Column        | Type   | Nullable | Default | Indexed | Notes |
|---------------|--------|----------|---------|---------|-------|
| `order_id`    | string | no       | —       | yes     | FK → `orders.id`. |
| `amount`      | number | no       | `0`     | no      | Amount received, major currency units. |
| `method`      | string | no       | —       | no      | Enum `'cash' \| 'pix' \| 'transfer' \| 'card' \| 'other'` (MVP shortlist — extend via migration). |
| `received_at_ms` | number | no    | `Date.now()` | no  | Timestamp the salesperson logged the receipt. |
| `image_url`   | string | yes      | `null`  | no      | Remote URL of the photographed receipt (Supabase Storage). URL only — never bytes. |
| `notes`       | string | yes      | `null`  | no      | Free text. |

**Relationships**: `belongsTo('order')` via `order_id`.

**Validation (repository-level)**:
- `amount > 0`
- `method` is one of the enum values

---

## Relationship map (ASCII)

```text
salesperson 1 ────── * clients 1 ────── * orders 1 ────── * order_items
         └─── * orders 1 ───────────────────── ^             │
                                                 │             └──── 1 product_variant * ──── 1 product
                                                 └──── * payment_receipts
```

---

## Enums captured as TypeScript literal unions

```ts
// src/data/types.ts (illustrative, not the actual ship code — see tasks)
export type SyncStatus = 'created' | 'updated' | 'deleted' | 'synced';
export type OrderStatus = 'draft' | 'sent' | 'canceled';
export type PaymentMethod = 'cash' | 'pix' | 'transfer' | 'card' | 'other';
```

The Model's `@field` accessor returns the narrowed type for `status` / `_status` / `method`. A wrong-shaped literal at the write site is a compile error.

---

## Indexes

Declared on every foreign key and on every `server_id` — see the *Indexed* column in each section above, and [research.md R9](./research.md#r9--indexes-and-query-performance).

---

## Summary

- 7 tables, exactly matching constitution R2.
- 4 sync-readiness columns on every table, exactly matching FR-003 and Watermelon's sync-adapter convention.
- Discount columns only on `orders` and `order_items` (R5).
- Images are URLs only (R3).
- All identifiers English (§9).
- Schema version 1 ships here; no migration needed until a later block.
