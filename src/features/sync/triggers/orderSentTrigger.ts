import { syncService } from '../service/syncService';

/**
 * Opportunistic sync trigger for the order-sending flow.
 *
 * Call immediately after `ordersRepository.markSent(orderId)` resolves.
 * Fire-and-forget (does not return a promise). No-op when the device is
 * offline. Do NOT await.
 *
 * Usage (from a future order-sending feature):
 *
 *   await ordersRepository.markSent(orderId);
 *   onOrderSent();
 *
 * The trigger does NOT verify that the order actually transitioned to
 * `sent` — that is the caller's responsibility. When offline, the order
 * stays locally queued and the next natural sync trigger (login or
 * pull-to-refresh) picks it up.
 */
export function onOrderSent(): void {
  syncService.onOrderSent();
}
