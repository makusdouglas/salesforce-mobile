# Phase 0 Research — Order Assembly

## R-001 — How to store a two-mode (%/R$) discount

**Decision**: Add one string column `discount_mode` ('amount' | 'percent') to `orders` and `order_items`, alongside the existing `discount_amount` numeric column. The numeric column's meaning is interpreted through the mode: `'amount'` means BRL; `'percent'` means a percentage 0–100.

**Rationale**:

- The spec (FR-005, FR-006) requires both modes. A percent discount on a line must remain "10%" even as qty changes — so the stored semantic cannot be the derived absolute amount; it must be the user's intent (the value + the mode).
- The existing `discount_amount: number` column (shipped in schema v2, 001) is re-interpretable without rename. Renaming to `discount_value` would double migration complexity for zero behavioral gain; the name is acceptable in context.
- A single enum column is the lightest shape. Alternatives: a JSON blob (`discount: { mode, value }`) — rejected because Watermelon has no native JSON helper and we would lose indexability. Two separate columns (`discount_percent: number?`, `discount_amount: number?`) — rejected because it permits an illegal both-set state; the mode column makes the active slot unambiguous.
- Default `'amount'` means any row that somehow pre-exists (there are zero in prod — 001–008 never shipped orders) renders correctly as "no percent discount" with the existing amount value.

**Alternatives considered**:

- **JSON blob column**: more extensible for future discount types (BOGO, tiered), but premature (P3). Reconsider if future discounts appear.
- **Two nullable numeric columns** (`discount_percent`, `discount_amount`): representable but invites illegal states. Enum + one value column is strictly simpler.
- **Normalize into a child `discounts` table**: massive overkill for a one-value-per-row relationship. Would force a join on every totals computation.

**Implementation notes**:

- Migration v3 adds the column with `default 'amount'` at WatermelonDB level. The same default is applied in the Supabase DDL (see R-004).
- The model field name is `discountMode` (camelCase), mapped to column `discount_mode` (snake_case) via `@field('discount_mode')` — standard WatermelonDB convention.

## R-002 — Navigation structure for the order-assembly flow

**Decision**: A new `OrdersStack` nested inside `HomeStack`, with three routes:

- `OrderDraft` — params: `{ orderId: string } | { clientId: string }` (one or the other; the screen resolves/creates a draft in an effect).
- `AddToOrder` — params: `{ orderId: string; productId: string; variantId?: string }`. Presented as a modal stack screen (`presentation: 'modal'`) so the top-bar chevron-down affordance in the design matches the dismiss gesture.
- `OrderSummary` — params: `{ orderId: string }`.

Entry points:

- `ClientProfileScreen` → `navigation.navigate('Orders', { screen: 'OrderDraft', params: { clientId } })`.
- Home "Drafts in progress" card → `navigation.navigate('Orders', { screen: 'OrderDraft', params: { orderId } })`.
- Catalog in order-context → `ProductDetailScreen` "Adicionar ao pedido" CTA → `navigation.navigate('Orders', { screen: 'AddToOrder', params: { orderId, productId, variantId? } })`.

**Rationale**:

- Nesting inside `HomeStack` keeps orders a pure VENDEDOR concern — admin users don't see `HomeStack` so they don't see `OrdersStack` either. No extra role guard needed.
- A dedicated stack is cleaner than three loose routes on `HomeStack` because the three screens share a lifecycle (they operate on one `orderId` logical subject). Pushing "deeper" into the draft flow is semantically one navigation level below home, and native-stack's back-button behavior matches what users expect.
- Modal presentation for `AddToOrder` matches the Pencil design (chevron-down in the top-bar). Native-stack's `presentation: 'modal'` gives the right dismiss gesture on iOS and the right animation on Android.
- `OrderDraft` resolves/creates a draft inside the screen because the client-profile entry has no orderId yet. Doing it in the screen (rather than in the caller) keeps `ClientProfileScreen` free of order-service knowledge — clients feature stays decoupled from orders feature.

**Alternatives considered**:

- **Flat routes on `HomeStack`**: possible but scatters the order flow across a stack it shares with `HomePlaceholder` / `Settings`. Loses the "we are inside an order" mental model.
- **Separate tab**: violates UX6 (no mode toggle). Orders are not a top-level role; they are a sub-flow of client + catalog work.
- **Pre-create the draft in `ClientProfileScreen` before navigation**: couples clients feature to orders service. Keeping the draft-resolution inside `OrderDraft` preserves module boundaries.

## R-003 — How the catalog knows it is browsing in "order context"

**Decision**: Route parameter `inOrderId?: string` threaded through the catalog routes. When present, (a) `ProductDetailScreen`'s primary CTA becomes "Adicionar ao pedido" (otherwise it stays "Detalhes" or current behavior), (b) `CatalogScreen` shows a sticky bottom summary bar reading "N itens · R$ X · Voltar ao pedido" that navigates back to `OrderDraft` when tapped, (c) tapping an item navigates to `ProductDetail` with the same `inOrderId` forwarded.

**Rationale**:

- Route params are the idiomatic React Navigation mechanism and avoid introducing a global "current order" context. They also make the catalog's two modes trivially unit-testable (present or absent `inOrderId`).
- The catalog remains a normal browsing surface when `inOrderId` is absent; the order affordance is strictly additive.
- The summary bar carries two pieces of info the salesperson cares about (line count, running total) so they can build an intuition of where the order is without bouncing back.

**Alternatives considered**:

- **Global `CurrentOrderContext` provider**: would let any screen read "what order am I in?" without prop-drilling. Rejected because exactly two screens care (`CatalogScreen`, `ProductDetailScreen`); a context is over-engineering (P3). If a third screen later needs the same, revisit.
- **Duplicate catalog screens** (`CatalogBrowseScreen` vs `CatalogForOrderScreen`): worst of both worlds — duplicated UI logic plus duplicated nav wiring. The parameter-gate approach is one `if (inOrderId)` in each of two files.

## R-004 — Supabase-side DDL ordering

**Decision**: The Supabase `ALTER TABLE` to add `discount_mode` must land **before** the first WatermelonDB-side push that carries the new column. Concretely, the plan's Phase 1 Setup in tasks.md includes a task "Apply DDL via Supabase SQL editor" that runs:

```sql
alter table public.orders
  add column if not exists discount_mode text not null default 'amount'
  check (discount_mode in ('amount', 'percent'));

alter table public.order_items
  add column if not exists discount_mode text not null default 'amount'
  check (discount_mode in ('amount', 'percent'));
```

…and that task blocks the first implementation task under Phase 3 (service/writes). The app-side migration v3 can run at any time after the local db is rebuilt; it is not dependent on the remote DDL.

**Rationale**:

- Sync push (D1) serializes every column of changed rows. If a row is pushed with a column the server does not know, PostgREST rejects the entire batch — which would surface as a silent sync failure on the seller device.
- A `check` constraint mirrors the TypeScript union and catches any future rogue value at the database level. This is the server-side half of D4's runtime gate.
- `if not exists` + `default 'amount'` makes the DDL idempotent and safe to run in any order relative to seeding — no pre-existing orders rows exist in prod, so there is no backfill concern.

**Alternatives considered**:

- **Supabase migrations via a tool**: the project's current posture (P4) uses the Supabase dashboard / SQL editor for schema work. Adopting a migration tool is out of scope for MVP.
- **Make the new column nullable on the server side**: possible, but the `check` constraint is cheap insurance. Nullable would let a rogue NULL bypass the enum gate.

## R-005 — `send` handoff to the PDF/email flow

**Decision**: In this feature, `ordersService.send(orderId)` transitions the row to `status = 'sent'`, stamps `sent_at_ms = Date.now()`, and returns. No PDF generation, no email, no network call. The downstream PDF/email feature (R4, constitutionally mandated but deferred) will either (a) observe `orders` where `status = 'sent'` and `pdf_uri IS NULL`, or (b) be invoked explicitly by a later revision of this service that has the PDF feature as a dependency. That decision is deferred to the plan of the PDF/email feature.

**Rationale**:

- Shipping `send` today without shipping PDF is fine: D4 permits the `sent` status as a valid terminal state, and the spec's acceptance for User Story 3 is satisfied by the transition alone.
- Deciding the handoff contract now would require knowing the PDF feature's shape, which we don't. P3 says do not design for hypothetical future requirements.
- The `orders` table already has `pdf_uri` and `sent_at_ms` columns (from 001 schema v1). We don't need to add anything now.

**Alternatives considered**:

- **Block this feature until PDF ships**: contradicts the independent-testability stance of each user story; P1 (Assemble & persist) is already deliverable value on its own.
- **Implement a stub PDF-gen path**: mock work for no benefit. The spec's Assumptions section already scopes this out explicitly.

## R-006 — Discount clamping semantics (FR-016)

**Decision**: Clamping happens at totals-computation time, not at entry time. `computeOrderTotals` produces a `warnings: DiscountWarning[]` array alongside the numeric totals; the UI surfaces warnings inline (never a modal). Specifically:

- Line: if `discountMode = 'percent'` and `discountAmount > 100`, compute as if `100`; warning `line-percent-over-100`.
- Line: if `discountMode = 'amount'` and `discountAmount > qty × unitPrice`, compute line total as 0; warning `line-amount-over-subtotal`.
- Order: if `discountMode = 'percent'` and `discountAmount > 100`, compute as if `100`; warning `order-percent-over-100`.
- Order: if `discountMode = 'amount'` and `discountAmount > post-line-subtotal`, compute order total as 0; warning `order-amount-over-subtotal`.

**Rationale**:

- Clamping at computation time keeps the stored value faithful to user intent ("I wanted to give them a R$ 100 discount on a R$ 50 line" preserves intent if qty later increases). Clamping at entry would destroy that intent.
- Warnings in the payload let the UI decide how/when to show them without embedding UI in the math module. `%` mode stepper is already bounded, so practically this path fires only if a user types in `R$` mode or if a future feature loosens the stepper.
- "Inline warning, never modal" matches UX4's discreet-but-present stance.

**Alternatives considered**:

- **Throw on invalid discount**: rejected — the UI should surface, not crash.
- **Silently clamp without warning**: rejected — the salesperson deserves to know the math changed.
- **Reject the mutation at service level**: rejected — user intent should be preserved across qty changes; the store is the input, the derived total is the output.

## R-008 — Timestamp format for the Home drafts list (FR-017)

**Decision**: Reuse 008's relative-time formatter (`src/features/home/…/formatRelativeSyncAge.ts`) for the "last-saved timestamp" field on each drafts-list row. Shape: `< 60s → "agora"`, `1–59 min → "há N min"`, `1–23 h → "há N h"`, `24 h+ → "há N d"`.

**Rationale**: The formatter is already in the home feature, already tested, already matches the relative-time idiom used elsewhere in the app (sync pill). Building a new formatter or using absolute times would break visual consistency with Home's sync pill for no benefit.

**Alternatives considered**:

- **Absolute time ("14:32 · hoje")**: more precise but more visually heavy; rejected as inconsistent with 008's idiom.
- **New formatter just for drafts**: duplication without a reason. The P3 duplicate-before-generalize rule applies only after the second *independent* consumer emerges; drafts reusing 008's formatter IS the second consumer, and extraction is deferred until a third appears.

## R-007 — Recent patterns reused (no research needed)

For the record, the following were not re-researched because they are established in 001–008:

- **Feature-module layout** — `src/features/<domain>/{screens,components,hooks,services,...}` — established in 006/007/008. Orders follows the same shape.
- **Repository pattern on top of WatermelonDB collections** — established in 002, refined in 006/007. `ordersRepository` and `orderItemsRepository` follow the same shape.
- **`useViewport()` duplicate-before-abstract** — 006/007/008 all carry their own copy. Orders carries its own too. A fourth consumer is the earliest moment the generalized hook gets extracted (P3 duplicate-before-generalize rule).
- **Inline Portuguese copy per screen, English identifiers** — constitution §9; applied in every prior feature.
- **Manual UI QA against Pencil frames on both viewports** — 006/007/008 all manual-verify; 009 does too.
