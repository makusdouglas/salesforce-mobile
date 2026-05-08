# Rollback scripts

Manual rollback companions for `supabase/migrations/`. **NOT picked up
automatically** by `supabase db push` — placed outside the migrations
folder on purpose so the CLI's pattern matcher (`NNNN_*.sql`) doesn't
include them in the apply queue.

Run only via:

- Supabase Dashboard → SQL Editor (paste the file contents)
- `supabase db execute --file supabase/rollbacks/<file>` from the project root

…and only when you explicitly need to undo the matching forward
migration. Each script is paired one-to-one with a forward migration.

## File list

| Forward | Rollback |
|---------|----------|
| `migrations/0018_product_lifecycle_and_granular_roles.sql` | `0018_product_lifecycle_and_granular_roles.down.sql` (Feature 016 — Product Lifecycle + Granular Admin Roles) |

## Authoring conventions

- Filename mirrors the forward migration with a `.down.sql` suffix.
- Every statement is `IF EXISTS`-guarded so re-running is safe.
- Schema-wise irreversible changes (e.g., column data backfills,
  legacy alias rewrites) are explicitly documented at the top of the
  rollback file.
