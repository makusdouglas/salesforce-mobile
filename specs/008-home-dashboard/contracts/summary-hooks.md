# Contract — Home Summary Hooks

All four hooks live under `src/features/home/hooks/`. Each is the shape it will have in perpetuity; v1 bodies for the two placeholders (Drafts, Last Sent Order) are fixed constants, and 009-orders will replace only the body.

## `useCatalogSummary(): { count: number }`

```ts
export function useCatalogSummary(): { count: number };
```

- Observes `productsRepository.observeAll()` via `useObservable(Array) → length`.
- Returns `{ count: 0 }` when observation has not yet resolved (first render).
- Unsubscribes on unmount.

## `useClientsSummary(salespersonId: string | null): { count: number }`

```ts
export function useClientsSummary(salespersonId: string | null): { count: number };
```

- When `salespersonId === null` → returns `{ count: 0 }` without subscribing (bootstrap gap; matches the clients list behavior).
- Otherwise observes `clientsRepository.observeByOwner(salespersonId)` via `useObservable(Array) → length`.

## `useDraftsSummary(): { count: number }` — PLACEHOLDER

```ts
// TODO(009-orders): replace body with observation over ordersRepository.observeByStatus('draft', salespersonId).
export function useDraftsSummary(): { count: number } {
  return { count: 0 };
}
```

- Contract test locks the return shape and default value.
- Future body must keep the same signature and must return `{ count: number }` on every render (no null, no undefined, no loading flag).

## `useLastSentOrder(): RecentActivityDTO | null` — PLACEHOLDER

```ts
// TODO(009-orders): replace body with observation over ordersRepository.observeLastSent(salespersonId) joined with client.name and line-items total.
export function useLastSentOrder(): RecentActivityDTO | null {
  return null;
}
```

- Contract test locks `null` as the v1 return.
- Future body must keep the same signature; it may add an internal `useMemo` for the joined DTO but MUST NOT return a tri-state like `{ status: 'loading' | 'ready' | 'empty' }`. The empty case is represented by `null`; the rendering side already has a dashed placeholder for `null`.

## Swap-in protocol for 009-orders

1. 009 implements `ordersRepository.observeByStatus(status, salespersonId)` and `observeLastSent(salespersonId)` on the existing 002 repository.
2. 009 changes the body of `useDraftsSummary` and `useLastSentOrder` in this module to subscribe to the new observations.
3. 009 updates the two contract tests to reflect real behavior (drafts count varies, last-sent-order can be non-null).
4. 009 MUST NOT rename the hooks or change their signatures; if it must, the change is a breaking contract and requires a new feature spec.

## Dependency graph

```text
useCatalogSummary  →  productsRepository (002)
useClientsSummary  →  clientsRepository (002)  +  useActiveSalespersonId (007)
useDraftsSummary   →  (future) ordersRepository (002)
useLastSentOrder   →  (future) ordersRepository (002)  +  clientsRepository (002)
```

No hook imports from any other Home component or hook. Each hook is independently testable.
