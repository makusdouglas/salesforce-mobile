# Implementation Plan: Order Email Delivery

**Branch**: `011-order-email-delivery` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-order-email-delivery/spec.md`

## Summary

Deliver constitution R4 — an order draft becomes a **sent** order by generating a PDF quote locally, handing it to the device's mail/share intent, and, on return, persisting `order_number`, `pdf_path`, and `sent_at_ms` on the row. No server render, no external delivery service (SendGrid/Resend), no network during the send path. The feature edits `OrderSummaryScreen` (phone + tablet), adds a new terminal confirmation screen `OrderSentScreen` (phone + tablet), and introduces a reference-only A4 PDF layout produced by `expo-print`. All five Pencil frames were produced by `/speckit-pencil-design` on 2026-04-23 and are the primordial UI source.

**One new service, two new libraries, one new screen.** A new `orderSendService.sendOrder({ orderId })` orchestrates the four-step transaction: (1) allocate the order number in the same `database.write(...)` action, (2) render the HTML → PDF with `expo-print`, (3) copy the output to a stable path `<documentDir>/orders/pedido-<YYYY-NNNN>-<client-slug>.pdf`, (4) open the mail or share intent. On the foreground-return resolution (step 5), a second `database.write(...)` action flips the order to `sent` and persists `pdf_path` + `sent_at_ms`. The two writes are deliberately split: number allocation + file materialization happen before the intent is opened (so a retry after cancel reuses the same number and filename — FR-015), and the status flip happens only after the salesperson confirms via the OS intent.

**Intent selection is a single conditional.** `sendOrder` inspects `order.clientEmail` (snapshotted on the order at send-intent time, same pattern as 009) and either opens `expo-mail-composer` with `recipients: [email], subject, body, attachments: [pdfPath]` (FR-003) or falls back to `expo-sharing.shareAsync(pdfPath, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })` when the email is missing or fails the basic shape check (FR-004 + edge case). The button label and hint copy on `OrderSummaryScreen` switch on the same condition (FR-005/006).

**Order number allocation is a local counter with deterministic sync reconciliation.** A new `order_number_counters(year)` Watermelon table holds the per-year next value. `sendOrder` reads + increments this counter inside the same transaction as the order status fields, producing `#YYYY-NNNN`. On push, the Supabase table `orders` carries a `UNIQUE (order_number)` constraint. When two devices race (FR-012), the sync engine's push loop catches the conflict on the second device, calls the pure helper `allocateNextNumber({ year, taken: [...] })` to find the next free number locally, rewrites the local order's `order_number`, renames the PDF file on disk to the new number, and retries the push. The renamed PDF is the canonical artifact from then on; `pdf_path` stays accurate. This is the only place sync conflict resolution is non-trivial in this feature; it is confined to one well-tested module.

**Totals come from the same source as the on-screen summary.** The PDF HTML template calls `computeOrderTotals(order, items)` (from 009) directly — no re-implementation of discount or total math (FR-010 / SC-004). Currency and date formatting reuse the existing `formatCurrencyBRL` and `formatShortDatePt` utilities from 008/010.

**No-fiscal marker is baked into the template.** The HTML template hard-codes a header chip "Documento sem valor fiscal" and a footer disclaimer "Este documento é um orçamento / proposta comercial. NÃO POSSUI valor fiscal." (FR-008). A dedicated test (`pdfTemplate.nofiscal.test.ts`) scans the rendered HTML string for any forbidden pattern (CNPJ label, "NF-e", "nota fiscal", tax code blocks) to keep the rule static — SC-003 turns into a CI guarantee.

**Retry after share-sheet cancel is a no-op.** If the foreground-return resolution reports "user dismissed without completing" (detected via the intent callback's result code), the status flip is skipped and the order stays `draft`. The allocated `order_number` and the PDF on disk are *kept*, so the next tap on **Enviar por email** reuses them — no renumbering, same filename (FR-014 + FR-015).

**Responsive strategy.** Same `useViewport()` hook + 768pt threshold as 008/009/010. Both edited screens (`OrderSummary`) and both new screens (`OrderSent`) render identical logical content with viewport-conditional layout inside the existing component — vertical footer on phone, right-column stack on tablet. The PDF layout is viewport-independent (A4 at 595×842pt, always portrait).

## Technical Context

**Language/Version**: TypeScript 5.9 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (inherited from 001–010).

**Primary Dependencies**:

- `@nozbe/watermelondb` — reused. Adds one new table (`order_number_counters`) and two new columns on `orders` (`order_number`, `pdf_path`). See `data-model.md`. One new migration.
- `@react-navigation/native-stack` — reused. Adds one new route `OrderSent` to the existing `OrdersStack` (009) — the `OrderSummaryScreen` navigates to it after the intent resolves.
- **NEW — `expo-print`** (mandated by constitution §3). Renders an HTML template to a PDF URI via `Print.printToFileAsync(...)`. Zero native extras beyond the existing dev-client build.
- **NEW — `expo-sharing`**. Generic OS share sheet for the no-email fallback path.
- **NEW — `expo-mail-composer`**. The mail intent (pre-filled recipient + subject + body + attachment) when the client has an email on file. Returns a result code distinguishing sent / cancelled / saved / undetermined, which `sendOrder` uses to decide whether to flip the order to `sent`.
- `expo-file-system` — reused. The PDF is copied from `expo-print`'s temp location to `<documentDir>/orders/pedido-<YYYY-NNNN>-<client-slug>.pdf` for stable retrieval (FR-015 / FR-016).
- `@/features/orders/totals/computeOrderTotals` — reused verbatim for the PDF totals and the on-screen hint.
- `@/features/orders/services/ordersService` — EDIT: `markSent(orderId, { orderNumber, pdfPath, sentAtMs })` becomes the canonical status-flip method; existing `sent` transition in 009 is rerouted through it so both code paths converge.
- **No new Supabase edge function. No RLS change. No `service_role` usage.**

**Storage**:

- **Schema migration** (one migration file): `orders` gains `order_number TEXT NULL` + `pdf_path TEXT NULL` columns. A new WatermelonDB table `order_number_counters` with columns `(year INTEGER PRIMARY KEY, next_value INTEGER NOT NULL)` holds the local allocator.
- **Supabase-side** (same migration): `orders.order_number TEXT` + `orders.pdf_path TEXT`; `UNIQUE (order_number)` constraint on the non-null values (partial unique index). `pdf_path` is **not** synced to Supabase — it is device-local and would be meaningless on another installation. Sync engine (005) is updated to exclude `pdf_path` from the outbound column set for `orders`.
- **Allocator semantics**: `allocateNextOrderNumber(year)` reads the row for `year`, computes `#YYYY-<zero-padded 4-digit next_value>`, bumps `next_value`, returns the formatted number. Runs inside the same `database.write(...)` action as the caller that persists the value on the order row, so two concurrent calls on the same device cannot produce duplicates. Cross-device collisions are handled at sync push time (see `allocateNextNumber` reconciliation helper).
- **Observation for OrderSent**: reads the order + items via existing repo observations; no new query.

**Testing**: Constitution §9 — business-logic coverage first.

1. **`orderSendService.test.ts`** — end-to-end behaviour lock for the send flow with expo modules mocked.
   - Happy path (client has email): allocates order number, renders PDF, copies file to `<documentDir>/orders/pedido-2026-0001-padaria-central.pdf`, calls `MailComposer.composeAsync` with the exact expected `recipients/subject/body/attachments`, on `MailComposerResult.SENT` flips status to `sent`, persists `order_number` + `pdf_path` + `sent_at_ms`.
   - No email path: allocates + renders + copies identically, calls `Sharing.shareAsync` with the PDF URI, flips status on resolve.
   - Cancel path: `MailComposer.composeAsync` returns `CANCELLED` → status stays `draft`, `order_number` and `pdf_path` are still persisted (so a second tap reuses them), `sent_at_ms` remains `null`.
   - Retry after cancel: a second call to `sendOrder` on a draft that already has `order_number` and `pdf_path` MUST NOT allocate a new number and MUST NOT re-render the PDF if the file still exists at `pdf_path`; it opens the intent directly.
   - Empty draft: `sendOrder` throws `EmptyDraftError` before allocating a number (FR-018).
   - Zero-network guarantee: the service module is statically scanned for `fetch`, `@supabase/`, `@/data/sync/...` (see `noNetworkOnSend.test.ts`).

2. **`allocateNextOrderNumber.test.ts`** — pure counter semantics.
   - Starts at `#YYYY-0001` for a fresh year.
   - Increments monotonically within a year.
   - Resets to `0001` at year boundary.
   - Padding: `#2026-0042`, `#2026-0999`, `#2026-1000`, `#2026-9999` all render correctly.
   - `allocateNextNumber({ year, taken: [...] })` (pure helper used by sync push on conflict): given a list of taken numbers, returns the lowest free `#YYYY-NNNN` — tested for contiguous, sparse, and adversarial inputs.

3. **`pdfTemplate.test.ts`** — pure HTML rendering lock.
   - Given a seeded order with known totals, the rendered HTML contains: the order number, the non-fiscal marker, the salesperson name, the client name, one row per line item with the expected `quantity × unitPrice −discount = lineTotal` values, the order-level discount, and the grand total — all matching `computeOrderTotals` output.
   - `pt-BR` formatting: currency uses `R$` with comma decimal; dates use `DD MMM YYYY` in Portuguese months.
   - **Negative** lock (`pdfTemplate.nofiscal.test.ts`): the rendered HTML does NOT contain any of `['NF-e', 'Nota Fiscal', 'CNPJ:', 'Inscrição Estadual', 'ICMS', 'IPI']` — static scan of the template file.

4. **`orderSendService.sync.test.ts`** — conflict reconciliation at push.
   - Given two orders with the same `#YYYY-NNNN` arriving at sync push, the second device's push loop detects the unique-violation (mocked), calls `allocateNextNumber`, rewrites the local `order_number`, renames the local PDF, and retries push — all idempotent on second try.
   - `pdf_path` is excluded from the outbound Supabase payload.

5. **Screen smoke**:
   - `OrderSummaryScreen.test.tsx` (edit of 009 test): hint slot renders `"PDF + email para joao@example.com"` when client has email, `"Sem email cadastrado"` when not; button label switches accordingly.
   - `OrderSentScreen.test.tsx` (new): given mock order `{ orderNumber: '#2026-0042', clientEmail: 'x@y.z' }`, renders order number, recipient line, and both CTAs. Tap on "Ver PDF salvo" calls `Sharing.shareAsync(pdfPath)`; tap on "Concluir" calls `navigation.navigate` with the post-send target (ClientProfile → client order history, matching 009's existing pattern).

6. **Static guards extended**:
   - `noCatalogWrites.test.ts` scan (010) widened again to include `src/features/orders/services/orderSendService.ts`, `src/features/orders/send/**`, and the two new screens — R5 stays locked.
   - New `noNetworkOnSend.test.ts` asserts zero `fetch` / `@supabase/` / `@/data/sync/` references along the send path (FR-021). The sync-reconciliation code explicitly lives in the sync engine, not in the send path, so this scan is clean.

UI verification is manual against all five Pencil frames on both viewports (phone + tablet for OrderSummary and OrderSent, plus the PDF template which is rendered against a seed order and visually diffed against `design/pdf-template-a4.png`), covering all three user stories: (a) send with email on file; (b) share without email; (c) re-open stored PDF from a sent order.

**Target Platform**: iOS 13+ and Android 7+ (inherited). `expo-print` requires a dev-client build (already in use since 001); `expo-mail-composer` and `expo-sharing` run in the existing dev client with no additional native work.

**Project Type**: Mobile app — feature-module extension under `src/features/orders/` with one new subfolder `send/` for the service, hook, helpers, and PDF template. No backend code (beyond a Supabase-side migration adding columns + a unique partial index).

**Performance Goals**:

- **SC-001 (< 2 s tap → share sheet)**: compute budget breakdown for a 30-line order — HTML rendering is a template-literal string build, < 5 ms. `Print.printToFileAsync` on mid-range hardware is 400–900 ms. File copy via `expo-file-system` is < 50 ms. Intent open is ~200 ms. Total p95 ≈ 1.1 s, well inside budget. No memoization needed.
- **SC-002 (zero silent failures)** is an architectural invariant of the two-`database.write` design, not a tuning target.
- PDF generation is CPU-bound on the device; no async backpressure.

**Constraints**:

- **Offline-first (P1 / FR-021)**: all send-path work is local. `expo-print` renders offline; `expo-mail-composer` and `expo-sharing` hand off to OS intents that may themselves need network — but that is the salesperson's mail app's concern, not ours. The app itself makes zero network calls between the **Enviar por email** tap and the order flipping to `sent`.
- **No fiscal drift (FR-008 / SC-003)**: locked by `pdfTemplate.nofiscal.test.ts` — any future edit that adds a forbidden marker fails CI.
- **R4 fidelity**: PDF local, email via system client, no delivery service. Constitution §4 R4 verbatim.
- **R5 catalog immutability**: re-asserted by widened `noCatalogWrites.test.ts`.
- **Portrait-only (UX5)**: inherited. PDF is portrait A4.
- **Role (UX6 / D7)**: VENDEDOR-only surfaces, identical to 009/010. No role-guarded surface touched.
- **Language (§9)**: English identifiers for service/hook/errors; Portuguese copy (UI + PDF body + mail subject/body) centralized per file.
- **D4 statuses unchanged**: this feature finally populates the `sent` status transition that 009 defined; no new status.

**Scale/Scope**:

- **New files (≈ 10)**: `src/features/orders/send/orderSendService.ts`, `src/features/orders/send/orderSendService.test.ts`, `src/features/orders/send/allocateNextOrderNumber.ts` + `.test.ts`, `src/features/orders/send/pdfTemplate.ts` + `.test.ts` + `.nofiscal.test.ts`, `src/features/orders/send/useSendOrder.ts`, `src/features/orders/screens/OrderSentScreen.tsx`, `src/features/orders/components/SendHint.tsx`, `src/features/orders/send/noNetworkOnSend.test.ts`.
- **New DB migration**: `0011_order_email_delivery.sql` adds two columns on `orders` + creates `order_number_counters` table + adds the Supabase-side partial unique index on `orders.order_number`. WatermelonDB schema version bumps; migration registered in `src/data/schema/`.
- **Existing files edited (≈ 7)**: `src/features/orders/services/ordersService.ts` (+ `markSent` rerouting), `src/features/orders/screens/OrderSummaryScreen.tsx` (+ hint slot + button label branch + navigation to `OrderSent`), `src/app/navigation/types.ts` (+ `OrderSent` route + params), `src/app/navigation/OrdersStack.tsx` (+ `OrderSent` screen registration), `src/data/schema/*` (+ columns + counter table), `src/data/sync/push/*` (+ conflict reconciliation hook; + exclude `pdf_path` from outbound), `src/features/orders/noCatalogWrites.test.ts` (widen scan root). Total: ~7 existing files touched, additively.
- **0 new Supabase Edge Functions. 0 new RLS policies.** The unique constraint on `orders.order_number` is a DB-level guarantee, not an RLS rule.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Verdict | Notes |
|------------------|----------|---------|-------|
| P1 Offline-first | ✅ | Pass | Send path has zero network calls (FR-021). `expo-print` renders offline; `expo-mail-composer` + `expo-sharing` hand off to OS intents. Static scan `noNetworkOnSend.test.ts` locks it. |
| P2 Local DB is source of truth | ✅ | Pass | Order number, PDF path, sent timestamp all persist locally first; sync pushes them upstream. |
| P3 MVP simplicity | ✅ | Pass | One service, one new screen, one migration, three new expo modules (two of which — `expo-print` + file-system — were already mandated by constitution §3). Counter is a single-row-per-year table; reconciliation is a pure function. |
| P4 Reuse free tools | ✅ | Pass | Mail delivery reuses the device's configured mail client (constitution R4). Sharing reuses `expo-sharing`. No custom infra. |
| P5 Salesperson data is sacred | ✅ | Pass | Order number + PDF path persist before the intent opens (retry-safe); status flip persists inside `database.write`. If the app is killed during the intent, the draft is preserved with its allocated number intact. |
| P6 Admin is online-first | N/A | — | VENDEDOR-only feature. |
| §3 Mandatory — Expo managed + dev client | ✅ | Pass | Three new expo modules, all Expo-managed-compatible, running in the existing dev client. |
| §3 Mandatory — WatermelonDB | ✅ | Pass | Counter and order field writes all via Watermelon. |
| §3 Mandatory — Supabase | ✅ | Pass | One additive migration; one partial unique index; `pdf_path` stays local-only. |
| §3 Mandatory — **`expo-print`** | ✅ | **First actual use** | Constitution §3 mandated it for this exact feature. Justification trivially met. |
| §3 Mandatory — `expo-sharing`, `expo-mail-composer` (new) | ✅ | Pass with one-line justifications | `expo-sharing`: generic share sheet for clients without email (FR-004). `expo-mail-composer`: explicit mail intent with attachment for clients with email (FR-003). Both are Expo SDK modules, no bundle bloat, no third-party delivery service (R4). |
| §3 Forbidden — custom backend / Firebase / heavy state mgmt / heavy UI libs | ✅ | Pass | None introduced. |
| §3 Forbidden — device-to-device P2P | ✅ | Pass | Share sheet hand-off is an OS intent, not a P2P connection we manage. |
| R1 WatermelonDB is the single data layer (VENDEDOR) | ✅ | Pass | All writes inside `database.write(...)`. |
| R2 Seven entities | ✅ | Pass | Adds two columns to `orders`. New `order_number_counters` is infrastructure (per the v1.0.0 precedent of `user_roles`), not a new business entity. |
| R3 Images in Storage | N/A | — | No images. |
| **R4 PDF local, email via system client, no delivery service** | ✅ | **Central invariant** | The entire feature implements R4. No SendGrid / Resend. PDF rendered on device. Mail intent is OS-owned. |
| R5 Discounts on order + order_item, never on product | ✅ | Pass | Send path reads but never writes catalog tables. Widened static scan. |
| UX1 Tap, not type | ✅ | Pass | Send button is a tap. Mail/share intent belongs to the OS thereafter. |
| UX2 Repeat previous order is first-class | N/A | — | Shipped in 010. |
| UX3 Useful empty states | ✅ | Pass | Send button is disabled for zero-line drafts (FR-018). `OrderSent` recipient line falls back to "compartilhado sem email" (FR-019). |
| UX4 Sync feedback discreet | ✅ | Pass | Order-number renumber on push conflict is invisible to the user — the PDF filename changes on disk; the in-app display reflects the new number on next observation tick. |
| UX5 Layouts serve phone and tablet | ✅ | Pass | Five frames shipped: OrderSummary × 2 edited, OrderSent × 2 new, PDF Template × A4 (viewport-independent). |
| UX6 Dual-role visibility | N/A | — | Seller surfaces only. |
| D1 Sync pull then push | ✅ | Pass | Send does not trigger sync synchronously; the existing sync engine picks the new fields up on the next push. |
| D2 Catalog read-only for VENDEDOR | ✅ | Pass | No catalog writes. |
| D4 Orders use simple local statuses | ✅ | Pass | Uses the existing `sent` status, now actually populated. No new status. |
| D5 / D6 Auth + biometric | N/A | — | No auth-surface change. |
| D7 Role-based authorization | N/A | — | No role-guarded surface touched. |
| §9 English in code / Portuguese in copy | ✅ | Pass | Service + hook + error types + helper names English. UI copy + PDF body + mail subject/body Portuguese, centralized per file. |

**Gate result: PASS.** No violations — no Complexity Tracking entries.

## Role & Authorization Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Does this feature expose or touch role-guarded surfaces?** **No.**

The feature edits `OrderSummaryScreen` and adds `OrderSentScreen` under `src/features/orders/` (VENDEDOR). It does not introduce or modify any screen under `src/features/admin/`, it does not alter RLS on any D7-guarded table (`products`, `product_variants`, `salespeople`, `clients`, `user_roles`), it does not change which roles see which affordance, and it introduces no Edge Function. Writes are to `orders` and the new `order_number_counters` table only — the former already scoped by `(salesperson_id = auth.uid())` RLS, the latter local-only (not synced).

N/A (no role-guarded surfaces).

## Design Prerequisite

*GATE: Must pass before any implementation task is generated.*

**Does this feature have a UI?** **Yes.** Spec lists five screens; `design/screens.md` + `design/design.json` were generated by `/speckit-pencil-design` on 2026-04-23.

| Check | Status | Notes |
|-------|--------|-------|
| Feature has UI? | yes | OrderSummary × 2 edited, OrderSent × 2 new, PDF Template × A4 reference |
| `design/screens.md` exists | ✅ | [design/screens.md](./design/screens.md) |
| Phone frames cover all screens | ✅ | OrderSummary / Phone (Z36e3), OrderSent / Phone (K99dc) |
| Tablet frames cover all screens | ✅ | OrderSummary / Tablet (JDXoD), OrderSent / Tablet (qWpse) |
| Responsive strategy documented below | ✅ | See Summary "Responsive strategy" + Structure Decision |

Note: the PDF Template (6iIjz) is intentionally single-frame — PDF is always A4 portrait, viewport-independent.

**Design pointer**: `specs/011-order-email-delivery/design.json`.

## Project Structure

### Documentation (this feature)

```text
specs/011-order-email-delivery/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── orderSendService.md
│   ├── allocateNextOrderNumber.md
│   └── pdfTemplate.md
├── design/              # from /speckit-pencil-design
│   ├── screens.md
│   ├── order-summary-phone.png
│   ├── order-summary-tablet.png
│   ├── order-sent-phone.png
│   ├── order-sent-tablet.png
│   └── pdf-template-a4.png
├── design.json
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── data/
│   ├── schema/
│   │   └── migrations/
│   │       └── 0011_order_email_delivery.ts   # NEW: + order_number, pdf_path, order_number_counters
│   ├── models/
│   │   ├── Order.ts                            # EDIT: + order_number, pdf_path decorators
│   │   └── OrderNumberCounter.ts               # NEW
│   ├── repositories/
│   │   └── orderNumberCountersRepository.ts    # NEW
│   └── sync/
│       └── push/ordersPush.ts                  # EDIT: exclude pdf_path; hook conflict reconciliation
│
├── features/
│   └── orders/
│       ├── send/
│       │   ├── orderSendService.ts             # NEW: the send orchestrator
│       │   ├── orderSendService.test.ts
│       │   ├── allocateNextOrderNumber.ts      # NEW: pure counter + reconciliation helpers
│       │   ├── allocateNextOrderNumber.test.ts
│       │   ├── pdfTemplate.ts                  # NEW: pure HTML builder
│       │   ├── pdfTemplate.test.ts
│       │   ├── pdfTemplate.nofiscal.test.ts    # NEW: static forbidden-marker scan
│       │   ├── useSendOrder.ts                 # NEW: React hook wrapper
│       │   ├── clientSlug.ts                   # NEW: tiny slug helper for filename
│       │   ├── noNetworkOnSend.test.ts         # NEW: static scan, zero network on send
│       │   └── orderSendService.sync.test.ts   # NEW: push conflict reconciliation
│       ├── services/
│       │   └── ordersService.ts                # EDIT: + markSent(orderId, {orderNumber, pdfPath, sentAtMs})
│       ├── screens/
│       │   ├── OrderSummaryScreen.tsx          # EDIT: + SendHint + button label branch + navigate to OrderSent
│       │   └── OrderSentScreen.tsx             # NEW: terminal confirmation screen (phone + tablet)
│       ├── components/
│       │   └── SendHint.tsx                    # NEW: inline "PDF + email para …" / "sem email cadastrado" hint
│       └── noCatalogWrites.test.ts             # EDIT: widen scan root to include src/features/orders/send/**
│
└── app/
    └── navigation/
        ├── types.ts                            # EDIT: + OrderSent route + params (orderId, orderNumber, pdfPath, recipientEmail?)
        └── OrdersStack.tsx                     # EDIT: + OrderSent screen registration

tests/
└── (co-located with the files they test — same convention as 001–010)
```

**Structure Decision**: Single RN app, one new subfolder `src/features/orders/send/` that owns the entire feature — service, pure helpers, HTML template, hook, and its own static scans. The edited surfaces (`OrderSummaryScreen`, `ordersService`, navigation types, sync push) stay in place. `OrderSentScreen` lives under `src/features/orders/screens/` alongside the existing three screens. Responsive strategy: reuse the `useViewport()` hook established in 008; both `OrderSummaryScreen` and `OrderSentScreen` branch layout at 768pt — phone uses a vertical footer; tablet puts primary/secondary CTAs on a single horizontal row. The PDF layout is viewport-independent (always A4 portrait).

## Complexity Tracking

No Constitution Check violations. This section is intentionally empty.
