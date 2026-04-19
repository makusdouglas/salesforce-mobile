# Tasks: Project Foundation & Navigation Shell

**Input**: Design documents from `/specs/001-project-foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/navigation.md, quickstart.md

**Tests**: Automated tests are NOT generated in this phase. Per constitution §9, scaffold verification is manual (spec SC-006). Test investment is reserved for business-logic features (blocks 006+).

**Organization**: Tasks are grouped by user story so each story can be delivered as an independent MVP increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]** — can run in parallel with other [P] tasks in the same block (different files, no shared dependency still in flight).
- **[Story]** — maps the task to User Stories US1 / US2 / US3 from [spec.md](./spec.md). Setup, Foundational, and Polish tasks have no story tag.

## Path Conventions

All source paths are relative to the repository root `/Users/markusdouglas/DEV/Personal/salesforce-mobile/`. Mobile app, single codebase, feature-folder layout per constitution §9.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Expo project, install every dependency the scaffold needs, and wire tooling so later phases land on a clean base.

- [x] T001 Initialize the Expo managed project at the repo root using `pnpm create expo-app@latest . --template blank-typescript --no-install` (keep existing files like `CLAUDE.md`, `SPECS.md`, `layout.pen`, `.specify/`, `.claude/` intact — resolve any overwrite prompts manually).
- [x] T002 Configure pnpm as the package manager: set `"packageManager": "pnpm@9"` in `package.json`, run `pnpm install`, commit `pnpm-lock.yaml`, delete any stray `package-lock.json` or `yarn.lock`.
- [x] T003 [P] Tighten `tsconfig.json` — enable `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `skipLibCheck: true`; extend `expo/tsconfig.base`.
- [x] T004 Install navigation runtime: `pnpm add @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context`.
- [x] T005 [P] Install and configure ESLint — `pnpm add -D eslint eslint-config-expo eslint-config-prettier`; create `eslint.config.js` extending `eslint-config-expo` and `eslint-config-prettier`.
- [x] T006 [P] Install and configure Prettier — `pnpm add -D prettier`; create `.prettierrc` with `{ "singleQuote": true, "trailingComma": "all", "printWidth": 100, "semi": true }`; create `.prettierignore` ignoring `node_modules`, `.expo`, `ios`, `android`, `dist`.
- [x] T007 [P] Create `eas.json` with three profiles — `development` (dev client, `distribution: internal`), `preview` (internal distribution, APK on Android, simulator build on iOS), `production` (store builds, `autoIncrement: true`).
- [x] T008 [P] Add scripts to `package.json` — `start`, `ios`, `android`, `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `build:dev`, `build:preview`, `build:prod`.
- [x] T009 Configure `app.json` — set `name`, `slug`, `scheme`, iOS `bundleIdentifier`, Android `package`, `supportsTablet: false` (phone target per §1), placeholders for `icon` and `splash`.
- [x] T010 Ensure `.gitignore` covers Expo artifacts (`.expo/`, `dist/`, `web-build/`, `*.log`), native folders if they ever appear, and the existing `temp.env`.

**Checkpoint**: `pnpm start` boots Metro; `pnpm typecheck`, `pnpm lint`, `pnpm format:check` all exit 0 on the empty template.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the folder layout and app-level composition that every feature plugs into. No user story can proceed until this is done.

**⚠️ CRITICAL**: No user story work begins until Phase 2 is complete.

- [x] T011 Create the source tree directories: `src/app/navigation/`, `src/app/providers/`, `src/app/theme/`, `src/features/home/screens/`, `src/features/auth/screens/`. Add `.gitkeep` where a folder would otherwise be empty after this phase.
- [x] T012 [P] Create `src/app/theme/colors.ts` exporting a minimal palette object — `background`, `foreground`, `primary`, `muted`. Placeholder values, not final tokens (real design tokens arrive with block 005 / 008 per research R8).
- [x] T013 [P] Create `src/app/navigation/types.ts` exporting `RootStackParamList`, `AuthStackParamList`, and `HomeStackParamList` exactly as defined in [contracts/navigation.md](./contracts/navigation.md) — English identifiers, `undefined` params in this feature.
- [x] T014 [P] Create `src/app/providers/AppProviders.tsx` — a component that wraps children in `SafeAreaProvider`. Placeholder for future providers (theme, auth context, db).
- [x] T015 Create `src/app/navigation/RootNavigator.tsx` — imports `createNativeStackNavigator`, types with `RootStackParamList`, renders the `HomeStack` unconditionally (no auth logic — block 003 replaces this with real session branching per contracts/navigation.md).

**Checkpoint**: Source tree matches plan.md §"Source Code". `pnpm typecheck` still exits 0. No screens wired yet.

---

## Phase 3: User Story 1 - Walking Skeleton Boots End-to-End (Priority: P1) 🎯 MVP

**Goal**: Install app → see Portuguese home placeholder → tap → reach auth placeholder → back → home. No crashes, no English copy.

**Independent Test**: Install a dev build on one iOS and one Android device, cold-launch, verify spec acceptance scenarios #1, #2, #3 pass; repeat navigation 20× without crash (SC-006).

### Implementation for User Story 1

- [x] T016 [P] [US1] Create `src/features/home/screens/HomePlaceholderScreen.tsx` — functional component typed `NativeStackScreenProps<HomeStackParamList, 'HomePlaceholder'>`. UI: centered `<Text>Bem-vindo</Text>` heading, a `<Pressable>` labeled "Entrar" that calls `navigation.navigate('AuthPlaceholder')` (via root). Background uses `colors.background`, heading uses `colors.foreground`, button uses `colors.primary`. No network calls, no async effects.
- [x] T017 [P] [US1] Create `src/features/auth/screens/AuthPlaceholderScreen.tsx` — same typing pattern against `AuthStackParamList`. UI: centered `<Text>Autenticação em breve</Text>` heading and a muted subtitle "Voltar para continuar". No inputs, no network.
- [x] T018 [US1] Create `src/app/navigation/HomeStack.tsx` — `createNativeStackNavigator<HomeStackParamList>()`, single `<Stack.Screen name="HomePlaceholder" component={HomePlaceholderScreen} options={{ title: 'Início' }} />`. (depends on T016)
- [x] T019 [US1] Create `src/app/navigation/AuthStack.tsx` — mirror of HomeStack for the auth side, `title: 'Autenticação'`. (depends on T017)
- [x] T020 [US1] Update `App.tsx` — import `NavigationContainer` from `@react-navigation/native`, wrap `RootNavigator` inside `NavigationContainer` inside `AppProviders`. Remove the default Expo template body. Entry should be ~10 lines.
- [x] T021 [US1] Wire `RootNavigator.tsx` to render `AuthStack` OR `HomeStack` within a root `createNativeStackNavigator<RootStackParamList>()` — register `Auth` and `Home` screens, set `initialRouteName="Home"` (block 003 will swap this to conditional). (depends on T015, T018, T019)
- [x] T022 [US1] Manual verification — iOS simulator (iPhone 15, iOS 17): `pnpm ios`, cold launch, confirm acceptance scenario #1 (PT home in <3s, no errors). Tap "Entrar", confirm scenario #2 (auth screen + native back). Back-navigate, confirm scenario #3 (home restored). Capture a screen recording and attach to the PR.
- [x] T023 [US1] Manual verification — Android emulator (Pixel 6, API 33): repeat T022 flow. Attach recording.
- [ ] T024 [US1] Stress cycle — run 20 consecutive home → auth → back cycles on each platform without relaunch; confirm no crash, no memory leak visible in the dev menu, no state drift (SC-006). Note pass/fail in PR.

**Checkpoint**: Walking skeleton verified on both platforms. The MVP of this block is shippable here.

---

## Phase 4: User Story 2 - A New Feature Lands Without Fighting the Scaffold (Priority: P2)

**Goal**: Prove the scaffold is extensible — adding a dummy feature needs changes only inside its own folder + a single navigation-types + single stack-registration edit.

**Independent Test**: A developer adds a throwaway screen under `src/features/smoke/`, registers it, runs the app, confirms it renders, then reverts. End-to-end in <20 min (SC-002). No scaffold file outside `src/app/navigation/types.ts` and `src/app/navigation/HomeStack.tsx` should need to change.

### Implementation for User Story 2

- [x] T025 [US2] Dry-run extensibility test — create `src/features/smoke/screens/SmokeScreen.tsx` (simple `<Text>Smoke</Text>` screen), add `Smoke: undefined` to `HomeStackParamList` in `src/app/navigation/types.ts`, register with `<Stack.Screen name="Smoke" component={SmokeScreen} />` in `src/app/navigation/HomeStack.tsx`. Add a temporary button in `HomePlaceholderScreen.tsx` that navigates to `Smoke`. Run the app and confirm navigation works.
- [x] T026 [US2] Audit the diff — run `git diff --stat` and confirm changed files are ONLY `src/features/smoke/**`, `src/app/navigation/types.ts`, `src/app/navigation/HomeStack.tsx`, and the one-line addition in `HomePlaceholderScreen.tsx`. No other scaffold files touched. Record duration (must be under 20 min per SC-002) in the PR.
- [x] T027 [US2] Revert the dry-run — `git checkout -- src/features/smoke` (delete the whole folder), revert the `types.ts`, `HomeStack.tsx`, and `HomePlaceholderScreen.tsx` changes. Confirm `pnpm typecheck` and `pnpm lint` still pass.

**Checkpoint**: Spec FR-010 and SC-002 validated on real code. US2 is a procedural proof, not persisted code.

---

## Phase 5: User Story 3 - Quality Gates Are Active From Day One (Priority: P3)

**Goal**: Lint, format, and type-check all pass with zero diagnostics on the complete scaffold.

**Independent Test**: On a fresh clone, `pnpm typecheck`, `pnpm lint`, and `pnpm format:check` each exit 0 with no output except successful completion.

### Implementation for User Story 3

- [x] T028 [US3] Run `pnpm typecheck` against the full scaffold; fix any type errors (likely in navigation typing edge cases); re-run until exit 0 with zero diagnostics.
- [x] T029 [US3] Run `pnpm lint`; fix any ESLint errors or warnings on scaffold files; re-run until exit 0 with zero diagnostics. No `eslint-disable` directives in scaffold files.
- [x] T030 [US3] Run `pnpm format` to normalise formatting, then `pnpm format:check` must exit 0.
- [x] T031 [US3] Document the three gate commands in [quickstart.md](./quickstart.md)'s "First run" section (they are already listed) and confirm they appear in `package.json` `scripts` from T008.

**Checkpoint**: Spec SC-003 validated. All three gates pass cleanly on the scaffold.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish the onboarding-ready state and double-check cross-story measurements.

- [x] T032 [P] Create a minimal `README.md` at repo root with: project name, one-paragraph summary, link to [constitution.md](.specify/memory/constitution.md), link to [SPECS.md](./SPECS.md), link to [quickstart.md](./specs/001-project-foundation/quickstart.md).
- [x] T033 [P] Add `.editorconfig` at repo root aligning with Prettier: `indent_style = space`, `indent_size = 2`, `end_of_line = lf`, `charset = utf-8`, `trim_trailing_whitespace = true`, `insert_final_newline = true`.
- [ ] T034 Fresh-clone onboarding dry-run — on a clean checkout under `/tmp/salesforce-mobile-clean`, run the [quickstart.md](./quickstart.md) "First run" section end-to-end, time it. Must finish under 10 min (SC-001); record the measured time in the PR description.
- [x] T035 Audit UI copy — grep the scaffold for English strings in render output (`grep -RE '<Text[^>]*>[A-Z][a-z]+' src/`) and confirm every visible string is Portuguese (SC-005). Flag any leaks and fix.
- [x] T036 Update the current-plan reference in `CLAUDE.md` — keep pointing to [specs/001-project-foundation/plan.md](./specs/001-project-foundation/plan.md) until this block ships; next block will overwrite it.

**Checkpoint**: All success criteria (SC-001 through SC-006) measured and recorded. Block is ready to merge.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — starts immediately.
- **Phase 2 (Foundational)**: Requires Phase 1 complete — BLOCKS all user stories.
- **Phase 3 (US1)**: Requires Phase 2 complete.
- **Phase 4 (US2)**: Requires Phase 3 complete (the dry-run adds a screen to `HomeStack`, which exists only after T018).
- **Phase 5 (US3)**: Requires Phase 3 complete (typecheck/lint must run against real screens). Can run in parallel with Phase 4 by different developers.
- **Phase 6 (Polish)**: Requires Phases 3 + 5 complete. Phase 4 is a procedural verification and does not persist code, so Polish does not wait on it.

### Story Dependencies

- **US1 (P1)** — no dependencies on other stories. Independently shippable.
- **US2 (P2)** — depends on US1 because the dry-run exercises the stack US1 creates. But it does not modify or rely on US1 behaviour beyond navigation existing.
- **US3 (P3)** — depends on US1 for the presence of scaffold files to lint/typecheck.

### Parallel Opportunities

- Phase 1: T003, T005, T006, T007, T008 run in parallel (different files).
- Phase 2: T012, T013, T014 run in parallel (different files).
- Phase 3: T016 + T017 run in parallel (two screen files, independent). T018 depends on T016; T019 depends on T017 — they can still run in parallel after T016/T017.
- Phase 6: T032, T033 run in parallel.

---

## Parallel Example: Phase 1 Tooling

```bash
# These can be kicked off concurrently once T001, T002, T004 are complete:
Task: "T003 — Tighten tsconfig.json"
Task: "T005 — Install and configure ESLint"
Task: "T006 — Install and configure Prettier"
Task: "T007 — Create eas.json with three profiles"
Task: "T008 — Add package.json scripts"
```

## Parallel Example: User Story 1 Screens

```bash
# T016 and T017 are independent screen files:
Task: "T016 — Create src/features/home/screens/HomePlaceholderScreen.tsx"
Task: "T017 — Create src/features/auth/screens/AuthPlaceholderScreen.tsx"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001 → T010).
2. Complete Phase 2: Foundational (T011 → T015) — **cannot skip**.
3. Complete Phase 3: US1 (T016 → T024).
4. **STOP and VALIDATE**: acceptance scenarios #1–#3 + 20-cycle stress test (SC-006).
5. This is a shippable increment — merge `001-project-foundation` into `develop`, tag, and move on.

### Incremental Delivery (Recommended for solo dev)

1. Setup + Foundational → checkpoint.
2. US1 → manual test → PR.
3. US3 (quality gates) → PR.
4. US2 (extensibility dry-run) → PR (optional — can also live in US1 PR if small).
5. Polish → final PR.

### Parallel Team Strategy (not applicable — solo project)

Not relevant for this block. Documented for completeness in case a second developer joins mid-MVP.

---

## Notes

- `[P]` means different files + no pending dependency. Strict rule.
- No automated tests in this block per constitution §9 — manual verification tasks (T022, T023, T024, T034, T035) substitute.
- Commit after each task or per-story group; the `after_tasks` git hook will prompt you. Use Conventional Commits (`feat(scaffold): ...`, `chore(tooling): ...`) per §9.
- The `001-project-foundation` branch was created by the `before_specify` hook; all commits for this block land there until merged.
- After this block ships, block **002 — WatermelonDB Schema & Data Layer** overwrites `.specify/feature.json` and `CLAUDE.md`'s current-plan pointer.
