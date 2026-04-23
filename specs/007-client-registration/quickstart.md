# Quickstart: 007 Client Management

**Phase**: 1 — Design & Contracts
**Audience**: anyone reviewing the plan or about to start implementation
**Reading order**: [spec.md](./spec.md) → [plan.md](./plan.md) → this file → [contracts/](./contracts/)

This quickstart answers the five questions an implementer asks first:

1. How does `HomeStack` mount the new screens?
2. How does the form know which salesperson owns the client?
3. How does the profile render order history?
4. How do I seed clients on a simulator to exercise the UI?
5. What happens to the `NewOrder` stub when the orders feature ships?

## 1. HomeStack mounts four new routes

File: `src/app/navigation/HomeStack.tsx` — MODIFIED.

```tsx
import {
  ClientsScreen,
  ClientFormScreen,
  ClientProfileScreen,
  NewOrderStubScreen,
} from '@/features/clients';

// ...inside the <Stack.Navigator>...
<Stack.Screen
  name="Clients"
  component={ClientsScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="ClientForm"
  component={ClientFormScreen}
  options={{ headerShown: false, presentation: 'modal' }}  // modal feels right for a create form
/>
<Stack.Screen
  name="ClientProfile"
  component={ClientProfileScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="NewOrder"
  component={NewOrderStubScreen}
  options={{ headerShown: false }}
/>
```

File: `src/app/navigation/types.ts` — MODIFIED.

```ts
export type HomeStackParamList = {
  HomePlaceholder: undefined;
  DataLayerSmoke: undefined;
  Catalog: undefined;
  ProductDetail: { productId: string };
  Clients: undefined;                         // NEW
  ClientForm: undefined;                      // NEW
  ClientProfile: { clientId: string };        // NEW
  NewOrder: { clientId: string };             // NEW — future 008 replaces the target component
};
```

File: `src/features/home/screens/HomePlaceholderScreen.tsx` — MODIFIED.

Insert a new primary button **above** the existing `Ver catálogo`, so the clients flow is the top action on the Home screen:

```tsx
<Pressable
  accessibilityRole="button"
  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
  onPress={() => navigation.navigate('Clients')}
>
  <Text style={styles.buttonLabel}>Ver clientes</Text>
</Pressable>
```

No further routing changes. The clients feature is self-contained; the only edges into it are these three files.

## 2. Salesperson id resolution via `useActiveSalespersonId`

The `clients` table requires a `salespersonId`. Session state holds only the email, so the feature observes the `salespeople` collection and matches on email.

```ts
// src/features/clients/hooks/useActiveSalespersonId.ts (essence)
export function useActiveSalespersonId(): ActiveSalespersonState {
  const { status: sessionStatus, email } = useSession();
  const [state, setState] = useState<ActiveSalespersonState>({
    status: 'resolving',
    salespersonId: null,
  });

  useEffect(() => {
    if (sessionStatus !== 'Authenticated' || email === null) {
      setState({ status: 'resolving', salespersonId: null });
      return;
    }

    const sub = salespeopleRepository
      .observeAll()
      .subscribe({
        next: (rows) => {
          const match = rows.find((r) => r.email === email);
          setState(
            match
              ? { status: 'ready', salespersonId: match.id }
              : { status: 'missing', salespersonId: null },
          );
        },
      });
    return () => sub.unsubscribe();
  }, [sessionStatus, email]);

  return state;
}
```

**`ClientsScreen` usage**: accepts `'resolving' | 'ready' | 'missing'` without blocking; passes `salespersonId` (or `null`) to `useClients`, which returns an empty list when null. First-launch empty state (`<ClientEmptyView />`) renders, inviting the salesperson to tap `Cadastrar primeiro cliente`.

**`ClientFormScreen` usage**: blocks save until `status === 'ready'`. If `status === 'missing'` after the first sync attempt, shows the "precisamos sincronizar" blocking state with a `Sincronizar agora` button that calls `onPullToRefresh()`.

## 3. Profile order history

```ts
// src/features/clients/screens/ClientProfileScreen.tsx (essence)
const { clientId } = route.params;
const client = useObservableClient(clientId);   // thin wrapper around clientsRepository.observe(clientId)
const history = useClientOrderHistory(clientId); // see contracts/order-history.md
const viewport = useViewport();
```

The profile reads from two observations in parallel; neither blocks the UI. If either the client is missing (soft-deleted) or the history is empty, the respective empty state renders. The `Novo pedido` CTA navigates to `NewOrder`.

### Derivation (simplified)

```ts
// For each order, derive OrderHistoryRowDTO
function deriveRow(order: Order, items: OrderItem[]): OrderHistoryRowDTO {
  const subtotal = items.reduce(
    (acc, i) => acc + (i.quantity * i.unitPrice - i.discountAmount),
    0,
  );
  const total = Math.max(0, subtotal - order.discountAmount);
  return {
    id: order.id,
    createdAtMs: order.createdAtMs,
    status: order.status,
    total,
    itemCount: items.length,
  };
}
```

The hook sorts the resulting array by `createdAtMs` descending before returning.

## 4. Seeding clients on a simulator

The project already has the `DataLayerSmoke` dev screen which creates one salesperson + one client + one order + items. To exercise the clients list at non-trivial scale, add a temporary seed script alongside the smoke screen (or extend `DataLayerSmokeScreen` with a `Seed 20 clients` button) that iterates:

```ts
for (let i = 0; i < 20; i++) {
  await clientsRepository.create({
    salespersonId: sp.id,
    name: `Loja ${String.fromCharCode(65 + (i % 26))}${i}`,
    taxId: i % 3 === 0 ? `12.345.${String(100 + i).padStart(3, '0')}/0001-0${i % 10}` : undefined,
    addressLine: `Rua Exemplo, ${i}`,
    phone: i % 2 === 0 ? `(11) 9${String(10000000 + i).padStart(8, '0')}` : undefined,
    notes: i === 0 ? 'Cliente âncora' : undefined,
  });
}
```

This gives coverage for:

- Alphabetic letter chips across A–Z (names start with different letters).
- CNPJ field: some clients have it, some don't, matching FR-008 (optional).
- `updatedAt` ordering: every row has the same creation-time millisecond bucket + small delta; the "Recente" chip still ranks them by insert order.
- Mixed phone / email / null contact data.

Seeding is developer-only; no production path creates clients in bulk (per constitution D3 and the spec's out-of-scope list).

## 5. NewOrder stub → orders feature swap

The `NewOrder` route renders `NewOrderStubScreen` today. When feature 008 ships its own order-draft screen, the swap is a one-file change in `HomeStack.tsx`:

```tsx
// BEFORE (007 ships):
import { NewOrderStubScreen } from '@/features/clients';
<Stack.Screen name="NewOrder" component={NewOrderStubScreen} ... />

// AFTER (008 lands):
import { OrderDraftScreen } from '@/features/orders';
<Stack.Screen name="NewOrder" component={OrderDraftScreen} ... />
```

The route name `NewOrder` and the param `{ clientId: string }` are locked — see [contracts/order-history.md § Hand-off contract with feature 008](./contracts/order-history.md). Nothing in `src/features/clients/` needs to change at swap time. The stub screen can be deleted in 008 as a cleanup step.

## Running the module end-to-end (after implementation)

Once the implementation tasks are done:

1. Launch the app on a simulator. Sign in. Complete local lock. Land on `HomePlaceholder`.
2. Tap `Ver clientes` → `ClientsScreen`.
3. Empty state shows `Cadastrar primeiro cliente`. Tap it → `ClientFormScreen`.
4. Fill `Nome` (required), optionally type a CNPJ in any format, a free-text address, a contact line, and notes. Tap `Salvar`.
5. Form closes; the new client appears at the top of the list with a small "Aguardando envio" badge.
6. Pull down to refresh (triggers sync). Once the push completes, the badge clears.
7. Tap the row → `ClientProfileScreen`. Identity fields are visible; order history is empty with the "Nenhum pedido ainda" copy.
8. Tap `Novo pedido` → the stub screen today (until 008 ships).
9. Back out twice to the list. Type in the search field — results filter live. Tap the `Recente` chip — the list narrows to the 10 most recently touched clients. Tap an alphabetic chip — list narrows further.
10. Put the device in airplane mode and repeat steps 2 – 7: every path MUST work offline.

## Where to look next

- [contracts/clients-service.md](./contracts/clients-service.md) — the public barrel and what each screen renders.
- [contracts/client-draft-store.md](./contracts/client-draft-store.md) — the draft singleton.
- [contracts/search-filter.md](./contracts/search-filter.md) — the three pure search / filter functions.
- [contracts/order-history.md](./contracts/order-history.md) — history hook + the 007 → 008 hand-off.
- [contracts/responsive.md](./contracts/responsive.md) — phone / tablet branching rules.
- [research.md](./research.md) — all nine decisions and their rejected alternatives.
- [data-model.md](./data-model.md) — DTO shapes and existing entities this feature reads.
