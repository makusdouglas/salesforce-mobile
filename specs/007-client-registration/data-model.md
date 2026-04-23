# Data Model: 007 Client Management

**Phase**: 1 — Design & Contracts
**Status**: Complete
**Date**: 2026-04-22

This feature introduces **no new entities and no schema changes**. Every table, column, relationship, and constraint listed below already exists in the codebase as of feature 006. The purpose of this document is to enumerate the shapes this feature **reads from** and the **derived DTOs** it produces, so the contracts in `/contracts/` can reference concrete types.

## Existing entities (read-only reference)

### `Client` (WatermelonDB, `src/data/models/Client.ts`)

| Field | Column | Type | Notes |
|-------|--------|------|-------|
| `id` | `id` | `string` | WatermelonDB-assigned primary key |
| `salespersonId` | `salesperson_id` | `string` | FK to `salespeople.id`; indexed |
| `name` | `name` | `string` | Store name; required at create time |
| `taxId` | `tax_id` | `string \| null` | CNPJ, optional; format-validated on save |
| `phone` | `phone` | `string \| null` | Optional contact phone |
| `email` | `email` | `string \| null` | Optional contact email |
| `addressLine` | `address_line` | `string \| null` | Single free-text address block |
| `notes` | `notes` | `string \| null` | Free-text notes |
| `serverId` | `server_id` | `string \| null` | Sync-readiness; indexed |
| `updatedAt` | `updated_at` | `number` | Epoch ms; used for recency ranking |
| `_raw._status` | (WatermelonDB internal) | `'created' \| 'updated' \| 'synced' \| 'deleted'` | Source of the pending-sync badge |

Associations (read-only in this feature):

- `salesperson: Relation<Salesperson>` via `salesperson_id`
- `orders: Query<Order>` via `client_id`

This feature **creates** rows via `clientsRepository.create({ salespersonId, name, taxId?, phone?, email?, addressLine?, notes? })` — no update or delete path is added.

### `Order` (read-only reference)

Used only to populate the client profile's order history. Read via `ordersRepository.observeByClient(clientId)`.

| Field | Type | Used by this feature? |
|-------|------|----------------------|
| `id` | `string` | yes (DTO key) |
| `clientId` | `string` | yes (query filter) |
| `salespersonId` | `string` | no (not surfaced in history) |
| `status` | `'draft' \| 'sent' \| 'canceled'` | yes (FR-015 display) |
| `discountAmount` | `number` | yes (total computation) |
| `notes` | `string \| null` | no |
| `createdAtMs` | `number` | yes (FR-015 display + sort key) |
| `sentAtMs` | `number \| null` | no |
| `pdfUri` | `string \| null` | no |

### `OrderItem` (read-only reference)

Used only for total computation inside `useClientOrderHistory`. Read via `orderItemsRepository.observeByOrder(orderId)` (existing repository).

| Field | Type | Used by this feature? |
|-------|------|----------------------|
| `id` | `string` | yes (for item count) |
| `orderId` | `string` | yes (join key) |
| `productVariantId` | `string` | no |
| `quantity` | `number` | yes (total) |
| `unitPrice` | `number` | yes (total) |
| `discountAmount` | `number` | yes (total) |

### `Salesperson` (read-only reference)

Used only for email → id resolution by `useActiveSalespersonId`. Read via `salespeopleRepository.observeAll()`.

| Field | Type | Used by this feature? |
|-------|------|----------------------|
| `id` | `string` | yes (output) |
| `name` | `string` | no |
| `email` | `string` | yes (match against `useSession().email`) |

## Derived DTOs (new in this feature)

These shapes live in `src/features/clients/types.ts` and are the ONLY way components consume client / order data. Keeping UI on DTOs (not on WatermelonDB models) prevents accidental mutation and centralizes `_raw._status` access.

### `ClientListItemDTO`

Consumed by `ClientsScreen` and `ClientListRow`.

```ts
type ClientListItemDTO = {
  readonly id: string;
  readonly name: string;
  readonly taxId: string | null;         // kept for CNPJ search (FR-024)
  readonly addressSnippet: string | null;  // first line / first 40 chars of address_line, for list row
  readonly contactSnippet: string | null;  // truncated phone or email for list row hint
  readonly updatedAt: number;            // used by "Recente" chip ranking
  readonly isPendingSync: boolean;       // derived from _raw._status !== 'synced'
};
```

**Derivation**: in `useClients.ts` for each `Client` model instance. Tests for the derivation live in `useClients.test.ts` (added later if the hook grows non-trivial logic; initially, only `useActiveSalespersonId.test.ts` is mandated per plan).

### `ClientProfileDTO`

Consumed by `ClientProfileScreen`.

```ts
type ClientProfileDTO = {
  readonly id: string;
  readonly name: string;
  readonly taxId: string | null;           // rendered with `—` placeholder when null (FR-013)
  readonly phone: string | null;
  readonly email: string | null;
  readonly addressLine: string | null;
  readonly notes: string | null;
  readonly isPendingSync: boolean;
};
```

**Derivation**: the profile screen observes a single `Client` via `clientsRepository.observe(clientId)` and projects it into this DTO. `null` fields are passed through — the component layer owns the "`—`" placeholder logic.

### `ClientDraft`

Held by `clientDraftStore`; consumed and mutated by `ClientFormFields` via `useClientDraft`.

```ts
type ClientDraft = {
  readonly name: string;           // required; empty string means "not filled yet"
  readonly taxId: string;          // raw (unnormalized) input from CnpjField
  readonly addressLine: string;
  readonly contact: string;        // free-text "contact" block per spec Assumption
  readonly notes: string;
};

const EMPTY_DRAFT: ClientDraft = {
  name: '',
  taxId: '',
  addressLine: '',
  contact: '',
  notes: '',
};
```

Note: the form treats `contact` as a **single free-text field** (spec Assumption). On save, the field is split heuristically into `phone` and `email` before the repository call — if the text contains an `@`, it goes to `email`; otherwise to `phone`. If the salesperson typed both on separate lines, the first `@`-bearing line becomes `email` and the rest becomes `phone`. Rationale: storage is structured per the data model; the form is free-form per UX1. Tests for this split live in `clientsFormSave.test.ts` (a targeted test added alongside the form implementation; not on the plan's mandated test list because the logic is tiny).

### `ClientFilterState`

Held as local state in `useClientsFilter`.

```ts
type ClientFilterState = {
  readonly query: string;
  readonly activeFilter:
    | { kind: 'recent' }
    | { kind: 'letter'; value: string }  // single uppercase letter, normalized
    | null;
};
```

Composition semantics: `query` and `activeFilter` intersect (FR-022). Empty `query` + null `activeFilter` = full list.

### `OrderHistoryRowDTO`

Consumed by `OrderHistoryRow`.

```ts
type OrderHistoryRowDTO = {
  readonly id: string;                              // order id
  readonly createdAtMs: number;                     // FR-015 date display + sort
  readonly status: 'draft' | 'sent' | 'canceled';  // FR-015 status display
  readonly total: number;                           // computed per research R-004, clamped ≥ 0
  readonly itemCount: number;                       // quality-of-life display, not required by FR
};
```

### `ActiveSalespersonState`

Returned by `useActiveSalespersonId()`.

```ts
type ActiveSalespersonState =
  | { readonly status: 'resolving'; readonly salespersonId: null }
  | { readonly status: 'ready'; readonly salespersonId: string }
  | { readonly status: 'missing'; readonly salespersonId: null };
```

- `'resolving'`: initial mount; observations haven't emitted yet.
- `'ready'`: the session is `Authenticated` and a `salespeople` row matching the email was found.
- `'missing'`: the session is `Authenticated` but no matching `salespeople` row exists yet (bootstrap gap — first run on a device where sync hasn't landed the salesperson row yet). The form screen renders a blocking state and invites a sync retry.

Session `NotAuthenticated` or `RequiresRelogin` never reaches the clients module — `HomeStack` is only mounted under an authenticated session.

## Validation rules

All validation runs in pure functions, re-used between the form and the form's save-button-disabled predicate.

| Field | Rule | Source |
|-------|------|--------|
| `name` | Required, non-empty after `trim()`. | FR-002 + spec Assumption ("store name is the only required field") |
| `taxId` | Optional. If present, `isValidFormat(taxId)` must return true. Stored as digits-only. | FR-008, FR-009, research R-002 |
| `phone` | Optional. No format validation. Stored verbatim. | Derived from the free-text "contact" field per DTO note above. |
| `email` | Optional. No format validation. Stored verbatim. | Derived from the free-text "contact" field per DTO note above. |
| `addressLine` | Optional. No validation. Single free-text block. | Spec Assumption. |
| `notes` | Optional. No validation. Free text. | Spec Assumption. |
| Duplicate CNPJ | **Explicitly NOT validated in-app.** | FR-007, D3. |

## State transitions

This feature introduces no entity-level state transitions. Clients are created, then consumed read-only by the list and profile screens; order rows are read for history display. The only "state" that changes over time is:

- `Client._raw._status`: `created` → `synced` when 005's push drains the row. No client-side code drives this transition; it is a by-product of sync.
- `ClientFilterState`: mutated by user interaction (typing into the search field, tapping a chip, tapping a clear control). All transitions are pure React state.
- `ClientDraft`: mutated by `ClientFormFields` on every keystroke; cleared on save or cancel.
- `ActiveSalespersonState`: `resolving` → `ready` once observations land; `resolving` → `missing` if a sync pass completes and still no matching salesperson row is present. Can transition back to `ready` when sync lands the salesperson row.

## Relationships at a glance

```text
┌──────────────┐ 1         * ┌──────────┐
│ Salesperson  │─────────────│ Client   │────────────┐
└──────────────┘             └──────────┘            │
         │                                           │ 1
         │ 1                                         │
         │                                           │ *
         │                                      ┌──────────────┐
         │                              READ    │ Order        │
         │                              FROM    │ (this feature│
         │                                      │  displays as │
         │                                      │  history)    │
         │                                      └──────────────┘
         │                                           │ 1
         │                                           │ *
         │                                     ┌──────────────┐
         └─────────────────────────────────────│ OrderItem    │
                                               │ (total calc) │
                                               └──────────────┘
```

None of these relationships are new. The feature reads existing edges; it does not introduce any.
