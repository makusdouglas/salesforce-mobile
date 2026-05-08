# Contract — Home Feature Public Surface

**Module**: `src/features/home/` — consumed by `src/app/navigation/HomeStack.tsx` only. Nothing else should import from `@/features/home` at runtime; Home is the leaf of the dependency tree.

## Barrel exports (`src/features/home/index.ts`)

```ts
export { HomeScreen } from './screens/HomeScreen';
export { SettingsScreen } from './screens/SettingsScreen';
```

Internal modules (components, hooks, summaries, formatters) are NOT re-exported. They are implementation details; importing them from outside the feature is forbidden.

## Route registration

`HomeStack` gains one new entry and swaps the component of an existing entry.

| Route name | Component | Options | Notes |
|------------|-----------|---------|-------|
| `HomePlaceholder` | `HomeScreen` | `{ headerShown: false }` | Route name preserved for compat — auth / lock post-action navigation continues to work. `options.title` is removed because `HomeTopBar` renders its own title. |
| `Settings` | `SettingsScreen` | `{ title: 'Configurações' }` | New route. Houses the inactivity-timeout segmented control, the logout button, and the two `__DEV__` debug entries (DataLayerSmoke, DatabaseInspector). |

Dev-only routes (`DataLayerSmoke`, `DatabaseInspector`) remain registered on `HomeStack` to avoid churn in the debug screens themselves; only their entry point moves from `HomePlaceholderScreen` to `SettingsScreen`.

## Param types (`src/app/navigation/types.ts`)

```ts
export type HomeStackParamList = {
  HomePlaceholder: undefined;
  Settings: undefined;              // NEW
  DataLayerSmoke: undefined;
  DatabaseInspector: undefined;
  Catalog: undefined;
  ProductDetail: { productId: string };
  Clients: undefined;
  ClientForm: undefined;
  ClientProfile: { clientId: string };
  NewOrder: { clientId: string };
};
```

## Navigation targets from Home

| Source | Target route | Condition |
|--------|--------------|-----------|
| Quick action: Catálogo card (populated) | `Catalog` | catalog count > 0 |
| Quick action: Catálogo card (empty CTA "Sincronizar agora") | no-navigate | triggers `onPullToRefresh()` from `@/features/sync`; stays on Home |
| Quick action: Clientes card (populated) | `Clients` | clients count > 0 |
| Quick action: Clientes card (empty CTA "Nova loja") | `ClientForm` | always tappable |
| Quick action: Rascunhos card (populated) | (placeholder no-op until 009) | drafts count > 0 — unreachable in v1 because `useDraftsSummary` returns 0 |
| Quick action: Rascunhos card (empty) | — | inert by spec FR-014 |
| Top bar: gear icon | `Settings` | always |
| Sync pill: tap | — | no-op except in `failed` state, where it calls `onPullToRefresh()` inline (no navigation) |
| Recent activity: populated row | (placeholder no-op until 009) | last-sent-order DTO non-null — unreachable in v1 |

## Accessibility contract

- `HomeTopBar` renders the title `"Início"` as `accessibilityRole="header"`.
- The sync pill carries an `accessibilityLabel` derived from the state: "Sincronizado há 2 min" / "Sincronizando" / "Sem conexão" / "Falha ao sincronizar, tocar para tentar novamente".
- Every quick-action card has `accessibilityRole="button"` with a label combining title + subtitle (populated) or title + empty-state subtitle.
- Every CTA button inside an empty-state card has `accessibilityRole="button"` and its Portuguese label.
- The gear icon has `accessibilityRole="button"` and `accessibilityLabel="Configurações"`.
