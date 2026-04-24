# Contract: `orderSendService.sendOrder`

Module: `src/features/orders/send/orderSendService.ts`

## Purpose

Orchestrate the full send flow: allocate an order number, render the PDF, materialize it to a stable path, open the mail or share intent, and — on successful completion — flip the order to `sent` with the persisted metadata.

## Signature

```ts
export interface SendOrderInput {
  readonly orderId: string;
}

export type SendOrderResult =
  | { readonly kind: 'sent'; readonly orderNumber: string; readonly pdfPath: string; readonly sentAtMs: number; readonly recipientEmail: string | null }
  | { readonly kind: 'cancelled'; readonly orderNumber: string; readonly pdfPath: string }
  | { readonly kind: 'error'; readonly reason: 'empty_draft' | 'not_draft' | 'not_found' | 'pdf_failed' | 'intent_unavailable' };

export async function sendOrder(input: SendOrderInput): Promise<SendOrderResult>;
```

## Preconditions

- `input.orderId` references an existing `order` row.
- The referenced order is in status `draft` (FR-013).
- The order has at least one `order_item` (FR-018).

## Invariants

1. **Number + file materialize once.** On the first call for a given draft, `sendOrder` allocates an `order_number` and writes the PDF to `<documentDir>/orders/pedido-<number-without-#>-<client-slug>.pdf`. Both are persisted on the order row **before** the OS intent opens.
2. **Retry is idempotent.** On a second call for the same draft after a cancel, `sendOrder` detects that `order.orderNumber` and `order.pdfPath` already exist (and the file exists on disk) and skips re-allocation + re-render.
3. **Status flips only on confirmed send.** The transition `draft → sent` happens only when the intent reports `SENT` (mail composer) or the share sheet resolves without a cancel signal. `sent_at_ms` is set in the same `database.write(...)` as the status flip.
4. **Cancel leaves the draft intact.** The order stays `draft`; `orderNumber` and `pdfPath` persist (for the next retry). `sent_at_ms` remains `null`.
5. **No network.** The service file is scanned by `noNetworkOnSend.test.ts` for forbidden imports (`fetch`, `@supabase/`, `@/data/sync/...`).

## Postconditions on `sent` result

- `order.status === 'sent'`
- `order.order_number === result.orderNumber` (matching `/^#\d{4}-\d{4}$/`)
- `order.pdf_path === result.pdfPath` (file exists on disk)
- `order.sent_at_ms === result.sentAtMs` (non-null)

## Error modes

| Reason | Trigger | Side effects |
|--------|---------|--------------|
| `not_found` | `orderId` has no row | none |
| `not_draft` | order already `sent` or `canceled` | none |
| `empty_draft` | zero line items | none |
| `pdf_failed` | `expo-print` or `FileSystem.copyAsync` throws | order_number *is* allocated and persisted (prevents the next retry from re-allocating); no PDF file on disk; status stays `draft` |
| `intent_unavailable` | `MailComposer.isAvailableAsync()` false AND `Sharing.isAvailableAsync()` false (effectively impossible in the target dev client, but surfaced so the UI can show an actionable message) | order_number + PDF persisted; status stays `draft` |

## Dependencies

- `@/data/database` — for `database.write(...)` transactions.
- `@/data/repositories/ordersRepository` — `findById`, update.
- `@/data/repositories/orderItemsRepository` — `findByOrder`.
- `./allocateNextOrderNumber` — counter read + increment.
- `./pdfTemplate` — pure HTML builder.
- `./clientSlug` — filename slug.
- `expo-print` — `printToFileAsync`.
- `expo-file-system` — `copyAsync`, `getInfoAsync`, `makeDirectoryAsync`.
- `expo-mail-composer` — `composeAsync`, `isAvailableAsync`.
- `expo-sharing` — `shareAsync`, `isAvailableAsync`.

## Test matrix

Covered by `orderSendService.test.ts`. See `plan.md` for the full list.
