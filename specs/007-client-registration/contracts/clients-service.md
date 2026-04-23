# Contract: `@/features/clients` public barrel

**Status**: authoritative for 007 Client Management
**File**: `src/features/clients/index.ts`

The clients feature exposes a single barrel. Every consumer — `HomeStack`, `HomePlaceholderScreen`, and the future 008 orders feature — MUST import only what is listed here. Internal modules (hooks, components other than the four screens, search primitives, draft store, CNPJ helpers, viewport hook, breakpoints) are NOT re-exported.

## Re-exports

```ts
// Screens (registered on HomeStack)
export { ClientsScreen } from './screens/ClientsScreen';
export { ClientFormScreen } from './screens/ClientFormScreen';
export { ClientProfileScreen } from './screens/ClientProfileScreen';
export { NewOrderStubScreen } from './screens/NewOrderStubScreen';

// Route param types (consumed by HomeStack types.ts)
export type ClientsRoutes = {
  Clients: undefined;
  ClientForm: undefined;
  ClientProfile: { clientId: string };
  NewOrder: { clientId: string };
};
```

No other exports. No hook is public (feature-internal wiring only). No component is public (screen-internal composition). The draft store, search primitives, and CNPJ helpers are strictly feature-local.

## Screens

### `ClientsScreen`

**Route**: `Clients` (no params).
**Renders**:

1. Top bar with back chevron (to Home) and `<SyncStatusIndicator />` on the right.
2. Search field + filter chip row when `hasAny === true`.
3. Client list (scrollable) when `hasAny === true` and filter produces results.
4. `<ClientNoMatchesView />` when `hasAny === true` and filter produces zero results.
5. `<ClientEmptyView />` when `hasAny === false` — points to `Cadastrar primeiro cliente`, navigates to `ClientForm`.

**Hand-offs**:

- Tap a row → `navigation.navigate('ClientProfile', { clientId })`.
- Tap `Novo cliente` header action (or the empty-state CTA) → `navigation.navigate('ClientForm')`.

**Offline behavior**: reads from `useClients()` which observes the local DB. Never blocks.

### `ClientFormScreen`

**Route**: `ClientForm` (no params).
**Renders**:

1. Top bar with back chevron and a `Salvar` action (disabled until form is valid and `useActiveSalespersonId().status === 'ready'`).
2. `<ClientFormFields />` — 5 labeled fields: `Nome`, `CNPJ`, `Endereço`, `Contato`, `Notas`.
3. When `useActiveSalespersonId().status === 'missing'`, a blocking state overlay: copy "Precisamos sincronizar pela primeira vez para cadastrar clientes. Conecte-se à internet e toque em atualizar." with a `Sincronizar agora` button that delegates to `onPullToRefresh()` from `@/features/sync`.

**Save flow**:

1. Read draft from `useClientDraft()`.
2. Call `clientsRepository.create({ salespersonId, name, taxId, phone, email, addressLine, notes })`.
3. On success: `clearDraft()`, `navigation.goBack()`.
4. On thrown validation (name empty — shouldn't happen since button is disabled): surface inline hint; do NOT clear the draft.
5. No network round-trip. No blocking spinner.

### `ClientProfileScreen`

**Route**: `ClientProfile` (param: `{ clientId: string }`).
**Renders**:

1. Top bar with back chevron + (optional future) overflow menu slot.
2. Identity block: name, CNPJ (or "—"), address, contact, notes, with inline `<PendingSyncBadge />` when the client is unsynced.
3. Section header `Pedidos` + `<OrderHistoryList />` (most recent first, or empty-state when no orders).
4. Bottom bar (sticky): primary `Novo pedido` CTA — tapping fires `navigation.navigate('NewOrder', { clientId })`.

**Tablet layout** (width ≥ 768): two-column split — identity on the left ≈ 45% width, order history + CTA on the right ≈ 55%.
**Phone layout** (width < 768): vertical stack, CTA pinned to the bottom safe area.

**Offline behavior**: observes `clientsRepository.observe(clientId)` and `useClientOrderHistory(clientId)` — both local. If the client is not found (soft-deleted between list render and profile open), shows a salesperson-language "client not available" state and offers a back action.

### `NewOrderStubScreen`

**Route**: `NewOrder` (param: `{ clientId: string }`).
**Purpose**: hand-off boundary for the future 008 orders feature (see research R-007).
**Renders**:

1. Top bar with back chevron.
2. Centered copy: "Preparando pedido para {client.name} — módulo em breve (feature 008)."
3. `Voltar para o cliente` button → `navigation.goBack()`.

**Contract with 008**: the route name `NewOrder` and the param `{ clientId: string }` are stable. When 008 ships, it replaces this component; the `HomeStack` registration moves the route target from `NewOrderStubScreen` to the new order-draft screen. No 007 code is touched.

## Route param types

```ts
type HomeStackParamList = {
  // ... existing (HomePlaceholder, Catalog, ProductDetail, DataLayerSmoke) ...
  Clients: undefined;
  ClientForm: undefined;
  ClientProfile: { clientId: string };
  NewOrder: { clientId: string };
};
```

`types.ts` merges the clients-feature entries into the existing `HomeStackParamList`.

## Accessibility

Every tappable element in the four screens MUST declare `accessibilityRole="button"` and a `accessibilityLabel` in Portuguese. The top-bar back chevron uses `accessibilityLabel="Voltar"`, consistent with `CatalogScreen` (006).

## Language

All user-visible strings are Portuguese (constitution §9). Identifiers (component names, hook names, type names, variable names) are English. Copy lives colocated with the screen or component that renders it — no central strings file.
