# Contract — Schema Version 1

**Feature**: 002-local-data-layer
**Schema version**: **1** (ships with this feature; fresh installs start here)
**Authoritative source**: `src/data/schema/tables.ts` at runtime; this document is the normative reference at design time.

Every table carries the four sync-readiness columns below (see [data-model.md](../data-model.md)):

- `server_id: string? (indexed)` — **user-declared** in `tableSchema.columns`
- `updated_at: number`            — **user-declared** in `tableSchema.columns`
- `_status: string`      — **WatermelonDB-reserved**; added to every table automatically. **Do NOT declare it in `tableSchema.columns` — doing so raises "Invalid column or table name '_status' reserved by WatermelonDB" at runtime.**
- `_changed: string`     — **WatermelonDB-reserved**; same story as `_status`.

Only the two user-declared columns (`server_id`, `updated_at`) appear in `src/data/schema/tables.ts`. The other two are present on every row at the raw-record level and are managed end-to-end by WatermelonDB's sync machinery (auto-set on create/update/markAsDeleted). FR-003's four sync-readiness fields are still satisfied — the responsibility is just split between us and the engine.

The tables below list only the **entity-specific** columns on top of those two user-declared sync columns.

---

## `salespeople`

| Column | Type | Nullable | Indexed |
|--------|------|----------|---------|
| `name` | string | no | no |
| `email` | string | no | no |

## `clients`

| Column | Type | Nullable | Indexed |
|--------|------|----------|---------|
| `salesperson_id` | string | no | **yes** |
| `name` | string | no | no |
| `tax_id` | string | yes | no |
| `phone` | string | yes | no |
| `email` | string | yes | no |
| `address_line` | string | yes | no |
| `notes` | string | yes | no |

## `products`

| Column | Type | Nullable | Indexed |
|--------|------|----------|---------|
| `name` | string | no | no |
| `description` | string | yes | no |
| `image_url` | string | yes | no |
| `unit` | string | yes | no |

## `product_variants`

| Column | Type | Nullable | Indexed |
|--------|------|----------|---------|
| `product_id` | string | no | **yes** |
| `label` | string | no | no |
| `price` | number | no | no |
| `barcode` | string | yes | no |

## `orders`

| Column | Type | Nullable | Indexed |
|--------|------|----------|---------|
| `client_id` | string | no | **yes** |
| `salesperson_id` | string | no | **yes** |
| `status` | string | no | **yes** |
| `discount_amount` | number | no | no |
| `notes` | string | yes | no |
| `created_at_ms` | number | no | no |
| `sent_at_ms` | number | yes | no |
| `pdf_uri` | string | yes | no |

## `order_items`

| Column | Type | Nullable | Indexed |
|--------|------|----------|---------|
| `order_id` | string | no | **yes** |
| `product_variant_id` | string | no | **yes** |
| `quantity` | number | no | no |
| `unit_price` | number | no | no |
| `discount_amount` | number | no | no |

## `payment_receipts`

| Column | Type | Nullable | Indexed |
|--------|------|----------|---------|
| `order_id` | string | no | **yes** |
| `amount` | number | no | no |
| `method` | string | no | no |
| `received_at_ms` | number | no | no |
| `image_url` | string | yes | no |
| `notes` | string | yes | no |

---

## Cross-cutting rules

1. **No column named `discount_*`** on `products` or `product_variants` (R5 enforcement at design time). Any future migration adding such a column MUST be rejected in review.
2. **No column holding binary image data** on any table (R3). Only `*_url: string` fields for images.
3. **All identifiers are English** (§9). No Portuguese column names.
4. **Foreign-key columns** end in `_id` and are always `string`, non-nullable, and indexed. They reference WatermelonDB local ids (not `server_id`).
5. **Every writable table** (i.e., everything except `products` / `product_variants` at the catalog level) gets writes exclusively through its repository.

---

## WatermelonDB `appSchema` shape (reference)

```ts
// src/data/schema/tables.ts — illustrative
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'salespeople',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'updated_at', type: 'number' },
        { name: '_status', type: 'string' },
        { name: '_changed', type: 'string' },
      ],
    }),
    // ... one tableSchema per entity, per the table definitions above
  ],
});
```

Implementation task lands the complete definition.
