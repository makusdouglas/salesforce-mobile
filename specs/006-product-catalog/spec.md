# Feature Specification: Product Catalog

**Feature Branch**: `006-product-catalog`
**Created**: 2026-04-21
**Status**: Draft
**Input**: User description: "Deliver the product catalog per constitution D2, R3, UX1, and UX3. Screens: a grid/list of products with their variants, a detail view, and a fast search bar prioritizing tap filters over typing. Catalog is strictly read-only inside the app; products are created/edited by the admin via Supabase dashboard. Product images live in Supabase Storage and MUST be cached locally through expo-file-system so the salesperson sees them offline after the first sync. First-launch empty state (no catalog pulled yet) points to the sync action in plain salesperson language, not system jargon. The constitution calls out this module as the first full spec→plan→tasks→implement cycle — scope it tightly."

## UI Design *(primordial source — include when the feature has a UI)*

**Design source**: [design/screens.md](./design/screens.md) — generated from [layout.pen](../../layout.pen) on 2026-04-21.

### Screens

| Screen | Screenshot | Intent |
|--------|------------|--------|
| Catalog / Phone | [catalog-phone.png](./design/catalog-phone.png) | Default populated state on phone: 2-column grid of product cards, tap-first filter chips, search field fallback. |
| Catalog / Tablet | [catalog-tablet.png](./design/catalog-tablet.png) | Same layout on tablet: 3-column grid, more filter chips inline, sync-status label visible next to the dot. |
| ProductDetail / Phone | [product-detail-phone.png](./design/product-detail-phone.png) | Stacked hero image + name/description/base price + variants list. Read-only, no create/edit affordance. |
| ProductDetail / Tablet | [product-detail-tablet.png](./design/product-detail-tablet.png) | Side-by-side split: hero left, info + variants right. Portrait-only (UX5). |
| CatalogEmpty / Phone | [catalog-empty-phone.png](./design/catalog-empty-phone.png) | First-launch empty state in plain salesperson language, primary `Sincronizar agora` CTA. |
| CatalogEmpty / Tablet | [catalog-empty-tablet.png](./design/catalog-empty-tablet.png) | Same copy constrained to a ~460 pt centered column so the CTA does not stretch edge-to-edge. |

The `Search & filter` affordance from the user's brief is realized as **in-place state** on the Catalog screen (search field + filter chip row pinned above the grid), not as a separate screen. The `No matches` sub-state called out by FR-018 is not drawn in this session and is flagged in `design/screens.md` under "Open questions".

### Design decisions carried into this spec

- Catalog is strictly read-only inside the app (constitution D2). No create/edit/delete affordances are present — not even hidden behind a long-press or debug menu.
- Images are cached locally after first sync (constitution R3). The salesperson sees images offline from the second launch onward.
- Search prioritizes tap filters over keyboard typing (UX1). The filter chip row is the primary interaction; the text field above it is the fallback.
- First-launch empty state uses salesperson language ("Seu catálogo está vazio. Toque em *Sincronizar agora* para carregar tudo."), never system jargon ("No records found", "Empty dataset", "Catalog table is empty").
- Every screen ships phone (390 × 844 pt) and tablet (820 × 1180 pt) layouts in portrait only (UX5).
- The Pencil session matched the existing `layout.pen` shadcn-neutral aesthetic (Inter type, zinc-neutral greys, `#18181B` primary button) instead of applying the `Anchored Ribbon Grid` / `Lavender Cream` style guide declared in `pencil-config.yml`. Rationale and the proposed re-application pass are recorded in `design/screens.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the catalog to find a product (Priority: P1)

A salesperson standing in a store opens the catalog from the home screen and scans a grid/list of products. Each row shows a thumbnail, product name, base price, and a hint that variants exist. Scrolling is smooth, and tapping a product opens its detail view. The catalog reads from the local database only — there is no blocking spinner waiting on the network.

**Why this priority**: This is the minimum-viable slice of the module. Without a browsable catalog, the salesperson cannot present products in the field — which is the app's core purpose. Every other story in this spec depends on this one being complete.

**Independent Test**: With the local catalog populated (seeded or from a prior sync), open the app, navigate to the catalog, scroll through at least one screen of products, and tap one to confirm the detail view opens. Repeat with the device in airplane mode to confirm the list and thumbnails are still available.

**Acceptance Scenarios**:

1. **Given** the local catalog contains at least one product, **When** the salesperson opens the catalog screen, **Then** the list/grid renders immediately from local data with no full-screen spinner.
2. **Given** the device is offline and the salesperson has synced at least once on this device, **When** they open the catalog, **Then** product thumbnails render from the local image cache — placeholders appear only for images that were never cached.
3. **Given** the catalog contains more products than fit on screen, **When** the salesperson scrolls, **Then** scrolling is smooth (no frame drops noticeable to the user) and additional rows render as they come into view.
4. **Given** the catalog screen is rendered on a tablet in portrait, **When** the salesperson views it, **Then** the grid uses a column count appropriate for the wider viewport (not a stretched phone layout).
5. **Given** the catalog screen is rendered on a phone in portrait, **When** the salesperson views it, **Then** the layout uses a column count appropriate for the narrower viewport.

---

### User Story 2 - First-launch empty state guides to sync (Priority: P1)

The salesperson installs the app, logs in, and opens the catalog before any sync has ever succeeded. Instead of seeing a blank white screen or a cryptic technical message, they see a short, friendly explanation that says the catalog is empty and points them to the sync action in their own language.

**Why this priority**: Constitution UX3 mandates that empty states point to the next step in the salesperson's language. The first time someone opens this app, the catalog is empty by definition — if this state is hostile, the salesperson is blocked at step one of onboarding. This is a correctness requirement, not cosmetics.

**Independent Test**: Install the app on a clean device, complete login and local lock setup, go to the catalog without triggering a sync, and confirm that the empty-state screen renders with (a) a plain-language explanation, (b) a clearly labeled action to start the sync, and (c) no system/developer jargon anywhere on the screen.

**Acceptance Scenarios**:

1. **Given** the local catalog has never been populated (fresh install or storage wiped), **When** the salesperson opens the catalog screen, **Then** an empty-state view is shown with a short salesperson-friendly message and an obvious call to action that starts a sync.
2. **Given** the empty-state view is visible, **When** the salesperson taps the sync call to action, **Then** a sync pass starts (the sync-status indicator transitions to `syncing`), and when the pass completes successfully with at least one product, **Then** the catalog list replaces the empty state automatically.
3. **Given** the empty-state view is visible and the device is offline, **When** the salesperson taps the sync call to action, **Then** the app communicates that an internet connection is needed using salesperson language (not "network error", "request failed", or a stack trace).
4. **Given** the catalog was populated previously but every product has been removed in the admin dashboard since the last sync and a fresh pull happened, **When** the salesperson opens the catalog, **Then** the empty state is shown again with the same call to action.
5. **Given** the empty-state copy is rendered on a phone or a tablet, **When** the salesperson views it, **Then** the layout is legible at each target viewport and the call to action remains clearly tappable.

---

### User Story 3 - View a product's detail and its variants (Priority: P2)

From the catalog list the salesperson taps a product and lands on its detail view. They see the image at a larger size, the name, the base price, and every variant that belongs to that product — each variant showing its distinguishing attributes (size, color, flavor, etc.) and its own price. The detail view is read-only: no edit, no delete, no admin-style controls.

**Why this priority**: Browsing the list alone is not enough to present a product in a store — the salesperson must be able to show variants and per-variant prices. However, the list is the entry point and delivers some value on its own, so detail is P2, not P1.

**Independent Test**: With a product that has at least two variants, open its detail screen from the catalog list and confirm (a) all variants render with their attributes and per-variant prices, (b) no edit or delete affordance is visible, and (c) the screen renders correctly on both phone and tablet viewports.

**Acceptance Scenarios**:

1. **Given** a product has one or more variants, **When** the salesperson opens its detail view, **Then** every variant is listed with its distinguishing attributes and its own price.
2. **Given** a product has exactly one variant, **When** the salesperson opens its detail view, **Then** the variant section is still shown clearly (not collapsed into the product header) so the single variant's price and attributes are unambiguous.
3. **Given** a product's detail view is open, **When** the salesperson looks at the screen, **Then** no affordance suggests editing, creating, or deleting anything about the product or its variants.
4. **Given** a product's image was cached during a prior sync, **When** the salesperson opens its detail view offline, **Then** the image renders from the local cache at detail-view resolution.
5. **Given** a product's image was never successfully cached, **When** the salesperson opens its detail view, **Then** a neutral placeholder renders in the image area and does not block access to the rest of the detail content.

---

### User Story 4 - Search the catalog with tap-first filters (Priority: P2)

The salesperson needs a product right now. They open the catalog and tap one or more filter chips (for example, category) to narrow the list immediately. If chips alone are not enough, they can type in a search field as a fallback — but the primary interaction is tap, not type, because they are standing up and holding the phone in one hand.

**Why this priority**: Without search/filter, large catalogs become impractical to browse in the field. This is a near-baseline capability, but the catalog is usable at P1 scale (small catalogs) without it — so it is P2.

**Independent Test**: With a catalog containing products across at least two categories, open the catalog screen and (a) tap a category filter chip and confirm only matching products remain, (b) clear the chip and confirm the full list returns, and (c) type a few characters into the search field and confirm results filter live.

**Acceptance Scenarios**:

1. **Given** the catalog has products in more than one category, **When** the salesperson taps a category filter chip, **Then** the list updates immediately to show only matching products and a visible indicator confirms the active filter.
2. **Given** a filter chip is active, **When** the salesperson taps the chip again (or a clearly labeled clear control), **Then** the filter is removed and the full catalog returns.
3. **Given** the catalog screen is visible, **When** the salesperson types characters into the search field, **Then** the list filters in real time by product name (and variant attributes where helpful).
4. **Given** a tap filter and a typed query are both active, **When** the salesperson views the list, **Then** both filters are applied (intersection) and a summary indicates how results were narrowed.
5. **Given** the salesperson has typed a query that matches no products, **When** they view the result, **Then** a salesperson-language "no matches" state is shown with a clear way to reset the search (distinct from the first-launch empty state described in US2).
6. **Given** the search/filter row renders on a tablet, **When** the salesperson views it, **Then** the wider viewport shows more filter chips inline without requiring horizontal scroll compared to the phone layout.

---

### Edge Cases

- **No internet on first launch, ever**: the empty state must still render correctly; the sync call to action must explain that internet is required for the first sync, in salesperson language.
- **Image present in Storage but not yet cached locally**: a neutral placeholder is shown. The catalog list and detail view must not block on image availability.
- **Image URL returns 404 during first sync**: the product itself still appears in the catalog; a placeholder stands in for the missing image; the rest of the pass continues.
- **Admin deletes a product between syncs**: after the next sync, that product disappears from the local catalog and from any screen currently listing it (the next navigation refreshes from the local DB).
- **Admin adds a product between syncs**: the new product appears only after the next successful sync pass. The catalog module does not poll the server on its own.
- **Variant with no price**: surface a neutral non-clickable label ("preço indisponível") for that variant rather than hiding it — the salesperson should still be aware it exists.
- **Very long product name or variant description**: truncate in the list with ellipsis; show in full in the detail view.
- **Search query with accents / diacritics** (e.g. "açaí" vs "acai"): matches are expected to be diacritic-insensitive so the salesperson does not have to type accents on a mobile keyboard.
- **Catalog with thousands of products**: list rendering remains smooth and the app does not crash or run out of memory on the reference phone/tablet viewports.
- **Tablet orientation rotated to landscape**: landscape is out of scope per UX5; the app is portrait-only in the MVP.

## Requirements *(mandatory)*

### Functional Requirements

**Read-only contract**

- **FR-001**: The catalog module MUST be strictly read-only inside the app. No screen may expose a create, edit, or delete affordance for products or variants, whether visible, hidden behind long-press, or in a debug menu.
- **FR-002**: The app MUST NOT write to the remote product or variant tables. Any hypothetical local mutation of product or variant rows MUST be treated as a bug.

**Catalog list (US1)**

- **FR-003**: The catalog screen MUST display all products from the local database in a grid/list with thumbnail, product name, base price, and a hint that variants exist.
- **FR-004**: The catalog screen MUST read from the local database only and MUST NOT show a blocking full-screen spinner waiting on the network at any point (constitution P1).
- **FR-005**: Tapping a product row MUST open its detail view.
- **FR-006**: The catalog list MUST render smoothly on catalogs sized for an MVP small-retailer operation (see Assumptions) on both phone and tablet baseline viewports.

**Product detail (US3)**

- **FR-007**: The product detail view MUST display the product image(s), name, base price, and the full list of variants belonging to that product.
- **FR-008**: Each variant row in the detail view MUST display the variant's distinguishing attributes and its own price.
- **FR-009**: A product with a single variant MUST still display the variant explicitly (do not collapse it into the product header).
- **FR-010**: A variant with no price MUST render a neutral non-clickable label indicating that the price is unavailable, instead of being hidden.

**Image caching (R3)**

- **FR-011**: After a successful sync, product images referenced by the catalog MUST be cached on the device filesystem so they render offline on subsequent launches.
- **FR-012**: The catalog and detail screens MUST serve images from the local cache when the device is offline, falling back to a neutral placeholder only when an image was never cached or the cached file is missing.
- **FR-013**: A missing or failed image download MUST NOT block the corresponding product or variant from being listed.

**Search and filter (US4)**

- **FR-014**: The catalog screen MUST expose tap-first filter controls (for example, filter chips) as the primary narrowing mechanism.
- **FR-015**: The catalog screen MUST expose a text search field as a secondary, fallback narrowing mechanism.
- **FR-016**: Tap filters and typed search MUST compose (both applied simultaneously = intersection) and the result summary MUST reflect that.
- **FR-017**: Text search MUST be diacritic-insensitive so the salesperson does not have to type accents.
- **FR-018**: A "no matches" state distinct from the first-launch empty state MUST be shown when search/filter produces zero results, with a clearly labeled reset control.

**Empty state (UX3)**

- **FR-019**: When the local catalog has never been populated, the catalog screen MUST show a dedicated first-launch empty state with a salesperson-language message and a visible call to action that triggers a sync.
- **FR-020**: The first-launch empty state copy MUST NOT contain system or developer jargon ("no records", "empty dataset", "network error", stack traces, HTTP codes, internal entity names).
- **FR-021**: When a sync started from the empty state's call to action completes successfully and produces at least one product, the catalog screen MUST transition automatically from the empty state to the populated list without requiring manual navigation.
- **FR-022**: If the salesperson taps the empty-state call to action while offline, the app MUST communicate the need for an internet connection in salesperson language.

**Responsiveness (UX5)**

- **FR-023**: Every screen introduced by this module (catalog list, product detail, search/filter, empty state, "no matches") MUST render correctly on the phone baseline viewport (390 × 844 pt portrait) AND the tablet baseline viewport (820 × 1180 pt portrait).
- **FR-024**: The tablet layout MUST use the wider viewport meaningfully (for example, more columns in the grid, more filter chips inline) rather than being a stretched phone layout.
- **FR-025**: Landscape orientation is out of scope per UX5 and MUST NOT be targeted by this module.

**Language (constitution §9)**

- **FR-026**: All user-visible copy introduced by this module MUST be in Portuguese. Internal identifiers (component, hook, utility, and variable names) MUST be in English.

### Key Entities *(include if feature involves data)*

- **Product**: The item a salesperson can present and later add to an order. Created and edited by the admin outside the app. Key attributes referenced by this module: name, optional description, base price, optional category, and references to one or more images. One product has many variants.
- **Product Variant**: A concrete purchasable configuration of a product (size, color, flavor, etc.). Has its own price and its own distinguishing attributes. Belongs to exactly one product. The order module (separate feature) references variants when building order items — this module only displays them.
- **Cached Image**: A local filesystem copy of a product image originally hosted remotely, keyed by its remote identifier, kept so the salesperson can see product imagery offline. Owned by this module; lifecycle tied to the catalog (a cached image whose product no longer exists locally is orphaned and eligible for cleanup — see Assumptions).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening the catalog screen from the home screen shows the first fold of products in under 500 ms on both baseline viewports, measured on a populated catalog after a cold app start.
- **SC-002**: With the device offline and at least one prior successful sync, at least 95% of product thumbnails render from the local cache (the remaining 5% accounts for products newly added in the last sync that happened to fail their image download).
- **SC-003**: A salesperson encountering the first-launch empty state can identify and tap the sync call to action in under 5 seconds in a first-time usability test, with no follow-up question about what the screen means.
- **SC-004**: A salesperson can locate a known product in a catalog of 500 products in under 10 seconds using only tap filters (no typing) in a usability test.
- **SC-005**: Every screen in this module passes visual review on both the phone baseline viewport and the tablet baseline viewport before the module is considered complete (UX5 compliance gate).
- **SC-006**: No business screen in this module renders a blocking full-screen spinner at any point during normal operation (P1 compliance check — verifiable by inspection of each screen in online, offline, and syncing states).
- **SC-007**: The module ships with zero create/edit/delete affordances on products or variants (D2 compliance check — verifiable by UI walkthrough and code review).

## Assumptions

- **Catalog size in the MVP**: the catalog is sized for a single small wholesaler / B2B operation targeting corner stores — typically hundreds of products, not tens of thousands. Smooth rendering and search targets in this spec assume that order of magnitude; extreme catalogs would require a follow-up performance pass.
- **Filter dimensions**: "Category" is assumed to be the primary tap filter dimension in the MVP because it is the most common axis small-retailer catalogs are organized along. If the admin does not populate categories, filter chips degrade gracefully to just the text search.
- **Sync infrastructure exists**: the sync engine feature (005) is already available and owns pulling products, variants, and image references into the local database. This module triggers sync (from the empty state's call to action) and listens to the existing sync status — it does not re-implement sync.
- **Local database owns products and variants**: per constitution R1 and R2, `products` and `product_variants` tables exist in the local database and are populated by sync. This module reads from them; it does not define them.
- **Image hosting and URLs**: product image URLs on the product/variant rows point to the canonical image location (Supabase Storage per R3). This module is responsible for caching those URLs locally; it does not manage the upload path.
- **Cache eviction policy**: a simple "keep all cached images; clean up orphans whose product no longer exists locally" policy is assumed sufficient for the MVP. A size-bounded LRU is out of scope until field data shows it is needed (P3).
- **Admin-side catalog editing is out of scope for this spec**: editing happens in the Supabase dashboard, per D2. No in-app admin mode, even for debugging.
- **Reporting catalog errors back to the admin is out of scope for the MVP**: per constitution D2, the channel for "salesperson spots a catalog error" is TBD and explicitly out of scope.
- **Multi-catalog per salesperson is out of scope**: per constitution §8, only a single shared catalog exists in the MVP.
