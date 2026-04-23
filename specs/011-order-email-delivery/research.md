# Phase 0 — Research: Order Email Delivery

All technical-context unknowns were resolved against constitution §3/§4 and design/screens.md decisions. No NEEDS CLARIFICATION remained after the spec session.

## R0 — PDF generation library

- **Decision**: `expo-print` (`Print.printToFileAsync(html, options)`).
- **Rationale**: already mandated by constitution §3 for this exact feature; runs in the existing dev client; returns a `file://` URI usable directly as an attachment.
- **Alternatives considered**: `react-native-html-to-pdf` (archived, native-module drift risk), `react-native-pdf-lib` (too low-level for an invoice-style template — would require manual text layout).

## R1 — Mail intent with attachment

- **Decision**: `expo-mail-composer` (`MailComposer.composeAsync({ recipients, subject, body, attachments })`).
- **Rationale**: native availability on both iOS (MFMailComposeViewController) and Android (ACTION_SEND with proper MIME + FileProvider). Returns a `MailComposerResult` enum (`SENT`, `CANCELLED`, `SAVED`, `UNDETERMINED`) — exactly the signal needed to decide whether to flip the order to `sent` (FR-013 / FR-014).
- **Alternatives considered**: deep-linking to `mailto:` with a data URI attachment (unsupported for binary attachments), `react-native-mail` (narrower API, no result codes), rolling our own `Linking.openURL` (cannot attach a file).

## R2 — Generic share fallback

- **Decision**: `expo-sharing` (`Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })`).
- **Rationale**: when the client has no email on file (FR-004) or the email is malformed, the salesperson still needs a way out — WhatsApp, AirDrop, hand-typed mail. `expo-sharing` is Expo SDK, no extra native work.
- **Alternatives considered**: falling back to `mailto:` without a prefilled recipient (can't attach), blocking the send until an email is captured (rejected by design — see screens.md decisions).

## R3 — Persistent PDF path

- **Decision**: copy from `expo-print`'s temp URI to `<FileSystem.documentDirectory>orders/pedido-<YYYY-NNNN>-<client-slug>.pdf` via `FileSystem.copyAsync`. Store the resulting absolute path on the order row.
- **Rationale**: `expo-print`'s output lives in a cache location the OS may evict; documents directory survives app restarts (FR-015). The filename encodes the order number + client slug so a human can recognise it outside the app.
- **Edge case**: FR-017 — if the file is missing on re-open, `sendOrder`'s "resume" branch can re-render from the persisted order data using the original `order_number` (never allocate a new one).

## R4 — Order-number allocation strategy

- **Decision**: local per-year counter table `order_number_counters(year, next_value)`, allocated inside the same `database.write(...)` action as the order status flip. Supabase side has `UNIQUE (order_number)` as a partial index. On push conflict, the second device uses the pure `allocateNextNumber({ year, taken })` helper to pick the lowest free number, rewrites the local order, renames the PDF file on disk, and retries.
- **Rationale**: matches constitution P3 (simplicity) — single row per year is the smallest viable local allocator. Matches P2 (local DB authoritative during a session) — allocation is instant and local. The sync-time reconciliation is confined to one pure function + one sync-push hook, fully tested. Given 1–2 sellers × a handful of orders per day, collisions are rare; when they do occur, the path is deterministic and idempotent.
- **Alternatives considered**:
  - **Device-prefixed number ranges** (e.g., device A: 0000–4999, device B: 5000–9999) — rejected: creates un-intuitive gaps in the human-readable sequence, and needs central coordination to assign ranges.
  - **Server-side `nextval('order_number_seq')`** — rejected: requires an online round-trip at send time, violating FR-021. Also couples the order number to sync ordering, which would break the "stable filename across retries" promise.
  - **UUID-based order numbers** — rejected: not human-readable (FR-011).
  - **Deferring number allocation until sync succeeds** — rejected: the PDF would have a placeholder and the salesperson couldn't tell one order from another until sync completed.

## R5 — Retry semantics across share-sheet cancel

- **Decision**: allocate number + materialize PDF *before* opening the intent. On cancel, leave both on disk, status stays `draft`. On retry, detect that `order.orderNumber` is non-null and the file at `order.pdfPath` still exists; skip re-allocation and re-render.
- **Rationale**: satisfies FR-015 (stable filename across retries) without reserving a number prematurely (number is only bumped when the salesperson actually taps **Enviar por email**, not when the draft is created).

## R6 — Totals math source

- **Decision**: the PDF HTML template calls `computeOrderTotals(order, items)` (from 009) directly; the template never does its own arithmetic.
- **Rationale**: single source of truth — FR-010 / SC-004. A property-based test over seeded orders asserts PDF totals match the on-screen summary cell-for-cell.

## R7 — Non-fiscal marker guarantee

- **Decision**: the PDF template hard-codes a prominent "Documento sem valor fiscal" header chip and a footer disclaimer. A static test (`pdfTemplate.nofiscal.test.ts`) scans the template file for forbidden patterns (`NF-e`, `Nota Fiscal`, `CNPJ:`, `Inscrição Estadual`, `ICMS`, `IPI`).
- **Rationale**: FR-008 / SC-003 become CI-enforced rules. Any future edit that introduces a fiscal-looking marker fails a fast unit test, not a late visual review.

## R8 — Locale scope

- **Decision**: pt-BR only — currency `R$` with comma decimal; dates `DD MMM YYYY` with lowercase Portuguese months (e.g., `12 abr 2026`). Reuse `formatCurrencyBRL` (008) and `formatShortDatePt` (010) verbatim.
- **Rationale**: assumption documented in spec; no other locales in MVP scope.

## R9 — Sync column exclusion for `pdf_path`

- **Decision**: the sync push layer (`src/data/sync/push/ordersPush.ts`) omits `pdf_path` from the outbound Supabase payload. `order_number` IS pushed.
- **Rationale**: `pdf_path` is an absolute device path that is meaningless on another installation; syncing it would pollute the remote row and confuse a future reader. `order_number` must sync for the uniqueness constraint to have any teeth across devices.

## R10 — `OrderSent` screen navigation on "Concluir"

- **Decision**: `navigation.navigate('ClientProfile', { clientId })`, matching the existing post-send target in 009.
- **Rationale**: consistency — the salesperson already expects to land back on the client profile after sending. Same pattern, no surprise.
