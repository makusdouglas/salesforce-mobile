// 011-order-email-delivery: the send orchestrator. See
// contracts/orderSendService.md for the full behaviour contract.
//
// Flow:
//   1. load order + items → guard (not found / not draft / empty)
//   2. if order.orderNumber is null, open a database.write and allocate +
//      persist it inside the same transaction as the allocator bump
//   3. if PDF file missing on disk, call Print.printToFileAsync + copy to
//      the stable path and persist pdf_uri inside another database.write
//   4. decide mail vs share by isLikelyEmail(order.clientEmail) — single
//      choke point for the email shape check (U1)
//   5. open the intent; on SENT (mail) or any non-throwing resolve (share,
//      see research R11) → database.write to flip status to 'sent' +
//      stamp sent_at_ms. On CANCELLED (mail) → return { kind: 'cancelled' }
//      leaving the persisted number + PDF in place for the next retry.
//
// This service is the ONLY place in the app that opens mail-composer or
// sharing intents on the VENDEDOR surface. Zero network (FR-021 / P1) —
// static-scanned by noNetworkOnSend.test.ts.

// eslint-disable-next-line import/no-unresolved -- subpath provided by expo-file-system
import * as FileSystem from 'expo-file-system/legacy';
import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { database } from '@/data/database';
import type Order from '@/data/models/Order';
import { applyTouchOnUpdate } from '@/data/repositories/_touch';
import { clientsRepository } from '@/data/repositories/clientsRepository';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { ordersRepository } from '@/data/repositories/ordersRepository';
import { productVariantsRepository } from '@/data/repositories/productVariantsRepository';
import { productsRepository } from '@/data/repositories/productsRepository';
import { salespeopleRepository } from '@/data/repositories/salespeopleRepository';

import { allocateNextOrderNumber } from './allocateNextOrderNumber';
import { clientSlug, isLikelyEmail } from './clientSlug';
import { renderOrderPdfHtml, type PdfOrderLine } from './pdfTemplate';

export type SendOrderResult =
  | {
      readonly kind: 'sent';
      readonly orderNumber: string;
      readonly pdfPath: string;
      readonly sentAtMs: number;
      readonly recipientEmail: string | null;
    }
  | {
      readonly kind: 'cancelled';
      readonly orderNumber: string;
      readonly pdfPath: string;
    }
  | {
      readonly kind: 'error';
      readonly reason:
        | 'empty_draft'
        | 'not_draft'
        | 'not_found'
        | 'pdf_failed'
        | 'intent_unavailable';
    };

export const SUBJECT_TEMPLATE = (orderNumber: string, clientName: string): string =>
  `Pedido ${orderNumber} - ${clientName}`;

export const BODY_TEMPLATE = (salespersonName: string, clientName: string): string =>
  [
    `Olá, ${clientName}.`,
    '',
    'Segue em anexo o pedido em PDF para sua avaliação.',
    '',
    'Qualquer dúvida estou à disposição.',
    '',
    salespersonName,
  ].join('\n');

function pdfDirectoryPath(): string {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  return `${base}orders/`;
}

function pdfFilename(orderNumber: string, clientName: string): string {
  const numberSansHash = orderNumber.replace(/^#/, '');
  return `pedido-${numberSansHash}-${clientSlug(clientName)}.pdf`;
}

async function ensurePdfDir(): Promise<void> {
  const dir = pdfDirectoryPath();
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch {
    // best effort; writePdfFile will surface the real error
  }
}

async function writePdfFile(html: string, destPath: string): Promise<void> {
  const result = await Print.printToFileAsync({ html });
  await ensurePdfDir();
  // Some platforms already emit a `file://` URI; FileSystem.copyAsync handles both.
  try {
    // If destination exists from a previous run, remove first to avoid rename races.
    const info = await FileSystem.getInfoAsync(destPath);
    if (info.exists) {
      await FileSystem.deleteAsync(destPath, { idempotent: true });
    }
  } catch {
    // ignore
  }
  await FileSystem.copyAsync({ from: result.uri, to: destPath });
}

async function fileExists(pathLike: string | null | undefined): Promise<boolean> {
  if (!pathLike) return false;
  try {
    const info = await FileSystem.getInfoAsync(pathLike);
    return info.exists;
  } catch {
    return false;
  }
}

async function loadPdfInputForOrder(order: Order): Promise<{
  lines: PdfOrderLine[];
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  salespersonName: string;
}> {
  const [client, salesperson, itemRows] = await Promise.all([
    clientsRepository.findById(order.clientId),
    salespeopleRepository.findById(order.salespersonId),
    orderItemsRepository.findByOrder(order.id),
  ]);

  const lines: PdfOrderLine[] = [];
  for (const row of itemRows) {
    const variant = await productVariantsRepository.findById(row.productVariantId);
    const product = variant ? await productsRepository.findById(variant.productId) : null;
    lines.push({
      id: row.id,
      productName: product?.name ?? 'Produto',
      variantLabel: variant?.label ?? null,
      quantity: row.quantity,
      unitPriceCents: row.unitPrice,
      discountAmountCents: row.discountAmount,
      discountMode: row.discountMode,
    });
  }

  return {
    lines,
    clientName: client?.name ?? 'Cliente',
    clientEmail: client?.email ?? null,
    clientPhone: client?.phone ?? null,
    salespersonName: salesperson?.name ?? 'Vendedor',
  };
}

export const orderSendService = {
  async sendOrder(input: { orderId: string }): Promise<SendOrderResult> {
    const order = await ordersRepository.findById(input.orderId);
    if (!order) return { kind: 'error', reason: 'not_found' };
    if (order.status !== 'draft') return { kind: 'error', reason: 'not_draft' };

    const itemCount = (await orderItemsRepository.findByOrder(order.id)).length;
    if (itemCount === 0) return { kind: 'error', reason: 'empty_draft' };

    // 1. Allocate order number (idempotent — keep existing if set).
    let orderNumber = order.orderNumber;
    if (!orderNumber) {
      const allocatedNumber: { value: string } = { value: '' };
      await database.write(async () => {
        allocatedNumber.value = await allocateNextOrderNumber(new Date().getFullYear());
        await order.update((r) => {
          r.orderNumber = allocatedNumber.value;
          applyTouchOnUpdate(r);
        });
      });
      orderNumber = allocatedNumber.value;
    }

    // 2. Materialize PDF at the stable path (idempotent — keep file if present).
    const pdfInputs = await loadPdfInputForOrder(order);
    const filename = pdfFilename(orderNumber, pdfInputs.clientName);
    const stablePath = `${pdfDirectoryPath()}${filename}`;

    let pdfPath = order.pdfUri;
    const stableExists = pdfPath === stablePath ? await fileExists(stablePath) : false;
    if (!stableExists) {
      try {
        const html = renderOrderPdfHtml({
          orderNumber,
          issuedAtMs: Date.now(),
          salesperson: { name: pdfInputs.salespersonName },
          client: {
            name: pdfInputs.clientName,
            email: pdfInputs.clientEmail,
            phone: pdfInputs.clientPhone,
          },
          items: pdfInputs.lines,
          orderDiscount: { amountCents: order.discountAmount, mode: order.discountMode },
        });
        await writePdfFile(html, stablePath);
        await database.write(async () => {
          await order.update((r) => {
            r.pdfUri = stablePath;
            applyTouchOnUpdate(r);
          });
        });
        pdfPath = stablePath;
      } catch {
        return { kind: 'error', reason: 'pdf_failed' };
      }
    }

    // 3. Decide intent. Single choke point for email shape (U1).
    const emailLikely = isLikelyEmail(pdfInputs.clientEmail);

    if (emailLikely) {
      const available = await safeIsMailAvailable();
      if (!available) return { kind: 'error', reason: 'intent_unavailable' };
      const result = await MailComposer.composeAsync({
        recipients: [pdfInputs.clientEmail as string],
        subject: SUBJECT_TEMPLATE(orderNumber, pdfInputs.clientName),
        body: BODY_TEMPLATE(pdfInputs.salespersonName, pdfInputs.clientName),
        attachments: [pdfPath as string],
      });
      if (result.status === MailComposer.MailComposerStatus.SENT) {
        const sentAtMs = await flipToSent(order);
        return {
          kind: 'sent',
          orderNumber,
          pdfPath: pdfPath as string,
          sentAtMs,
          recipientEmail: pdfInputs.clientEmail,
        };
      }
      // CANCELLED / SAVED / UNDETERMINED → keep draft, reuse on retry.
      return { kind: 'cancelled', orderNumber, pdfPath: pdfPath as string };
    }

    // Generic share fallback (no email / malformed email).
    const shareAvailable = await safeIsShareAvailable();
    if (!shareAvailable) return { kind: 'error', reason: 'intent_unavailable' };
    try {
      await Sharing.shareAsync(pdfPath as string, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: `Pedido ${orderNumber}`,
      });
    } catch {
      return { kind: 'cancelled', orderNumber, pdfPath: pdfPath as string };
    }
    // Android does not return a result code (research R11) — accept non-throw as sent.
    const sentAtMs = await flipToSent(order);
    return {
      kind: 'sent',
      orderNumber,
      pdfPath: pdfPath as string,
      sentAtMs,
      recipientEmail: null,
    };
  },

  /**
   * FR-017: regenerate the stored PDF for a sent order using the PERSISTED
   * order_number — never allocate a new one. Returns the path.
   */
  async regeneratePdfForSentOrder(orderId: string): Promise<string> {
    const order = await ordersRepository.findById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status !== 'sent') {
      throw new Error(`Order ${orderId} is ${order.status}, not sent — cannot regenerate`);
    }
    if (!order.orderNumber) {
      throw new Error(`Order ${orderId} has no order_number — cannot regenerate without allocating`);
    }
    const pdfInputs = await loadPdfInputForOrder(order);
    const filename = pdfFilename(order.orderNumber, pdfInputs.clientName);
    const stablePath = `${pdfDirectoryPath()}${filename}`;
    const html = renderOrderPdfHtml({
      orderNumber: order.orderNumber,
      issuedAtMs: order.sentAtMs ?? Date.now(),
      salesperson: { name: pdfInputs.salespersonName },
      client: {
        name: pdfInputs.clientName,
        email: pdfInputs.clientEmail,
        phone: pdfInputs.clientPhone,
      },
      items: pdfInputs.lines,
      orderDiscount: { amountCents: order.discountAmount, mode: order.discountMode },
    });
    await writePdfFile(html, stablePath);
    if (order.pdfUri !== stablePath) {
      await database.write(async () => {
        await order.update((r) => {
          r.pdfUri = stablePath;
          applyTouchOnUpdate(r);
        });
      });
    }
    return stablePath;
  },
};

async function flipToSent(order: Order): Promise<number> {
  const sentAtMs = Date.now();
  await database.write(async () => {
    await order.update((r) => {
      r.status = 'sent';
      r.sentAtMs = sentAtMs;
      applyTouchOnUpdate(r);
    });
  });
  return sentAtMs;
}

async function safeIsMailAvailable(): Promise<boolean> {
  try {
    return await MailComposer.isAvailableAsync();
  } catch {
    return false;
  }
}

async function safeIsShareAvailable(): Promise<boolean> {
  try {
    return await Sharing.isAvailableAsync();
  } catch {
    return false;
  }
}
