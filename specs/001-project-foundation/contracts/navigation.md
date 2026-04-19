# Navigation Contract

The scaffold exposes a single interface to every future feature: the **navigation tree** and the TypeScript `ParamList` types that describe it. Features plug in by declaring their screens and registering them in a stack.

## Stacks

### `RootNavigator` (conditional)

Decides between `AuthStack` and `HomeStack` based on authenticated session state. In this feature the decision is hard-coded to `HomeStack` (no auth logic yet); block 003 replaces the hard-coded branch with real session detection.

```text
RootNavigator
├── AuthStack        (rendered when no session)
│   └── AuthPlaceholder
└── HomeStack        (rendered when session present — always, for now)
    └── HomePlaceholder
```

### `AuthStack`

Holds every screen related to sign-in, PIN setup, and local lock. Owned by feature `auth`. Blocks 003 and 004 will add real screens; this feature ships only `AuthPlaceholder`.

### `HomeStack`

Holds the salesperson-facing product surface — home dashboard, catalog, clients, orders, receipts, settings. Owned collectively by the product features; each feature registers its own screens on the same stack (no per-feature sub-stack in this feature; sub-stacks are allowed later if complexity warrants it).

## TypeScript ParamList types

Declared in `src/app/navigation/types.ts`. Identifiers in English (constitution §9). Displayed labels in Portuguese (set via screen `options`).

```ts
export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
};

export type AuthStackParamList = {
  AuthPlaceholder: undefined;
  // Login, PinSetup, Unlock, PinReset, etc. added by blocks 003 and 004
};

export type HomeStackParamList = {
  HomePlaceholder: undefined;
  // Real home, catalog, clients, orders, etc. added by blocks 006+
};
```

Every stack screen MUST be typed with its route's param entry via React Navigation's `NativeStackScreenProps<ParamList, 'RouteName'>`. No untyped `navigation` / `route` props are allowed.

## How a new feature registers a screen

1. Create the screen file under `src/features/<featureName>/screens/<ScreenName>.tsx`.
2. Add a new key to the appropriate `ParamList` in `src/app/navigation/types.ts`.
3. Add a `<Stack.Screen>` entry in `AuthStack.tsx` or `HomeStack.tsx`.

No scaffold file *outside* `src/app/navigation/types.ts` and the owning stack file needs to change. This is the measurable guarantee behind spec FR-010 and SC-002.

## What the scaffold does NOT provide

- **Deep-linking schema**. Added when a real feature requires it.
- **Screen transition overrides**. Defaults ship; per-screen overrides live in the screen's `options`.
- **Modal stacks**. Introduce when a feature needs them (e.g., order summary in block 009).
- **Tab navigation**. The home dashboard (block 008) will decide whether tabs or a stack is the right container.
