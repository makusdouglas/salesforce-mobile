# Contract: search & filter pure functions

**Status**: authoritative for 007 Client Management
**Files**:

- `src/features/clients/search/normalize.ts`
- `src/features/clients/search/matches.ts`
- `src/features/clients/search/filter.ts`

Three tiny pure modules. Zero React, zero repository access, zero side effects. They take data in, they return data out.

## `normalize(input: string): string`

```ts
export function normalize(input: string): string;
```

- **Input**: any string.
- **Output**: a canonical, ASCII-friendly, lowercase form suitable for substring comparison.
- **Rules**:
  1. `input.normalize('NFD')` — decompose accented characters into base + combining-mark.
  2. Strip every Unicode Mn (combining-mark) code point.
  3. `toLocaleLowerCase('pt-BR')` — Brazilian-Portuguese lowercase mapping.
  4. `trim()` — strip surrounding whitespace.
- **Examples**:
  - `"São Paulo"` → `"sao paulo"`
  - `"açaí"` → `"acai"`
  - `"ÁRVORE"` → `"arvore"`
  - `"   Loja   "` → `"loja"`
  - `""` → `""`
- **Duplicated** from `src/features/catalog/search/normalize.ts`. A TODO in the file notes the eventual shared extraction (research R-008).

## `matchesQuery(client: ClientListItemDTO, normalizedQuery: string): boolean`

```ts
import type { ClientListItemDTO } from '../types';

export function matchesQuery(
  client: ClientListItemDTO,
  normalizedQuery: string
): boolean;
```

- **Input**: one `ClientListItemDTO` (see data-model.md) and a pre-normalized query string.
- **Output**: `true` if the client matches; `false` otherwise.
- **Rules**:
  1. If `normalizedQuery === ''`, return `true` (empty query matches all — used when only the chip filter is active).
  2. **Name primary**: if `normalize(client.name)` contains `normalizedQuery` as a substring, return `true`.
  3. **CNPJ secondary**: if `client.taxId !== null` and the digits-only form of `client.taxId` contains the digits-only form of `normalizedQuery` as a substring, return `true`. (Digits-only comparison allows the salesperson to type `12345678` and match a stored `12.345.678/0001-99`.)
  4. Otherwise, return `false`.
- **Examples** (with `normalize` + CNPJ digit-strip applied as described):
  - client `{ name: "Mercearia São Paulo", taxId: null }`, query `"sao"` → true (name)
  - client `{ name: "Loja A", taxId: "12.345.678/0001-99" }`, query `"12345"` → true (CNPJ)
  - client `{ name: "Loja A", taxId: null }`, query `"12345"` → false
  - client `{ name: "Loja B", taxId: "12.345.678/0001-99" }`, query `"loja"` → true (name)
  - client `{ name: "Loja B", taxId: null }`, query `""` → true
- **Pre-condition**: callers MUST pass the already-normalized query so that the expensive `normalize` call happens once per filter pass, not once per client × keystroke.

## `applyFilter(input: FilterInput): readonly ClientListItemDTO[]`

```ts
type FilterInput = {
  readonly clients: readonly ClientListItemDTO[];
  readonly query: string;
  readonly activeFilter:
    | { kind: 'recent' }
    | { kind: 'letter'; value: string }
    | null;
};

export function applyFilter(input: FilterInput): readonly ClientListItemDTO[];
```

- **Output**: a filtered, ordered list. Unchanged relative ordering is preserved for the non-`recent` paths.
- **Composition rules** (FR-022):
  1. Normalize `input.query` once.
  2. If `activeFilter === null` and normalized query is empty: return `input.clients` unchanged.
  3. Otherwise start from `input.clients` and apply, in this order:
     - If `activeFilter.kind === 'recent'`: sort a shallow copy by `updatedAt` descending, take the top `RECENT_LIMIT = 10` (see research R-003). This MAY reorder the output relative to the source list; that is the only case where ordering changes.
     - If `activeFilter.kind === 'letter'`: keep only clients whose `normalize(name).charAt(0) === activeFilter.value` (the chip row already renders already-normalized uppercase letters, but the comparison is case-insensitive).
     - Apply `matchesQuery(client, normalizedQuery)` as a final filter pass.
- **Empty-case handling**:
  - Query only, no clients matching name / CNPJ → empty array. `ClientsScreen` renders `<ClientNoMatchesView />` (FR-025).
  - Query + `recent` + letter chip combined and no match → empty array, same UX.
  - Clients list is empty and no filter: still empty — `ClientsScreen` renders `<ClientEmptyView />` (FR-026) because `hasAny === false`, not because of the filter.

## Test contract

- `normalize.test.ts`:
  1. Empty string returns empty string.
  2. Diacritic stripping: `"São Paulo" === "sao paulo"`, `"açaí" === "acai"`, `"Limão" === "limao"`.
  3. Case folding: `"ÁRVORE" === "arvore"`.
  4. Trim: `"  Loja  " === "loja"`.

- `matches.test.ts`:
  1. Empty query returns true.
  2. Name substring match anywhere (start, middle, end).
  3. CNPJ match with formatted input stored and digits-only query.
  4. CNPJ match rejected when `taxId === null`.
  5. Query that doesn't match name or CNPJ returns false.

- `filter.test.ts`:
  1. Empty query + null filter returns the full list unchanged.
  2. Empty query + `recent` filter returns top-10 by `updatedAt` desc, even with 50 clients.
  3. Empty query + letter filter returns only clients whose normalized name starts with that letter.
  4. Query + letter filter intersects.
  5. Query + recent filter intersects (recent top-10 first, then query-filter).
  6. All three combined (query + recent + letter) intersects.
  7. No-match combinations return empty array.

## `RECENT_LIMIT` constant

Defined in `filter.ts` as `export const RECENT_LIMIT = 10;`. Referenced from the test as `import { RECENT_LIMIT } from '../search/filter'`. Easy to tune in one place.
