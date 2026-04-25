# Client API Contract — Product Lifecycle + Granular Admin Roles

**Feature**: `016-product-lifecycle-roles`
**Date**: 2026-04-24

This contract enumerates every client-side module added or modified by this feature. Signatures are TypeScript; error modes use the project's existing `Result<T, E>` convention.

## `src/features/admin/products/productsService.ts` (modify)

Adds two functions; existing `createProduct`, `updateProduct`, `deleteProduct`, `listProducts` are unchanged except that `listProducts` grows an optional filter param.

```ts
type ActiveFilter = 'active' | 'inactive' | 'all';

interface ListProductsParams {
  activeFilter?: ActiveFilter;   // default: 'active'
  search?: string;               // matched case+diacritic-insensitive against name and category
}

function listProducts(params?: ListProductsParams): Promise<Product[]>;

// New.
function setProductActive(
  productId: string,
  active: boolean,
): Promise<Result<Product, 'network' | 'forbidden' | 'not_found' | 'conflict'>>;

// New. Used by AdminProductDeactivateConfirmModal.
function listDraftsUsingProduct(productId: string): Promise<number>;
```

Behavior:

- `setProductActive(id, false)` sends `{ active: false, deactivated_at: new Date().toISOString() }`.
- `setProductActive(id, true)` sends `{ active: true, deactivated_at: null }`.
- After success, both callers trigger `adminWriteTrigger()` from feature 014 to request a seller-side pull.
- `forbidden` maps to a 403 from RLS (e.g., a seller-only user bypassing the UI gate).

## `src/features/admin/users/usersService.ts` (new)

```ts
type Role =
  | 'seller'
  | 'manage-products'
  | 'manage-salespersons'
  | 'manage-clients'
  | 'superuser';

interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  roles: Role[];
  active: boolean; // from salespeople.active when the user is a seller; true for admin-only users
}

function listUsers(params?: { search?: string; role?: Role }): Promise<UserSummary[]>;

function getUser(userId: string): Promise<UserSummary | null>;

// Returns the user's new role set on success. Errors:
//   - 'self_demote_blocked'  → attempted to drop the caller's own last superuser role
//   - 'network' / 'forbidden' / 'not_found'
function setUserRoles(
  userId: string,
  roles: Role[],
): Promise<Result<Role[], 'self_demote_blocked' | 'network' | 'forbidden' | 'not_found'>>;
```

Behavior:

- `listUsers` joins `auth.users`, `salespeople`, and `user_roles` via a Postgres view (defined in migration 0016) so the client performs one read per list.
- `setUserRoles` diffs the target vs. existing role set and issues INSERTs / DELETEs in a single RPC wrapper. The seller role is never inserted or removed here — attempts are silently filtered out on the client (UI also prevents toggling it).
- `self_demote_blocked` is a pre-RLS client-side guard; the server trigger catches the race condition.

## `src/features/session/useAdminGate.ts` (new)

```ts
type AdminRole =
  | 'manage-products'
  | 'manage-salespersons'
  | 'manage-clients'
  | 'superuser';

// Returns true if the signed-in user carries the requested role OR superuser.
function useAdminGate(required: AdminRole): boolean;

// Returns true if the signed-in user carries ANY admin-grade role.
function useAnyAdminRole(): boolean;
```

## `src/features/session/roleBadgeMapping.ts` (new)

```ts
interface RoleBadge {
  label: string;      // Portuguese
  style: 'default' | 'secondary' | 'destructive';
}

function roleBadge(role: Role): RoleBadge;
```

Single source of truth for role display across `AdminUsersList` rows, `AdminUserRolesForm` toggles, and `ProfileScreen → Suas funções`.

## `src/features/catalog/catalogSelectors.ts` (modify)

The existing `selectCatalogItems()` selector adds `WHERE active = true` to every query it issues against WatermelonDB. All consumers (CatalogScreen grid, ProductDetailScreen, OrderAssembly product picker) observe the filtered list automatically.

## `src/features/orders/addLine.ts` (modify)

```ts
function addLine(
  draftId: string,
  productId: string,
  variantId: string | null,
  qty: number,
): Promise<Result<OrderItem, 'product_inactive' | 'not_found'>>;
```

Pre-insert guard: reads the product from WatermelonDB; refuses with `product_inactive` when `active = false`. The caller (OrderAssemblyScreen) converts the error into the banner "Produto descontinuado".

## `src/features/orders/draftHydrate.ts` (modify)

On `OrderDraftScreen` mount, runs:

```ts
function detectDiscontinuedLines(draft: OrderDraft): OrderItem[];
```

Returns the subset of the draft's items whose product is inactive. When non-empty, the screen opens `DraftDiscontinuedAlert` and disables the send action until the caller clears them via "Remover linhas e continuar" (which deletes those items).

## `src/features/orders/repeatLastOrder.ts` (modify)

```ts
interface RepeatPreview {
  clonableItems: OrderItem[];
  discontinuedItems: OrderItem[];
}

function previewRepeat(sourceOrderId: string): Promise<RepeatPreview>;

function cloneRepeat(sourceOrderId: string, keepDiscontinued: false): Promise<OrderDraft>;
```

Flow:

1. Client calls `previewRepeat(sourceOrderId)`.
2. If `discontinuedItems.length > 0`, `RepeatOrderDiscontinuedAlert` opens listing the names.
3. User taps "Continuar com ativos" → client calls `cloneRepeat(sourceOrderId, false)` which clones only `clonableItems`. If that set is empty, "Continuar com ativos" is disabled.
4. User taps "Cancelar" → nothing happens. No draft is created.

`cloneRepeat` NEVER silently drops lines — the two-step preview/clone ensures the alert always runs.

## `src/features/profile/ProfileScreen.tsx` (modify)

Appends a "Suas funções" section below the existing user info block. Renders each role in `session_state.roles` through `roleBadge(role)`. Empty state (no roles): "Sem funções atribuídas".

## WatermelonDB migration

- Schema version: 13 → 14.
- Migration body: ADD COLUMN `products.active boolean not null default true`, ADD COLUMN `products.deactivated_at integer null` (WatermelonDB stores timestamps as integers). Existing product rows receive `active = true`.
- File: `src/db/watermelon/migrations/0014_products_active.ts`.
