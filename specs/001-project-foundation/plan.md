# Implementation Plan: Project Foundation & Navigation Shell

**Branch**: `001-project-foundation` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-project-foundation/spec.md`

## Summary

Bootstrap the salesperson app as a walking skeleton: an Expo managed-workflow build with TypeScript strict mode, a feature-folder source layout under `src/features/`, React Navigation wiring a placeholder home stack and a placeholder auth stack, linting/formatting tooling, and EAS build profiles for dev/preview/production. No business feature lands here — the deliverable is the scaffold every subsequent block (auth, sync, catalog, orders…) will plug into. All code identifiers in English; every user-visible string in Portuguese per constitution §9.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
**Primary Dependencies**: Expo SDK 55 (managed) — React Native 0.83.x and React 19.2.x are pinned by the SDK; `@react-navigation/native` + `@react-navigation/native-stack` (v7); `react-native-safe-area-context`, `react-native-screens`. Dev: `eslint` (v9), `eslint-config-expo` (v55), `eslint-config-prettier`, `prettier`, `@types/react`. *Originally planned against SDK 52; bumped to SDK 55 at implementation time — see research.md R1.*
**Storage**: Not applicable — this feature introduces no persistence. WatermelonDB arrives in block 002.
**Testing**: Manual verification only (per constitution §9 — test investment goes to business logic, not scaffold).
**Target Platform**: iOS 13+ and Android 7+ (per spec Assumptions). Expo managed workflow covers both. No web target.
**Project Type**: Mobile app (single codebase, no backend in-repo — Supabase is the remote backend, out of scope for this feature).
**Performance Goals**: Cold launch to home placeholder visible in under 3 s on a mid-range Android device (spec SC-004).
**Constraints**: Offline-capable from cold launch (spec FR-011 + constitution P1). No forbidden dependency (§3 Forbidden list: Firebase, custom backend, Redux/MobX, heavy UI kit). Identifiers in English, UI copy in Portuguese (§9).
**Scale/Scope**: ~12–18 source files in the scaffold; two placeholder screens; one root navigator; zero data entities; one ESLint config; one Prettier config; one EAS config.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | FR-011 requires cold boot without network; placeholders have no network calls. |
| P2 Local DB is source of truth | N/A | — | No data in this feature. Deferred to block 002. |
| P3 MVP simplicity | ✅ | Pass | Only the minimum libs; no premature architecture. |
| P4 Reuse free tools | N/A | — | No admin surface; no backend. |
| P5 Salesperson data sacred | N/A | — | No data. |
| §3 Mandatory Stack — Expo managed, TS | ✅ | Pass | Both adopted as the scaffold. |
| §3 Mandatory Stack — WatermelonDB, Supabase, expo-print, expo-secure-store, expo-local-authentication | Deferred | Pass | Intentionally NOT installed here; each arrives with its owning feature block (002, 003, 004, 011). Documented in spec Assumptions. |
| §3 Forbidden — Firebase, custom backend, Redux/MobX, heavy UI | ✅ | Pass | None introduced. State strategy deferred (block 002+ will settle on Zustand or Context per §3). |
| §4 R1–R5 Architecture rules | N/A | — | No data layer, discounts, or images yet. Folder structure leaves room for `src/features/<feature>/` to own its data adapters later. |
| §5 UX1–UX4 | Partial | Pass | Placeholders use tap-only interaction (UX1). No modal spinners. Full UX work deferred to feature blocks. |
| §6 D1–D4 Sync rules | N/A | — | No sync yet. |
| §7 D5–D6 Auth rules | N/A | — | Auth deferred. The scaffold includes an auth stack placeholder but NO token logic, secure store, or local lock. |
| §9 Code Conventions | ✅ | Pass | English identifiers + Portuguese UI strings + feature-folder structure enforced via FR-004, FR-006. Conventional Commits enforced via git hook (existing). |

**Gate status**: PASS. No violations, no complexity-tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (empty — no entities)
├── quickstart.md        # Phase 1 output — dev onboarding
├── contracts/
│   └── navigation.md    # Navigation contract the scaffold exposes to future features
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output — /speckit-tasks
```

### Source Code (repository root)

```text
.
├── app.json                             # Expo config (name, slug, splash, icons placeholders, scheme)
├── App.tsx                              # Entry — mounts RootNavigator inside SafeAreaProvider
├── package.json                         # scripts: start, ios, android, lint, format, typecheck, build:dev|preview|prod
├── tsconfig.json                        # strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├── babel.config.js                      # Expo preset
├── eslint.config.js                     # eslint-config-expo + project rules
├── .prettierrc
├── .prettierignore
├── .gitignore
├── eas.json                             # build profiles: development, preview, production
└── src/
    ├── app/                             # app-level composition (NOT a feature)
    │   ├── navigation/
    │   │   ├── RootNavigator.tsx        # Decides between AuthStack / HomeStack (always HomeStack in this feature — no auth yet)
    │   │   ├── AuthStack.tsx
    │   │   ├── HomeStack.tsx
    │   │   └── types.ts                 # ParamList types for each stack (English identifiers)
    │   ├── providers/
    │   │   └── AppProviders.tsx         # SafeAreaProvider wrapper (placeholder for future providers)
    │   └── theme/
    │       └── colors.ts                # Minimal palette — placeholder, real tokens land with block 005/008
    └── features/
        ├── home/
        │   └── screens/
        │       └── HomePlaceholderScreen.tsx   # Portuguese copy: "Bem-vindo", CTA "Entrar"
        └── auth/
            └── screens/
                └── AuthPlaceholderScreen.tsx   # Portuguese copy: "Autenticação em breve"
```

**Structure Decision**: Single mobile app (Expo managed workflow), feature-folder layout per constitution §9. Navigation lives under `src/app/navigation/` because it is app-level composition, not a product feature; the §9 rule forbids type-based *global* folders like `src/components/`, but permits an `app/` layer for providers, navigation root, and theme. Each product feature owns its screens, hooks, components, and data access inside `src/features/<name>/`.

Rejected alternatives:
- **Bare workflow** — heavier setup, no obvious gain for an offline-first mobile app that does not need native modules the managed workflow cannot support. Kept open via §3 "Allowed with justification" if a later feature requires it.
- **Monorepo with `apps/mobile` + `packages/*`** — over-engineering for a solo dev / single-app MVP (P3). Revisit only if an admin web surface emerges.
- **`src/navigation/` at root** — would create exactly the type-based global folder §9 forbids. Placed under `src/app/` so `src/` top level stays limited to `app/` + `features/`.

## Phase 1 post-design re-check

Same table as above — no design decision in Phase 1 contradicts any rule. Navigation contract ([contracts/navigation.md](./contracts/navigation.md)) is a lightweight interface between scaffold and features and introduces no forbidden tech.

**Gate status (post-design)**: PASS.

## Complexity Tracking

No Constitution-Check violations. Table intentionally empty.
