# Feature Specification: Local Data Layer (WatermelonDB Foundation)

**Feature Branch**: `002-local-data-layer`
**Created**: 2026-04-19
**Status**: Draft
**Input**: User description: "Set up WatermelonDB as the sole client-side data layer per constitution R1 and R2. Define the initial schema and Model classes for all seven MVP entities — salespeople, clients, products, product_variants, orders, order_items, payment_receipts — with their relationships, required columns in English, sync-friendly columns (server_id, updated_at, _status, _changed), and a migrations directory. Include a lightweight repository/adapter pattern that every feature will consume; components MUST NOT read Supabase directly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — The Seven MVP Entities Are Available to Every Feature Through One Data Adapter (Priority: P1)

Any feature that will be built on top of this foundation (catalog, clients, orders, receipts, …) reads and writes any of the seven MVP entities — salespeople, clients, products, product variants, orders, order items, payment receipts — through a single local-database adapter. No feature reaches past that adapter to talk to the remote database directly.

**Why this priority**: Without a local data layer, no business feature can satisfy constitution P1 (offline-first) or R1 (WatermelonDB is the single client data layer). This is the minimum viable slice: the moment a feature needs to persist a client or an order, the repository must already exist and cover all seven entities.

**Independent Test**: A developer writes a throwaway screen that creates a client, adds an order for that client with two order items, and then reads the order back — all through the data-layer repository, with no network connection, and with zero references to the remote-database SDK in the screen's code. All created records are visible on a subsequent cold launch.

**Acceptance Scenarios**:

1. **Given** the app is freshly installed and offline, **When** a feature calls the data adapter to create a client, **Then** the client is persisted locally and a subsequent read through the adapter returns it with the values written.
2. **Given** an order is created locally with three order items, **When** the app is killed and cold-launched, **Then** the order and all three items are still retrievable through the adapter, in full.
3. **Given** a developer writes feature code that tries to import the remote-database SDK directly, **When** a project-level audit runs, **Then** the import is flagged as a violation of the "components MUST NOT read the remote database directly" rule.
4. **Given** any of the seven MVP entities, **When** a feature queries the adapter for records of that entity, **Then** it receives typed results and can observe changes reactively without polling.

---

### User Story 2 — Every Record Is Born Sync-Ready (Priority: P2)

Each record written to the local database automatically carries the metadata a future synchronization pass will need: a remote identifier slot, a last-modified timestamp, a sync status marker, and a per-field change marker. When the future sync block lands, no schema rewrite or backfill of existing local records is required.

**Why this priority**: Delivering sync metadata with the schema (instead of retrofitting it later) prevents a disruptive migration that could risk the salesperson's field data. The data layer is useful even before sync ships, so this is P2 not P1 — but it must land with this feature, not after, to stay faithful to constitution P5 (salesperson data is sacred).

**Independent Test**: Create a record via the adapter; inspect the row in the local database; confirm all four sync-readiness fields are present and populated with sensible defaults (no remote id yet, current timestamp, status indicating "created locally, not yet synced", and a change tracker initialized).

**Acceptance Scenarios**:

1. **Given** a new record is created locally, **When** the underlying row is inspected, **Then** it has a remote-identifier field (empty because no sync has happened), a last-modified timestamp set to creation time, a status marker indicating a pending outbound change, and a per-field change marker covering the fields that were written.
2. **Given** an existing record, **When** one of its fields is updated through the adapter, **Then** the last-modified timestamp is refreshed, the status marker flips to "pending outbound change" if it was clean, and the per-field change marker records which fields changed.
3. **Given** records of every one of the seven MVP entities, **When** each is audited, **Then** all four sync-readiness fields exist on every one of them — the behaviour is uniform across the schema.

---

### User Story 3 — The Schema Can Evolve Without Wiping a Salesperson's Device (Priority: P3)

When a later feature needs a new column, a new table, or a change to a relationship, the change ships as a migration. Running the updated app on a device that already has records from the previous version applies the migration and preserves the existing records.

**Why this priority**: Schema evolution is certain — the MVP is not the last release. The migration mechanism must be in place from day one so no later feature has the excuse to "just wipe and re-sync", which would risk unsent field data. Lower priority than US1/US2 because there are no migrations on day one; the first one will ship with the next data-carrying feature.

**Independent Test**: On a device with records in the schema as it ships here, simulate installing a future version that adds one column to one MVP entity via a migration. After the upgrade, all rows that existed before the upgrade are still readable through the adapter, including on the unchanged tables.

**Acceptance Scenarios**:

1. **Given** a device with existing local records in schema version N, **When** the app is upgraded to a version that includes a migration from N to N+1 adding one column, **Then** the migration runs automatically on next cold launch and every pre-existing record is preserved and readable.
2. **Given** the app is first installed on a fresh device, **When** it launches for the first time, **Then** the local database is initialized at the current schema version and no migrations are attempted.
3. **Given** the app is killed during migration, **When** it is re-launched, **Then** the database is either at version N (migration retried safely) or at version N+1 (migration completed) — never in an intermediate, corrupted state.

---

### Edge Cases

- What happens when the device is low on storage at database-init time? The app MUST surface a graceful error instead of silently losing writes.
- What happens when a migration script itself has a bug and throws mid-run? The migration MUST NOT leave the database in a half-migrated state; the app MUST keep the previous version's data intact and report the failure in logs.
- What happens when a feature tries to write a record that violates the schema (missing required field, wrong type)? The adapter MUST reject the write with a deterministic error; the database MUST NOT be left in a partially written state.
- What happens when two writes to the same record race inside the app? The adapter MUST serialize writes per record so the "last-write" metadata reflects actual write order.
- What happens when a record is deleted locally that has not yet been synced? The record is marked as locally deleted (via the sync-status marker) rather than hard-deleted, so the future sync block can tell the server about the deletion.
- What happens when a field value is large (e.g., a long note on an order)? The schema MUST still accept it up to the reasonable per-row size limits of the underlying local store; image binaries are out of scope (see Assumption about image URLs).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The local data layer MUST expose exactly the seven MVP entities named by the constitution (R2): salespeople, clients, products, product_variants, orders, order_items, payment_receipts. No additional entity is introduced in this feature.
- **FR-002**: The data layer MUST model the relationships between these entities: a client belongs to a salesperson; a product has many product variants; an order belongs to a client and to a salesperson and has many order items; each order item references a product variant; a payment receipt belongs to an order.
- **FR-003**: Every record of every MVP entity MUST carry four sync-readiness fields: a remote/server identifier (string, nullable until first sync), a last-modified timestamp, a sync status marker, and a per-field change marker. Field names MUST be `server_id`, `updated_at`, `_status`, and `_changed` respectively.
- **FR-004**: Any feature that reads or writes an MVP entity MUST do so exclusively through the data-layer's repository/adapter API. Feature code MUST NOT import the remote-database client (Supabase) at runtime. Sync is a separate future block and is out of scope here.
- **FR-005**: All table names, column names, relationship names, and code-level identifiers in the data layer MUST be in English. No Portuguese in the data layer's identifiers (constitution §9). User-visible Portuguese labels are the responsibility of feature UI code, not the data layer.
- **FR-006**: The data layer MUST support schema evolution via a migrations directory. Each migration bumps the schema version, declares the forward changes to apply, and MUST be applicable against an existing database populated with records from the previous version without data loss.
- **FR-007**: Orders and order items MUST be able to store discount amounts (per constitution R5 — discounts belong to the order, not the catalog). Products and product variants MUST NOT carry any discount fields.
- **FR-008**: Product images and payment-receipt images MUST be represented in the schema by a URL string field (per constitution R3). Binary image data MUST NOT be stored inside a database row.
- **FR-009**: The data layer MUST initialize an empty local database with the current schema version on first launch of a fresh install, with no user-visible steps.
- **FR-010**: On subsequent launches of an already-installed app, the data layer MUST apply any pending migrations automatically before the first feature screen reads data. This initialization MUST NOT block the first frame of the UI for longer than a second on a mid-range Android device.
- **FR-011**: All reads and writes through the adapter MUST work offline. The adapter MUST NOT require network connectivity to return values or confirm a write.
- **FR-012**: The data layer MUST provide reactive reads — a feature that observes a record or a collection MUST receive an updated result when that data changes, without polling.
- **FR-013**: The adapter API MUST be typed: callers of any MVP-entity read or write receive values matching that entity's schema, and wrong-shaped writes MUST be rejected at build time where possible and at runtime otherwise.
- **FR-014**: Deletions MUST go through a soft-delete path (mark the sync-status field accordingly) so the deletion can later be pushed to the remote. Hard-delete is reserved for records that have never been synced.

### Key Entities

> Field lists here are the minimum required by this feature. Each later feature may add columns by shipping a migration (FR-006). All four sync-readiness fields (`server_id`, `updated_at`, `_status`, `_changed`) MUST exist on every entity per FR-003 and are not repeated on each row below.

- **salesperson**: the user of the app. Holds the salesperson's name and the e-mail they authenticate with. One-to-many with clients and orders.
- **client**: a retailer visited by a salesperson. Holds a display name, identification number (e.g., CNPJ), and contact fields (phone, e-mail, address). Belongs to a salesperson. Has many orders and payment receipts.
- **product**: a catalog item. Holds name, description, optional image URL, unit of sale. Has many product variants. Read-only in the app (constitution D2) — registered via the admin dashboard.
- **product_variant**: a specific SKU of a product (e.g., size, packaging). Holds a variant label, price, barcode (optional), and belongs to a product. Discounts do NOT live here (constitution R5).
- **order**: an intent-order a salesperson assembles for a client. Holds a status (`draft` / `sent` / `canceled` per constitution D4), an order-level discount, a created-at timestamp, optional notes, and optional sent-at / PDF-path fields. Belongs to a client and a salesperson. Has many order items.
- **order_item**: a single line on an order. Holds quantity, unit price captured at the time of order, line-level discount, and belongs to an order and to a product variant.
- **payment_receipt**: a recorded receipt of payment linked to an order. Holds an amount, a method indicator (cash, transfer, etc.), a date, an optional image URL of the receipt, and optional notes. Belongs to an order.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can build a feature that creates, reads, updates, and soft-deletes any of the seven MVP entities through the data-layer adapter in a fresh session, with no remote-database SDK imports anywhere in the feature code.
- **SC-002**: An automated or checklist-driven audit over the entire source tree finds zero imports of the remote-database SDK outside the data-layer directory — 100% of data access goes through the adapter.
- **SC-003**: Records created on a device survive 20 consecutive cold restarts in airplane mode with zero loss — the last read returns the same rows as the first read, byte-for-byte on the fields written.
- **SC-004**: Every record inspected across the seven MVP entities has all four sync-readiness fields populated on creation and correctly updated on subsequent writes — verified by inspecting a sample of 20+ records covering every entity.
- **SC-005**: Upgrading the installed app from schema version N to N+1 — where the migration adds one column to one entity — preserves 100% of previously stored rows and completes in under 2 seconds on a mid-range Android device.
- **SC-006**: Cold-launch time from tap-to-first-feature-screen does not regress beyond the scaffold's 3-second target (block 001 SC-004) after the data layer is added — the database-init step costs less than 1 second of that budget on a mid-range Android device.
- **SC-007**: A developer can add a new column to an MVP entity (write the migration, update the model, update the repository typings) in under 30 minutes of uninterrupted work.
- **SC-008**: A developer can swap the underlying local-store implementation in a hypothetical future migration by editing only files inside the data-layer directory — the adapter surface exposed to features is stable by design.

## Assumptions

- Sync between the device and the remote database is **out of scope** for this block. This feature lands the schema and the sync-readiness columns; the push/pull process itself arrives in a later block. Until then, `server_id` stays null, `_status` stays at "created locally", and `_changed` tracks changes that no one reads yet — that is intentional.
- The remote database schema (Supabase Postgres) and Row-Level-Security policies are **out of scope** here. They will be designed and deployed with the sync block.
- The app is single-user per device (constitution §1 — one salesperson per install). The data layer does not partition records by salesperson at query time; the salesperson owns all local records.
- The seven MVP entities are exactly those listed in constitution R2. Any eighth entity MUST go through a spec amendment, not this feature.
- Discounts live on `order` and `order_item` only, per constitution R5. Catalog entities (`product`, `product_variant`) carry no discount columns — attempts by future features to add them MUST be rejected.
- Image content lives in remote object storage (constitution R3). This feature stores URLs only. Image download and local caching are out of scope and arrive with the catalog / receipts feature blocks.
- Schema migrations are sequential (version 1, 2, 3, …). The `002-local-data-layer` feature ships **version 1** — no migrations are needed on first install. Every later schema change ships exactly one migration bumping the version by one.
- Test investment (per constitution §9) targets business logic — not this plumbing. The data layer is verified by the manual/integration checks implied by the Acceptance Scenarios and Success Criteria.
- No UI is introduced by this feature. Any screen or copy work lives in the consuming feature's spec, not here.
- The underlying local-database engine is WatermelonDB (constitution §3 Mandatory Stack). The sync-readiness field names `server_id`, `updated_at`, `_status`, `_changed` follow WatermelonDB's sync-adapter convention so the future sync block can adopt the standard adapter without renaming columns.
- Repository/adapter style: **one typed repository per MVP entity** (e.g., `clientsRepository`, `ordersRepository`, …), all exported from a single data-layer entry point. Features import the repositories they need — no generic stringly-typed `forEntity("clients")` API.
- The data-layer directory lives at `src/data/` (a non-feature app-level directory like `src/app/`, permitted by constitution §9 since it is not a type-based split of feature code). The repository entry point is importable by any `src/features/<feature>/` module.
