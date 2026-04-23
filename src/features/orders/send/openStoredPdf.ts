// 011-order-email-delivery: single choke point for opening the PDF of a
// sent order. OrderSent and OrderSummary (status=sent) both call this so
// the FR-017 regeneration branch is never duplicated.

// eslint-disable-next-line import/no-unresolved -- subpath provided by expo-file-system
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { ordersRepository } from '@/data/repositories/ordersRepository';

import { orderSendService } from './orderSendService';

export async function openStoredPdf(orderId: string): Promise<void> {
  const order = await ordersRepository.findById(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);

  let path = order.pdfUri;
  const exists = path ? (await FileSystem.getInfoAsync(path)).exists : false;
  if (!exists) {
    // File was evicted or order predates the PDF. Regenerate using the
    // PERSISTED order_number — never allocate a new one (FR-017).
    path = await orderSendService.regeneratePdfForSentOrder(orderId);
  }
  const available = await Sharing.isAvailableAsync().catch(() => false);
  if (!available || !path) throw new Error('Sharing intent unavailable');
  await Sharing.shareAsync(path, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Pedido ${order.orderNumber ?? ''}`,
  });
}
