# Quickstart — Project Foundation

How a fresh developer goes from `git clone` to a running dev build in under 10 minutes (spec SC-001).

## Prerequisites

- macOS with Xcode 15+ and Android Studio installed (Command Line Tools available).
- Node.js 20.x (LTS).
- `pnpm` (or `npm` — project defaults to pnpm for lockfile consistency).
- Expo CLI available via `pnpm dlx expo`.
- An iOS Simulator installed in Xcode and at least one Android emulator configured.

## First run

```bash
git clone git@github.com:<owner>/salesforce-mobile.git
cd salesforce-mobile
pnpm install
pnpm typecheck   # should exit 0
pnpm lint        # should exit 0
pnpm format:check
pnpm start       # opens Metro
```

Then either:

- Press `i` in the Metro terminal to launch the iOS simulator with the dev build.
- Press `a` to launch the Android emulator with the dev build.

The app boots to **Bem-vindo** (home placeholder). Tap **Entrar** → you land on **Autenticação em breve** (auth placeholder). Back-navigate with the device gesture.

## Build profiles

| Profile | Command | Output |
|---------|---------|--------|
| Development (simulator dev client) | `pnpm build:dev` | Dev client build on EAS |
| Internal preview | `pnpm build:preview` | Shareable APK (Android) + ad-hoc IPA (iOS) |
| Production | `pnpm build:prod` | Store-ready builds |

All three profiles are defined in `eas.json`.

## Adding a new feature

See [contracts/navigation.md](./contracts/navigation.md). In short:

1. Create `src/features/<name>/screens/<Screen>.tsx`.
2. Add the route to the relevant `ParamList` in `src/app/navigation/types.ts`.
3. Register with `<Stack.Screen>` in `AuthStack.tsx` or `HomeStack.tsx`.

No scaffold surgery required. SC-002 says this should take under 20 minutes end-to-end.

## Code style expectations

- **Identifiers in English. UI copy in Portuguese.** Enforced by code review + the checklist in [checklists/requirements.md](./checklists/requirements.md). ESLint does not enforce this (there is no reliable rule for "human-language of string literals") — it is a human gate.
- **Folder structure by feature**, per constitution §9. Do not create `src/components/`, `src/hooks/`, or `src/utils/`. If a utility is truly cross-feature, place it under the first feature that needs it and copy or extract when a second feature shows up (P3 — simplicity over premature abstraction).
- **Conventional Commits** (`feat:`, `fix:`, `chore:`) — already enforced by the `after_*` git-commit hook.

## When in doubt

- Check the [spec](./spec.md) for what this feature does and does not cover.
- Check the [plan](./plan.md) Constitution-Check table for which rules are active now vs deferred.
- Check the [research.md](./research.md) for why the stack looks the way it does.
