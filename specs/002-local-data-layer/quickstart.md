# Quickstart — Using the Local Data Layer

**Feature**: 002-local-data-layer
**Audience**: developers writing a feature under `src/features/<feature>/`.

The data layer is a single barrel at `@/data`. Repositories are plain objects — no instantiation, no DI, no context provider. Import what you need, call its methods.

---

## 1. Install (one-time, handled by this feature's tasks)

After this block is implemented, a fresh clone must run:

```bash
pnpm install
pnpm exec expo prebuild   # regenerates ios/ and android/ with WatermelonDB native modules
pnpm exec eas build --profile development --platform ios      # or android
```

`expo start` alone is no longer enough — Expo Go cannot load WatermelonDB. Use the **development build** created by EAS (or `pnpm start --dev-client` against a local dev client).

No manual native Xcode / Gradle edits are needed; the Watermelon config plugin is wired into `app.json`.

---

## 2. Read a record

```tsx
// src/features/clients/screens/ClientDetailScreen.tsx
import { clientsRepository, type Client } from '@/data';
import { useEffect, useState } from 'react';

export function ClientDetailScreen({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    const sub = clientsRepository.observe(clientId).subscribe(setClient);
    return () => sub.unsubscribe();
  }, [clientId]);

  if (!client) return null;
  return <Text>{client.name}</Text>;
}
```

- Always prefer `observe*` over one-shot `findById` when the screen stays open — you get reactive updates for free.
- `null` is a valid emission (record not found / was soft-deleted).

---

## 3. Write a record

```ts
import { clientsRepository } from '@/data';

await clientsRepository.create({
  salespersonId: currentSalesperson.id,
  name: 'Mercearia São Paulo',
  taxId: '12.345.678/0001-90',
  phone: '+55 11 99999-0000',
});
```

- Validation errors reject the promise with a `DataLayerError` — `try/catch` accordingly.
- No need to touch `_status`, `_changed`, `updated_at`, `server_id` — the repository populates them.
- Nothing propagates to the server here; sync is a separate block.

---

## 4. Update a record

```ts
await clientsRepository.update(clientId, { phone: '+55 11 98888-1111' });
```

- Pass only the fields that changed; the repository merges.
- `updated_at` is bumped, `_status` transitions `'synced' → 'updated'` (or stays `'created'` / `'updated'`), `_changed` gains the column names.

---

## 5. Soft-delete a record

```ts
await clientsRepository.softDelete(clientId);
```

- The row stays in the database with `_status='deleted'` so the future sync block can inform the server.
- `observeAll()` and `query()` filter out soft-deleted rows by default. Pass an explicit option if you need to see them (e.g., for an admin-style recovery UI — not in MVP).

---

## 6. Order-specific flows

### Creating a draft order with items

```ts
const order = await ordersRepository.create({
  clientId,
  salespersonId,
});

await orderItemsRepository.create({
  orderId: order.id,
  productVariantId: variant.id,
  quantity: 2,
  unitPrice: variant.price,    // snapshot the price at add time
});
```

### Marking the order sent

```ts
await ordersRepository.markSent(order.id);
```

No generic `update({ status })` method exists — status transitions only through `markSent` and `cancel`.

---

## 7. Catalog is read-only

```ts
await productsRepository.create(/* … */);
// TYPE ERROR: productsRepository does not expose 'create'.
```

If a TypeScript error says `create` doesn't exist on `productsRepository`, that is constitution D2 at work — the catalog is registered by the admin via Supabase dashboard, not from the app.

---

## 8. What NOT to do

- ❌ `import { supabase } from '@supabase/supabase-js'` inside `src/features/*` — ESLint rejects this at lint time (R1 enforcement).
- ❌ `import { database } from '@/data/database'` — the database singleton is internal, not exported from the barrel.
- ❌ Call `.update()` or `.destroyPermanently()` on a Model instance returned by `observe*` — bypasses the repository's validation and bookkeeping. Use `repository.update(id, patch)` / `repository.softDelete(id)`.
- ❌ Write SQL. Anywhere. Ever. (This block does not expose a SQL escape hatch.)

---

## 9. Adding a column (future feature)

Walk-through for the next developer who needs a new field:

1. Read [contracts/migrations.md](./contracts/migrations.md).
2. Bump the version in `src/data/schema/tables.ts`.
3. Append a migration in `src/data/schema/migrations.ts` with `addColumns({ … })`.
4. Add the `@field` to the Model.
5. Extend the repository's `create` / `update` input types.
6. Update [data-model.md](./data-model.md) and [contracts/schema.md](./contracts/schema.md).

A single column addition should take under 30 minutes (SC-007).

---

## 10. Testing the data layer

No test framework is installed yet — per constitution §9, test investment lands on business logic, not on plumbing. Acceptable verification for this block:

- Write a throwaway dev-only screen that exercises US1 (create a client, an order, two order items; kill the app; cold-launch; confirm persistence).
- Use the manual audit described in [spec.md SC-002](./spec.md#measurable-outcomes) and the [checklist](./checklists/requirements.md).
- When the first business feature lands on top of the data layer, that feature's tests naturally cover the repository behaviour end-to-end.
