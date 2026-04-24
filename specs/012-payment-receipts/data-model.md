# Phase 1 — Data Model: Payment Receipts

## WatermelonDB (client)

### Table `payment_receipts` — widened

Existing table from feature 002 (skeleton). Migration `0012_payment_receipts` **adds** the five columns at the bottom and **renames** `image_url`. The method enum string values change from `'cash' | 'pix' | 'transfer' | 'card' | 'other'` to `'cash' | 'pix' | 'transfer' | 'check' | 'other'`.

| Column | Type | Nullable | Indexed | Source | Notes |
|--------|------|----------|---------|--------|-------|
| `id` | string (ULID) | no | PK | unchanged | |
| `order_id` | string | no | yes | unchanged | FK → `orders.id` |
| `amount` | number (cents) | no | no | unchanged | Positive on `create()`; may be negative when created via `createCorrection()`. |
| `method` | string | no | no | **modified** | Enum `cash | pix | transfer | check | other`. `card` values in existing dev data are rewritten to `check` during migration. |
| `received_at_ms` | number | no | no | unchanged | Unix epoch ms. Default is `Date.now()` at create time; user-editable before save. |
| `attachment_url` | string | yes | no | **renamed from `image_url`** | Populated by `uploader.flushPending()` after a successful Storage upload. Excluded from UI-driven writes. |
| `attachment_local_path` | string | yes | no | **new** | Absolute path under `<docDir>/receipts/staging/<id>.<ext>`. Source of truth for preview until sync replaces / supplements it. **Device-local** — excluded from Supabase push. |
| `attachment_mime_type` | string | yes | no | **new** | One of `image/jpeg`, `image/png`, `image/heic`, `application/pdf`. |
| `attachment_size_bytes` | integer | yes | no | **new** | After any on-device shrink (`expo-image-manipulator`). |
| `attachment_upload_state` | string | yes | no | **new** | Enum `pending | synced | failed`, or NULL when no attachment. **Device-local** — excluded from Supabase push. |
| `correction_of_receipt_id` | string | yes | yes | **new** | Self-FK to `payment_receipts.id`. Populated only by `createCorrection()`. |
| `notes` | string | yes | no | unchanged | |
| `server_id` | string | yes | no | unchanged | Sync column. |
| `created_at` | number | no | no | unchanged | Sync column. |
| `updated_at` | number | no | no | unchanged | Sync column (bumped only on create — rows are append-only from business perspective, but sync columns still track row-level state). |
| `_status` | string | no | no | unchanged | WatermelonDB internal. `deleted` is **not** produced by this feature. |

### Validation rules (at repository boundary)

- `amount !== 0` (rejected with validation error).
- `amount > 0` for `create()`; `amount` may be positive or negative for `createCorrection()`, but **never** zero.
- `method` ∈ `{ cash, pix, transfer, check, other }`.
- `received_at_ms` is a valid epoch ms; no upper bound (future dates are legal — FR-010).
- When `attachment_local_path` is set, `attachment_mime_type`, `attachment_size_bytes`, and `attachment_upload_state` MUST all be set. Partial attachment metadata is rejected.
- `correction_of_receipt_id`, when set, MUST resolve to an existing receipt row (checked at repo level; sync pull allows orphans per R8).

### Append-only semantics

- `paymentReceiptsRepository` exports only `create`, `createCorrection`, `findById`, `observe`, `observeByOrder`, and `retryAttachmentUpload` (for failed uploads).
- `update()`, `destroyPermanently()`, `markAsDeleted()` are **not** exported. A call site attempting `collection.find(id).update(...)` is caught by `appendOnlyReceipts.test.ts`.

### State diagram (attachment)

```
    [ no attachment ]   ← create(no file)
           │
           │ create(with file) / stage()
           ▼
    [ pending ] ── uploader.flushPending ────▶ [ synced ]
        │  │
        │  │ 3 failed attempts
        │  ▼
        │  [ failed ] ── retryAttachmentUpload ──▶ [ pending ]
        └──▶ (no further user action required — runs on next sync)
```

No transition ever decreases the attachment metadata: once a `pending` row gains an `attachment_url`, it stays set.

## Supabase (Postgres)

### Table `payment_receipts` — same migration applied server-side

Same column additions as above minus the device-local columns (`attachment_local_path`, `attachment_upload_state`). The method CHECK constraint is updated from `CHECK (method IN ('cash','pix','transfer','card','other'))` to `CHECK (method IN ('cash','pix','transfer','check','other'))`, with a pre-update fixup `UPDATE payment_receipts SET method = 'check' WHERE method = 'card'`.

### Storage bucket `receipt-attachments`

- **Visibility**: `PRIVATE` (no public URLs).
- **Path**: `receipt-attachments/<seller_id>/<receipt_id>.<ext>`.
- **Policies**:
  - `receipts_attachments_read` — `SELECT` allowed when the object's path prefix (`<seller_id>/`) matches the authenticated user's ID AND the user has a row in `payment_receipts` joined to an `orders.seller_id = auth.uid()` whose `id` matches the `<receipt_id>` segment.
  - `receipts_attachments_insert` — `INSERT` with the same two-part check.
  - **No** `UPDATE` or `DELETE` policies. The bucket is append-only.
- Policy SQL lives in `supabase/migrations/0012_payment_receipts.sql`.

## Sync payload shape (per row, outbound)

```json
{
  "id": "01HQ...",
  "order_id": "01HQ...",
  "amount": 15000,
  "method": "pix",
  "received_at_ms": 1745400000000,
  "attachment_url": "https://…/receipt-attachments/<seller>/<receipt>.jpg",
  "correction_of_receipt_id": null,
  "notes": null,
  "server_id": null,
  "created_at": 1745400000000,
  "updated_at": 1745400000000
}
```

**Excluded** from outbound: `attachment_local_path`, `attachment_upload_state`, `attachment_mime_type` (irrelevant server-side), `attachment_size_bytes` (irrelevant server-side).

**Inbound** pull payload is the same shape; the device enriches each row with `attachment_local_path = null`, `attachment_upload_state = null`, `attachment_mime_type = null` on insert.

## Key Entities (from spec, mapped to tables)

- **PaymentReceipt** (spec) ↔ `payment_receipts` row (above).
- **Attachment** (spec) is **not** a separate table — it is an inline block of five columns on `payment_receipts`, because the 1:1 lifetime is identical and a separate table would force an additional join on every read for zero flexibility gain.
- **Order** (existing entity) — unchanged in this feature.
