# Data Model — Home Dashboard & Empty States

**No new persisted entities.** Home is a read-only projection layer over state that 002 (data layer), 005 (sync), 006 (catalog), and 007 (clients) already own. This document specifies the projection DTOs and the additive extension to the sync-status snapshot.

---

## Additive extension — `SyncStatusSnapshot`

Owner: `src/features/sync/state/derive.ts` + `syncStatusStore.ts`.

### Before

```ts
export type SyncStatusSnapshot = { status: SyncStatus };
```

### After

```ts
export type SyncStatusSnapshot = {
  readonly status: SyncStatus;
  /**
   * Wall-clock ms of the last successful sync pass. `null` when no sync has
   * succeeded yet in this session (cold start, first login). NOT cleared on
   * sync failure — the most recent known-good timestamp is kept so the Home
   * pill can keep showing "há N h" even after an intermittent failure.
   */
  readonly lastOkAt: number | null;
};
```

**Backward-compat guarantee**: every current consumer destructures `{ status }` (`SyncStatusIndicator`, the one catalog test). Adding `lastOkAt` as a new readonly field does not break any destructure, any test, or any TypeScript structural-typing consumer.

### `InternalState` change

Adds `_lastOkAt: number | null`. `initialState()` seeds `null`. `__resetForTests()` restores `null`. `_internalSyncStatusStore.setLastOkAt(ms)` is an additive internal mutator. `setLastOutcome('ok')` stamps `Date.now()` into `_lastOkAt` before `recompute()`.

---

## Projection DTOs (pure, in-memory)

Owner: `src/features/home/`. These are derived values used by `HomeScreen` and its presentational children. None is persisted. None crosses the feature boundary.

### `HomeSnapshotDTO`

Composed inside `HomeScreen` from the four summary hooks + `useSession` + `useSyncStatus`. Consumers: only `HomeScreen` itself and its subcomponents via props.

```ts
type HomeSnapshotDTO = {
  readonly greetingName: string | null;         // from deriveGreetingName(useSession().email)
  readonly sync: SyncPillStateDTO;              // from useSyncStatus() + formatRelativeSyncAge
  readonly catalog: { count: number };           // from useCatalogSummary()
  readonly clients: { count: number };           // from useClientsSummary(salespersonId)
  readonly drafts: { count: number };            // from useDraftsSummary() — placeholder until 009
  readonly recentActivity: RecentActivityDTO | null; // from useLastSentOrder() — placeholder until 009
};
```

### `SyncPillStateDTO`

```ts
type SyncPillStateDTO =
  | { readonly kind: 'in-sync'; readonly ageLabel: string }   // "há 2 min" | "agora" | "há 3 h" | "há 1 d"
  | { readonly kind: 'syncing' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'failed' };
```

Derived via:

```text
if syncStatus === 'in-sync' && lastOkAt !== null → kind: 'in-sync', ageLabel = formatRelativeSyncAge(now - lastOkAt)
if syncStatus === 'in-sync' && lastOkAt === null → kind: 'syncing' (semantic fallback — user has not seen a success yet)
if syncStatus === 'syncing' → kind: 'syncing'
if syncStatus === 'offline' → kind: 'offline'
if syncStatus === 'failed'  → kind: 'failed'
```

### `RecentActivityDTO`

```ts
type RecentActivityDTO = {
  readonly storeName: string;       // client.name of the order's client
  readonly totalCentsAmount: number; // computed from order + order_items; rendered as "R$ 1.284,50"
  readonly sentAtMs: number;        // wall-clock when the order status became 'sent'
};
```

Today: `useLastSentOrder()` always returns `null` — `RecentActivityCard` renders the empty dashed placeholder. When 009-orders lands, `useLastSentOrder()` returns the real DTO and the card switches to the populated variant without any other code change.

### `QuickActionCardDTO`

Not a runtime type — it's the shape of props `HomeScreen` passes to each `QuickActionCard`. Listed here to fix the visual contract.

```ts
type QuickActionCardDTO = {
  readonly title: 'Catálogo' | 'Clientes' | 'Rascunhos';
  readonly populated: {
    readonly subtitle: string;               // "324 produtos disponíveis" etc.
    readonly badge?: number;                 // only Drafts uses this; hidden when 0
    readonly onPress: () => void;            // navigates to destination
  } | null;                                  // null when empty-state is active
  readonly empty: {
    readonly title: string;                  // "Seu catálogo ainda está vazio"
    readonly subtitle: string;               // "Assim que a sincronização terminar, os produtos aparecem aqui."
    readonly cta?: {                         // absent for the drafts card per FR-014
      readonly kind: 'primary' | 'secondary';
      readonly label: string;                // "Sincronizar agora" / "Nova loja"
      readonly onPress: () => void;
    };
  };
};
```

The `populated` field is non-null when the count > 0 (Catálogo, Clientes) or when the count > 0 (Drafts) AND `useDraftsSummary` returns a positive count. For the drafts card, because the placeholder always returns 0, the empty variant is what renders today; the swap-in from 009 will naturally start rendering the populated variant when drafts exist.

---

## Placeholder hook contracts

Locked by unit tests (see plan §Testing). The shapes are the final shapes; only the bodies change in 009.

### `useDraftsSummary(): { count: number }`

- v1 body: `return { count: 0 };`
- future body: observes `ordersRepository.observeByStatus('draft', salespersonId)` and returns its length.

### `useLastSentOrder(): RecentActivityDTO | null`

- v1 body: `return null;`
- future body: observes `ordersRepository.observeLastSent(salespersonId)` joined with the client's name and the line-items total; maps to `RecentActivityDTO`.

A migration comment lives at the top of each file naming 009 as the swap-in feature.

---

## State lifecycle

- **Cold start (seller)**: `lastOkAt = null`, every summary hook resolves to `{ count: 0 }` or `null`. Home renders the empty state; sync pill reads `syncing` (per R-001 rule: `in-sync + lastOkAt=null → syncing`).
- **After first successful pull (login-sync)**: `lastOkAt = Date.now()`, `useCatalogSummary().count` updates reactively as WatermelonDB receives rows. Pill transitions to `in-sync · agora`.
- **Active session, offline**: status becomes `offline`; `lastOkAt` is preserved; the pill shows `"Sem conexão"` without the age.
- **Active session, sync retry succeeds**: status back to `in-sync`; `lastOkAt` updated; pill shows the fresh age label.
- **App backgrounded / foregrounded**: no Home-specific state survives backgrounding; all values are re-derived from the stores on mount. No AsyncStorage persistence.

## Invariants

- Home NEVER writes to any repository or any Supabase table.
- The sync pill NEVER appears as a modal, toast, or full-screen spinner.
- Empty-state copy is centralized in a single string table per card component — a test asserts none of the strings contain any of: "erro", "falha", "null", "undefined", "sem dados" (FR-016 enforcement).
- Counters are read-through-local; they never query the network directly.
