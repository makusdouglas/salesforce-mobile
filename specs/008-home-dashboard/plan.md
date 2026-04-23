# Implementation Plan: Home Dashboard & Empty States

**Branch**: `008-home-dashboard` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-home-dashboard/spec.md`

## Summary

Replace `HomePlaceholderScreen` with the hub dashboard defined in `design/screens.md` (four Pencil frames: Home / HomeEmpty × phone / tablet). Home becomes a self-contained feature module under `src/features/home/` that composes state from modules already in the tree — `useSyncStatus` (005) plus a **new `lastOkAt` snapshot field**, `productsRepository.observeAll()` (006), `clientsRepository.observeByOwner()` (007), and new **placeholder hooks for drafts + last-sent-order** that the future orders feature (009) will replace behind the same interface. No Supabase schema change, no new native module, no new dependency.

The spec requires the sync pill to show "Sincronizado · há N min" when synced — the existing `SyncStatusIndicator` (dot-only on phone, dot + fixed label on tablet) does not carry a timestamp. We extend `syncStatusStore` with one additive internal field (`_lastOkAt: number | null`) stamped when `runPass` reports `ok`, expose it via the snapshot, and build a **new local `HomeSyncPill` component** that consumes it. `SyncStatusIndicator` continues to serve catalog / clients headers unchanged — the pill is a Home-specific flavor (full pill shape, "há N min" derivation, amber "Sincronizando…", red "Falha ao sincronizar — tocar para tentar" with a retry tap), not a replacement. The existing `SyncStatusIndicator` is deliberately NOT modified — two surface shapes for two contexts, P3 says duplicate before abstracting.

Quick-action cards consume lightweight summary hooks local to this feature: `useCatalogSummary()` → `{ count }` over `productsRepository.observeAll()`; `useClientsSummary(salespersonId)` → `{ count }` via `clientsRepository.observeByOwner(salespersonId)` + `useActiveSalespersonId` (reused from 007 via barrel import); `useDraftsSummary()` → `{ count }` — **placeholder implementation returning `{ count: 0 }`** until orders ship. `useLastSentOrder()` returns `null` as a placeholder today. Both placeholder hooks live under `src/features/home/summaries/` with a one-line comment pointing at the future swap-in; this is deliberately not a shared abstraction behind a context, because there are zero consumers besides Home.

The evicted settings content from `HomePlaceholderScreen` (inactivity-timeout segmented control + logout) moves to a new `SettingsScreen` on `HomeStack`, reached via a gear icon in the Home top bar (next to the sync pill). This keeps Home a clean hub per UX3 while preserving user access to the two affordances that already shipped. `NewOrder` routing from the Drafts card is not wired yet — in empty state the card is intentionally inert per spec FR-014; the populated-state tap target is a forward-reference no-op until orders ship.

**Infrastructure spillover — `ConfirmModal` primitive.** Spec FR-005 ("no modal/alert/toast/spinner for sync") cannot be enforced while the app still uses the OS `Alert.alert` anywhere, because the static no-modal test for Home would fail on any file that imports `Alert` — including a faithful relocation of the existing logout confirmation. Rather than narrow the test with an allowlist, 008 lands a single cross-cutting `ConfirmModal` primitive at `src/app/ui/modal/` and migrates both existing `Alert.alert` call sites: (a) logout confirm relocates to `SettingsScreen` using the new component; (b) `CatalogScreen.tsx:35`'s "Sem internet" alert is DELETED — the inline sync pill's "Sem conexão" state carries the signal per constitution UX4, and the offline branch in `handleSyncPress` becomes a no-op. Two fresh Pencil frames (`ConfirmModal / Phone` `zwiuM`, `ConfirmModal / Tablet` `Lasp4`) ship as the canonical design reference. The primitive is a single component that covers both two-button destructive confirm and single-button info shapes (info = `cancelLabel` undefined); it is NOT a global provider and does not add a new dependency. Spec.md is intentionally NOT updated — this is scaffolding surfaced by 008's needs; the user-visible surface remains what the spec describes.

Responsive strategy: a new local `useViewport()` returning `'phone' | 'tablet'` at 768 pt (duplicated from catalog/clients per P3 — extraction deferred until a fourth consumer). Home renders a single component (`HomeScreen`) whose layout branches inline: single-column stacked cards on phone, two-column quick-action grid + expanded recent-activity on tablet. No separate tablet component, no split-pane — the Pencil frames are layout variants of the same content tree.

## Technical Context

**Language/Version**: TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (inherited from 001–007).

**Primary Dependencies**:

- `@nozbe/watermelondb` — already installed (002). Home reads via `productsRepository.observeAll()`, `clientsRepository.observeByOwner()`, and (once orders ships) `ordersRepository.observeLastSent()`; no writes.
- `@react-navigation/native-stack` — already installed (001). One new route `Settings` added to `HomeStack`. `HomePlaceholder` route is kept as a compatibility alias that mounts the new `HomeScreen` (renaming the route would break deep links and the Relogin return path; only the component changes). See Phase 0 R-002.
- `@/features/sync` — existing 005 store, extended with one additive snapshot field (`lastOkAt`). No change to `runPass` surface; `_internalSyncStatusStore.setLastOutcome('ok')` is augmented with `setLastOkAt(Date.now())`.
- `@/features/auth` — reuses `useSession()` for the greeting name (`email.split('@')[0]` as a minimal heuristic — no schema change) and `authService.logout()` in `SettingsScreen`.
- `@/features/lock` — reuses `lockService.getInactivityTimeout()` / `setInactivityTimeout()` in `SettingsScreen`.
- `@/features/clients` — reuses the already-exported `useActiveSalespersonId` (007) for the clients count scope.
- `@/data` — existing `productsRepository`, `clientsRepository`. `ordersRepository` is referenced by the *placeholder* `useLastSentOrder` hook only as a future import; today the hook returns `null` without touching the repo (no dependency on orders-feature state).
- No new npm package. No new Expo module.

**Storage**:

- **No new entity.** All reads go through existing repositories.
- **Sync store extension** — `InternalState` gains `_lastOkAt: number | null`, stamped on successful sync pass, reset to `null` on `__resetForTests`. Snapshot exposes `lastOkAt: number | null` alongside `status`. Additive and backward-compatible with every current consumer (SyncStatusIndicator ignores the new field).
- **No draft persistence.** Drafts count is `0` until orders ships. The placeholder hook is a pure constant — no memoization, no store.

**Testing**: Constitution §9 — business-logic coverage first. Unit tests ship for:

1. **Relative-time formatter** (`formatRelativeSyncAge.test.ts`): `< 60 s → "agora"`, `1–59 min → "há N min"`, `1–23 h → "há N h"`, `24 h+ → "há N d"`; stable input → stable output (no `Date.now()` inside, caller supplies `nowMs`).
2. **Sync store last-ok timestamp** (`syncStatusStore.lastOkAt.test.ts`): `setLastOutcome('ok')` stamps `lastOkAt`; `setLastOutcome('failed')` does not clear prior value (the pill should keep showing "há N h" even after a failure, per spec edge case "very old sync"); `__resetForTests` clears it; snapshot is referentially stable when nothing changed.
3. **Catalog summary** (`useCatalogSummary.test.ts`): count is `0` when repo is empty; count reflects repository additions; observation unsubscribes on unmount.
4. **Clients summary** (`useClientsSummary.test.ts`): count is `0` when salespersonId is null (bootstrap gap — same pattern as clients list); count equals `observeByOwner` result length otherwise.
5. **Drafts placeholder** (`useDraftsSummary.test.ts`): always returns `{ count: 0 }`. Test exists to lock the placeholder contract so the swap-in from 009 cannot silently change shape.
6. **Last-sent-order placeholder** (`useLastSentOrder.test.ts`): always returns `null`. Same contract-lock rationale as above.
7. **Greeting name derivation** (`deriveGreetingName.test.ts`): `"markus@acme.com" → "markus"`; `null → null` (fallback is "Olá" without a name); unicode preserved; no network call.

UI verification is manual against the four Pencil frames on a phone simulator (390 × 844) and an iPad simulator (820 × 1180), covering the four combinations of populated / empty catalog × populated / empty clients × populated / empty drafts × populated / empty recent-activity (total 16 combinations — the spec's acceptance scenarios reduce to a walkthrough of 4 representative paths that exercise every visual).

**Target Platform**: iOS 13+ and Android 7+ (inherited). No platform-specific API.

**Project Type**: Mobile app — pure feature-module evolution on top of 001–007. No backend code. No Supabase schema change. No RLS change.

**Performance Goals**:

- Home first-fold renders under 500 ms on cold start on both baseline viewports, measured against a local DB pre-seeded with 300 products + 50 clients + 10 sent orders. Achieved by reading from three existing observations (products, clients, orders) that 005/006/007 already benchmarked inside budget.
- Counters update within 2 s of a repository change without requiring the user to leave Home (SC-006). Achieved by keeping observations live while Home is focused (React Navigation's `useFocusEffect` is NOT used here — the observations persist across focus changes because the count is also useful to a future "badge on the tab bar"; Home simply re-renders when the count changes).
- Zero modal / toast / spinner on any sync state transition (SC-003). Achieved by the `HomeSyncPill` being the ONLY sync-visual surface on Home; no code path from sync triggers to Home calls `Alert.*` or opens a modal.

**Constraints**:

- **Offline-first (P1)**: every surface on Home reads from WatermelonDB. No network call initiated by Home itself. The pill reflects state produced by 005's existing triggers.
- **No scroll on reference phone viewport (FR-020, SC-007)**: Home content in both populated and empty states fits 844 pt minus safe-area and top bar. The HomeEmpty / Phone frame already confirms this — the verified screenshot renders top bar + greeting + 3 cards + recent-activity row in 844 pt. Implementation uses a non-scrolling root `View`; no `ScrollView`. If a future content addition breaks the budget, that is a spec change, not a layout patch.
- **Role visibility (UX6 / D7)**: Home sits on `HomeStack`, which is the VENDEDOR navigation surface. Admin-only users do not see `HomeStack` (enforced by the future 013 dual-role navigator). No additional role gate is added here.
- **Portrait-only (UX5)**: landscape is out of scope; `app.json` already locks orientation (inherited).
- **Language (constitution §9)**: English identifiers; Portuguese user-visible copy, centralized in the screen and card components.

**Scale/Scope**:

- **~14 new source files + 7 unit-test files** under `src/features/home/`, plus **3 new files under `src/app/ui/modal/`** (the `ConfirmModal` primitive + type barrel + one unit test). Breakdown: 2 screen components (`HomeScreen`, `SettingsScreen`), 6 presentational components (`HomeSyncPill`, `GreetingBlock`, `QuickActionCard`, `RecentActivityCard`, `HomeTopBar`, `DashedPlaceholderCard`), 4 summary hooks (`useCatalogSummary`, `useClientsSummary`, `useDraftsSummary`, `useLastSentOrder`), 1 greeting derivation module (`deriveGreetingName.ts`), 1 relative-time formatter (`formatRelativeSyncAge.ts`), 1 local viewport hook (`useViewport.ts`), 1 barrel `index.ts`. Test files listed under Testing above.
- **3 existing files edited** — `src/features/sync/state/derive.ts` (adds `lastOkAt` to exported snapshot type), `src/features/sync/state/syncStatusStore.ts` (adds `_lastOkAt` internal field + `setLastOkAt` internal mutator, stamps on `setLastOutcome('ok')`), `src/features/sync/protocol/runPass.ts` (calls the new mutator on the success path). These are additive — nothing existing is removed.
- **2 navigation files edited** — `src/app/navigation/HomeStack.tsx` (swaps `HomePlaceholderScreen` → `HomeScreen` for route `HomePlaceholder`; registers new `Settings` route), `src/app/navigation/types.ts` (adds `Settings: undefined` to `HomeStackParamList`).
- **1 existing file edited by the modal migration** — `src/features/catalog/screens/CatalogScreen.tsx` (deletes the `Alert.alert` offline notice at `:35`; offline branch in `handleSyncPress` becomes a no-op; removes the `Alert` import if nothing else references it).
- **1 existing file deleted** — `src/features/home/screens/HomePlaceholderScreen.tsx` is removed; its content either moves to `SettingsScreen` (inactivity-timeout segment, logout) or is absorbed by `HomeScreen`.
- **0 package changes**.
- **0 Supabase-side operational changes**.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | Home reads exclusively from WatermelonDB and the sync-status store (local). No network call is initiated by Home. The sync pill reflects existing state; tapping it in the failed state triggers 005's existing retry — not a new network path authored here. |
| P2 Local DB is source of truth | ✅ | Pass | Counters and recent-activity derive from local observations. No parallel "what the server says" surface exists on Home. |
| P3 MVP simplicity | ✅ | Pass | No new library. No new entity. `HomeSyncPill` is a second visual of sync status, deliberately duplicated from `SyncStatusIndicator` rather than generalized — P3 "simpler option SHOULD be chosen and the reason documented". `useViewport` duplicated from catalog/clients per the same rule. Drafts + last-sent-order are placeholder hooks, not a premature abstraction. |
| P4 Reuse free tools | ✅ | Pass | No admin UI added. Supabase dashboard remains the admin surface. |
| P5 Salesperson data is sacred | ✅ | Pass | Home is read-only from the user's perspective. No data can be lost through this feature — it only surfaces what 005/006/007 already persisted. |
| P6 Admin is online-first | N/A | — | This feature is VENDEDOR-only. No admin screens, no `src/features/admin/` code. |
| §3 Mandatory — Expo managed + dev client | ✅ | Pass | No new native module. No dev-client change. |
| §3 Mandatory — WatermelonDB | ✅ | Pass | All reads through existing repositories. |
| §3 Mandatory — Supabase | N/A | — | No direct Supabase call. |
| §3 Mandatory — PDF / secure-store / local-auth / image libs | N/A | — | Not touched. |
| §3 Forbidden — custom backend / Firebase / heavy state mgmt | ✅ | Pass | No backend. No Firebase. Summary hooks are thin `useSyncExternalStore`-style wrappers over existing observations. No Redux, no MobX, no Zustand. |
| §3 Forbidden — heavy UI libraries | ✅ | Pass | RN core + existing shadcn-neutral visual language. No new UI lib. |
| R1 WatermelonDB is the single client data layer (VENDEDOR) | ✅ | Pass | All reads go through existing 002 repositories. No direct Supabase call from Home. |
| R2 Seven entities | ✅ | Pass | No new entity. Uses existing `products`, `clients`, `orders` (read-only). |
| R3 Images in Storage + local cache | N/A | — | No images in this feature. |
| R4 PDF local, email via share sheet | N/A | — | Not touched. |
| R5 Discounts on order, not catalog | N/A | — | Not touched. |
| §5 UX1 Tap, not type | ✅ | Pass | Every Home action is a tap. No text input exists on Home. |
| §5 UX2 Repeat previous order | N/A | — | Belongs to the future orders feature. "Atividade recente" references the last sent order for awareness; re-order is out of scope. |
| §5 UX3 Useful empty states | ✅ | Pass | This feature is the canonical implementation of UX3. Four independent empty states (no catalog, no clients, no drafts, no recent activity) each with salesperson-language copy captured in `design/screens.md` and enforced by the copy-blocklist test (see Phase 1). |
| §5 UX4 Discreet sync feedback | ✅ | Pass | `HomeSyncPill` is inline only. FR-005 (no modal/toast/spinner) is enforced by the pill being the only sync-visual on Home and by an explicit test asserting no `Alert.*` call path from sync triggers to Home. |
| §5 UX5 Phone AND tablet layouts | ✅ | Pass | Four Pencil frames ship in `design/` for this feature (phone + tablet × populated + empty). `useViewport()` switches the single `HomeScreen` between layouts inline. |
| §6 D1 Pull then push | N/A | — | Sync belongs to 005. Home only reflects state. |
| §6 D2 Catalog read-only in app | N/A | — | Not modified; Home only shows the count. |
| §6 D3 Admin-side merge for duplicates | N/A | — | Not touched. |
| §6 D4 Simple order statuses | N/A | — | Atividade Recente reads statuses when they arrive, but renders only the "sent" status for v1 (last sent order) — no status surface added. |
| §7 D5 Online-one-time + offline-persistent | ✅ | Pass | No auth work in this feature. |
| §7 D6 Mandatory local lock | ✅ | Pass | `HomeStack` is gated by `<LockGate>` (inherited). `SettingsScreen` houses the lock timeout control (relocated from the old placeholder home). |
| §7 D7 Role-based authorization | ✅ | Pass | See Role & Authorization below. No role-guarded surface is introduced or modified. |
| §9 English identifiers | ✅ | Pass | New files / types / functions / components all English. Portuguese only in user-visible strings, centralized in screen and card components. |

**Gate status (pre-research)**: PASS. Zero principle violations. No Complexity Tracking entries needed.

## Role & Authorization Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Does this feature expose or touch role-guarded surfaces?** No. Home reads from WatermelonDB only; it does not write to any RLS-covered table, introduces no admin screen, and ships no Edge Function. The feature is entirely VENDEDOR-surface, read-only.

N/A (no role-guarded surfaces). No RLS policy change. No Edge Function. No service_role usage. Offline classification: **offline-first** (reads only). Dual-role users who also hold the `admin` role see the VENDEDOR Home from the seller tab; the future 013 dual-role navigator mounts this feature unchanged.

## Design Prerequisite

*GATE: Must pass before any implementation task is generated.*

**Does this feature have a UI?** Yes. `spec.md` ships a `## UI Design` section pointing at four Pencil frames.

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | Single `HomeScreen` (layout-branches inline) + a subordinate `SettingsScreen`. |
| `design/screens.md` exists | ✅ | Authored by `/speckit-pencil-design` before `/speckit-specify`. |
| Phone frames cover all screens | ✅ | `XmxN2` (Home populated) + `yHNTP` (HomeEmpty) cover every state on phone. `SettingsScreen` is a subordinate maintenance screen that does not require its own Pencil frame per the Design Prerequisite rule (the spec does not list it as a user-visible story — it only exists to host the two evicted controls). |
| Tablet frames cover all screens | ✅ | `czxzV` (Home populated) + `IvIBz` (HomeEmpty). Same rationale for `SettingsScreen`. |
| Responsive strategy documented below | ✅ | Local `useViewport()` returns `'phone' \| 'tablet'` at 768 pt. `HomeScreen` reads once, branches inline: single-column stack on phone, two-column quick-action grid + expanded recent-activity on tablet. Same pattern as catalog / clients. |

**Consequence**: tasks.md Phase 0 does NOT need to block on `/speckit-pencil-design` — the frames already exist. Implementation tasks can start immediately after Setup.

## Project Structure

### Documentation (this feature)

```text
specs/008-home-dashboard/
├── plan.md                                 # This file
├── spec.md                                 # Feature specification
├── research.md                             # Phase 0 — four research items: sync-store lastOkAt ergonomics, HomePlaceholder route-rename vs in-place swap, relative-time thresholds vocabulary, settings eviction location
├── data-model.md                           # Phase 1 — no new entities; documents the Home projection shapes (HomeSnapshotDTO, SyncPillStateDTO, RecentActivityDTO) and the contract of the placeholder hooks
├── quickstart.md                           # Phase 1 — how HomeStack mounts HomeScreen, how SettingsScreen replaces the old placeholder affordances, how to seed a representative home state for a simulator demo, how 009-orders will swap the drafts + last-sent-order placeholders
├── contracts/
│   ├── home-surface.md                     # Public surface of the feature barrel: HomeScreen, SettingsScreen, route param types
│   ├── sync-pill.md                        # HomeSyncPill state machine (in-sync+age / syncing / offline / failed+retry), tap semantics, relative-time thresholds
│   ├── summary-hooks.md                    # useCatalogSummary / useClientsSummary / useDraftsSummary / useLastSentOrder contracts, including the placeholder swap-in protocol for 009
│   └── sync-store-extension.md             # Additive lastOkAt contract — snapshot shape before/after, backward-compat guarantee for SyncStatusIndicator consumers
├── checklists/
│   └── requirements.md                     # Spec quality checklist (from /speckit-specify)
├── design/
│   ├── screens.md                          # Pencil design summary (already authored)
│   ├── home-phone.png                      # XmxN2 (populated)
│   ├── home-empty-phone.png                # yHNTP
│   ├── home-tablet.png                     # czxzV
│   └── home-empty-tablet.png               # IvIBz
├── design.json                             # Pencil pointer file (already authored)
└── tasks.md                                # Phase 2 — /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

The feature expands `src/features/home/` from a single placeholder screen into a real module. Exactly two files outside the feature folder are edited: `src/app/navigation/HomeStack.tsx` (swaps the component behind `HomePlaceholder`, registers `Settings`) and `src/app/navigation/types.ts` (adds `Settings: undefined`). Three sync-module files are edited additively (`derive.ts`, `syncStatusStore.ts`, `protocol/runPass.ts`).

```text
.
└── src/
    ├── app/
    │   ├── navigation/
    │   │   ├── HomeStack.tsx                          # MODIFIED — swaps HomePlaceholderScreen → HomeScreen for route 'HomePlaceholder'; adds route 'Settings'
    │   │   └── types.ts                               # MODIFIED — adds Settings: undefined to HomeStackParamList
    │   └── ui/
    │       └── modal/
    │           ├── index.ts                           # NEW — barrel exporting ConfirmModal + ConfirmModalProps
    │           ├── ConfirmModal.tsx                   # NEW — single component covering destructive-confirm + info shapes; consumes RN <Modal transparent> + styled card per design/modals/confirm-modal-{phone,tablet}.png; calls deriveConfirmModalShape for button-count + colors
    │           ├── shape.ts                           # NEW — pure deriveConfirmModalShape({cancelLabel, primaryVariant}) → {showCancel, primaryFill, primaryTextColor}; no React imports
    │           └── tests/
    │               └── shape.test.ts                  # NEW — pure-function tests of deriveConfirmModalShape covering destructive/default variants and cancel-visibility
    ├── features/
    │   ├── sync/
    │   │   ├── state/
    │   │   │   ├── derive.ts                          # MODIFIED — adds lastOkAt: number | null to exported SyncStatusSnapshot
    │   │   │   └── syncStatusStore.ts                 # MODIFIED — adds _lastOkAt: number | null to InternalState + setLastOkAt mutator; stamps Date.now() on setLastOutcome('ok')
    │   │   └── protocol/
    │   │       └── runPass.ts                         # MODIFIED — calls _internalSyncStatusStore.setLastOkAt(Date.now()) on successful pass
    │   └── home/
    │       ├── index.ts                                # NEW — public barrel: HomeScreen, SettingsScreen, route types
    │       ├── screens/
    │       │   ├── HomeScreen.tsx                      # NEW — top bar (GreetingBlock + sync pill + gear icon) + 3 QuickActionCard + RecentActivityCard; branches layout by useViewport()
    │       │   ├── SettingsScreen.tsx                  # NEW — hosts inactivity-timeout segmented control + logout button; reuses lockService + authService
    │       │   └── HomePlaceholderScreen.tsx           # DELETED — content redistributed to HomeScreen + SettingsScreen
    │       ├── components/
    │       │   ├── HomeTopBar.tsx                      # NEW — title "Início" + HomeSyncPill + gear icon (Pressable → navigation.navigate('Settings'))
    │       │   ├── HomeSyncPill.tsx                    # NEW — pill shape; renders dot + status label + (for in-sync) "· há N min"; amber / neutral / red variants; tap-to-retry in failed state
    │       │   ├── GreetingBlock.tsx                   # NEW — "Olá, <name>" (or "Bem-vindo, <name>" in empty-world state) + subtitle; name derived via deriveGreetingName
    │       │   ├── QuickActionCard.tsx                 # NEW — icon + title + subtitle + (optional) count badge + chevron; accepts an empty-state variant with a CTA slot
    │       │   ├── RecentActivityCard.tsx              # NEW — wraps a populated row or a DashedPlaceholderCard depending on useLastSentOrder() result
    │       │   └── DashedPlaceholderCard.tsx           # NEW — dashed-border card shell used for empty Drafts and empty Recent Activity
    │       ├── hooks/
    │       │   ├── catalogSummary.ts                   # NEW — pure deriveCatalogSummary(products) → { count }; no React
    │       │   ├── useCatalogSummary.ts                # NEW — thin hook: observes productsRepository.observeAll(); returns deriveCatalogSummary(state)
    │       │   ├── clientsSummary.ts                   # NEW — pure deriveClientsSummary(clients | null) → { count }; no React
    │       │   ├── useClientsSummary.ts                # NEW — thin hook: observes clientsRepository.observeByOwner(salespersonId); returns deriveClientsSummary(state)
    │       │   ├── useDraftsSummary.ts                 # NEW — PLACEHOLDER, always returns { count: 0 }; constant body → callable from Node
    │       │   ├── useLastSentOrder.ts                 # NEW — PLACEHOLDER, always returns null; constant body → callable from Node
    │       │   └── useViewport.ts                      # NEW — 'phone' | 'tablet' at 768 pt; duplicated from catalog per P3
    │       ├── snapshot/
    │       │   └── deriveHomeSnapshot.ts               # NEW — pure (session + sync + counts + recentActivity + nowMs) → HomeSnapshotDTO; composes deriveGreetingName, deriveSyncPillState, populated-vs-empty card DTOs
    │       ├── sync/
    │       │   ├── formatRelativeSyncAge.ts            # NEW — pure formatter ((ageMs, nowMs?) → "agora" | "há N min" | "há N h" | "há N d")
    │       │   └── deriveSyncPillState.ts              # NEW — pure ({status, lastOkAt, nowMs}) → SyncPillStateDTO; state-machine from contracts/sync-pill.md
    │       ├── greeting/
    │       │   └── deriveGreetingName.ts               # NEW — pure (email | null) → first-name | null
    │       ├── responsive/
    │       │   └── breakpoints.ts                      # NEW — TABLET_MIN_WIDTH = 768 (duplicated per P3)
    │       └── tests/
    │           ├── formatRelativeSyncAge.test.ts       # NEW — pure
    │           ├── syncStatusStore.lastOkAt.test.ts    # NEW — sync store behavior; driven by Home's needs so colocated here
    │           ├── catalogSummary.test.ts              # NEW — pure (tests deriveCatalogSummary; hook reactivity is QA-only)
    │           ├── clientsSummary.test.ts              # NEW — pure (tests deriveClientsSummary; hook reactivity is QA-only)
    │           ├── useDraftsSummary.test.ts            # NEW — placeholder locks { count: 0 }
    │           ├── useLastSentOrder.test.ts            # NEW — placeholder locks null
    │           ├── deriveGreetingName.test.ts          # NEW — pure
    │           ├── deriveSyncPillState.test.ts         # NEW — pure (state-machine)
    │           ├── deriveHomeSnapshot.test.ts          # NEW — pure (composes the whole DTO; single source of shape truth for FR-018)
    │           └── copyBlocklist.test.ts               # NEW — static grep over copy.ts enforcing FR-016 blocklist
```

**Structure Decision**: The Home feature is organized around four architectural levers that match the shape of 006/007 and deliberately stay small:

1. **Three layers inside the feature**: presentation (`screens/`, `components/`), logic (`hooks/`, `sync/`, `greeting/`), and layout primitives (`responsive/`). Hooks reach outside the feature only into `@/data` (repositories) and `@/features/{sync,auth,lock,clients}` (via each module's barrel).

2. **Responsive strategy = local `useViewport()` hook + inline layout branches**. `useViewport()` returns `'phone' | 'tablet'` by comparing `useWindowDimensions().width` against `TABLET_MIN_WIDTH = 768`. `HomeScreen` reads the viewport once and branches inline — single-column stack on phone; two-column quick-action grid (Catálogo | Clientes on row 1, Rascunhos | spacer on row 2) + expanded recent-activity card on tablet. **`useViewport` and `breakpoints.ts` are duplicated from catalog / clients per P3.** Catalog → Clients → Home is the third duplication; the pre-approved extraction to `src/app/responsive/` from the clients plan now has an explicit trigger and SHOULD happen as a follow-up chore (NOT in this feature, to keep this feature's blast radius contained and to give the chore a focused PR).

3. **`HomeSyncPill` is a new visual surface, NOT a replacement for `SyncStatusIndicator`**. The two components serve different surfaces (Home's full pill vs. catalog/clients' dot-or-dot-plus-label). Both subscribe to the same `syncStatusStore`. Unifying them later is possible but not valuable today — the shared store is the real abstraction; the visual wrappers are intentionally thin and different per context.

4. **Placeholder hooks lock the contract for 009**. `useDraftsSummary` and `useLastSentOrder` return fixed values today but are already shaped like their future selves — future-009 will replace the body of each file and no Home component or test needs to change. The contract tests lock this.

5. **Tests are `ts-jest` + `testEnvironment: 'node'` — pure functions only.** The repo (001–007) ships a single Jest preset with no React renderer and no `testMatch` for `.tsx`. Rather than add `jest-expo` + `@testing-library/react-native` (three new dev deps, a new Jest config branch, a new surface to maintain — all to cover four render tests), 008 continues the established pattern: every hook that subscribes to a repository is paired with a pure helper (`deriveCatalogSummary`, `deriveClientsSummary`), and the helper is what gets tested. Screen-level behavior (reactivity within 2 s, visual conformance of the pill / modal / cards) is validated by QA on phone and tablet simulators in Phase 7. Same pattern 007 followed with `resolveActiveSalesperson` ↔ `useActiveSalespersonId`. Revisiting this decision is a separate feature if and when a future spec justifies the infra investment.

6. **`ConfirmModal` is cross-cutting infrastructure, landed at `src/app/ui/modal/`, NOT inside `src/features/home/`**. It has two consumers on day one (`SettingsScreen` for logout, and `CatalogScreen`'s offline path — which is being deleted, so the second consumer is implicit: the migration). A single styled component with declarative state (`<ConfirmModal open title ... onCancel onPrimary />`) is simpler than an imperative `showConfirm()` helper + provider; we land the smaller thing first and promote to a helper only when a third non-trivial call site arrives (P3 "rule of three").

**Rejected alternatives**:

- **Add `lastOkAt` to `SyncStatusIndicator` and render "· há N min" in the shared indicator** — considered and rejected. The existing indicator is used in headers where the extra text would cramp the layout (catalog header, clients header), and the design decision in `design/screens.md` scopes the timestamp to Home's full-pill surface only. Keeping the indicator's visual contract unchanged means zero risk to shipped screens.
- **Build drafts / last-sent-order summaries as hooks inside the future orders feature and import them from Home** — rejected because 009 doesn't exist yet, and the reverse dependency (Home → future orders) is easier than temporarily mocking at call sites. Today's placeholder body + comment is a cleaner handoff than an interface defined in a feature that isn't there. When 009 lands, it replaces the body; the Home barrel does not need to change.
- **Rename the existing `HomePlaceholder` route to `Home`** — considered. A rename reads better in code but has downstream effects: `src/features/lock/navigation` references the placeholder route (for post-unlock navigation), `src/features/auth` references it (for post-login navigation), and future deep-link URLs would shift. P3 says simpler: keep the route name, swap the component. One-line comment in `HomeStack.tsx` documents the intent.
- **Extract `HomeSyncPill` and `SyncStatusIndicator` into a shared `<SyncBadge variant="pill" | "dot">` component** — rejected by P3 and by the "rule of three": we have two call sites, not three. When (if) a third sync-visual lands, the extraction becomes proportionate.
- **Keep the inactivity-timeout segment and logout on Home under a collapsible "Mais" section** — rejected. UX3 / UX4 say Home is a hub; a settings accordion would clutter the hub and make the sync pill fight for attention. The gear-icon → SettingsScreen route costs one tap and keeps Home clean.
- **Make the empty Drafts card open a "start a new pedido" flow** — rejected. Drafts are produced as a side-effect of catalog interaction (per spec Assumption). A "Novo rascunho" button would create a dangling empty draft and misrepresent the data model. Empty card is inert by spec (FR-014).
- **Render "Atividade recente" as a scroll list capped at 3 items** — rejected. Spec says single item (FR-011). Growing later is a separate feature decision, not an implementation detail.
- **Use `useFocusEffect` to lazy-observe repositories only when Home is focused** — considered. Rejected because the counters also drive the spec's SC-006 ("counters update within 2 s without leaving Home") and because tab-bar badges (future) will need the same observation. The observations are cheap (WatermelonDB reactive queries; no polling) and leaving them always-on removes a future footgun.
- **Narrow the no-modal test (F1) by excluding `SettingsScreen.tsx`** — rejected. The test would become "no `Alert.alert` except in the allowlist", which leaks a pre-existing wart into a guarantee meant to be absolute. Migrating both existing `Alert.alert` sites to `ConfirmModal` removes the wart at the root and lets the no-modal scan stay a single-line assertion with no carve-outs.
- **Ship `ConfirmModal` as a separate feature (009-modal-system)** — considered. Procedurally cleaner (spec-kit cycle for the primitive) but it defers fixing the `Alert.alert` problem on Home, forces 008 to ship with the narrow-the-regex workaround anyway, and costs a full spec/plan/tasks round for a 3-file scaffold. Folding it into 008 as a documented spillover (this plan's "Infrastructure spillover" paragraph) trades a small spec-kit irregularity for a smaller, faster, more coherent delivery.
- **Build a global `<ModalProvider>` + imperative `showConfirm(...)`** — rejected for v1. Two call sites don't justify a provider; declarative state in the two calling screens is shorter, easier to test, and has no re-render surface. Re-evaluate when a third non-trivial consumer shows up.
- **Migrate `CatalogScreen` offline alert to a `ConfirmModal` instead of deleting it** — rejected. Constitution UX4 is explicit: "sync feedback — never a modal or alert". The inline sync pill's `offline` state already carries the signal. A modal here would paper over a pre-existing violation.
- **Add a manual "Sincronizar agora" tap target to the pill in the in-sync state** — rejected. The pill's tap semantics are: no-op when in-sync, no-op when syncing, no-op when offline, retry when failed. Manual sync is reachable via Catalog's pull-to-refresh and via the empty-catalog CTA on Home; adding a third path without a user story would be feature creep.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified.**

None. Gate passed pre-research with zero principle violations. Design Prerequisite is ✅ because the Pencil session ran before spec authoring.

## Phase 1 post-design re-check

After Phase 1 artifacts (research.md, data-model.md, contracts/, quickstart.md) are drafted, the Constitution Check table is re-evaluated. Items expected to surface and not move the gate:

1. **Sync-store additive extension** (research §R-001 + contracts/sync-store-extension.md): `lastOkAt` is exposed on the snapshot with a documented backward-compatibility guarantee. Every existing consumer of `useSyncStatus()` continues to destructure `{ status }` without type breakage. Tests cover both the old and new shapes.
2. **Relative-time vocabulary** (research §R-003): "agora" / "há N min" / "há N h" / "há N d" with thresholds 60 s / 60 min / 24 h. Stable per spec's Assumption (no localization variants in v1).
3. **Responsive extraction deferral** (plan Structure Decision point 2): `useViewport` duplication is now at three consumers; a follow-up chore ticket should be created once this feature lands to extract to `src/app/responsive/`. This is not part of 008's scope.

**Gate status (post-design)**: PASS (expected). Zero principle violations expected. Design Prerequisite is ✅ throughout.
