# Quickstart — Repeat Past Order (feature 010)

**Audience**: developers implementing `010-repeat-last-order` after `/speckit-tasks`.
**Prereqs**: feature 009 merged and running locally. No schema migration, no Supabase change, no new dependency.

## 0. Branch + environment

```bash
git checkout 010-repeat-last-order   # already created by /speckit-specify
npm install                          # no-op: no package.json change
npm run typecheck                    # baseline green before any edit
npm test                             # baseline green before any edit
```

If those two commands aren't green against `main` before you start, stop and fix first — the feature's tests assume a clean baseline.

## 1. Repository layer

Add one observation and one finder to `src/data/repositories/ordersRepository.ts`:

```ts
// observes the client's most recent SENT order (used by the hero card)
observeLastSentForClient(clientId: string): Observable<Order | null>

// thin wrapper; confirm it isn't already present from 009
findById(id: string): Promise<Order | null>
```

Query shape (logical):

```
orders WHERE client_id = ? AND status = 'sent' AND _status != 'deleted'
ORDER BY sent_at_ms DESC LIMIT 1
```

Use the existing `(client_id)` index — no new index needed. `Q.take(1)` keeps the result small so mapping cost is negligible.

## 2. Service layer

Add to `src/features/orders/services/ordersService.ts`:

1. Two error classes: `CannotRepeatDraftError` and `AllItemsUnavailableError`. Follow the existing error-class pattern (class with `.code` field, extends Error).
2. `repeat(input: RepeatInput): Promise<RepeatResult>`. Follow the contract in [contracts/ordersService.repeat.md](./contracts/ordersService.repeat.md).

Order of operations inside `repeat`:
1. Load source order; throw `OrderNotFoundError` if missing.
2. Throw `CannotRepeatDraftError` if `status === 'draft'`.
3. Load source lines.
4. For each line: look up variant + parent product; classify as `kept` or `dropped`.
5. Throw `AllItemsUnavailableError` if `kept.length === 0`.
6. Inside one `database.write(...)`: create new order row, create one `order_items` row per `kept`.
7. Return `{ orderId, droppedProductNames }`.

**Critical**: the availability gate runs before `database.write`. The all-unavailable path must not create any row.

## 3. Hook

Create `src/features/orders/hooks/useRepeatOrder.ts`:

```ts
export function useRepeatOrder(): {
  repeat(sourceOrderId: string): Promise<RepeatOutcome>;
};

export type RepeatOutcome =
  | { kind: 'landed'; orderId: string; droppedNames: string[] }
  | { kind: 'blocked'; reason: 'all_unavailable' };
```

Hook-internal branch:
- Look up source via `ordersRepository.findById`.
- If `source.status === 'draft'` → return `{ kind: 'landed', orderId: source.id, droppedNames: [] }` (resume).
- Else call `ordersService.repeat(...)` inside a try/catch:
  - On success → `{ kind: 'landed', orderId: result.orderId, droppedNames: result.droppedProductNames }`.
  - On `AllItemsUnavailableError` → `{ kind: 'blocked', reason: 'all_unavailable' }`.
  - On other errors → rethrow.

The caller navigates on `'landed'` and renders an inline notice on `'blocked'`. Do **not** have the hook perform navigation itself — that couples it to RN and breaks unit testing.

## 4. UI components

Two new components under `src/features/clients/components/`:

- `RepeatHeroCard.tsx` — the dark primary card. Props: `{ lastSent: { date: string; itemCount: number; total: number } | null; onPress(): void }`. Renders nothing when `lastSent === null`.
- `RepeatIconButton.tsx` — the circular ↺. Props: `{ dim?: boolean; onPress(): void }`. `dim` is used on cancelled-source rows so the icon uses the zinc-500 variant from the design summary.

One new component under `src/features/orders/components/`:

- `DroppedItemsNotice.tsx` — the non-dismissable summary banner. Props: `{ names: string[] }`. Renders nothing when `names.length === 0`.

Follow the design tokens (colors, corner radius, elevation) already in use in 008/009 — no new palette entry.

## 5. Screen edits

### `src/features/clients/screens/ClientProfileScreen.tsx`

- Observe `ordersRepository.observeLastSentForClient(clientId)`; derive `itemCount` + `total` via `computeOrderTotals` on the observed order's lines.
- Mount `<RepeatHeroCard>` above the history list. Its `onPress` calls `useRepeatOrder().repeat(lastSent.id)` and navigates on `kind: 'landed'` or sets local state to render a blocking notice on `kind: 'blocked'`.
- On each history row, append `<RepeatIconButton>` with `dim={row.status === 'canceled'}` and `onPress` wired the same way (but against `row.id`, not `lastSent.id`). Tapping the row body still opens the read-only order view — do not change that handler.
- Demote the existing "Novo pedido" primary button (bottom on phone, top on tablet) to the outline style shown in the design summary. Label changes to "Novo pedido em branco".

### `src/features/orders/screens/OrderSummaryScreen.tsx`

- Read `route.params.droppedNames` (new optional param; add to `app/navigation/types.ts`).
- Render `<DroppedItemsNotice names={droppedNames ?? []} />` above the line list.

No layout change, no viewport branch change.

## 6. Tests

Before writing production code, stub the tests from plan.md §Testing so red→green is visible:

- `src/features/orders/services/ordersService.repeat.test.ts`
- `src/features/orders/hooks/useRepeatOrder.test.ts`
- `src/data/repositories/__tests__/ordersRepository.observeLastSentForClient.test.ts`
- Edit `src/features/clients/screens/__tests__/ClientProfileScreen.test.tsx`
- Edit `src/features/orders/screens/__tests__/OrderSummaryScreen.test.tsx`
- Widen `src/features/orders/noCatalogWrites.test.ts`'s scan root to include `src/features/clients/**`.

Run tests often: `npm test -- --watch`.

## 7. Manual QA

Run on both the iPhone and iPad simulators (the portrait-only lock applies).

**Client with ≥ 2 sent orders, all variants available**
- Open the client profile. Hero card shows the most recent sent order's date / count / total. Confirm.
- Tap the hero → lands on OrderSummary with all lines + same discounts. Tap "Enviar" → order is sent. Expected taps: 2.
- Open the profile again; tap the ↺ on an older sent order → summary shows *that* order's lines, not the latest. Expected taps: 2.
- **Timing pass (SC-004)**: with a stopwatch, time `profile loaded → "Enviar" tap registered` five times through the hero path and five times through a per-row ↺ path, on each viewport (20 runs total). Record each median below; each must be < 10 s:

  | Viewport | Hero median (s) | Per-row median (s) |
  |----------|-----------------|---------------------|
  | iPhone 14 |   |   |
  | iPad 11" |   |   |

**Client with a cancelled last order**
- Open profile. Hero card is NOT rendered. Per-row ↺ on the cancelled order still works.

**Client with a draft last order**
- Open profile. Hero card is NOT rendered. ↺ on the draft row resumes the draft (same id visible on the summary URL/state, no new draft created in Home's "Drafts in progress" count).

**Source with a deleted variant**
- Soft-delete one variant referenced by a past order (`productVariantsRepository.softDelete(variantId)` via a dev console).
- Tap ↺ on that order. Summary shows the notice banner naming the deleted product; line count is one less than source.

**Source with every variant deleted**
- Soft-delete every variant referenced by a past order.
- Tap ↺. Expected: no navigation; blocking notice appears on the profile; no new order row exists (`await ordersRepository.count()` unchanged).

**Empty-history client**
- Open a brand-new client's profile. `ClientProfileEmpty` renders; no hero, no ↺.

## 8. Definition of done

- `npm run typecheck` green.
- `npm test` green, including the new `repeat`, `useRepeatOrder`, `observeLastSentForClient`, and widened-scan tests.
- Manual QA above passes on both viewports.
- `specs/010-repeat-last-order/checklists/requirements.md` all items ticked.
- No new npm package, no new migration, no new navigation route.
