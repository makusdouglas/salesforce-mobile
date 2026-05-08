# Contract — `HomeSyncPill`

**Module**: `src/features/home/components/HomeSyncPill.tsx`. Consumes `useSyncStatus()` + `formatRelativeSyncAge()` + `onPullToRefresh()` (from `@/features/sync`). Not reusable outside Home.

## State machine

Input: `{ status, lastOkAt }` from `useSyncStatus()`.

| Derived kind | Condition | Visual | Label | Tap behavior |
|--------------|-----------|--------|-------|--------------|
| `in-sync` | `status === 'in-sync' && lastOkAt !== null` | green fill `#F0FDF4`, green border `#BBF7D0`, dot `#16A34A` | `"Sincronizado · <age>"` where `<age> = formatRelativeSyncAge(now - lastOkAt)` | no-op |
| `syncing` | `status === 'syncing'` OR (`status === 'in-sync' && lastOkAt === null`) | amber fill `#FFFBEB`, amber border `#FDE68A`, dot `#D97706` | `"Sincronizando…"` | no-op |
| `offline` | `status === 'offline'` | neutral fill `#F4F4F5`, neutral border `#E4E4E7`, dot `#A1A1AA` | `"Sem conexão"` | no-op |
| `failed` | `status === 'failed'` | red fill `#FEF2F2`, red border `#FECACA`, dot `#DC2626` | `"Falha ao sincronizar — tocar para tentar"` | `onPullToRefresh()` |

Colors match the Pencil frames and the palette already in use by `SyncStatusIndicator` (same dot hues).

## Render geometry

- Phone: pill of height 26 pt, horizontal padding 10 pt, gap 6 pt between dot and text; text `fontSize: 12, fontWeight: 600, fontFamily: 'Inter'`.
- Tablet: height 30 pt, horizontal padding 12 pt, gap 8 pt, `fontSize: 13`.
- Corner radius: half of height (fully rounded).
- Dot: 8 pt on phone, 10 pt on tablet, `cornerRadius` half.

## Non-requirements

- No animated transition between states. State changes are instantaneous; a cross-fade would be nice but is out of scope for v1 (P3).
- No spinner inside the pill during `syncing`. The color change carries enough signal.
- No long-press. Only single-tap, and only in `failed` state.

## Accessibility

- Rendered as a single `Pressable` with `accessibilityRole="button"` always set (so the OS announces consistently), but `onPress` is a no-op when the kind is not `failed`.
- `accessibilityLabel` reads the full human label (including the age for `in-sync`) so a screen reader announces context without needing to read the dot.

## Time-update behavior

The pill re-derives the age on every React render — which happens on every store emission. Between emissions the label can grow stale by as much as the next transition interval. No timer is added to force periodic re-render; the spec tolerates "glance" precision and forcing a re-render every 60 s would be wasteful (P3).

## Tests

- Unit: `formatRelativeSyncAge` covers the four windows.
- Unit: `deriveSyncPillState({status, lastOkAt, nowMs})` pure function tested independently of React.
- Manual: each state is reachable via 005's debug hooks in `__DEV__` (set `_lastOutcome`, `_online`, `_inFlight` via `_internalSyncStatusStore`).
