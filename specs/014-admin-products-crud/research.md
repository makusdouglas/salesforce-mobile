# Research — 014 Admin role + products/variants CRUD

## R-001 — Role-gated tab navigator vs. conditional screen

**Decision**: Introduce `@react-navigation/bottom-tabs` and wrap the
post-auth stack in a tab navigator (`RootTabs`) that lists `HomeStack`
always and `AdminStack` iff the session carries `role='admin'`. The tab
bar itself is only visible when ≥ 2 tabs exist; single-tab (admin-only)
users see a borderless tab bar — effectively identical to a plain stack.

**Rationale**: UX6 requires dual-role users to see both the seller home AND
the Admin tab **simultaneously** with no toggle. A conditional screen
inside the native-stack would force a mode-switch affordance. A bottom-tab
navigator scoped under the existing `LockGate` is the lowest-cost way to
host both surfaces at the same time while keeping `AuthStack` / `LockGate`
intact.

**Alternatives considered**:
- **Nested drawer**: adds an off-canvas control that UX6 explicitly
  forbids ("MUST NOT surface a 'switch to admin mode' control").
- **Role filter inside `HomeStack`**: admin screens would then live
  beneath the seller routes, violating the §9 convention
  (`src/features/admin/<domain>/`).

## R-002 — Session exposes roles post-login

**Decision**: Extend `SessionSnapshot` with a `roles: string[]` field
populated during `bootstrap()` (post-login and post-refresh). The roles
are fetched from `public.user_roles` using the authenticated client. A
`useRoles()` hook wraps the snapshot so screens can subscribe without
pulling the whole session.

**Rationale**: D7 mandates that roles are server-owned (persistence in
`user_roles`), while UX6 asks for synchronous client-side gating. Storing
`roles` on the session snapshot is cheap, keeps the tab gate synchronous,
and reuses the existing `sessionStore` subscribe / emit plumbing.

**Alternatives considered**:
- **Encode roles in the JWT**: cheap server-side, but requires deploying
  a Supabase auth hook and tying role changes to re-issuing the JWT.
  Outside the MVP budget and adds operational complexity.
- **Fetch roles per screen**: defeats UX6 (flicker on dual-role users) and
  hits the network on every tab mount.

## R-003 — Admin writes bypass WatermelonDB (P6)

**Decision**: The admin feature creates a dedicated service module
(`src/features/admin/products/service/productsApi.ts`) that calls
`@supabase/supabase-js` directly. It does NOT import anything from
`src/data/**` (WatermelonDB). A follow-up `adminWriteTrigger` wraps
`pullToRefreshTrigger` so after every successful write the seller cache
receives a pull.

**Rationale**: P6 is explicit — admin code MUST NOT route through the
push queue. Keeping the admin service physically separate from the
WatermelonDB layer makes accidental coupling a review-time failure.

**Alternatives considered**:
- **Reuse the sync engine for admin writes**: matches the seller path but
  inherits the offline queue, conflicting with P6.

## R-003b — `saveProduct` atomicity strategy

**Decision**: `saveProduct` performs **two sequential Supabase calls**
with a client-side "soft rollback" on the second failure:

1. `upsert` the `products` row (new row = INSERT; existing row = UPDATE).
   Capture the resulting `id`.
2. Apply the variant diff: `upsert` for kept/new variants, `UPDATE ... SET
   deleted_at = now()` for the ones flagged `_delete`.
3. If step 2 fails, mark the operation as failed from the admin's
   perspective (toast + keep form state + log). For a **create** flow,
   re-delete the just-inserted `products` row via `UPDATE ... SET
   deleted_at = now()` so the admin does not end up with a ghost
   product. For an **update** flow the product row remains in its new
   state (that partial save is acceptable — the variants block is
   additive/editable; the admin retries from the same form).

**Rationale**: FR-012 asks for "atomic from the admin's perspective".
True DB-level atomicity would require a Supabase RPC / edge function.
P3 ("MVP simplicity") and P6 ("no new server-side moving parts unless
justified") both push back on that. The two-call + soft-rollback path
covers the only failure mode that is user-visible (ghost product rows on
create), and every retry from the admin form is idempotent because the
`products` row is addressed by `id`.

**Alternatives considered**:
- **Supabase RPC (`rpc_save_product`) wrapping both writes in one
  `begin/commit`**: truly atomic, but adds a PL/pgSQL function to the
  migration surface and a new contract to version. Deferred — revisit if
  create-failure ghosts become a measurable problem.
- **Two separate user-visible saves (product first, variants second)**:
  rejected because it contradicts the single "Salvar" CTA in the design.

## R-009 — Contract-test location

**Decision**: RLS contract tests for feature 014 live at
`src/features/admin/products/tests/rls.contract.test.ts`. The existing
sync tests (`src/features/sync/tests/*.test.ts`) are the nearest
convention; no `supabase/tests/` directory exists.

**Rationale**: Keeps feature-scoped tests under the feature namespace.
The sync tests run against a mocked Supabase client; the RLS contract
tests will do the same, using two pre-issued JWTs to exercise policy
branches. True end-to-end RLS verification against a live Supabase
project is out of scope for Jest and documented in `quickstart.md` §6.

**Alternatives considered**:
- **`supabase/tests/`**: no precedent; would need new tooling config.
- **Dedicated Postgres test harness**: overkill at MVP scale.

## R-004 — Barcode uniqueness strategy

**Decision**: Add `products.barcode text UNIQUE` with a partial index
constrained to `deleted_at IS NULL`. The client-side lookup (`SELECT … WHERE barcode = $1 AND deleted_at IS NULL`) is the happy path; the unique
constraint is the race guarantee.

**Rationale**: FR-017 and FR-018 demand concurrent safety. A partial
unique index keeps soft-deleted rows from blocking new registrations that
reuse the same code (FR-edge "soft-deleted match is treated as no match").

**Alternatives considered**:
- **Check-only (no constraint)**: cheap, but two admins can race.
- **Full unique (no partial)**: blocks reuse of codes whose previous
  product was soft-deleted.

## R-005 — Barcode scanner choice

**Decision**: Use `expo-camera` (already permitted under §3 "Required")
for the live barcode preview. Accept codes in `code128`, `ean-13`,
`ean-8`, `upc-a`, and `qr` — the union of what retailers in our target
segment actually print. Always render a "typed code" input beneath the
reticle so a denied camera permission does not block the flow.

**Rationale**: Expo's camera module is the lowest-cost path that meets
FR-013 (camera + typed fallback on the same screen) and does not add a
new native module outside the managed workflow. Limiting the accepted
symbologies keeps the decoder fast on low-end devices.

**Alternatives considered**:
- **`react-native-vision-camera`**: higher throughput but requires a dev
  client and a bigger plugin graph — not justified at MVP scale.

## R-006 — Image pipeline

**Decision**: `expo-image-picker` with `mediaTypes: Images`, then
`expo-image-manipulator` to resize to a 1024 px longest edge and
re-encode to JPEG at quality 0.8. Upload the manipulated asset via
`supabase.storage.from('product-images').upload(...)` and store the
public URL returned by `getPublicUrl` on `products.image_url`.

**Rationale**: SC-007 targets ~300 KB average per image; a 1024 px JPEG
@ 0.8 lands near that budget for typical catalogue shots. Resizing
client-side keeps Storage costs bounded and avoids bandwidth-wasting
uploads of a full sensor image.

**Alternatives considered**:
- **Server-side resize via Supabase Edge Function**: would need a new
  Edge Function + bucket permissions; not needed at this scale.

## R-007 — Responsive strategy

**Decision**: Reuse the shared `useViewport()` primitive; feature-local
`useAdminProductsLayout()` returns `'phone' | 'tablet'`. Each screen
authors two layout branches inside a single component file, matching the
existing `src/features/clients/responsive/**` pattern. No per-viewport
route duplication.

**Rationale**: UX5 requires phone+tablet coverage; duplicating routes
would double the maintenance surface and is not how the existing
features are structured.

## R-008 — Test strategy

**Decision**: Three layers:
1. Unit tests on `productsApi.ts`, `barcodeLookup.ts`, `imageUpload.ts`
   with `supabase-js` mocked.
2. Hook tests on `useProductForm`, `useBarcodeLookup` with fake
   services.
3. Smoke screen tests on `AdminProductsListScreen` and the source chooser
   to verify role-gated affordances + happy-path navigation.

**Rationale**: Matches existing Jest + RTL patterns already used by the
clients and orders features. End-to-end Detox / Maestro is out of scope
for this slice.
