# Feature Specification: Project Foundation & Navigation Shell

**Feature Branch**: `001-project-foundation`
**Created**: 2026-04-19
**Status**: Draft
**Input**: User description: "Bootstrap the Expo + TypeScript project shell: managed workflow, strict tsconfig, React Navigation with a placeholder home and auth stacks, folder structure by feature (src/features/), ESLint + Prettier, dev/preview/production build scripts. No business features yet — just the scaffold every later feature lands on. Identifiers in English; UI copy in Portuguese per constitution §9."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Walking Skeleton Boots End-to-End (Priority: P1)

A fresh install of the app launches to a Portuguese welcome/home placeholder and lets the salesperson tap through to an authentication placeholder, proving the navigation shell is wired up before any real feature lands on top of it.

**Why this priority**: Nothing else can be delivered until the app reliably boots on the target devices. This is the minimum viable slice — a salesperson (or QA) can install the build, see the app open, and navigate between the two stacks that every subsequent feature will plug into.

**Independent Test**: Install the build on a physical iOS and Android device, cold-launch, confirm the home placeholder renders in Portuguese, tap the primary call-to-action, confirm navigation to the auth placeholder screen, and back-navigate to home. No crashes, no English copy, no blank screens.

**Acceptance Scenarios**:

1. **Given** the app is freshly installed on a supported device, **When** the user opens it for the first time, **Then** a welcome/home placeholder in Portuguese is visible within 3 seconds and no error or blank state is shown.
2. **Given** the user is on the home placeholder, **When** they tap the primary action, **Then** an authentication placeholder screen appears with the device's native back navigation available.
3. **Given** the user is on the auth placeholder, **When** they navigate back, **Then** they return to the home placeholder with no state loss.

---

### User Story 2 — A New Feature Lands Without Fighting the Scaffold (Priority: P2)

Any future feature (catalog, auth, orders, etc.) can be added under `src/features/<featureName>/` and wired into navigation without modifying unrelated folders, editing global registries, or introducing new conventions.

**Why this priority**: The whole point of this foundation is to stop re-deciding layout decisions for each feature. If every feature still requires scaffold edits, the foundation has failed.

**Independent Test**: A developer creates a dummy feature folder (e.g., `src/features/hello/`) containing a single screen and registers it in the appropriate navigation stack. The app recognises the screen, navigation works, and no file outside that feature folder needs structural changes beyond the navigation entry.

**Acceptance Scenarios**:

1. **Given** the scaffold is in place, **When** a developer adds a new feature folder with a single screen component, **Then** the app runs and renders that screen within its navigation stack without scaffold restructuring.
2. **Given** a new feature folder is added, **When** the developer runs lint and type-check, **Then** both pass with no scaffold-level adjustments required.

---

### User Story 3 — Quality Gates Are Active From Day One (Priority: P3)

Lint, format, and type-check commands are wired and pass on the initial scaffold, so the first business feature does not have to fight a broken tooling setup.

**Why this priority**: Lower priority than the walking skeleton itself, but delivering the scaffold without tooling guarantees it rots within a week. Still part of the MVP slice because setup cost is concentrated here.

**Independent Test**: Run the project's lint, format-check, and type-check commands on a fresh clone — all three exit with status 0 and no diagnostics.

**Acceptance Scenarios**:

1. **Given** a fresh checkout of the repository, **When** the developer runs the lint command, **Then** it completes successfully with zero errors and zero warnings on scaffold files.
2. **Given** a fresh checkout, **When** the developer runs the type-check command, **Then** it completes successfully under strict TypeScript settings.
3. **Given** a fresh checkout, **When** the developer runs the format-check command, **Then** every scaffold file is already formatted and no changes are suggested.

---

### Edge Cases

- What happens when the device's OS language is not Portuguese? The app still shows Portuguese copy — the MVP is for a single-language, Brazilian salesperson audience per the constitution.
- What happens if navigation state is interrupted (app backgrounded during transition)? Navigation must restore cleanly; no crash, no duplicated stacks.
- What happens when the developer adds a feature folder but forgets to register it in navigation? The feature simply is not reachable — no crash, and the app behaves as if it did not exist.
- What happens on unsupported OS versions? The scaffold targets the Expo SDK's default minimums (iOS 13+ / Android 7+); older devices are not supported by the MVP.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST boot on iOS and Android devices from an Expo managed-workflow build and display a home placeholder within 3 seconds of cold launch.
- **FR-002**: The home placeholder and the auth placeholder MUST render all user-visible copy in Portuguese; no English strings may appear in the UI.
- **FR-003**: The app MUST expose navigation between at least two top-level stacks — a home stack and an auth stack — with native back/forward navigation working on both platforms.
- **FR-004**: All source code MUST live under `src/features/<featureName>/` (plus a `src/app/` or equivalent root). There MUST NOT be a top-level `src/components/`, `src/hooks/`, or `src/utils/` global folder.
- **FR-005**: All application code MUST be TypeScript with strict compiler checks enabled.
- **FR-006**: Code-level identifiers (variable names, function names, file names, type names, folder names) MUST be in English; only literal UI strings and documentation intended for the salesperson may be in Portuguese.
- **FR-007**: The project MUST provide runnable lint, format-check, and type-check commands that pass on the scaffold with zero errors and zero warnings.
- **FR-008**: The project MUST provide three distinct build commands (or documented equivalents) for development, internal preview, and production distribution.
- **FR-009**: The scaffold MUST NOT introduce any technology forbidden by the constitution — no custom backend, no Firebase, no Redux/MobX, no heavy UI kit.
- **FR-010**: A developer MUST be able to add a new feature folder (a new screen + navigation entry) in under 20 minutes without modifying any scaffold file outside that feature folder and the navigation registration point.
- **FR-011**: The app MUST launch offline. No network request is required to reach the home placeholder.

### Key Entities

Not applicable — this feature establishes project structure and tooling only. No data entities are introduced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer cloning the repository onto a prepared workstation has a working development build running on a simulator in under 10 minutes.
- **SC-002**: Adding a new feature under `src/features/` and wiring it into navigation takes under 20 minutes of uninterrupted work for a developer familiar with the stack.
- **SC-003**: On every commit, the lint and type-check commands pass with zero errors and zero warnings on 100% of scaffold files.
- **SC-004**: Cold-launch on a mid-range Android device displays the home placeholder within 3 seconds 95% of the time.
- **SC-005**: Manual audit of the scaffold UI confirms that every user-visible string is in Portuguese and no English copy leaks into the app.
- **SC-006**: A walkthrough video or QA checklist demonstrates home → auth → back navigation working on both iOS and Android with no crashes across 20 consecutive cycles.

## Assumptions

- The target platforms are iOS (13+) and Android (7+) only. A web target is explicitly out of scope for the MVP; if later needed, it will go through its own spec.
- "Development", "preview", and "production" builds correspond to Expo's standard distribution model (local dev server + EAS internal distribution + EAS production submission), which matches the constitution's Expo managed-workflow requirement.
- The placeholder home and auth screens are intentionally minimal — a title, a short Portuguese label, and a primary action. Visual design refinement is deferred to feature-specific specs (auth, home dashboard).
- The scaffold does not ship automated tests. Per constitution §9, test investment is focused on business-logic features; a scaffold that boots and navigates is verified manually.
- Dev environment: solo developer on macOS with Xcode and Android Studio installed. The documented setup steps assume this baseline.
- Dependency footprint stays minimal: only the libraries strictly required to satisfy the functional requirements (Expo, React Navigation, TypeScript, ESLint, Prettier). Any additional library requires its own feature spec.
- Secure-store and local-authentication packages mentioned in constitution §3 are NOT installed in this feature — they arrive with the auth and local-lock features (blocks 003 and 004 in the backlog).
