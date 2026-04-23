# Quickstart — Home Dashboard & Empty States

How the pieces fit together once 008 ships, plus the concrete steps to demo each state on a simulator.

## Navigation entry

```
App → (cold start) → AuthStack (if not signed in)
                   → HomeStack
                       → HomePlaceholder  (route name preserved; component is HomeScreen)
                           ├── Catalog                       (tap Catálogo card)
                           ├── Clients                       (tap Clientes card)
                           ├── ClientForm                    (tap empty-state "Nova loja" CTA)
                           ├── Settings                      (tap gear icon in HomeTopBar)
                           │     ├── inactivity-timeout segmented control
                           │     ├── logout
                           │     └── [__DEV__] DataLayerSmoke, DatabaseInspector
                           └── (sync retry)                  (tap sync pill when in 'failed' state)
```

`HomeScreen` is the entry point for every seller session — the gate is `<LockGate>` (004) → `HomeStack` → `HomePlaceholder`.

## How Home composes existing state

```
HomeScreen
  └── HomeTopBar
        ├── "Início" title
        ├── HomeSyncPill
        │     └── useSyncStatus() .status + .lastOkAt
        │           (sync store extended in this feature)
        │     └── formatRelativeSyncAge(now - lastOkAt)
        └── gear icon → navigation.navigate('Settings')
  └── GreetingBlock
        ├── deriveGreetingName(useSession().email)
        └── subtitle (populated vs. empty-world variant)
  └── QuickActionCard × 3
        ├── Catálogo
        │     populated: { count = useCatalogSummary() }
        │     empty: CTA triggers onPullToRefresh() (no navigation)
        ├── Clientes
        │     populated: { count = useClientsSummary(salespersonId) }
        │     empty: CTA → ClientForm
        └── Rascunhos
              populated: { count = useDraftsSummary() }   (placeholder → always 0)
              empty: no CTA (inert by spec)
  └── RecentActivityCard
        populated: useLastSentOrder() → RecentActivityDTO  (placeholder → always null)
        empty: DashedPlaceholderCard
```

## How to demo each state on a simulator

### A — Fully populated

1. Sign in with a seeded seller account.
2. Wait for the first sync to complete (catalog pulls in).
3. Register at least one client via `/Clients/ClientForm`.
4. (Once 009 ships) Create and send one order.
5. Return to Home → pill reads "Sincronizado · há N min"; all three cards show counts; Atividade Recente shows the last sent order.

### B — First-run empty world

1. Reset the simulator database (Settings → DB Inspector → Reset, or reinstall).
2. Sign in; do NOT wait for sync to finish.
3. Observe: pill reads "Sincronizando…" (lastOkAt is null → forced to syncing kind).
4. Three cards render their empty variants; each (except Drafts) offers a CTA.
5. Atividade Recente is the dashed placeholder.

### C — Offline mid-session

1. Start from state A.
2. Toggle airplane mode.
3. Pill flips to "Sem conexão" without any modal or toast.
4. Counts remain (local reads).

### D — Sync failure with retry

1. Start from state A.
2. Force a failure via `_internalSyncStatusStore.setLastOutcome('failed')` (dev build).
3. Pill reads "Falha ao sincronizar — tocar para tentar" in red.
4. Tap the pill → `onPullToRefresh()` fires → pill transitions to "Sincronizando…" → "Sincronizado" on success.

### E — Tablet layout

1. Launch the iPad simulator.
2. Observe: quick actions render in a two-column grid (Catálogo | Clientes on row 1, Rascunhos | spacer on row 2); recent activity card is wider with a bigger icon.

## When 009-orders lands

1. 009 adds `ordersRepository.observeByStatus(status, salespersonId)` and `observeLastSent(salespersonId)` on the existing 002 repository surface.
2. 009 rewrites the bodies of `useDraftsSummary` and `useLastSentOrder` in `src/features/home/hooks/` to observe the new repo methods.
3. 009 updates `src/features/home/tests/useDraftsSummary.test.ts` and `useLastSentOrder.test.ts` from "locked placeholder" assertions to real behavioral assertions.
4. 009 wires the Rascunhos card's populated `onPress` and the RecentActivityCard's populated `onPress` to the orders-feature routes.
5. No other file in Home needs to change. `HomeScreen`, the components, `HomeTopBar`, `HomeSyncPill`, etc. all stay as they are.

## Sanity-check commands

```bash
# run home unit tests only
npm test -- src/features/home

# run sync-store tests (catches lastOkAt regression)
npm test -- src/features/sync/state

# type-check the whole app
npx tsc --noEmit

# start the phone simulator
npx expo start --ios

# start the iPad simulator
npx expo start --ios -- --simulator "iPad (11-inch)"
```
