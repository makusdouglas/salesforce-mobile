# Contract — Repository API surface

**Feature**: 002-local-data-layer
**Status**: Authoritative — every feature under `src/features/*` consumes this surface.
**Import path**: `@/data`

The repository layer is the *only* module in the application that may read from or write to the local database. Features import typed repositories from `@/data` and call their methods.

---

## Import contract

```ts
import {
  salespeopleRepository,
  clientsRepository,
  productsRepository,
  productVariantsRepository,
  ordersRepository,
  orderItemsRepository,
  paymentReceiptsRepository,

  type Salesperson,
  type Client,
  type Product,
  type ProductVariant,
  type Order,
  type OrderItem,
  type PaymentReceipt,

  type OrderStatus,
  type PaymentMethod,
  type SyncStatus,
} from '@/data';
```

Everything else exported from `src/data/` is internal — the WatermelonDB `Database` singleton, Model decorators, the SQLite adapter, and the schema objects are **not** re-exported. Features must not reach into `src/data/database.ts`, `src/data/models/*`, or `src/data/schema/*`.

---

## Method naming conventions

Every repository follows the same vocabulary, so a developer familiar with one is familiar with all:

| Method                       | Returns                    | Notes |
|------------------------------|----------------------------|-------|
| `findById(id)`               | `Promise<T \| null>`       | `null` when not found; never throws for "not found". |
| `query()`                    | `Query<T>` (Watermelon)    | Chainable query builder for list screens. |
| `observe(id)`                | `Observable<T \| null>`    | Reactive single-record observation. |
| `observeAll()`               | `Observable<T[]>`          | Reactive collection observation — emits on any add/update/soft-delete. |
| `create(input)`              | `Promise<T>`               | Writable entities only (see read-only exception below). Sets `_status='created'`, `_changed=''`, `updated_at=Date.now()`, `server_id=null`. |
| `update(id, patch)`          | `Promise<T>`               | Writable entities only. Merges `patch` into the row, appends changed column names to `_changed`, bumps `updated_at`, transitions `_status` from `'synced'` to `'updated'` (no change if already `'created'` or `'updated'`). |
| `softDelete(id)`             | `Promise<void>`            | Writable entities only. Sets `_status='deleted'`, bumps `updated_at`. Does not remove the row until the future sync block hard-deletes it post-confirmation. |

Read-only repositories (`productsRepository`, `productVariantsRepository`) expose only the read half: `findById`, `query`, `observe`, `observeAll`. Attempting to call `.create` / `.update` / `.softDelete` on them is a **compile error** — the TypeScript surface of those two repositories simply does not declare those methods. This is how constitution D2 ("catalog is read-only in the app") is enforced.

---

## Per-entity repository surface

### `salespeopleRepository`

```ts
findById(id: string): Promise<Salesperson | null>
query(): Query<Salesperson>
observe(id: string): Observable<Salesperson | null>
observeAll(): Observable<Salesperson[]>
create(input: { name: string; email: string }): Promise<Salesperson>
update(id: string, patch: Partial<{ name: string; email: string }>): Promise<Salesperson>
softDelete(id: string): Promise<void>
```

### `clientsRepository`

```ts
findById(id: string): Promise<Client | null>
query(): Query<Client>
observeByOwner(salespersonId: string): Observable<Client[]>    // primary list feed
observe(id: string): Observable<Client | null>
observeAll(): Observable<Client[]>

create(input: {
  salespersonId: string;
  name: string;
  taxId?: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  notes?: string;
}): Promise<Client>

update(id: string, patch: Partial<ClientInput>): Promise<Client>
softDelete(id: string): Promise<void>
```

### `productsRepository` — READ-ONLY

```ts
findById(id: string): Promise<Product | null>
query(): Query<Product>
observe(id: string): Observable<Product | null>
observeAll(): Observable<Product[]>
// no create / update / softDelete
```

### `productVariantsRepository` — READ-ONLY

```ts
findById(id: string): Promise<ProductVariant | null>
query(): Query<ProductVariant>
observeByProduct(productId: string): Observable<ProductVariant[]>
observe(id: string): Observable<ProductVariant | null>
observeAll(): Observable<ProductVariant[]>
// no create / update / softDelete
```

### `ordersRepository`

```ts
findById(id: string): Promise<Order | null>
observe(id: string): Observable<Order | null>
observeByClient(clientId: string): Observable<Order[]>
observeDraftsForSalesperson(salespersonId: string): Observable<Order[]>

create(input: {
  clientId: string;
  salespersonId: string;
  discountAmount?: number;       // default 0
  notes?: string;
}): Promise<Order>

update(id: string, patch: Partial<{
  discountAmount: number;
  notes: string;
  pdfUri: string;
}>): Promise<Order>

markSent(id: string): Promise<Order>        // status draft|sent → sent; sets sent_at_ms
cancel(id: string): Promise<Order>          // status draft|sent → canceled
softDelete(id: string): Promise<void>       // also soft-deletes this order's order_items
```

**Status transitions**: the repository enforces the transitions defined in [data-model.md order state transitions](../data-model.md#5-order--an-intent-order-assembled-in-the-field). `markSent` and `cancel` are the only ways to change the status — no `update({ status: ... })` method exists.

### `orderItemsRepository`

```ts
findById(id: string): Promise<OrderItem | null>
observe(id: string): Observable<OrderItem | null>
observeByOrder(orderId: string): Observable<OrderItem[]>

create(input: {
  orderId: string;
  productVariantId: string;
  quantity: number;              // > 0
  unitPrice: number;             // >= 0 — captured at add time
  discountAmount?: number;       // default 0
}): Promise<OrderItem>

update(id: string, patch: Partial<{
  quantity: number;
  discountAmount: number;
}>): Promise<OrderItem>

softDelete(id: string): Promise<void>
```

`unit_price` is deliberately **not** in the update patch — it is frozen at creation time (see data-model note: "captured at the time the item was added").

### `paymentReceiptsRepository`

```ts
findById(id: string): Promise<PaymentReceipt | null>
observe(id: string): Observable<PaymentReceipt | null>
observeByOrder(orderId: string): Observable<PaymentReceipt[]>

create(input: {
  orderId: string;
  amount: number;                 // > 0
  method: PaymentMethod;
  receivedAtMs?: number;          // default Date.now()
  imageUrl?: string;
  notes?: string;
}): Promise<PaymentReceipt>

update(id: string, patch: Partial<{
  amount: number;
  method: PaymentMethod;
  imageUrl: string;
  notes: string;
}>): Promise<PaymentReceipt>

softDelete(id: string): Promise<void>
```

---

## Error handling contract

- Every repository method **rejects its promise** with a typed error (`DataLayerError`) when a validation rule from [data-model.md](../data-model.md) fails. The error carries a `code` field (`'VALIDATION'`, `'NOT_FOUND'`, `'FOREIGN_KEY'`, `'STATE_TRANSITION'`).
- Repositories never throw synchronously. Promise rejection is the only error signal.
- Repositories never return `undefined`. Queries return `[]`; single-record lookups return `null`.

---

## Reactive contract

- `observe*` methods return RxJS `Observable`s (Watermelon's built-in reactive layer). Subscribers receive an initial value on subscribe and a new value on every relevant change (create, update, soft-delete).
- Features should subscribe through a React hook (`useWatermelonObservable` or the project's own `useObservedValue`) — that hook is introduced by the first feature that needs it, not by this block.
- `observe*` methods are **not** side-effect-free: Watermelon may open a DB subscription on subscribe. Features MUST unsubscribe when the component unmounts (standard RxJS discipline).

---

## Concurrency

- Writes from the same process are serialized by WatermelonDB's internal actions queue — concurrent calls to `ordersRepository.markSent(id)` from two places result in one winning transition and the other becoming a no-op (status already `'sent'`).
- Cross-process concurrency is not a concern — the app is single-process.

---

## What repositories do NOT expose

- The `Database` singleton. Features must not call `database.write(…)` directly.
- Model instances returned by Watermelon — *wait*, repositories **do** return Model instances (`Client`, `Order`, etc.). The Model is the typed row; it has `.observe()`, `.update()`, `.destroyPermanently()` methods from Watermelon that features **should not** call directly (they bypass the repository's validation and sync-column bookkeeping). ESLint cannot enforce this; code review is the backstop. [Future hardening: wrap returned rows in a plain data object, at the cost of reactivity — not in this MVP.]
- Raw SQL. Features never write SQL.
- Migration helpers. Migrations live inside `src/data/schema/migrations.ts` and are called only by the DatabaseAdapter at boot time.
