# Research: 007 Client Management

**Phase**: 0 — Outline & Research
**Status**: Complete
**Date**: 2026-04-22

Nine research items were opened by the plan's Technical Context. Each has a Decision, Rationale, and Alternatives section. Nothing in this list blocks the Constitution Check; every item produced a reasonable default that fits the spec's Assumptions and the MVP envelope (P3).

---

## R-001 — Resolving `salespersonId` for the current session

**Decision**: Introduce a tiny local hook `useActiveSalespersonId()` inside `src/features/clients/hooks/`. It observes `salespeopleRepository.observeAll()` and the session snapshot (`useSession().email`), and returns the first id whose email matches. The hook returns `{ salespersonId: string | null, status: 'resolving' | 'ready' | 'missing' }`. The form screen blocks on `status !== 'ready'`; the list screen treats `null` as "show the first-launch empty state" and does not block.

**Rationale**:

- The session store (003) holds only `email`. Adding a `salespersonId` field to `SessionSnapshot` changes a cross-cutting contract that dozens of modules consume (at least 003, 004, 005, 006) for the benefit of one feature (007). P3 says simpler and local.
- The salesperson row arrives via sync. In the common path (returning user, device synced at least once) the match is immediate. In the edge-case path (first launch, sync hasn't landed yet) the form blocks with a salesperson-language state that invites a sync retry — which aligns with FR-002 (a brand-new install needs to sync once before the salesperson can actually save a field client).
- The `observeAll()` result is small (O(number of salespeople), typically 1–2 in MVP) so the observation is cheap.
- The hook is 20 lines and trivially testable (see `useActiveSalespersonId.test.ts`).

**Alternatives considered**:

- **Extend `SessionSnapshot`**: rejected per P3. The mutation to session state is cross-cutting and has to thread through `sessionStore.setAuthenticated` and its two call sites in `authService`; every snapshot consumer's test fixtures would need updating. Not proportionate to a one-feature win.
- **Read at create time (no hook)**: rejected because the form screen needs to know salesperson-ready status before the user hits save, not after. Users should not tap "Save" and be told "wait, we can't save yet" — the form's save button is disabled until `status === 'ready'`.
- **Persist the resolved id in `expo-secure-store`**: rejected. It's derivable from local WatermelonDB state whenever it's needed; persisting creates a cache-invalidation problem if the admin ever renames a salesperson's email.

---

## R-002 — CNPJ validator shape

**Decision**: A pure module `src/features/clients/cnpj/cnpj.ts` with two exports:

- `normalize(raw: string): string` — strips every non-digit character from `raw`. Empty input returns `""`.
- `isValidFormat(raw: string): boolean` — returns `true` for any input that normalizes to exactly 14 digits OR to an empty string. Returns `false` otherwise.

No checksum validation. No checking against existing rows.

**Rationale**:

- Spec FR-008 requires format validation "when provided" and explicitly DEFERS any deeper validation (checksum, duplicate) to the admin per D3.
- Accepting both bare digits and the formatted `12.345.678/0001-99` form (FR-009) means the single `normalize + length-check` is sufficient. Strip first, then count.
- An empty CNPJ is "valid" because the field is optional per the spec Assumption ("store name is the only required field"). The form screen wires this into the save-button-disabled predicate.
- CNPJ checksum rules (the two weighted-sum check digits) are well-known and about 25 lines of code. Adding them for "free" doesn't violate any constitution principle but crosses the spec's explicit scope line. Keep them out until the admin-clients feature (015) wants them.

**Alternatives considered**:

- **Full checksum validation**: rejected as out of spec scope. The spec defers deep validation to the admin.
- **Use an existing npm library (`cnpj-validator`, `brazilian-values`)**: rejected by P3. 25 lines of code is not worth a dependency.
- **Validate on every keystroke**: rejected. UX1 says minimize typing friction. The validator is called on save and on field blur — not on every character.

---

## R-003 — Recency definition for the "Recente" chip

**Decision**: "Recente" is defined as the top-10 clients sorted by `updatedAt` descending, pre-filter. The filter applies to the list that's already observed.

**Rationale**:

- WatermelonDB exposes `updatedAt` on every model instance (populated by our sync-readiness columns `updated_at` from 002). For a just-created offline client, `updated_at === creation time`. For an admin-updated client, `updated_at === last edit`. Either way, "touched recently" is the salesperson's mental model.
- Top-K is time-insensitive: it never returns zero (if there are at least 10 clients) and never returns the whole list. A threshold-based alternative ("last 7 days") is more semantically meaningful but brittle under device-clock drift and produces unstable chip results.
- 10 rows fits one mobile screen on phone and is trivially scannable on tablet.
- If the list has fewer than 10 total clients, "Recente" effectively == the full list sorted — harmless, and the salesperson would not tap the chip anyway.

**Alternatives considered**:

- **Threshold "last 7 days"**: rejected for clock-drift brittleness. Revisitable.
- **Store a dedicated `last_viewed_at` per client**: rejected. Requires a schema bump for a heuristic, and the salesperson never explicitly "views" a client today — they scroll, they tap. P3.
- **Read the salesperson's last few `orders.client_id` and surface those clients as "Recent"**: more accurate but couples the filter to order-module internals. Deferred to a future polish pass.

**Parameter**: `RECENT_LIMIT = 10`. A single constant in `filter.ts`, easy to tune if field data suggests otherwise.

---

## R-004 — Order total computation

**Decision**: For each order row in the history, compute:

```text
subtotal = Σ (item.quantity × item.unitPrice − item.discountAmount)  // item discounts already applied
total    = max(0, subtotal − order.discountAmount)                   // order-level discount, clamped
```

Implemented in `useClientOrderHistory`, which joins `ordersRepository.observeByClient(clientId)` with `orderItemsRepository.observeByOrder(orderId)` and produces `OrderHistoryRowDTO { id, createdAtMs, status, total, itemCount }`.

**Rationale**:

- Constitution R5: discounts live on the order and order items, not the catalog. The formula above honors both levels.
- The `max(0, …)` clamp prevents a negative total from surfacing when a data anomaly exists (e.g., an over-aggressive order-level discount relative to items, which can happen during order editing in the future orders feature). Displaying a negative total is worse than displaying 0.
- The computation runs over the order-item collection at render time. At MVP scale (a handful of orders per client, a handful of items per order), this is trivial. If profiling ever shows the join is expensive, the result can be memoized per-order and invalidated on item change.

**Alternatives considered**:

- **Persist `total` on the `orders` row**: rejected. Adding a denormalized column introduces an update-on-write discipline that is currently absent, and the future orders feature is the right owner of any such denormalization. For this read-only feature, computing on the fly is simpler and correct.
- **Skip the total and display only item-count**: considered but rejected — FR-015 explicitly requires the total. A missing total would violate the spec.
- **Leave negative totals uncapped**: rejected. Honesty about the data is good; surfacing nonsense values to the salesperson is not.

---

## R-005 — Form draft store scope

**Decision**: `src/features/clients/drafts/clientDraftStore.ts` is a module-level in-memory singleton with `get()`, `set(draft)`, `clear()`, `subscribe(listener)`, and a `__resetForTests()` hatch. The draft lives until one of: (a) the form saves successfully and calls `clear()`, (b) the salesperson explicitly cancels and the cancel handler calls `clear()`, (c) the JS bundle unloads (process restart, fresh install).

**Rationale**:

- Spec Assumption explicitly scopes draft persistence to a single session: "protects against 'I tabbed away for 20 seconds', not 'I lost my phone for a week'". Anything more is scope creep.
- A module-level singleton follows the exact pattern the rest of the codebase uses for feature-local stores: `sessionStore` (003), `lockStore` (004), `syncStatusStore` (005). No new pattern introduced.
- React integration is `useSyncExternalStore(subscribe, getSnapshot)`. Clean.

**Alternatives considered**:

- **AsyncStorage persistence**: rejected by the spec Assumption. Future revisit if field data shows frequent crashes during form fill.
- **React Context with a provider around the form screen only**: rejected. A Context requires a mount-time provider and makes testing awkward compared to a plain singleton; 003/004/005/006 already avoid this pattern.

---

## R-006 — Pending-sync indicator source

**Decision**: Read WatermelonDB's internal `_raw._status` on each client row. Expose it through a `ClientListItemDTO.isPendingSync: boolean` field derived as `model._raw._status !== 'synced'`. The `PendingSyncBadge` component renders a dot + `Aguardando envio` label when this is true. Once 005's push drains the row, `_raw._status` flips to `'synced'` and the observation re-emits, clearing the badge automatically.

**Rationale**:

- WatermelonDB's own sync-state machine already distinguishes `created` (new local row, not yet pushed), `updated` (local edit, not yet pushed), and `synced` (upstream matches). This is the source of truth that 005's sync engine itself uses to decide what to push.
- Reading `_raw._status` is a `O(1)` field access per row — no query, no join.
- No parallel state means no invalidation bug. Every list re-render picks the correct status.
- `_raw` is not officially part of WatermelonDB's public API, but it is stable across Watermelon versions the project has used and is read elsewhere in the codebase (e.g., the smoke screen). The DTO derivation encapsulates the dependency in exactly one place, so any future Watermelon-API change requires a one-line edit.

**Alternatives considered**:

- **Introduce a `sync_state` column on the `clients` table**: rejected — duplicates Watermelon's own state, violates P3.
- **Query `collection.query(Q.where('_status', Q.notEq('synced')))` to get the pending list and cross-reference**: rejected — `O(clients)` extra query per render, no gain over a per-row field read.
- **Subscribe to 005's sync events and infer "pending" from "there is something queued to push"**: rejected — 005 knows the aggregate state (syncing / idle), not which individual rows haven't pushed. The per-row info lives in Watermelon.

---

## R-007 — "New order" CTA hand-off strategy

**Decision**: Register a `NewOrder: { clientId: string }` route on `HomeStack` and mount a stub screen `NewOrderStubScreen` that reads the param, looks up the client's name, and shows:

```text
Preparando pedido para [client.name]
Módulo de pedidos em breve (008).
← Voltar
```

When the orders feature (008) ships, the stub component is replaced with the real order-draft screen — the route name and param shape are pre-agreed in this plan. No navigation-edge change is needed when 008 lands; 007's code is not touched.

**Rationale**:

- The spec's FR-018 explicitly separates the hand-off boundary (this feature's responsibility) from the order-building flow (the future orders feature). A stable route + param shape is the hand-off.
- A stub screen is polite and navigable. An `Alert.alert('Em breve')` is jarring and blocks navigation.
- Creating an `Order` draft row on CTA tap would litter the `orders` table and the client's history area with empty drafts between taps and saves. Rejected.
- The plan's `HomeStackParamList` entry for `NewOrder` is a `NewOrder: { clientId: string }` object param — consistent with `ProductDetail: { productId: string }` from 006. When 008 replaces the stub screen, the route signature is already right.

**Alternatives considered**:

- **Create an order draft on CTA tap**: rejected (see above).
- **Modal alert "Em breve"**: rejected for UX.
- **Skip the CTA entirely and wait for 008**: rejected because the spec requires the CTA to be the primary action on the profile (FR-017) — a profile without it violates the spec. The stub is the minimum viable CTA.

**Future swap contract**: when 008 ships, it will replace the `NewOrderStubScreen` component registered on `HomeStack` with its own `OrderDraftScreen`. The route name `NewOrder` and the param `{ clientId: string }` MUST be preserved. If 008 wants a different param shape, it updates `types.ts` and any caller — this feature does not constrain future shape, it only fixes the current shape.

---

## R-008 — `useViewport` duplication vs extraction

**Decision**: Duplicate `useViewport.ts` and `breakpoints.ts` inside `src/features/clients/`. Add a one-line TODO in each duplicated file pointing to the catalog original. Do NOT extract to a shared module.

**Rationale**:

- The hook is 10 lines. Duplication cost is negligible.
- Catalog already has a working copy. Extracting now means editing catalog's imports and churning its files for no user-facing gain. P3 ("when in doubt, choose the simpler option") covers this.
- The rule of three: extract on the third consumer. This is the second consumer. The next feature that needs the hook triggers the extraction — at that point all three call sites switch to `import { useViewport } from '@/app/responsive'` in one refactor PR.
- A shared module now would also need a unit test and a clear ownership decision about how breakpoints grow over time. All premature for two consumers.

**Alternatives considered**:

- **Import `useViewport` from `@/features/catalog`**: rejected — explicit cross-feature import. Feature modules are supposed to be leaf-like; cross-importing couples them.
- **Introduce `src/app/responsive/` now**: rejected per P3 (see above).

---

## R-009 — RLS status for the `clients` table

**Decision**: No new RLS policies are authored in this feature. The existing `clients` INSERT / SELECT policies from the admin's Supabase bootstrap (referenced in `specs/005-sync-engine/contracts/supabase-schema.md` lines 105–107) allow the owning salesperson to create and read their own rows. A "verify RLS" task is added to tasks.md Phase 1 Setup as a sanity check that runs against the dev Supabase dashboard — it is a read-only verification, not a migration.

**Rationale**:

- 005's sync push already writes `clients` rows to Supabase. If the policies weren't in place, 005 would already be broken in the field. Since 005 is shipping, the policies exist.
- D7 reserves RLS authoring for admin-feature plans (013, 014, 015). VENDEDOR features consume existing policies.
- The verify-RLS task provides a paper trail without introducing code or migrations. If the verification ever fails (e.g., the admin revoked a policy), that is a deployment-level issue separate from this feature and surfaces at tasks.md time before any code runs.

**Verification query** (documented for tasks.md):

```sql
-- Expected: at least one policy covers INSERT by authenticated users whose
-- auth.uid() matches the clients.salesperson_id. At least one policy covers
-- SELECT similarly.
select polname, polcmd, pg_catalog.pg_get_expr(polqual, polrelid) as using_expr
from pg_policy
where polrelid = 'public.clients'::regclass
order by polname;
```

The task's success criterion is "at least one INSERT policy and at least one SELECT policy scoped to `auth.uid() = salesperson_id` (or equivalent scoping) exist". If absent, the feature blocks on the admin authoring them before any screen task runs.

**Alternatives considered**:

- **Author the policies pre-emptively in this feature's plan**: rejected per D7 (RLS authoring is an admin-feature concern) and per P3 (authoring policies that may already exist adds migration risk).
- **Skip verification and trust the upstream**: rejected — an explicit, cheap verification is the right belt-and-braces for a security-sensitive surface.

---

## Summary

All nine items resolved with MVP-appropriate decisions. No `NEEDS CLARIFICATION` carried into Phase 1. No schema bump. No new dependency. No new RLS. The feature is a UI-and-hooks composition on top of already-shipped data, sync, auth, and lock infrastructure.
