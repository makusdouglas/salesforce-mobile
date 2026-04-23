/**
 * Per-table shape mappers between Supabase rows and WatermelonDB raw records.
 *
 * Two functions per table:
 *   - map<Table>ServerRowToWMDB(row)   — Supabase → Watermelon DirtyRaw
 *   - map<Table>WMDBRecordToServerPayload(rec) — Watermelon rawRecord → Supabase payload
 *
 * Rules:
 *   - Column names match 002's schema (snake_case everywhere).
 *   - Server `id` becomes `server_id` on the client side AND is used as the
 *     Watermelon `id` (T000 guarantees local.id === server.id on device-created
 *     rows; pulled rows adopt the server's id as their local id).
 *   - `updated_at` / `deleted_at` arrive as ISO-8601 strings and are stored as
 *     milliseconds since epoch on the client.
 *   - Push payloads OMIT `id`, `server_id`, `_status`, `_changed`, `updated_at`,
 *     `deleted_at`. Inserts send `id` explicitly via the adapter (see
 *     push-changes.md §Insert path).
 */

/** Partial shape of a WatermelonDB `_raw` record that our adapters handle. */
export interface WMDBRawRecord {
  id: string;
  server_id: string | null;
  updated_at: number;
  _status?: string;
  _changed?: string;
  [key: string]: unknown;
}

/** Partial shape of a Supabase row returned by `select('*')`. */
export interface SupabaseRow {
  id: string;
  updated_at: string;
  deleted_at: string | null;
  [key: string]: unknown;
}

/** Shape returned to WatermelonDB's `pullChanges.updated[]` / `created[]`. */
export interface WMDBDirtyRaw {
  id: string;
  server_id: string;
  updated_at: number;
  [key: string]: unknown;
}

function toMs(iso: string): number {
  return Date.parse(iso);
}

function baseServerToWMDB(row: SupabaseRow): WMDBDirtyRaw {
  return {
    id: row.id,
    server_id: row.id,
    updated_at: toMs(row.updated_at),
  };
}

// ---- Salespeople ----

export function mapSalespersonServerRowToWMDB(row: SupabaseRow): WMDBDirtyRaw {
  return {
    ...baseServerToWMDB(row),
    name: row.name,
    email: row.email,
  };
}

export function mapSalespersonWMDBRecordToServerPayload(
  rec: WMDBRawRecord,
): Record<string, unknown> {
  return {
    name: rec.name,
    email: rec.email,
  };
}

// ---- Client ----

export function mapClientServerRowToWMDB(row: SupabaseRow): WMDBDirtyRaw {
  return {
    ...baseServerToWMDB(row),
    salesperson_id: row.salesperson_id,
    name: row.name,
    tax_id: row.tax_id ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    address_line: row.address_line ?? null,
    notes: row.notes ?? null,
  };
}

export function mapClientWMDBRecordToServerPayload(
  rec: WMDBRawRecord,
): Record<string, unknown> {
  return {
    salesperson_id: rec.salesperson_id,
    name: rec.name,
    tax_id: rec.tax_id ?? null,
    phone: rec.phone ?? null,
    email: rec.email ?? null,
    address_line: rec.address_line ?? null,
    notes: rec.notes ?? null,
  };
}

// ---- Product ----

export function mapProductServerRowToWMDB(row: SupabaseRow): WMDBDirtyRaw {
  return {
    ...baseServerToWMDB(row),
    name: row.name,
    description: row.description ?? null,
    image_url: row.image_url ?? null,
    unit: row.unit ?? null,
    category: row.category ?? null,
  };
}

// Products are never pushed from the device (catalog is admin-only, D2).
// No toServerPayload mapper is provided; push-changes.md filters this table out.

// ---- ProductVariant ----

export function mapProductVariantServerRowToWMDB(row: SupabaseRow): WMDBDirtyRaw {
  return {
    ...baseServerToWMDB(row),
    product_id: row.product_id,
    label: row.label,
    price: row.price,
    barcode: row.barcode ?? null,
  };
}

// Product variants are never pushed from the device (catalog is admin-only, D2).

// ---- Order ----

export function mapOrderServerRowToWMDB(row: SupabaseRow): WMDBDirtyRaw {
  return {
    ...baseServerToWMDB(row),
    client_id: row.client_id,
    salesperson_id: row.salesperson_id,
    status: row.status,
    discount_amount: row.discount_amount,
    notes: row.notes ?? null,
    created_at_ms: typeof row.created_at_ms === 'number' ? row.created_at_ms : toMs(String(row.created_at_ms)),
    sent_at_ms:
      row.sent_at_ms === null || row.sent_at_ms === undefined
        ? null
        : typeof row.sent_at_ms === 'number'
          ? row.sent_at_ms
          : toMs(String(row.sent_at_ms)),
    pdf_uri: row.pdf_uri ?? null,
  };
}

export function mapOrderWMDBRecordToServerPayload(
  rec: WMDBRawRecord,
): Record<string, unknown> {
  return {
    client_id: rec.client_id,
    salesperson_id: rec.salesperson_id,
    status: rec.status,
    discount_amount: rec.discount_amount,
    notes: rec.notes ?? null,
    created_at_ms: rec.created_at_ms,
    sent_at_ms: rec.sent_at_ms ?? null,
    pdf_uri: rec.pdf_uri ?? null,
  };
}

// ---- OrderItem ----

export function mapOrderItemServerRowToWMDB(row: SupabaseRow): WMDBDirtyRaw {
  return {
    ...baseServerToWMDB(row),
    order_id: row.order_id,
    product_variant_id: row.product_variant_id,
    quantity: row.quantity,
    unit_price: row.unit_price,
    discount_amount: row.discount_amount,
  };
}

export function mapOrderItemWMDBRecordToServerPayload(
  rec: WMDBRawRecord,
): Record<string, unknown> {
  return {
    order_id: rec.order_id,
    product_variant_id: rec.product_variant_id,
    quantity: rec.quantity,
    unit_price: rec.unit_price,
    discount_amount: rec.discount_amount,
  };
}

// ---- PaymentReceipt ----

export function mapPaymentReceiptServerRowToWMDB(row: SupabaseRow): WMDBDirtyRaw {
  return {
    ...baseServerToWMDB(row),
    order_id: row.order_id,
    amount: row.amount,
    method: row.method,
    received_at_ms:
      typeof row.received_at_ms === 'number'
        ? row.received_at_ms
        : toMs(String(row.received_at_ms)),
    image_url: row.image_url ?? null,
    notes: row.notes ?? null,
  };
}

export function mapPaymentReceiptWMDBRecordToServerPayload(
  rec: WMDBRawRecord,
): Record<string, unknown> {
  return {
    order_id: rec.order_id,
    amount: rec.amount,
    method: rec.method,
    received_at_ms: rec.received_at_ms,
    image_url: rec.image_url ?? null,
    notes: rec.notes ?? null,
  };
}
