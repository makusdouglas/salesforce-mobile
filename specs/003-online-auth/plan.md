# Implementation Plan: Online-One-Time Authentication

**Branch**: `003-online-auth` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-online-auth/spec.md`

## Summary

Install Supabase Auth as the identity provider, introduce `expo-secure-store` for OS-enclave persistence of the refresh token, and stand up the minimum infrastructure that satisfies constitution §7 D5: a login screen that authenticates online, a session state machine that treats the refresh token as the offline credential of record, a silent-refresh loop that fires on connectivity recovery, a 90-day client-side TTL gate, a `requireSession()` gate that **only** asks for re-login when a feature attempts a network-requiring action, and a logout flow that revokes server-side and wipes the secure-store entry. No feature may call validate-token on every tap — that invariant is encoded as `FR-005` in the spec and enforced by keeping validation out of the repository/render paths and concentrating it at the sync boundary. This block does not modify WatermelonDB (block 002) and explicitly defers the local biometric/PIN lock (constitution §7 D6) to its own spec.

## Technical Context

**Language/Version**: TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (inherited from 001/002).
**Primary Dependencies**: `@supabase/supabase-js` (latest stable v2), `expo-secure-store` (Expo SDK 55 compatible), `@react-native-community/netinfo` (connectivity events). Dev: none new — the existing ESLint/Babel/TS toolchain covers this block. WatermelonDB is untouched.
**Storage**:
- **Refresh credential** + **last-successful-refresh timestamp** — `expo-secure-store` (iOS Keychain, Android EncryptedSharedPreferences).
- **Last logged-in email** (non-secret) — `expo-secure-store` co-located at a separate key (avoids adding AsyncStorage as a dependency; same lifecycle story).
- **Access token** — **in memory only** (FR-020). Lost on cold start, recovered by silent refresh on next connectivity window.
- **Salesperson business data** — WatermelonDB (block 002). Unaffected by this feature. Not wiped on refresh failure (FR-008a) or on logout (FR-013).
**Testing**: Constitution §9 — business-logic coverage first. Ship with unit-style coverage for the session state machine (`requireSession()`, TTL boundary at 90 days, queued-sync handoff) and for the secure-store adapter (JSON encode/decode, missing-key handling). UI of the login and re-login screens is verified manually against the acceptance scenarios in [spec.md](./spec.md). No E2E test harness is introduced.
**Target Platform**: iOS 13+ and Android 7+ (inherited).
**Project Type**: Mobile app, auth-infrastructure-and-screens addition on top of the existing Expo dev-client scaffold.
**Performance Goals**: Login screen interactive < 1 s (SC-010). Cold launch with valid stored session adds **0 s** of blocking network wait (SC-009). Online logout end-to-end < 3 s; offline logout < 1 s (SC-006).
**Constraints**: Offline-first (P1) governs this feature's core promise. Zero token-validation network calls during offline field work (FR-005, SC-002). No user-visible UI during happy-path silent refresh (FR-006, SC-003). Single-user-per-device (constitution §1).
**Scale/Scope**: ~18–22 new source files: 1 Supabase client, 1 secure-storage adapter for Supabase, 1 project secure-store wrapper, 1 session state store + event emitter, 1 `authService` (login/logout/refresh), 1 connectivity listener, 1 boot initializer, 2 screens (Login, Relogin), 1 `useSession` hook, 1 `requireSession` helper, 2 navigator updates, 1 `SessionProvider`, 1 error-mapping module, plus the barrel. Two configuration touches: `app.json` (expo-secure-store plugin — no-op on recent SDKs, added for clarity) and `.env.example` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | Only login, silent refresh, and logout cross the network. Business operations continue offline against WatermelonDB (block 002). Zero validate-token per tap — FR-005, SC-002. |
| P2 Local DB is source of truth | ✅ | Pass | Auth does not read or write business tables. Refresh failure and logout both preserve WatermelonDB (FR-008a, FR-013). |
| P3 MVP simplicity | ✅ | Pass | One session singleton with event-emitter subscription; a React Context for the `useSession` hook; no state library (constitution forbids Redux/MobX; Context + hooks suffice per §3). |
| P4 Reuse free tools | ✅ | Pass | Supabase Auth replaces a custom auth flow (constitution P4). No custom backend, no third-party auth SaaS. |
| P5 Salesperson data sacred | ✅ | Pass | FR-008a (keep data on refresh rejection), FR-013 (logout does not wipe local data), FR-012 (offer final sync on logout when connectivity is present). |
| §3 Mandatory — Expo managed + dev client | ✅ | Pass | Inherits the dev client from 002. `expo-secure-store` is an official Expo package — zero native-module friction. |
| §3 Mandatory — WatermelonDB | ✅ | Pass | Not modified. Auth layer imports nothing from `@/data/repositories` or `@/data/models`. |
| §3 Mandatory — Supabase | ✅ | Pass | First block to instantiate the JS client; lives in `src/data/supabase.ts`. Sync block will consume the same client. |
| §3 Mandatory — `expo-secure-store` | ✅ | Pass | Installed here per §7 D5. |
| §3 Mandatory — `expo-local-authentication` | N/A | — | Ships with the §7 D6 feature; FR-021 preserves independence. |
| §3 Forbidden — custom backend / Firebase / Redux/MobX / heavy UI | ✅ | Pass | None introduced. Session state uses an event emitter + Context. |
| R1 WatermelonDB is the single client data layer | ✅ | Pass | Auth does not bypass WatermelonDB — it does not read business data at all. Supabase client stays in `src/data/` per the 002 ESLint scope. |
| R2 Seven entities | ✅ | Pass | No entity change. |
| R3 Images in Storage | N/A | — | Not touched. |
| R4 PDF local, email via share sheet | N/A | — | Not touched. |
| R5 Discounts on order, not catalog | N/A | — | Not touched. |
| §5 UX1 Tap, not type | ⚠️ Justified | Pass | The login and re-login screens require typing an email and password by the nature of credential auth. Constitution UX1 allows typing for "notes and mandatory fields during registration"; once-every-90-days credential entry is within that allowance. Spec FR-017 mitigates: show/hide password toggle, email auto-fill from last login, no non-essential fields. |
| §5 UX2 Repeat previous order | N/A | — | Not touched. |
| §5 UX3 Useful empty states | ✅ | Pass | Login screen and the re-login prompt both carry salesperson-language copy (Portuguese, FR-016, FR-022). |
| §5 UX4 Discreet sync feedback | ✅ | Pass | Silent refresh has **no** user-visible affordance on the happy path (FR-006, SC-003). Sync-status indicator on home screen (block 001) stays the source of sync truth. |
| §6 D1 Pull then push | ✅ | Pass | Auth triggers a sync pass on successful silent refresh (FR-007); ordering is the sync block's responsibility. |
| §6 D2–D4 | N/A | — | Not touched. |
| §7 D5 Online-one-time + offline-persistent | ✅ | Pass | This feature **is** the implementation of D5. Every requirement in the spec traces to a D5 clause. |
| §7 D6 Mandatory local lock | ✅ | Pass | Explicitly out of scope — FR-021. Auth state and unlock state are independent by design. |
| §9 English identifiers | ✅ | Pass | All code identifiers, service names, hook names, file names in English. Portuguese only in UI strings. |

**Gate status (pre-research)**: PASS. One justified deviation (UX1 — typing is inherent to credential auth and falls under the constitutional "mandatory fields during registration" allowance).

## Project Structure

### Documentation (this feature)

```text
specs/003-online-auth/
├── plan.md              # This file
├── research.md          # Phase 0 — choices and their rationale
├── data-model.md        # Phase 1 — session state machine + secure-store payload shapes
├── quickstart.md        # Phase 1 — "how a feature uses the session"
├── contracts/
│   ├── auth-service.md  # Public API of authService
│   ├── session.md       # Session state machine + useSession hook
│   ├── secure-storage.md # What is stored, how keyed, how encoded
│   └── screens.md       # Login / Relogin screen contracts + navigation
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 — /speckit-tasks output (not created here)
```

### Source Code (repository root)

This block extends the existing scaffold from 001/002 with a Supabase client (joins `src/data/`) and a full `src/features/auth/` feature module (replacing the current stub). Feature-local subdirectories follow constitution §9 — all auth code is bounded under a single feature folder; nothing auth-specific sits at the top level.

```text
.
├── app.json                                # MODIFIED — add "expo-secure-store" plugin entry (no-op on SDK 55+ but explicit)
├── package.json                            # MODIFIED — add @supabase/supabase-js, expo-secure-store, @react-native-community/netinfo
├── .env.example                            # NEW — EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
└── src/
    ├── app/
    │   ├── navigation/
    │   │   ├── RootNavigator.tsx           # MODIFIED — branches on session state
    │   │   ├── AuthStack.tsx               # MODIFIED — Login + Relogin screens replace placeholder
    │   │   ├── HomeStack.tsx               # MODIFIED — add logout entry point (transitional — the real logout UI lands with home feature)
    │   │   └── types.ts                    # MODIFIED — AuthStackParamList covers Login and Relogin
    │   └── providers/
    │       └── AppProviders.tsx            # MODIFIED — wraps children with <SessionProvider>; invokes authBootstrap
    ├── data/
    │   ├── supabase.ts                     # NEW — Supabase client singleton, configured with a custom storage adapter that delegates to src/features/auth/storage/secureStore
    │   ├── index.ts                        # MODIFIED — re-exports { supabase } for other infrastructure (sync block will use it)
    │   └── (rest from 002 — unchanged)
    └── features/
        ├── auth/
        │   ├── index.ts                    # public barrel — exports authService, useSession, requireSession, SessionProvider, SessionStatus
        │   ├── service/
        │   │   ├── authService.ts          # login(), logout(), refresh()
        │   │   └── errors.ts               # AuthError type + error-code → UX-message mapping (FR-016)
        │   ├── session/
        │   │   ├── session.ts              # in-memory session state + event emitter
        │   │   ├── requireSession.ts       # the ONLY function that may surface the re-login prompt
        │   │   └── bootstrap.ts            # app-boot hydration: read secure store, compute initial state, start connectivity listener
        │   ├── storage/
        │   │   └── secureStore.ts          # typed wrapper over expo-secure-store (set/get/clear of { refreshToken, lastRefreshAtMs } and lastEmail)
        │   ├── connectivity/
        │   │   └── connectivity.ts         # NetInfo subscription; triggers silentRefresh() on offline→online transitions
        │   ├── hooks/
        │   │   └── useSession.ts           # React hook bridging session subscribers into React render cycle
        │   ├── components/
        │   │   ├── SessionProvider.tsx     # Context provider consumed by useSession
        │   │   └── PasswordField.tsx       # show/hide toggle (FR-017)
        │   └── screens/
        │       ├── LoginScreen.tsx         # replaces AuthPlaceholderScreen
        │       └── ReloginScreen.tsx       # Portuguese copy reassuring "your field data is safe" per FR-022
        ├── _debug/                         # existing (from 002)
        └── home/                           # existing — HomePlaceholderScreen gains a "Sair" (logout) row in a later task
```

**Structure Decision**: The Supabase JS client is the one cross-cutting piece that belongs in `src/data/` (it is the outbound gateway to remote infrastructure, shared in the future with the sync block). Everything else — the authService, secure-store adapter, session state, screens, hook, provider — is bounded under `src/features/auth/` and imported through its barrel `@/features/auth`. The root navigator and the `AppProviders` (under `src/app/`) are the only modules outside the feature folder that reach into auth; they do so through the barrel. `src/app/navigation/AuthStack.tsx` already exists from block 001 as a placeholder — this block replaces the placeholder screen with the real Login and Relogin screens.

**Rejected alternatives**:

- **A top-level `src/auth/` directory (sibling to `src/data/`)** — considered by analogy to 002's data layer, but rejected because auth has substantial UI (two screens, one provider, one hook) and §9 is explicit that code lives in feature folders. The data layer earned its top-level status precisely because it has **no** UI; auth does not share that property.
- **Feature-scoped Supabase client under `src/features/auth/lib/supabase.ts`** — rejected because the sync block (not-yet-built) will also need the same client instance. Two instances would mean two session states could diverge. Centralizing in `src/data/supabase.ts` keeps one source of truth.
- **Stateful `Zustand` or `Jotai` store for session state** — rejected by constitution §3 (state libraries discouraged) and P3 (MVP simplicity). An event emitter + a Context + a hook is ~40 lines and handles every case here.
- **`AsyncStorage` for `lastEmail`** — rejected; would add a dependency just to avoid co-locating non-secret data in secure store. `expo-secure-store` has no per-entry cost and two keys vs. one doesn't complicate the adapter.
- **Persist both access and refresh tokens** — rejected by FR-020. Persisting the access token would give a lost-device attacker a window before the next refresh; the 0-second latency saved at cold launch is not worth it (FR-014 says zero network wait is achieved through optimistic state anyway).
- **Validate-token on every network action** — rejected by FR-005 and SC-002 (and by the literal constitutional mandate "No feature may call validate-token on every tap"). `requireSession()` reads local state and only refreshes when no access token is cached or the one cached is known to be expired.

## Phase 1 post-design re-check

After Phase 1 artifacts (research, data-model, contracts, quickstart) were drafted, no constraint in the Constitution Check table was violated. Two things surfaced as discrete follow-on decisions that survived into the design:

1. **The session store emits events; React consumes them via Context**. The event emitter is synchronous; the React Context's `useSyncExternalStore` pattern provides concurrent-mode-safe subscriptions. This choice lets non-React code (the sync block, the connectivity listener, `requireSession`) read and react to state without a React tree.
2. **`requireSession()` is the only module that may surface the re-login UI**. Other modules call it; it alone knows when to navigate to `ReloginScreen`. This keeps the "prompt only on next network-requiring action" invariant in exactly one file — and makes it obvious in a code review if any other module tries to show the re-login screen.

**Gate status (post-design)**: PASS.

## Complexity Tracking

One justified deviation is recorded in the Constitution Check table; it is inherent to the feature and has no simpler alternative:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Login and re-login screens require typing (UX1 prioritizes tap-not-type) | Email + password is the authentication surface Supabase Auth accepts, and it is the supported free-tier identity flow for the MVP (constitution P4). Typing at the login screen is a once-per-90-days event on Wi-Fi, not an in-store operation. | Passwordless magic-link login (would add an email round-trip — blocks the salesperson from logging in on an un-internetted phone unless they are also on their email); biometric-first login (§7 D6's territory, not D5's; also requires a prior online login anyway, so biometrics cannot replace it, only complement it). |
