# Contract: `pdfTemplate.renderOrderPdfHtml`

Module: `src/features/orders/send/pdfTemplate.ts`

## Purpose

Pure HTML builder for the order PDF. Takes a fully-hydrated order view model and returns an HTML string ready to pass to `expo-print`'s `printToFileAsync`.

## Signature

```ts
export interface PdfOrderInput {
  readonly orderNumber: string;       // '#YYYY-NNNN'
  readonly issuedAtMs: number;        // display date on the PDF (= sent_at_ms when available, else now)
  readonly salesperson: { readonly name: string };
  readonly client: { readonly name: string; readonly email: string | null; readonly phone: string | null };
  readonly items: readonly {
    readonly productName: string;
    readonly variantLabel: string | null;
    readonly quantity: number;
    readonly unitPriceCents: number;
    readonly discountAmountCents: number;
    readonly discountMode: 'amount' | 'percent';
  }[];
  readonly orderDiscount: { readonly amountCents: number; readonly mode: 'amount' | 'percent' };
}

export function renderOrderPdfHtml(input: PdfOrderInput): string;
```

## Invariants

1. **Pure**: no side effects, deterministic output for a given input.
2. **Totals delegate to `computeOrderTotals`** — the template MUST NOT re-implement discount or total arithmetic. Verified by code inspection + by `pdfTemplate.test.ts` comparing rendered numbers against `computeOrderTotals` output on property-based seeds.
3. **Non-fiscal markers present**:
   - Header contains the literal string `"Documento sem valor fiscal"`.
   - Footer contains the literal string `"Este documento é um orçamento / proposta comercial. NÃO POSSUI valor fiscal."`.
4. **No fiscal markers present**: the rendered HTML MUST NOT contain any of `['NF-e', 'Nota Fiscal', 'CNPJ:', 'Inscrição Estadual', 'ICMS', 'IPI']`. Verified by `pdfTemplate.nofiscal.test.ts` as a static scan of the template source file AND a runtime scan of a rendered example.
5. **pt-BR formatting**: currency via `formatCurrencyBRL`; dates via `formatShortDatePt`. No other locales.
6. **Self-contained**: inline `<style>` only; no external assets, no remote images. The rendered PDF must not require a network fetch during `expo-print` rendering.

## Test matrix

Covered by `pdfTemplate.test.ts` and `pdfTemplate.nofiscal.test.ts`.
