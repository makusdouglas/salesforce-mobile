# Implementation Plan: Sync Engine

**Branch**: `005-sync-engine` | **Date**: 2026-04-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-sync-engine/spec.md`

## Summary

Install the sync engine as a self-contained feature under `src/features/sync/` that binds the WatermelonDB data layer (block 002) to the authenticated Supabase session (block 003). Every pass runs *pull-then-push* (D1): pull server-side changes for all seven business tables into the local database, then push locally changed records back to Supabase. The pass is orchestrated through WatermelonDB's own `synchronize()` helper — the sync-readiness columns (`server_id`, `updated_at`, `_status`, `_changed`) were specifically provisioned by 002 for this purpose (R1). Conflict resolution is last-write-wins by `updated_at`, expressed as a `conflictResolver` function on the Watermelon sync call (P2).

Three — and only three — triggers fire a pass: (a) a successful login, detected by subscribing to the `sessionStore` transitioning to `Authenticated` with the `_queuedSync` flag set or freshly cleared, (b) the salesperson's pull-to-refresh gesture on the home screen, (c) a public `syncService.onOrderSent()` hook called by the order-sending flow after `ordersRepository.markSent()` resolves, gated by connectivity. No periodic timer-based sync. A module-level guard allows at most one pass in-flight; overlapping triggers coalesce to one queued follow-up.

A `syncStatusStore` (same pattern as `sessionStore`/`lockStore`) exposes exactly four states — `in-sync | syncing | offline | failed` — and a small `<SyncStatusIndicator>` component reads it via `useSyncStatus()` and renders a tap-inert icon+label in the home-screen header. The component is inline, never modal, and does not block any business screen (UX4, P1). Failure of a pass preserves every local record unchanged (P5) and leaves the indicator in `failed` until the next trigger fires.

## Technical Context

**Language/Version**: TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (inherited from 001/002/003/004).

**Primary Dependencies**:

- `@nozbe/watermelondb` — **already installed** (002). Specifically `@nozbe/watermelondb/sync` for the `synchronize()` helper and its pull/push protocol.
- `@supabase/supabase-js` — **already installed** (003). The sync engine consumes the `supabase` singleton exported from `@/data`; it does NOT instantiate its own client.
- `@react-native-community/netinfo` — **already installed** (003). The sync engine reuses the same `NetInfo` source as `startConnectivityListener` (the auth feature's listener and this feature's are peers, not coupled).
- No new runtime dependencies.
- Dev: existing Jest + ts-jest; no new dev tooling.

**Storage**:

- **Last-pulled-at cursor** — WatermelonDB's internal `getLastPulledAt()` / `setLastPulledAt()` on the `Database` instance. No additional cursor storage, no additional secure-store entries. WatermelonDB persists this inside SQLite alongside the data it governs.
- **Push queue** — the set of local records with `_status !== 'synced'`. Managed entirely by WatermelonDB; surfaced to `synchronize()` via its built-in `fetchLocalChanges` step. Not a separate entity.
- **Sync status singleton** — **in-memory only** (`status: 'in-sync' | 'syncing' | 'offline' | 'failed'`, plus internal `_lastOutcome`, `_online`, `_inFlight`, `_followUpQueued`). Derived at mount time from (a) whether WatermelonDB has any unsynced records and (b) current `NetInfo` state; lost on process kill and rederived on next boot.
- **Supabase side** — every synced table MUST expose `updated_at timestamptz NOT NULL DEFAULT now()` with a `BEFORE UPDATE` trigger that refreshes it on every row change, and a nullable `deleted_at timestamptz` for server-authoritative soft deletes. These are Supabase-side schema changes (migration + trigger). They are NOT handled by the app — they are an operational prerequisite declared in [contracts/supabase-schema.md](./contracts/supabase-schema.md) and executed by the admin via the Supabase dashboard SQL editor. No app-side migration runs.

**Testing**: Constitution §9 — business-logic coverage first. Ship unit tests for:

1. **Pull-phase merger**: given a batch of server changes and a set of local pending edits on the same ids, assert last-write-wins by `updated_at` (older-updated_at row is discarded).
2. **Push idempotency**: a record in `_status === 'synced'` MUST NOT be re-pushed; a successful push transitions the record to `synced` and the next pass skips it.
3. **Coalesce semantics**: firing three triggers in rapid succession while a pass is in-flight results in exactly one in-flight pass plus one queued follow-up, never two queued.
4. **Status state machine**: every edge of `in-sync ↔ syncing ↔ offline ↔ failed` is reachable and transitions are deterministic from `(inFlight, online, lastOutcome)`.
5. **Trigger wiring**: the `sessionStore` transitioning to `Authenticated` with `_queuedSync === true` causes exactly one pass; pull-to-refresh while offline does not queue a pass; `onOrderSent()` while offline does not queue a pass.
6. **Connectivity loss mid-pass**: a pass that loses connectivity mid-flight ends in `failed`, no local data is discarded, and the indicator settles on `offline` (connectivity precedence) rather than `failed`.

The Supabase pull/push calls themselves are integration points — verified manually against the acceptance scenarios in [spec.md](./spec.md) using a disposable test salesperson account on the dev Supabase project.

**Target Platform**: iOS 13+ and Android 7+ (inherited from 002/003). WatermelonDB's sync protocol and NetInfo both support these; no additional platform minimums.

**Project Type**: Mobile app — feature module addition on top of the 002 data layer and 003 auth scaffold. No backend code (Supabase dashboard covers the schema side).

**Performance Goals**:

- Full first-pull after login completes in under 15 s on a 10 Mbps connection for a catalog of up to 500 products (3 variants average), 200 clients, and 500 orders (SC-001).
- Opportunistic post-order-sent pass makes the order visible in the admin dashboard within 30 s on the same link (SC-002).
- Status-indicator state change latency ≤ 1 s at the 95th percentile (SC-003).
- Zero bytes of additional network traffic on any business screen during a pass — the pass is background, home-screen-driven for feedback only (SC-004, FR-017).

**Constraints**: Offline-first (P1) is non-negotiable — no sync failure may surface as an error on a business screen. No sync pass may block UI rendering. Local data must survive 100% of simulated sync failures (SC-005); this is guaranteed by WatermelonDB's transactional sync — failed passes leave the change-tracking state untouched. Single-in-flight guarantee is a module-level semaphore, not a reentrant lock. LWW conflict resolution must be deterministic regardless of device order (SC-006) — achieved by keying resolution on `updated_at` with a stable tiebreaker (`server_id` lexicographic order) when timestamps tie exactly.

**Scale/Scope**: ~17 new source files + 5 unit-test files under `src/features/sync/`. The source files are: one sync service, one errors module, one Supabase pull-changes adapter, one push-changes adapter, one per-table mappers module, one conflict resolver, one `runPass` orchestrator, one status store + event emitter, one pure `derive.ts` helper, one `useSyncStatus` hook, one NetInfo bridge, three trigger modules (login, pull-to-refresh, order-sent), one `<SyncProvider>` lifecycle component, one `<SyncStatusIndicator>` component, one barrel. The tests cover the conflict resolver, the status store + derivation, `runPass` coalesce semantics, push-changes idempotency + mapping, and the login trigger. Two **existing** files receive minor extensions: `src/app/providers/AppProviders.tsx` gains `<SyncProvider>` wrapping inside `<LockProvider>`, and `src/features/home/screens/HomePlaceholderScreen.tsx` gains one header row with `<SyncStatusIndicator />` and one `<ScrollView refreshControl>` wiring. Zero WatermelonDB schema changes (the sync-readiness columns were provisioned by 002). One Supabase-side operational change documented in `contracts/supabase-schema.md` (add `updated_at` + `deleted_at` columns + triggers to the seven business tables, plus a `public.sync_now_ms()` RPC for the pull-phase server-clock read; admin executes via dashboard SQL).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | A sync pass is background-only; no business screen blocks on it (FR-017, SC-004). `offline` and `failed` are indicator states, never error dialogs. Pull-to-refresh on an offline device is a no-op, not a thrown error (FR-005). |
| P2 Local DB is source of truth | ✅ | Pass | Last-write-wins by `updated_at` is the constitution's own rule (P2). Implemented as a `conflictResolver` that the Watermelon sync helper calls for every incoming record. |
| P3 MVP simplicity | ✅ | Pass | Uses WatermelonDB's official `synchronize()` helper instead of rolling a custom sync loop. Uses direct Supabase table reads + upserts via the existing client; no Edge Functions, no server-side compute. One status store, one provider, one indicator component. |
| P4 Reuse free tools | ✅ | Pass | Reuses the `supabase` client from `@/data` (no new instance), the NetInfo source from 003, the `sessionStore` `_queuedSync` flag from 003, and WatermelonDB's internal last-pulled-at cursor. No SaaS sync service, no custom backend. |
| P5 Salesperson data is sacred | ✅ | Pass | Watermelon's `synchronize()` is transactional: a failed pass leaves local change-tracking untouched. Pull-phase failures do not discard local pending changes. Push-phase failures keep failed records in the pending set (SC-005). The conflict resolver never discards local changes unless local `updated_at` is strictly older than server `updated_at`. |
| §3 Mandatory — Expo managed + dev client | ✅ | Pass | No new native modules introduced. Inherits the 002 dev client. |
| §3 Mandatory — WatermelonDB | ✅ | Pass | This feature is the first consumer of Watermelon's sync machinery that 002 deliberately exposed (the `server_id` / `updated_at` / `_status` / `_changed` columns were added with this feature in mind — confirmed by the comment in `src/data/schema/tables.ts`). |
| §3 Mandatory — Supabase | ✅ | Pass | Consumes the existing `supabase` client via `@/data`. The Supabase-side schema prerequisite (`updated_at` + `deleted_at` columns + triggers) lives in the admin's operational runbook ([contracts/supabase-schema.md](./contracts/supabase-schema.md)), not in app code. |
| §3 Mandatory — `expo-secure-store` | N/A | — | The sync feature does not persist anything to the secure store. The WatermelonDB last-pulled-at cursor lives in SQLite with the data it governs. |
| §3 Mandatory — `expo-local-authentication` | N/A | — | Unlock is 004's responsibility. The sync engine never prompts biometrics. |
| §3 Forbidden — custom backend / Firebase / Redux-MobX / heavy UI | ✅ | Pass | No backend introduced. Supabase table reads + triggers cover the server-side compute. Sync status uses the same event-emitter + `useSyncExternalStore` pattern 003 and 004 established. |
| R1 WatermelonDB is the single client data layer | ✅ | Pass | The sync engine is **the exception the rule anticipates** — it is the "separate process, executed at defined moments" that R1 explicitly carves out. It is the ONLY module in the app that talks to Supabase for business data; UI components continue to read only from the Watermelon repositories. |
| R2 Seven entities | ✅ | Pass | The seven entities and no more are synced. No new entity. The feature introduces only in-memory/derived runtime state (sync status, pass snapshot), which R2 does not govern. |
| R3 Images in Storage | ✅ | Pass | Explicitly out of scope (spec Assumptions). Product and receipt image URLs are synced as string columns; the image bytes are loaded on demand via the local cache. The sync engine does not pre-download images. |
| R4 PDF local, email via share sheet | N/A | — | Not touched. |
| R5 Discounts on order, not catalog | N/A | — | Not touched. |
| §5 UX1 Tap, not type | ✅ | Pass | The only user-facing affordance is the pull-to-refresh gesture — a single swipe, no typing. The indicator itself is tap-inert (FR-016). |
| §5 UX2 Repeat previous order | N/A | — | Not touched. |
| §5 UX3 Useful empty states | ✅ | Pass | The indicator's four labels are chosen to be the salesperson's next-step language (to be finalized in the component contract): `Dados em dia` (in-sync), `Sincronizando…` (syncing), `Sem internet` (offline), `Falha ao sincronizar` (failed). Portuguese per §9. |
| §5 UX4 Discreet sync feedback | ✅ | Pass | This feature **is** the implementation of UX4. The indicator is inline, always-on, never modal (FR-013, FR-016). |
| §5 UX5 Phone AND tablet layouts | ⚠️ Justified (component-only, no new screen) | Pass | The feature adds one inline component to an existing host screen (the home placeholder). The component's visual spec (four states, icon + one-line label) is layout-neutral and renders identically on phone and tablet; the host screen's phone/tablet frames are owned by the future home-screen feature. A standalone Pencil frame for a single-row indicator would be wasted design effort. The component contract ([contracts/indicator-component.md](./contracts/indicator-component.md)) pins exact colors, iconography, and typography so the future home-screen Pencil pass can place it without guesswork. |
| §6 D1 Pull then push | ✅ | Pass | This feature is the implementation of D1. FR-001 traces directly. |
| §6 D2 Catalog read-only | ✅ | Pass | The push adapter filters out catalog tables (`products`, `product_variants`) and only pushes `clients`, `orders`, `order_items`, `payment_receipts`. Salespeople cannot mutate the catalog locally (002's repositories already prevent this), so nothing is ever queued for push from catalog tables in practice; the filter is a belt-and-suspenders second line of defense. |
| §6 D3 Admin-side merge | ✅ | Pass | Duplicate clients are a manual-merge concern in the admin dashboard, not a client-side responsibility. The sync engine never attempts deduplication. |
| §6 D4 Simple order statuses | ✅ | Pass | Sync treats `status` as an opaque string column. The opportunistic trigger fires only on the `draft → sent` transition (FR-004), by explicit call from the order-sending flow — no state-machine logic inside sync. |
| §7 D5 Online-one-time + offline-persistent | ✅ | Pass | Sync consumes the session snapshot read-only. A 401 from Supabase during a pass is translated into an `AuthError('RELOGIN_REQUIRED')`-equivalent: the pass ends in `failed`, the `_queuedSync` flag is set on the session (so the next successful refresh triggers a new pass), and the session store transitions to `RequiresRelogin` per FR-019. Sync never talks to the Supabase Auth endpoints directly — it only routes auth failures through the 003 `authService` contract. |
| §7 D6 Mandatory local lock | ✅ | Pass | Sync runs only while unlocked (the `<LockGate>` from 004 gates all of `Home`, and sync triggers only fire while Home is mounted — via `SyncProvider` placed **inside** the gate). Cold-launch that stays locked does not sync until unlock. |
| §9 English identifiers | ✅ | Pass | All identifiers, service names, hook names, file names, store keys, and SQL column names in English. Portuguese only in the indicator's four UI strings. |

**Gate status (pre-research)**: PASS with one justified component-only deviation.

1. **UX5 Phone AND tablet frames** — the feature adds a single inline component, not a screen. The component's visual spec is captured in [contracts/indicator-component.md](./contracts/indicator-component.md) with exact metrics so the home-screen feature's future Pencil pass can place it correctly on phone and tablet frames without guessing.

## Design Prerequisite

*GATE: Must pass before any implementation task is generated.*

**Does this feature have a UI?** The feature introduces a single inline UI primitive (`<SyncStatusIndicator>`) that renders inside an existing host screen (the home placeholder from 003). It does NOT introduce a standalone screen.

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | Component only (no screen) | One 32-pt-tall inline row component in the home-screen header area. |
| `design/screens.md` exists | N/A | No screens belong to this feature. |
| Phone frames cover all screens | N/A | No screens. |
| Tablet frames cover all screens | N/A | No screens. |
| Responsive strategy documented below | ✅ | Component is viewport-independent (same icon + single-line label on both form factors). Wrapper padding is inherited from the host screen; the component does not own horizontal margins. Documented in the "Structure Decision" section below. |

**Rationale for skipping Pencil frames**: The indicator is a four-state primitive — icon + one-line label — that the host screen's own Pencil pass will place. Producing two Pencil frames for a component that is 32 pt tall and has no layout alternatives would violate P3 (simplicity). The component contract at [contracts/indicator-component.md](./contracts/indicator-component.md) specifies exact colors, icons, typography, and the four state labels so the future home-screen design owns placement without ambiguity.

## Project Structure

### Documentation (this feature)

```text
specs/005-sync-engine/
├── plan.md                      # This file
├── research.md                  # Phase 0 — transport, protocol, resolver, triggers, failure handling
├── data-model.md                # Phase 1 — server-side sync contract, status store shape, cursor delegation
├── quickstart.md                # Phase 1 — "how the home screen mounts the indicator + wires pull-to-refresh; how the order-sending flow calls onOrderSent"
├── contracts/
│   ├── sync-service.md          # Public API of syncService + useSyncStatus + SyncProvider
│   ├── pull-changes.md          # Supabase → device contract: what the pull adapter reads, shape it returns
│   ├── push-changes.md          # Device → Supabase contract: what the push adapter writes, shape it sends
│   ├── conflict-resolver.md     # LWW-by-updated_at behavior, tiebreaker, delete/update race
│   ├── status-store.md          # State machine: in-sync ↔ syncing ↔ offline ↔ failed
│   ├── indicator-component.md   # <SyncStatusIndicator> visual spec, accessibility, PT labels
│   ├── triggers.md              # Three trigger wirings: login, pull-to-refresh, onOrderSent
│   └── supabase-schema.md       # Operational prerequisite: updated_at + deleted_at columns + triggers on the 7 tables
├── checklists/
│   └── requirements.md          # Spec quality checklist (from /speckit-specify)
└── tasks.md                     # Phase 2 — /speckit-tasks output (not created here)
```

### Source Code (repository root)

The sync feature is bounded under `src/features/sync/` and imported through its barrel `@/features/sync`. Exactly two modules outside the feature folder reach into it: `src/app/providers/AppProviders.tsx` (wraps the tree with `<SyncProvider>`) and `src/features/home/screens/HomePlaceholderScreen.tsx` (mounts `<SyncStatusIndicator />` and wires the pull-to-refresh gesture). The 003 and 004 features are untouched — this feature consumes their public contracts read-only.

```text
.
└── src/
    ├── app/
    │   └── providers/
    │       └── AppProviders.tsx                # MODIFIED — wraps children with <SyncProvider> INSIDE <LockProvider> (sync depends on session + lock being unlocked; neither depends on sync)
    ├── features/
    │   ├── home/
    │   │   └── screens/
    │   │       └── HomePlaceholderScreen.tsx   # MODIFIED — mounts <SyncStatusIndicator /> in the header; wraps content in a <ScrollView refreshControl={...}> wired to syncService.runSync({ trigger: 'pull-to-refresh' })
    │   └── sync/
    │       ├── index.ts                        # NEW — public barrel: syncService, useSyncStatus, SyncProvider, SyncStatusIndicator, types
    │       ├── service/
    │       │   ├── syncService.ts              # NEW — runSync({ trigger }), onOrderSent(), public surface; owns the in-flight guard + coalesce queue
    │       │   └── errors.ts                   # NEW — SyncError with codes: NETWORK | AUTH_REJECTED | SERVER | PUSH_REJECTED | PULL_REJECTED | ABORTED
    │       ├── state/
    │       │   ├── syncStatusStore.ts          # NEW — module-level singleton + event emitter; status = in-sync | syncing | offline | failed; internal _inFlight, _followUpQueued, _online, _lastOutcome
    │       │   └── derive.ts                   # NEW — pure function deriveStatus({ inFlight, online, lastOutcome, hasQueuedChanges }) → SyncStatus
    │       ├── supabase/
    │       │   ├── pullChanges.ts              # NEW — queries Supabase for rows WHERE updated_at > lastPulledAt across the 7 tables; maps to Watermelon's SyncPullResult shape
    │       │   ├── pushChanges.ts              # NEW — upserts changed local rows back to Supabase via client.from(...).upsert(); maps auth failures to AUTH_REJECTED
    │       │   └── mappers.ts                  # NEW — snake_case ↔ camelCase mapping per table; server-id ↔ Watermelon-id mapping
    │       ├── protocol/
    │       │   ├── runPass.ts                  # NEW — wraps @nozbe/watermelondb/sync's synchronize() with pullChanges + pushChanges adapters and the conflict resolver
    │       │   └── conflictResolver.ts         # NEW — pure LWW: if server.updated_at > local.updated_at → server wins; else local wins; tiebreaker: server.server_id < local.server_id lex
    │       ├── triggers/
    │       │   ├── loginTrigger.ts             # NEW — subscribes to sessionStore; fires a pass on NotAuthenticated→Authenticated AND on any Authenticated snapshot where _queuedSync was cleared by the login OR silent-refresh
    │       │   ├── pullToRefreshTrigger.ts     # NEW — thin wrapper: await syncService.runSync({ trigger: 'pull-to-refresh' })
    │       │   └── orderSentTrigger.ts         # NEW — public onOrderSent() hook: runs a pass only if connectivity is present at call time
    │       ├── connectivity/
    │       │   └── netinfoBridge.ts            # NEW — subscribes to NetInfo, writes _online into syncStatusStore; debounced 500 ms to match auth's listener
    │       ├── hooks/
    │       │   └── useSyncStatus.ts            # NEW — useSyncExternalStore hook over syncStatusStore; exposes { status } only (internal flags hidden)
    │       ├── components/
    │       │   ├── SyncProvider.tsx            # NEW — mounts loginTrigger + netinfoBridge on mount; tears down on unmount. No Context — the stores ARE the context.
    │       │   └── SyncStatusIndicator.tsx    # NEW — renders one of four rows: icon + Portuguese label; tap-inert; accessible label in Portuguese
    │       └── tests/
    │           ├── conflictResolver.test.ts   # NEW — LWW correctness, tiebreaker correctness, delete/update race
    │           ├── syncStatusStore.test.ts    # NEW — state machine transitions, derive() exhaustive
    │           ├── runPass.test.ts            # NEW — coalesce semantics, single-in-flight guarantee (with mocked pullChanges/pushChanges)
    │           └── pushChanges.test.ts        # NEW — push idempotency (synced record is not re-pushed), auth failure mapping
    └── (everything else unchanged from 001/002/003/004)
```

**Structure Decision**: The sync feature sits as a peer of `src/features/auth/` and `src/features/lock/` under `src/features/`, exposing itself through a single barrel. Three architectural levers keep the feature well-bounded:

1. **`<SyncProvider>` wraps inside `<LockProvider>` inside `<SessionProvider>` in `AppProviders.tsx`**. Order of composition (outer → inner): `SessionProvider` → `LockProvider` → `SyncProvider` → children. Sync depends on session (for the `_queuedSync` flag and the `Authenticated` status) and on lock (so triggers only fire while unlocked). Neither session nor lock depends on sync, preserving the dependency direction already established by 003 and 004.

2. **Sync is the single module in the app that talks to Supabase for business data**. R1 calls this out explicitly. UI components continue to read exclusively from the 002 repositories. The pull and push adapters import `supabase` from `@/data` and `database` / the repositories from `@/data`, then call `@nozbe/watermelondb/sync`'s `synchronize()` with the adapters wired as `pullChanges` and `pushChanges` callbacks. No other file in the codebase gains a Supabase import as a result of this feature.

3. **The component contract is layout-neutral**. `<SyncStatusIndicator>` is a 32-pt-tall single-row primitive with no horizontal margin of its own — the host screen controls placement. This is why no Pencil frames are needed: the component renders identically on phone (390 pt wide) and tablet (820 pt wide); only the host screen's padding differs. When the home-screen feature is specified, its Pencil pass will absorb the indicator into the header row for both viewports with zero additional design decisions left to the indicator itself.

**Rejected alternatives**:

- **Custom sync loop instead of WatermelonDB's `synchronize()`** — rejected by P3. WatermelonDB's helper already handles change-tracking, transaction wrapping, the push-ack round-trip, and the last-pulled-at cursor. Rolling our own would duplicate all of this for zero gain. The helper's API is stable and well-understood.
- **Supabase Edge Functions for pull/push** — rejected for MVP by P3. An Edge Function gives us server-side shaping of the response (perfect for collapsing multiple tables into one payload) but costs another moving part to deploy, monitor, and secure. Direct table reads with RLS-filtered queries and an `updated_at > lastPulledAt` filter suffice at MVP scale (1–2 salespeople, low hundreds of rows). The pull/push adapters are small enough that migrating to Edge Functions later is a pure adapter swap — the `synchronize()` call site, the conflict resolver, the status store, and the component contract all stay the same.
- **Periodic background sync via `expo-background-fetch`** — rejected. The spec explicitly names three triggers and no others (FR-004). Background fetch adds an OS-governed trigger the spec doesn't require and would need its own P1/P5 analysis (what happens if a background pass fails silently? how does the indicator reflect a pass the user didn't initiate?). Out of scope.
- **Embed the status indicator inside every business screen's header** — rejected by FR-018 and UX4. The indicator is home-screen only. Business screens stay focused on their business task; the salesperson checks sync state from Home, not mid-flow.
- **Expose a Context + Provider pair for the sync service** — rejected. The `syncStatusStore` + `useSyncStatus` pattern matches 003's `sessionStore` + `useSession` and 004's `lockStore` + `useLock`. Three consistent patterns beat one stylistic divergence. `<SyncProvider>` exists only to own lifecycle (mount triggers, unmount triggers); it does not publish any value through Context.
- **Auto-subscribe to `ordersRepository` changes to detect `status === 'sent'` transitions** — rejected. That would couple sync to the data layer's observables and invert the dependency (sync is a consumer of the data layer, the data layer should not emit feature-specific events). The explicit `syncService.onOrderSent()` call at the callsite of `ordersRepository.markSent()` is clearer and easier to test.
- **Stamp `updated_at` client-side on push and let the server accept it** — rejected. Supabase-side `updated_at` via trigger is the only way to break conflict-resolution ties authoritatively (SC-006). If the client stamps `updated_at`, two devices with mildly skewed clocks can produce identical-or-wrong timestamps, and LWW loses determinism. The server trigger is the single source of truth. On the local side, the record's `updated_at` is overwritten with the server-returned value immediately after push, converging the local clock to the server's.
- **Soft-delete via a `deleted` boolean column** — rejected in favor of `deleted_at timestamptz`. A timestamp lets the pull query use the same `> lastPulledAt` predicate as `updated_at` and naturally participates in LWW (a record whose local `updated_at` is newer than the server's `deleted_at` wins the conflict per P2 — rare in practice since the catalog is admin-only, but semantically clean).

## Complexity Tracking

One justified deviation is recorded in the Constitution Check table. It is a scoping judgement, not a workaround:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| UX5 Phone AND tablet Pencil frames | The feature's only UI is a 32-pt-tall inline component. Producing phone/tablet Pencil frames for a layout-neutral component would waste design effort and create zero additional information. | Shipping a standalone screen just to design the indicator would be backwards — the component is designed to slot into whatever host it's given. The component contract ([contracts/indicator-component.md](./contracts/indicator-component.md)) pins exact metrics so the future home-screen Pencil pass owns placement deterministically. |

## Phase 1 post-design re-check

After Phase 1 artifacts (research.md, data-model.md, contracts/, quickstart.md) were drafted, the Constitution Check table remains satisfied. Three items that surfaced during Phase 1 and are worth noting:

1. **Supabase-side schema prerequisite is operational, not an app migration.** The two new columns (`updated_at`, `deleted_at`) and the `BEFORE UPDATE` trigger on each of the seven tables are documented in [contracts/supabase-schema.md](./contracts/supabase-schema.md) with verification SQL. This keeps the app bundle unchanged by the prerequisite — the admin owns the migration in the Supabase dashboard. Noted because it shifts one line of work to the admin's runbook that a casual reader of the plan might expect to see in app code.

2. **The `_queuedSync` internal flag on the session store is already wired by 003.** `loginTrigger` consumes it read-only; no modification to the auth feature's surface or internals is needed. Confirmed by reading `src/features/auth/session/session.ts` lines 7–26 (where `_queuedSync` is defined) and lines 80–130 (where setters toggle it). This is 003's deliberate hand-off into 005 — see the comments in session.ts.

3. **The push adapter's FK ordering (clients → orders → order_items → payment_receipts) is not a performance choice, it's a correctness requirement.** Parallelizing these four would race against Supabase foreign-key constraints during inserts. The adapter's inside-a-table parallelism (inserts parallel, updates parallel, deletes parallel) is a latency optimization on top of the sequential table order — documented in [contracts/push-changes.md](./contracts/push-changes.md) "Per-table order".

**Gate status (post-design)**: PASS. One justified component-only deviation (UX5 Pencil frames for a layout-neutral inline primitive) remains recorded in Complexity Tracking.
