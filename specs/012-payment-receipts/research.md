# Phase 0 — Research: Payment Receipts

This feature's Technical Context surfaced **zero** `NEEDS CLARIFICATION` markers — the spec resolved each open question via documented defaults. The items below are decision records for the non-obvious choices that shape Phase 1.

## R1 — Attachment upload pipeline: minimal new subsystem vs. reuse of catalog image-cache

- **Decision**: Build a **new minimal subsystem** under `src/features/orders/receipts/attachments/` for the upload path. Reuse `@/features/catalog/image-cache` **only for the read side** (resolving synced `attachment_url` back to a cached file).
- **Rationale**: `image-cache` is a download-oriented module — its `downloadOnce` assumes a known remote URL and writes to a cache directory. The upload flow is conceptually opposite (local URI → remote URL) and needs state machinery (`pending / synced / failed`) tied to a DB row. Bolting an upload path onto `image-cache` would entangle two lifecycles; a fresh 80-line pipeline is clearer and cheaper.
- **Alternatives considered**:
  - *Extend `image-cache`* with an `uploadOnce(localPath, remoteKey)` — rejected. It blurs the module's single responsibility (offline cache for remote assets) and leaks DB concerns into a pure file helper.
  - *Use Supabase Storage SDK directly inside the repository's `create()`* — rejected. Violates P1: creating a receipt would implicitly require network.

## R2 — Append-only enforcement: runtime guard vs. repo-boundary rule vs. static scan

- **Decision**: **All three in layers**, cheapest first. (a) Remove `update()` / `softDelete()` from the exported repository surface so TypeScript callers cannot express the mutation. (b) Static scan (`appendOnlyReceipts.test.ts`) walks `src/features/orders/receipts/**` + the repo file and fails on forbidden patterns. (c) No runtime guard — a row once inserted is fundamentally mutable via WatermelonDB internals; we trust the first two layers.
- **Rationale**: P3 (simplicity) dictates we not build a runtime invariant when types + CI catch it cheaper. The static scan protects against new callers that try to bypass the repo boundary (e.g., raw `collection.find(id).update(...)`).
- **Alternatives considered**:
  - *Database-level CHECK constraint* — rejected. WatermelonDB schemas do not express "immutable-after-create" natively, and a Postgres-side trigger is overkill for the MVP.

## R3 — Correction as new row vs. linked-list flag on amount

- **Decision**: Correction is a **new `payment_receipts` row** with `correction_of_receipt_id = <original>`. The row's `amount` can be negative (reversal) or positive (upward adjustment). The original row is byte-identical before and after.
- **Rationale**: The spec calls this out as the single domain rule (append-only with a reference). Storing correction as a column flag + mutated amount would re-open the "last-write-wins" merge problem on sync and erase the audit trail. A new row is trivially auditable and makes the UI rendering straightforward ("show a separate row with Correção badge").
- **Alternatives considered**:
  - *Version chain via `version` column* — rejected. Would require a "latest version" selector at every read site; conceptually the same as our current approach but with more indirection.

## R4 — Method enum: `card` → `check` rename and data fixup

- **Decision**: Rename the enum value in code and migrate any existing dev-fixture row with `method = 'card'` to `'check'` during the `0012` migration. The UI label `Cheque` maps to enum `check`.
- **Rationale**: The existing schema was laid down in feature 002 with a generic `card` value that predates the spec's finalized method list (`cash, pix, transfer, check, other`). The MVP has no production data yet (D3, P5 apply only to seller field data, which is still in early testing), so the rewrite is safe.
- **Alternatives considered**:
  - *Keep `card` and add `check`* — rejected. Gives two near-synonymous enum values and forces the UI to either hide one or pick arbitrarily.
  - *Expose free-text in the "Outro" chip* — rejected (already documented in spec FR-011).

## R5 — Picker strategy: `expo-image-picker` + `expo-document-picker`

- **Decision**: Use `expo-image-picker` for the **Câmera** entry point and for the photo-library entry point. Use `expo-document-picker` as a secondary selection under the **Galeria / PDF** entry point when the user wants a PDF.
- **Rationale**: iOS's photo picker does not return PDFs — the OS routes documents through a separate picker UI. Android is more lenient but we prefer uniform behaviour across platforms. Unifying under a single button with two native flows ("show images" + "show documents") is more complicated than the one-size-fits-most UX of **two buttons** — which the design already captures (Câmera, Galeria/PDF). In the `Galeria / PDF` action sheet, if the user picks an image we go through `expo-image-picker`'s library picker; if they pick PDF we go through `expo-document-picker`.
- **Alternatives considered**:
  - *Single "pick anything" button that dispatches to OS intent* — rejected. Lives differently on iOS vs. Android and fights with the spec's two-button design.

## R6 — 10 MB cap: reject vs. on-device shrink

- **Decision**: For **images** > 10 MB, run through `expo-image-manipulator` with `compress: 0.75` at max 2048px; if the result is still > 10 MB, reject. For **PDFs** > 10 MB, reject directly (manipulator does not re-encode PDFs).
- **Rationale**: Field-captured photos on modern phones routinely exceed 10 MB. A hard reject + "open the camera again" is worse UX than a silent shrink that meets the constraint. PDFs at this size are usually already-optimized business documents where silent shrinking risks data loss.
- **Alternatives considered**:
  - *Hard 10 MB reject for images too* — rejected (bad UX). The shrink path is a single `manipulateAsync` call with deterministic output size.
  - *Larger cap (e.g., 25 MB)* — rejected. Supabase Storage has per-object limits and upload over 3G/4G would be noticeably slow; the cap is as much about network etiquette as about storage cost.

## R7 — Storage path convention and RLS

- **Decision**: Path `receipt-attachments/<seller_id>/<receipt_id>.<ext>`, bucket private, two RLS policies (SELECT + INSERT) gated by `auth.uid()` matching the owning order's `seller_id` via sub-select. No UPDATE or DELETE policies (append-only parity).
- **Rationale**: Nesting the seller ID directly in the path allows a fast, index-less auth check against the path prefix AND the RLS join against the parent order, defense in depth. The absence of UPDATE/DELETE policies means even a malicious client holding a valid token cannot mutate or remove a synced attachment.
- **Alternatives considered**:
  - *Single flat path `receipt-attachments/<receipt_id>.<ext>`* — rejected. The seller_id prefix gives a cheaper first-line auth hint and mirrors how 013 will lay out product attachments.
  - *Public bucket* — rejected. Proofs of payment are not public information.

## R8 — Pull-side handling of orphan corrections

- **Decision**: If `pullChanges` receives a correction row whose `correction_of_receipt_id` points to a row that has not yet arrived locally, insert the correction anyway with the raw amount + "Correção" badge; the "referenciando o original" caption is suppressed until the original syncs in on a subsequent pull. No retry, no quarantine.
- **Rationale**: Append-only + last-write-wins already guarantee eventual consistency. Orphans self-heal on the next pull. A quarantine queue would be a new concept for little benefit in a 1–2 seller MVP.
- **Alternatives considered**:
  - *Quarantine unresolved orphans until the original arrives* — rejected (over-engineered).
  - *Reject the orphan and refuse to insert* — rejected (data loss + breaks "salesperson data is sacred").

## R9 — Date input UX: platform picker vs. inline stepper

- **Decision**: Tap the Data row → opens the platform's native date picker (iOS wheel, Android calendar). Default is today, local time zone.
- **Rationale**: UX1 ("tap not type") combined with the field being optional to edit (default is today). The native picker is zero custom code and respects OS accessibility.

## R10 — Overpayment surfacing

- **Decision**: `Saldo em aberto` clamps at 0. The totals card adds a small "Ajuste pendente" badge when `received > total`. No blocking modal, no alternate save path.
- **Rationale**: P1 ("no blocking spinners") + the append-only rule ("corrections are new receipts") means the only remediation is a negative correction. Pushing the burden of reconciliation to the seller via a visible marker (not a blocker) matches how the sync status banner behaves on Home (UX4).

---

**All research items resolved.** Phase 1 proceeds with data model, contracts, and quickstart.
