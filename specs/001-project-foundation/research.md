# Research — Project Foundation & Navigation Shell

No `[NEEDS CLARIFICATION]` markers survived the spec. This file records the deliberate choices the plan's Technical Context is built on, so the next block does not re-litigate them.

## R1 — Expo SDK version

**Decision**: Expo SDK **55** (pinned at `~55.0.15`, the latest stable at implementation time on 2026-04-19 — npm dist-tags: `latest = 55.0.15`, `next = 55.0.15`).

**Rationale**: The constitution mandates Expo managed workflow. SDK 55 ships with React Native 0.83 and React 19.2, new-architecture enabled by default, iOS 13+ / Android 7+ baseline aligned with the spec, and first-class support for `expo-secure-store` and `expo-local-authentication` — the two dependencies that will land in blocks 003 and 004. Pinning to the current latest avoids a costly upgrade mid-MVP.

**History / errata**: The original plan proposed SDK 52 under the same rationale. At implementation time, `pnpm create expo-app@latest` bootstrapped the project against SDK 54 (the version the template still referenced), and SDK 55 was the actual latest on npm — so the scaffold was upgraded in place via `pnpm add expo@latest && pnpm dlx expo install --fix`. No architectural consequence; the versioned peer-dep set (React Native, `react-native-screens`, `react-native-safe-area-context`, `eslint-config-expo`) was re-pinned automatically by `expo install --fix`.

**Alternatives considered**:
- **SDK 54** (what the create-expo-app template still pins) — stable, but 55 had already shipped and was a cleaner starting point for a net-new project.
- **Canary / SDK 56 pre-release** — rejected; canary channels break often and the MVP does not need any 56-only feature.
- **Expo Router** as the navigation layer — attractive for file-based routing but couples navigation to the filesystem in a way that conflicts with the feature-folder convention (§9). Sticking with classic React Navigation keeps the rule clean and the mental model simple.

## R2 — Navigation library

**Decision**: React Navigation v7 with `@react-navigation/native-stack` (backed by `react-native-screens`).

**Rationale**: Native-stack uses platform-native view controllers (`UINavigationController` / `FragmentManager`), giving the salesperson OS-consistent back gestures and animations — important since the constitution prioritises "device feel" (UX1 tap-first). v7 has stable TypeScript support for `ParamList` generics, which we will use for the navigation contract.

**Alternatives considered**:
- **Expo Router** — rejected as in R1.
- **`@react-navigation/stack`** (JS-based) — more customisable but slower; unnecessary for placeholders and adds an animation responsibility later features do not need.

## R3 — State management strategy

**Decision**: Defer the choice to block 002. The scaffold introduces **no** state library — placeholders use component state only.

**Rationale**: Constitution §3 forbids Redux/MobX and narrows the choice to "Zustand or Context + hooks". Making the call now without a concrete feature that needs shared state would be speculative (P3 — MVP simplicity). Block 002 (WatermelonDB) will reach for cross-feature observables naturally; that is when we commit.

**Alternatives considered**:
- Install Zustand now — premature.
- Pick Context + hooks explicitly — also premature; might be wrong for sync-state concerns.

## R4 — Linting & formatting

**Decision**: `eslint-config-expo` v55 as the base ESLint config (tracks the SDK major), Prettier for formatting, Prettier integration via `eslint-config-prettier` (turns off conflicting stylistic rules). ESLint is pinned to **v9** — `eslint-plugin-react-hooks` (transitive) does not yet support ESLint v10 peer ranges, and SDK 55's config set is built against v9.

**Rationale**: `eslint-config-expo` is maintained alongside the SDK and ships React-Native-specific rules already tuned. Prettier handles formatting; having one opinionated formatter is in spirit with §9 and keeps diffs minimal.

**Alternatives considered**:
- **Biome** — faster, single-tool, but ecosystem coverage for React Native rules (hooks, native-module import checks) is thinner. Revisit when Biome reaches parity on RN-specific linting.

## R5 — Build profiles (EAS)

**Decision**: Three EAS profiles in `eas.json`: `development` (dev client, auto-increment off), `preview` (internal distribution, APK for Android / ad-hoc iOS), `production` (Store builds, auto-increment on).

**Rationale**: Spec FR-008 requires "development, internal preview, and production distribution". EAS's default three-profile model maps 1:1 and is the de-facto convention for Expo projects.

**Alternatives considered**:
- Local-only builds via `expo run:ios`/`expo run:android` — works for dev but cannot serve the "preview" slot (no shareable artifact).

## R6 — Testing stance for the scaffold

**Decision**: No automated tests in this feature. Verification is manual per the Success Criteria (SC-006: "walkthrough across 20 consecutive cycles").

**Rationale**: Constitution §9: "Tests MUST prioritize business-logic tests (discount calculation, PDF generation, sync merge). UI does NOT need exhaustive testing in the MVP." The scaffold has no business logic — adding test infrastructure without a target to cover would be scaffolding for scaffolding (P3).

**Alternatives considered**:
- Install Jest + React Native Testing Library now so later features only need to write tests — attractive, but two of the three later test targets (sync merge, PDF generation) are easier to unit-test in plain TypeScript modules *outside* the RN host, so the RNTL investment does not pay dividends until block 009+. Defer.

## R7 — Internationalisation

**Decision**: Hard-code Portuguese strings in this feature. Do not install `i18next` or `expo-localization`.

**Rationale**: The app targets a single audience (Brazilian salespeople) per constitution §1. Adding i18n infrastructure for a single-language MVP is a P3 violation. If multi-tenant / multi-country is ever reintroduced, it comes with its own spec (§8 out-of-scope list).

**Alternatives considered**:
- Install `i18next` and structure strings now — adds a dependency and a translation workflow for no immediate value.

## R8 — Theming

**Decision**: A minimal `src/app/theme/colors.ts` with a handful of placeholder tokens (background, foreground, primary). No design-system library (NativeWind, Tamagui, etc.) in this feature.

**Rationale**: The *real* design system is being established through the Pencil style guide ("Anchored Ribbon Grid") on a feature-by-feature basis starting at block 003. Committing to a React Native styling library now would pre-empt that decision. A tiny hand-rolled palette is enough to prove the scaffold.

**Alternatives considered**:
- **NativeWind** — strong contender later, but the Pencil → code translation pattern is not yet settled.
- **Tamagui** — heavier; wait until a feature has enough UI surface to justify.
