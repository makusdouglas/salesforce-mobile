// 011-order-email-delivery: behaviour lock for the send orchestrator.
//
// All expo modules are mocked. The database is mocked so `database.write(fn)`
// just runs fn() — we assert side-effect ordering via the mocks, not via a
// real SQLite instance.

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({ uri: 'file:///tmp/out.pdf' }),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/data/database', () => ({
  database: {
    write: async (fn: () => Promise<unknown>) => fn(),
    get: () => ({}),
  },
}));
jest.mock('@/data/repositories/_touch', () => ({ applyTouchOnUpdate: jest.fn() }));
jest.mock('@/data/repositories/clientsRepository', () => ({
  clientsRepository: { findById: jest.fn() },
}));
jest.mock('@/data/repositories/salespeopleRepository', () => ({
  salespeopleRepository: { findById: jest.fn() },
}));
jest.mock('@/data/repositories/productsRepository', () => ({
  productsRepository: { findById: jest.fn() },
}));
jest.mock('@/data/repositories/productVariantsRepository', () => ({
  productVariantsRepository: { findById: jest.fn() },
}));
jest.mock('@/data/repositories/ordersRepository', () => ({
  ordersRepository: { findById: jest.fn() },
}));
jest.mock('@/data/repositories/orderItemsRepository', () => ({
  orderItemsRepository: { findByOrder: jest.fn() },
}));
jest.mock('./allocateNextOrderNumber', () => ({
  ...jest.requireActual('./allocateNextOrderNumber'),
  allocateNextOrderNumber: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { clientsRepository } from '@/data/repositories/clientsRepository';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { ordersRepository } from '@/data/repositories/ordersRepository';
import { productVariantsRepository } from '@/data/repositories/productVariantsRepository';
import { productsRepository } from '@/data/repositories/productsRepository';
import { salespeopleRepository } from '@/data/repositories/salespeopleRepository';

import { allocateNextOrderNumber } from './allocateNextOrderNumber';
import { orderSendService } from './orderSendService';

function makeOrder(over: Record<string, unknown> = {}): any {
  const state: Record<string, unknown> = {
    id: 'ord1',
    clientId: 'c1',
    salespersonId: 's1',
    status: 'draft',
    discountAmount: 0,
    discountMode: 'amount',
    createdAtMs: 1,
    sentAtMs: null,
    canceledAtMs: null,
    pdfUri: null,
    orderNumber: null,
    ...over,
  };
  return {
    ...state,
    get id() { return state.id; },
    get status() { return state.status; },
    get clientId() { return state.clientId; },
    get salespersonId() { return state.salespersonId; },
    get discountAmount() { return state.discountAmount; },
    get discountMode() { return state.discountMode; },
    get pdfUri() { return state.pdfUri; },
    get orderNumber() { return state.orderNumber; },
    get sentAtMs() { return state.sentAtMs; },
    update: jest.fn(async (updater: (r: any) => void) => {
      const proxy: any = {};
      for (const k of Object.keys(state)) {
        Object.defineProperty(proxy, k, {
          get: () => state[k],
          set: (v) => { state[k] = v; },
          configurable: true,
        });
      }
      updater(proxy);
    }),
    _state: state,
  };
}

const mockItem = { id: 'li1', productVariantId: 'v1', quantity: 1, unitPrice: 1000, discountAmount: 0, discountMode: 'amount' as const };
const mockVariant = { id: 'v1', productId: 'p1', label: '1L', price: 1000 };
const mockProduct = { id: 'p1', name: 'Leite' };
const mockSalesperson = { id: 's1', name: 'Maria' };

beforeEach(() => {
  jest.clearAllMocks();
  // Default: file doesn't exist on pre-check, but after writePdfFile's
  // copy we report a non-empty file so the post-copy size guard passes.
  let call = 0;
  (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async () => {
    call += 1;
    // First call per test = pre-existing file check (missing). Subsequent
    // calls = post-copy size check (non-empty) and any later lookups.
    return call === 1 ? { exists: false } : { exists: true, size: 1024 };
  });
  (allocateNextOrderNumber as jest.Mock).mockResolvedValue('#2026-0042');
  (orderItemsRepository.findByOrder as jest.Mock).mockResolvedValue([mockItem]);
  (productVariantsRepository.findById as jest.Mock).mockResolvedValue(mockVariant);
  (productsRepository.findById as jest.Mock).mockResolvedValue(mockProduct);
  (salespeopleRepository.findById as jest.Mock).mockResolvedValue(mockSalesperson);
  (Print.printToFileAsync as jest.Mock).mockResolvedValue({ uri: 'file:///tmp/out.pdf' });
  (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
});

describe('orderSendService.sendOrder', () => {
  test('happy path: client with email → share sheet → flip to sent, recipientEmail preserved for OrderSent', async () => {
    const order = makeOrder({ clientId: 'c1' });
    (ordersRepository.findById as jest.Mock).mockResolvedValue(order);
    (clientsRepository.findById as jest.Mock).mockResolvedValue({ id: 'c1', name: 'Padaria', email: 'x@y.co', phone: null });

    const result = await orderSendService.sendOrder({ orderId: 'ord1' });

    expect(result.kind).toBe('sent');
    if (result.kind === 'sent') {
      expect(result.orderNumber).toBe('#2026-0042');
      expect(result.recipientEmail).toBe('x@y.co');
    }
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('pedido-2026-0042-padaria.pdf'),
      expect.objectContaining({ mimeType: 'application/pdf' }),
    );
    expect(order._state.status).toBe('sent');
    expect(order._state.sentAtMs).toBeGreaterThan(0);
    expect(order._state.orderNumber).toBe('#2026-0042');
  });

  test('no email → share → flip to sent with recipientEmail null', async () => {
    const order = makeOrder();
    (ordersRepository.findById as jest.Mock).mockResolvedValue(order);
    (clientsRepository.findById as jest.Mock).mockResolvedValue({ id: 'c1', name: 'Padaria', email: null, phone: null });

    const result = await orderSendService.sendOrder({ orderId: 'ord1' });

    expect(result.kind).toBe('sent');
    if (result.kind === 'sent') expect(result.recipientEmail).toBeNull();
    expect(Sharing.shareAsync).toHaveBeenCalled();
    expect(order._state.status).toBe('sent');
  });

  test('malformed email → share branch, recipientEmail null on result', async () => {
    const order = makeOrder();
    (ordersRepository.findById as jest.Mock).mockResolvedValue(order);
    (clientsRepository.findById as jest.Mock).mockResolvedValue({ id: 'c1', name: 'Padaria', email: 'not-an-email', phone: null });

    const result = await orderSendService.sendOrder({ orderId: 'ord1' });

    expect(Sharing.shareAsync).toHaveBeenCalled();
    if (result.kind === 'sent') expect(result.recipientEmail).toBeNull();
  });

  test('share throws (user dismissed) → draft kept, number + PDF persisted', async () => {
    const order = makeOrder();
    (ordersRepository.findById as jest.Mock).mockResolvedValue(order);
    (clientsRepository.findById as jest.Mock).mockResolvedValue({ id: 'c1', name: 'Padaria', email: 'x@y.co', phone: null });
    (Sharing.shareAsync as jest.Mock).mockRejectedValueOnce(new Error('user cancelled'));

    const result = await orderSendService.sendOrder({ orderId: 'ord1' });

    expect(result.kind).toBe('cancelled');
    expect(order._state.status).toBe('draft');
    expect(order._state.sentAtMs).toBeNull();
    expect(order._state.orderNumber).toBe('#2026-0042');
    expect(order._state.pdfUri).toBeTruthy();
  });

  test('retry after cancel: reuses persisted number and PDF (no re-alloc, no re-render)', async () => {
    const order = makeOrder({ orderNumber: '#2026-0042', pdfUri: 'file:///doc/orders/pedido-2026-0042-padaria.pdf' });
    (ordersRepository.findById as jest.Mock).mockResolvedValue(order);
    (clientsRepository.findById as jest.Mock).mockResolvedValue({ id: 'c1', name: 'Padaria', email: 'x@y.co', phone: null });
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

    await orderSendService.sendOrder({ orderId: 'ord1' });

    expect(allocateNextOrderNumber).not.toHaveBeenCalled();
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
  });

  test('empty draft → error empty_draft, no allocation', async () => {
    const order = makeOrder();
    (ordersRepository.findById as jest.Mock).mockResolvedValue(order);
    (orderItemsRepository.findByOrder as jest.Mock).mockResolvedValue([]);

    const result = await orderSendService.sendOrder({ orderId: 'ord1' });

    expect(result).toEqual({ kind: 'error', reason: 'empty_draft' });
    expect(allocateNextOrderNumber).not.toHaveBeenCalled();
  });

  test('not found → error not_found', async () => {
    (ordersRepository.findById as jest.Mock).mockResolvedValue(null);
    const result = await orderSendService.sendOrder({ orderId: 'ord1' });
    expect(result).toEqual({ kind: 'error', reason: 'not_found' });
  });

  test('already sent → error not_draft', async () => {
    (ordersRepository.findById as jest.Mock).mockResolvedValue(makeOrder({ status: 'sent' }));
    const result = await orderSendService.sendOrder({ orderId: 'ord1' });
    expect(result).toEqual({ kind: 'error', reason: 'not_draft' });
  });

  test('PDF generation failure → error pdf_failed, number still allocated', async () => {
    const order = makeOrder();
    (ordersRepository.findById as jest.Mock).mockResolvedValue(order);
    (clientsRepository.findById as jest.Mock).mockResolvedValue({ id: 'c1', name: 'Padaria', email: 'x@y.co', phone: null });
    (Print.printToFileAsync as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    const result = await orderSendService.sendOrder({ orderId: 'ord1' });

    expect(result).toEqual({ kind: 'error', reason: 'pdf_failed' });
    expect(order._state.orderNumber).toBe('#2026-0042');
    expect(order._state.pdfUri).toBeNull();
    expect(order._state.status).toBe('draft');
  });
});

describe('orderSendService.regeneratePdfForSentOrder', () => {
  test('reuses persisted order_number, never calls allocator', async () => {
    const order = makeOrder({ status: 'sent', orderNumber: '#2026-0042', sentAtMs: 99 });
    (ordersRepository.findById as jest.Mock).mockResolvedValue(order);
    (clientsRepository.findById as jest.Mock).mockResolvedValue({ id: 'c1', name: 'Padaria', email: 'x@y.co', phone: null });

    const path = await orderSendService.regeneratePdfForSentOrder('ord1');

    expect(allocateNextOrderNumber).not.toHaveBeenCalled();
    expect(path).toMatch(/pedido-2026-0042-padaria\.pdf$/);
  });

  test('rejects on non-sent order', async () => {
    (ordersRepository.findById as jest.Mock).mockResolvedValue(makeOrder({ status: 'draft' }));
    await expect(orderSendService.regeneratePdfForSentOrder('ord1')).rejects.toThrow(/not sent/);
  });
});
