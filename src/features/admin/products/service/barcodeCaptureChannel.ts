type Listener = (code: string) => void;

/**
 * Module-level pub-sub that lets the product edit form open
 * AdminBarcodeScannerScreen in "capture mode" — i.e., scan a code and
 * pipe it back into the form's barcode field instead of running the
 * lookup flow (which navigates away to AdminBarcodeMatch / a fresh
 * AdminProductForm and discards in-progress edits).
 *
 * Mirrors imageSourceChannel.ts: callbacks aren't serializable, so they
 * can't ride on navigation params without warnings + persistence
 * breakage.
 *
 * Flow:
 *   1. Form registers a handler via `request(listener)`.
 *   2. Form navigates to AdminBarcodeScanner.
 *   3. Scanner sees a pending listener, switches to capture mode, and
 *      on a successful read calls `resolve(code)` then `goBack()`.
 *   4. If the user dismisses the scanner, `cancel()` clears the handler.
 */
let pending: Listener | null = null;

export const barcodeCaptureChannel = {
  request(listener: Listener): void {
    pending = listener;
  },
  resolve(code: string): void {
    const listener = pending;
    pending = null;
    listener?.(code);
  },
  cancel(): void {
    pending = null;
  },
  hasPending(): boolean {
    return pending !== null;
  },
};
