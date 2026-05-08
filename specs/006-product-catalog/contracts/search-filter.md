# Contract: Search and Filter (`src/features/catalog/search/`)

**Feature**: 006-product-catalog
**Modules**: `normalize.ts`, `matches.ts`, `filter.ts`
**Traces to**: FR-014 (tap-first), FR-015 (text fallback), FR-016 (composition), FR-017 (diacritic-insensitive), FR-018 (no-matches state)

Three pure functions. Zero runtime dependencies beyond the JS engine. All testable without React, WatermelonDB, or filesystem.

---

## 1. `normalize(input: string): string`

**Purpose**: produce a canonical form of a user-entered string or a product/variant string so they can be compared without regard to diacritics, case, or surrounding whitespace.

**Contract**:

```typescript
// src/features/catalog/search/normalize.ts
export function normalize(input: string): string;
```

**Algorithm**:

```typescript
input
  .normalize('NFD')                    // decompose: "é" → "e" + U+0301
  .replace(/\p{Mn}/gu, '')             // strip combining marks
  .toLocaleLowerCase('pt-BR')          // case-fold, locale-aware
  .trim();                             // strip leading/trailing whitespace
```

**Properties** (formalized in `tests/normalize.test.ts`):

1. `normalize("Café") === "cafe"` — diacritic stripped, case lowered.
2. `normalize("AÇAÍ") === "acai"` — uppercase diacritics also decomposed.
3. `normalize(" Limão ") === "limao"` — trim + strip tilde.
4. `normalize("coração") === "coracao"` — cedilla + tilde in one string.
5. `normalize("Pet 600ml") === "pet 600ml"` — digits and spaces preserved.
6. `normalize("Refri-Cola") === "refri-cola"` — punctuation preserved.
7. `normalize("") === ""` — empty is empty.
8. `normalize("") === normalize("")` — idempotent under multiple applications (`normalize(normalize(x)) === normalize(x)`).

**Do not**:

- Remove punctuation. The catalog's product names contain hyphens, periods, and numbers that are meaningful.
- Collapse internal whitespace. A user searching "pet 600" should not match "pet600".
- Use a non-locale `toLowerCase()`. Explicit `pt-BR` matches the user's locale even if the system locale is different.

---

## 2. `matchesQuery(product: ProductDisplayDTO, normalizedQuery: string): boolean`

**Purpose**: given a product DTO and a pre-normalized query, decide whether the product should appear in a search result.

**Contract**:

```typescript
// src/features/catalog/search/matches.ts
export function matchesQuery(
  product: ProductDisplayDTO,
  normalizedQuery: string,
): boolean;
```

**Algorithm**:

```typescript
if (normalizedQuery.length === 0) return true;

const haystack = [
  normalize(product.name),
  ...product.variants.map((v) => normalize(v.label)),
].join(' ');

return haystack.includes(normalizedQuery);
```

**Properties**:

1. Empty query matches every product.
2. Query matches product name case/diacritic-insensitively.
3. Query matches any variant label (for products where the variant label carries the distinguishing info — e.g. "Garrafa 2L").
4. Matching is substring, not prefix — "cola" matches "Refri Cola".
5. Multi-word query: space in the query is a literal character, not a token separator. `"refri cola"` matches "refri cola" in the haystack. This is pragmatic for mobile typing; tokenized matching is out of scope for MVP.
6. On the list screen where variants are lazily empty (`[]`), `matchesQuery` effectively searches only `name`. This is intentional: full variant search requires the details to be loaded, and the list is expected to provide a coarse filter (variant-level matching is perfect on the detail screen, which is only one tap away).

**Rationale for substring**: users in the field type fragments ("cafe" meaning "Café Torrado 500g"). Prefix matching would miss this. Tokenized scoring (à la Fuse.js) adds complexity for MVP; a simple substring match on normalized strings is fast enough (O(N × haystackLen) per keystroke, where N ≈ 200) to stay within SC-001.

---

## 3. `applyFilter(input): ProductDisplayDTO[]`

**Purpose**: compose the text query and the category chip into a single filtered list.

**Contract**:

```typescript
// src/features/catalog/search/filter.ts
type FilterInput = {
  readonly products: ReadonlyArray<ProductDisplayDTO>;
  readonly query: string;
  readonly activeCategory: string | null;  // null = "Todos" chip
};

export function applyFilter(input: FilterInput): ProductDisplayDTO[];
```

**Algorithm**:

```typescript
const nq = normalize(input.query);
const cat = input.activeCategory;   // already trimmed by the chip-row caller

return input.products.filter((p) => {
  if (cat !== null && (p.category ?? '').trim() !== cat) return false;
  if (!matchesQuery(p, nq)) return false;
  return true;
});
```

**Properties**:

1. **Intersection (FR-016)**: a product must pass BOTH the category check and the query check to appear.
2. **No-filter case**: `query === '' && activeCategory === null` returns `input.products` unchanged (reference-preserving when no array change is needed — important for `FlatList` prop stability).
3. **Category-only**: `activeCategory === 'Bebidas'` returns products whose `category === 'Bebidas'`. Trimmed comparison (the chip row stored the trimmed value).
4. **Query-only**: `query === 'cola'` returns all products matching the query across categories.
5. **Empty category**: products with `category === null` are filtered out when `activeCategory !== null`; always included when `activeCategory === null`.
6. **Ordering**: output order matches `products` input order. `useCatalog` already sorts alphabetically by name; `applyFilter` does not re-sort.

---

## Category sourcing for the chip row

The chip row (`<FilterChipRow />`) needs to render the set of categories that currently exist in the local catalog. It does this by:

1. Reading `products: ProductDisplayDTO[]` from `useCatalog`.
2. Extracting `categorySet = new Set(products.map((p) => (p.category ?? '').trim()).filter((c) => c !== ''))`.
3. Sorting the set: by frequency descending (most common category first), with ties broken alphabetically case-insensitively (`'pt-BR'` locale).
4. Prepending the "Todos" chip (`activeCategory === null`) at the head.
5. If `categorySet.size === 0`, **the entire chip row renders nothing** (returns `null`). The search field alone stays visible.

**Hide-row invariant (FR-015 degradation)**: when no product has a category, the search field becomes the sole narrowing mechanism. This is the "graceful degradation" path recorded in the spec Assumptions.

---

## Test coverage (from `tests/filter.test.ts`)

1. **Compose**: `query='cola', activeCategory='Bebidas'` returns only products that match both.
2. **Empty-both**: returns the full list.
3. **Category-only**: returns all products in that category regardless of name.
4. **Query-only**: returns matches across categories.
5. **Reference-preserving no-op**: empty inputs → same array reference (`Object.is(result, input.products)` is true) to keep `FlatList` happy.
6. **Null-category handling**: products with null `category` are excluded when `activeCategory !== null`.
7. **Whitespace in admin-entered category**: admin saves `"Bebidas "` (trailing space); the chip row stores `"Bebidas"` (trimmed); filter still matches.
8. **Diacritic-insensitive query**: `query='cafe'` matches product named "Café Torrado 500g".
9. **Variant-label match** (detail-screen scenario with variants populated): product with name "Cola" and variants `["Garrafa 2L"]` matches query `"garrafa"`.
10. **No-matches**: `query='xyzzy'` returns `[]` — used by `CatalogScreen` to branch into `<CatalogNoMatchesView>`.

---

## Composition with React

The `useCatalogFilter()` hook owns the filter state and composes the three functions:

```typescript
export function useCatalogFilter(products: ReadonlyArray<ProductDisplayDTO>) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(
    () => applyFilter({ products, query, activeCategory }),
    [products, query, activeCategory],
  );

  const reset = useCallback(() => {
    setQuery('');
    setActiveCategory(null);
  }, []);

  return { query, setQuery, activeCategory, setActiveCategory, filtered, reset };
}
```

Notes:

- `useMemo` keys on reference equality of `products` (safe because `useCatalog` re-emits a new array only when data changes).
- `reset` is the reset-CTA target for `CatalogNoMatchesView` (FR-018).
- No debouncing of `setQuery`: the filter is fast enough (O(N × L) where N ≤ 500 and L ≤ 20) to run per-keystroke synchronously. Debouncing adds perceived latency and complexity for no gain at MVP scale.

---

## Non-goals (explicit)

- **Fuzzy / typo-tolerant matching** — out of scope for MVP. Product names are admin-curated and the salesperson types ≤ 20 chars. Fuse.js is a future enhancement if usability testing shows a need.
- **Multi-select category chips** — out of scope. One active category at a time matches the Pencil frames and UX1.
- **Sort controls** (price, A–Z override) — out of scope. Default sort is alphabetical by name (stable, deterministic, matches the Pencil frames).
- **Saved searches / recent searches** — out of scope. No persistence; filters reset on screen close.
