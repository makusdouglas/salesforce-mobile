# Quickstart: Sync Engine

Three audiences: (a) the home screen that mounts the indicator and wires pull-to-refresh, (b) the future order-sending flow that calls `onOrderSent()` after `markSent()`, (c) a developer onboarding to the feature.

---

## (a) Home screen integration

**Goal**: show the always-on sync indicator in the header row, and let pull-to-refresh fire a sync pass.

### Step 1 — Wrap the app with `SyncProvider`

Done once in `src/app/providers/AppProviders.tsx`. `SyncProvider` goes inside `LockProvider` and `SessionProvider`:

```tsx
// src/app/providers/AppProviders.tsx
import { SessionProvider } from '@/features/auth'
import { LockProvider } from '@/features/lock'
import { SyncProvider } from '@/features/sync'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LockProvider>
        <SyncProvider>
          {children}
        </SyncProvider>
      </LockProvider>
    </SessionProvider>
  )
}
```

This mounts the login trigger and the NetInfo bridge. Nothing else.

### Step 2 — Mount the indicator in the home header

```tsx
// src/features/home/screens/HomePlaceholderScreen.tsx
import { SyncStatusIndicator } from '@/features/sync'
// ...
<View style={styles.header}>
  <Text style={styles.title}>Home</Text>
  <SyncStatusIndicator style={{ marginStart: 'auto' }} />
</View>
```

That's the entire UI integration. The component reads `useSyncStatus()` internally; nothing to pass.

### Step 3 — Wire pull-to-refresh

```tsx
// Same file
import { onPullToRefresh } from '@/features/sync'  // re-exported convenience

const [refreshing, setRefreshing] = React.useState(false)
const handleRefresh = React.useCallback(async () => {
  setRefreshing(true)
  try { await onPullToRefresh() }
  finally { setRefreshing(false) }
}, [])

return (
  <ScrollView
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
  >
    {/* home content */}
  </ScrollView>
)
```

`onPullToRefresh()` never rejects. The `try/finally` is for `setRefreshing(false)`, not for error handling.

### Verification

Run the app, log in. On a fresh session the indicator should:

1. Show `Sincronizando…` briefly after login.
2. Settle on `Dados em dia` once the first pass completes.
3. Toggle airplane mode → indicator becomes `Sem internet` within ~1 s.
4. Disable airplane mode → stays `Sem internet` until the silent refresh + next trigger fires; pulling down on Home forces a pass, indicator goes `Sincronizando…` → `Dados em dia`.

---

## (b) Order-sending flow integration *(future feature)*

**Goal**: after a quote email is sent and the order's status transitions to `sent`, opportunistically push it to the server.

```ts
// In the future order-sending flow
import { ordersRepository } from '@/data'
import { onOrderSent } from '@/features/sync'

async function sendQuote(orderId: string): Promise<void> {
  // 1. Generate PDF (R4 — local)
  const pdfUri = await generateOrderPdf(orderId)

  // 2. Open share sheet / email intent (R4)
  await shareOrderByEmail({ orderId, pdfUri })

  // 3. Commit the 'sent' transition locally (D4)
  await ordersRepository.markSent(orderId)

  // 4. Opportunistically sync if online (spec US4)
  onOrderSent()
}
```

Step 4 is synchronous. It never throws; it never blocks. If the device is offline, it's a no-op and the order will sync on the next natural trigger.

**Do NOT await `onOrderSent()`.** It's fire-and-forget.

---

## (c) Developer onboarding

### The mental model in three sentences

1. **WatermelonDB is the local data layer.** The sync feature is the *only* module that crosses the network with business data; UI reads only from the repositories.
2. **A sync pass is pull-then-push, wrapped by WatermelonDB's `synchronize()` helper.** Our adapters (`pullChanges`, `pushChanges`) translate between Supabase's REST shape and Watermelon's sync protocol.
3. **Conflicts are last-write-wins by `updated_at`, decided by a pure resolver.** The resolver is small, tested exhaustively, and is the single place that encodes P2.

### File map

```text
src/features/sync/
├── index.ts                              → the barrel; consume only from here
├── service/syncService.ts                → runSync(), onOrderSent(), the single-in-flight guard
├── service/errors.ts                     → SyncError
├── state/syncStatusStore.ts              → the singleton status store
├── state/derive.ts                       → pure deriveStatus(internalState) → SyncStatus
├── supabase/pullChanges.ts               → reads from Supabase, maps to Watermelon shape
├── supabase/pushChanges.ts               → writes to Supabase from Watermelon's changeset
├── supabase/mappers.ts                   → per-table Postgres ↔ Watermelon mapping
├── protocol/runPass.ts                   → wires pullChanges + pushChanges + conflictResolver into synchronize()
├── protocol/conflictResolver.ts          → pure LWW
├── triggers/loginTrigger.ts              → sessionStore subscriber
├── triggers/pullToRefreshTrigger.ts      → home-screen gesture wrapper
├── triggers/orderSentTrigger.ts          → public onOrderSent() hook
├── connectivity/netinfoBridge.ts         → NetInfo → syncStatusStore._online
├── hooks/useSyncStatus.ts                → useSyncExternalStore over the public store
├── components/SyncProvider.tsx           → lifecycle owner
├── components/SyncStatusIndicator.tsx    → the four-state inline component
└── tests/...                             → unit tests
```

### How to add a new synced table *(if ever)*

1. Add the table to the WatermelonDB schema (`src/data/schema/tables.ts`), with the four sync-readiness columns.
2. Add a Postgres table on the Supabase side with `updated_at` + `deleted_at` + the `set_updated_at` trigger (see `contracts/supabase-schema.md`).
3. Add a mapper in `src/features/sync/supabase/mappers.ts`.
4. Reference the table in `pullChanges.ts` (the table-iteration list) and in `pushChanges.ts` (the parent-before-child order).
5. Add a test that exercises the new mapper.

Keep the seven-entity constitution rule (R2) in mind — we shouldn't add tables lightly.

### How to debug a failing pass

1. Check the status indicator — `Falha ao sincronizar` confirms a failure reached the status store.
2. Check the DEV console for `[sync]` log lines — the pass logs phase transitions (`pull:start`, `pull:end`, `push:start`, `push:end`) and the error code on failure.
3. The most common failure modes are:
   - **AUTH_REJECTED** — the refresh token was rejected. `authService.refresh()` is about to flip the session to `RequiresRelogin`; re-login to fix.
   - **PULL_REJECTED** / **PUSH_REJECTED** — Supabase returned a non-2xx. Typical cause: RLS policy change server-side. The dev log includes the offending row's `server_id`.
   - **NETWORK** — transient. Pull-to-refresh on Home to retry.
4. Local data is always preserved across failures (SC-005). If you suspect data loss, the first thing to check is whether the failure actually happened (indicator at `Falha`) vs. a UI bug making you think data is missing.

### How to test locally *(without a Supabase round trip)*

- **Conflict resolver**: pure function, no setup — unit test directly.
- **Status store**: import the store, drive setters, assert snapshot — no React needed.
- **`runSync` coalesce semantics**: mock `runPass` to return a delayed promise; fire three `runSync` calls in rapid succession; assert one in-flight pass + one follow-up.
- **Pull/push adapters**: mock the Supabase client (`from(...).select(...)` / `.upsert(...)`) using the existing `@/data` test doubles; assert the adapters shape requests and responses correctly.

Manual integration testing against the dev Supabase project is required for the happy path — fresh login, first pull, create an order locally, mark it sent, observe it in the admin dashboard. The disposable dev salesperson account is fine for this.

---

## Cheatsheet: consuming the sync feature

```ts
// Read status anywhere in the tree
const { status } = useSyncStatus()  // 'in-sync' | 'syncing' | 'offline' | 'failed'

// Render the indicator (home screen only, per FR-013 / FR-018)
<SyncStatusIndicator />

// Fire pull-to-refresh (home screen only)
await onPullToRefresh()

// Fire an opportunistic sync after marking an order sent (future order flow)
syncService.onOrderSent()
```

Four lines cover 100% of the public surface.
