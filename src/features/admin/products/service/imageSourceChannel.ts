export type ImageSourceChoice = 'camera' | 'library';

type Listener = (source: ImageSourceChoice) => void;

/**
 * Module-level pub-sub that lets AdminProductFormScreen launch
 * AdminImageSourceScreen without passing a non-serializable callback
 * through navigation params (which triggers a React Navigation warning
 * and breaks persistable state restoration).
 *
 * Flow:
 *   1. Form screen registers a handler via `imageSourceChannel.request()`.
 *   2. Form screen navigates to the chooser.
 *   3. Chooser calls `resolve(source)` which invokes the handler and clears it.
 *   4. If the user dismisses the chooser, `cancel()` clears any pending handler.
 *
 * Only one request can be pending at a time — the last caller wins.
 */
let pending: Listener | null = null;

export const imageSourceChannel = {
  request(listener: Listener): void {
    pending = listener;
  },
  resolve(source: ImageSourceChoice): void {
    const listener = pending;
    pending = null;
    listener?.(source);
  },
  cancel(): void {
    pending = null;
  },
  /** Test-only helper. */
  _hasPending(): boolean {
    return pending !== null;
  },
};
