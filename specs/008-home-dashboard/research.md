# Phase 0 Research — Home Dashboard & Empty States

All four items resolved. No items block Phase 1.

---

## R-001 — Sync-store `lastOkAt` ergonomics

**Question**: How to expose the timestamp of the last successful sync without breaking any existing consumer of `useSyncStatus()`?

**Decision**: Add `_lastOkAt: number | null` to `InternalState` in `src/features/sync/state/derive.ts`. Extend the exported `SyncStatusSnapshot` with `lastOkAt: number | null`. In `syncStatusStore.ts`, add `setLastOkAt(ms: number | null)` to `_internalSyncStatusStore` and stamp `Date.now()` from inside `setLastOutcome('ok')` (one call site, inside the store, avoiding every caller of `setLastOutcome` having to remember). `__resetForTests` clears it to `null`. On `setLastOutcome('failed')` the timestamp is NOT cleared — the pill should continue to show "há N h" even after a failure per the spec edge case "very old sync".

**Rationale**: Additive contract. `SyncStatusIndicator` destructures `{ status }` and ignores the new field — TypeScript-compatible. The store stays the single source of truth; Home does not maintain a parallel "when was the last sync" state. Stamping happens exactly once per successful pass, co-located with the outcome transition.

**Alternatives considered**:
- _Compute `lastOkAt` in Home from `status` transition observations_: fragile (lost on remount), parallel state (violates P2).
- _Emit a separate event bus for sync success_: over-engineered for one consumer.
- _Store `lastOkAt` in AsyncStorage_: not needed — the value is session-scoped and spec does not require survival across cold starts; if we cold-start with no sync yet, "Sincronizando…" / "Sem internet" / "Sincronizado" are all more accurate than a stale "há 3 d ago".

---

## R-002 — Route rename vs. in-place component swap

**Question**: `HomePlaceholder` is the route name baked into auth + lock post-action navigation. Do we rename it to `Home` or swap the component under the same name?

**Decision**: Swap the component in place. `HomeStack.tsx` mounts `HomeScreen` at route name `HomePlaceholder`. A one-line comment on the `Stack.Screen` explains the historical name. `HomeStackParamList['HomePlaceholder']` stays `undefined`.

**Rationale**: Renaming requires edits in `src/features/auth` and `src/features/lock` (at minimum — the CODEOWNERS-free project could have more call sites), and future deep links would diverge from whatever this rename settles on. P3 says pick the smaller change. The compat-alias is a one-line comment.

**Alternatives considered**:
- _Rename to `Home` with a migration guide_: breaks every navigator call site and deep-link scheme for zero user-facing benefit.
- _Register both routes, alias one to the other_: adds a forward and a dead route; worse than a comment.

---

## R-003 — Relative-time vocabulary

**Question**: What exact strings and thresholds does the sync pill use for the `{ status: 'in-sync', lastOkAt }` combination and what does Atividade Recente use?

**Decision** — `formatRelativeSyncAge(ageMs, nowMs?)` returns:

| Age window | Output |
|------------|--------|
| < 60 s | `"agora"` |
| 1–59 min | `"há N min"` (integer floor) |
| 1–23 h | `"há N h"` (integer floor) |
| ≥ 24 h | `"há N d"` (integer floor, no ceiling) |

The pill renders `"Sincronizado · <age>"`. Atividade Recente reuses the same formatter against the order's send timestamp. No localization variants — the spec explicitly limits language scope (Portuguese, short forms, no plural agreement logic: "há 1 min" is not re-written to "há 1 minuto").

**Rationale**: Four strings and three thresholds are enough to cover every realistic field case and every spec acceptance scenario. The formatter is pure (caller supplies `nowMs`), so tests do not mock the clock.

**Alternatives considered**:
- _ISO absolute timestamps_: too technical for the spec's "salesperson language" constraint.
- _"há N minutos / há 1 minuto" plural agreement_: adds a conditional per case; low value; would break the clean four-line formatter.
- _Refresh interval timer_: unnecessary — the snapshot is recomputed on every `status` transition; the pill re-renders on every `syncStatusStore.emit()`. Between transitions, a stale "há 2 min" can live up to the next transition, which is within the spec's "glance" tolerance.

---

## R-004 — Where do the evicted Settings controls live?

**Question**: The current `HomePlaceholderScreen` houses two affordances the spec does NOT reference: the lock inactivity-timeout segmented control and the logout button. They are not dev-only. Where do they go?

**Decision**: Create `SettingsScreen` under `src/features/home/screens/SettingsScreen.tsx`, register it as route `Settings` on `HomeStack`, and reach it via a gear icon in `HomeTopBar` (right edge, after the sync pill). The screen renders the existing segmented control + logout button unchanged (identical component logic, copy, and service calls). Dev-only affordances (`DataLayerSmoke`, `DatabaseInspector`) ALSO move to `SettingsScreen` under a `__DEV__` block — they are debug tools, not hub content.

**Rationale**: Home stays a clean hub (UX3, spec FR-020 no-scroll). Every existing user capability survives the redesign (nothing is lost; it is relocated). Route name is `Settings` because it accurately describes what's there; no conflict with the Settings affordances that a future admin feature may want (admin settings are gated by role under `src/features/admin/`).

**Alternatives considered**:
- _Inline a "Mais" accordion on Home_: clutters the hub, fights with the sync pill for attention.
- _Ship Settings in a separate feature spec_: the content already exists and is trivially relocated; a separate spec is ceremony without user value.
- _Put the timeout segment in a bottom sheet reachable from a long-press on the app logo_: undiscoverable.

---

## Notes for tasks.md

- No `/speckit-pencil-design` blocking task — the design artifacts are already in `design/`.
- Phase 1 Setup should include a dedicated task to add `lastOkAt` to the sync store (it is a shared module; land it BEFORE any Home component task so `useSyncStatus()` consumers see the new field immediately).
- A follow-up chore ticket should be filed after this feature lands to extract `useViewport` / `breakpoints.ts` / `normalize.ts` from catalog + clients + home into `src/app/responsive/` (and `src/app/text/`). That chore is NOT part of 008.
