# Contract — Migrations

**Feature**: 002-local-data-layer
**Current schema version**: **1**
**Ships with this block**: an empty migrations registry (no migrations needed on first install).

---

## Where migrations live

`src/data/schema/migrations.ts`:

```ts
// src/data/schema/migrations.ts — illustrative
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // Empty for now. Each subsequent schema change adds an entry here
    // AND bumps the `version` number in schema/tables.ts.
  ],
});
```

---

## Authoring a new migration

When a later block needs a schema change:

1. **Bump `version`** in `src/data/schema/tables.ts` from N to N+1.
2. **Add one migration entry** to `schemaMigrations({ migrations: [...] })` in `src/data/schema/migrations.ts`:

   ```ts
   {
     toVersion: 2,
     steps: [
       addColumns({
         table: 'clients',
         columns: [{ name: 'priority', type: 'string', isOptional: true }],
       }),
       // other steps...
     ],
   }
   ```

3. **Update the Model** that owns that table so its `@field`s reflect the new column.
4. **Update the repository's TypeScript input/patch types** if the column is writable through the public surface.
5. **Update [data-model.md](../data-model.md)** to document the new column, and **[schema.md](./schema.md)** to list it in the table contract.

---

## Available migration steps

Watermelon supports four step kinds — these are the only operations a migration can perform:

| Step              | Purpose |
|-------------------|---------|
| `addColumns`      | Add one or more columns to an existing table. Added columns are `NULL` for pre-existing rows, so they MUST be `isOptional: true` OR come with a backfill handled by application code on first boot. |
| `createTable`     | Create a new table entirely. |
| `renameColumn`    | *Not* supported at the Watermelon level — to rename, add the new column, copy on first read, deprecate the old. Documented here so contributors don't look for it. |
| `addIndex` / `removeIndex` | Not a built-in step in current Watermelon; index changes require a more invasive migration plan — defer until actually needed. |

In practice the MVP will only need `addColumns` and `createTable`.

---

## Data preservation contract

Every migration MUST:

- **Preserve existing rows.** No migration may drop a row. If a column is removed, the migration adds the replacement column first and the old column stays until a future release when all devices have synced.
- **Be idempotent on retry.** If the app crashes mid-migration, re-launch retries from the same starting version — Watermelon handles this as long as the migration body does not issue side effects beyond `steps`.
- **Not block the first UI frame for more than 1 second** on a mid-range Android device (FR-010 / SC-005). `addColumns` and `createTable` are cheap; complex data transformations should be deferred to a background task that runs after the first frame.

---

## Forbidden migration patterns

- **Wiping the database.** Even as a "quick fix", never. Violates P5.
- **Dropping a table.** Not supported by Watermelon — and philosophically a P5 violation too.
- **Adding a `discount_*` column to `products` or `product_variants`.** Hard-blocked by constitution R5.
- **Adding a binary / blob column for image bytes.** Hard-blocked by constitution R3.
- **Renaming any of `server_id`, `updated_at`, `_status`, `_changed`.** These names are the sync adapter's contract (see [research.md R3](../research.md#r3--sync-adapter-column-conventions-server_id-updated_at-_status-_changed)).

---

## Versioning & commit hygiene

- Schema version bumps land **atomically** with their migration entry and with the Model/repository updates that depend on them — never in separate commits.
- Migration PR description MUST cite the feature spec that requires the change.
