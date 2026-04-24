// 012-payment-receipts: capture-form state + submit.
//
// Wraps the repository — `create()` when `correctionOf` is absent,
// `createCorrection()` when it is set. Amount is stored as cents (integer)
// internally; the form binds to a BRL-formatted text input and parses on
// each keystroke. Attachment is wired as an opaque slot (pipeline runs
// in Phase 6 — the form just accepts an AttachmentInput or leaves it
// undefined).

import { useCallback, useRef, useState } from 'react';

import { generateId } from '@/data/ids';
import { paymentReceiptsRepository } from '@/data/repositories/paymentReceiptsRepository';
import type { AttachmentInput } from '@/data/repositories/paymentReceiptsRepository';
import type { PaymentMethod } from '@/data/types';

export interface UseReceiptFormParams {
  readonly orderId: string;
  /** When set, submit() dispatches to createCorrection() instead of create(). */
  readonly correctionOf?: string;
}

export interface ReceiptFormState {
  /** BRL decimal (e.g. 194.50). 0 = unset / invalid. */
  readonly amount: number;
  readonly method: PaymentMethod;
  readonly receivedAtMs: number; // default: Date.now() at mount
  readonly notes: string;
  readonly attachment: AttachmentInput | null;
}

export interface UseReceiptFormResult {
  /**
   * Pre-allocated receipt id for the session. Stable across renders.
   * Used by the attachment-staging pipeline so the local filename and the
   * eventual remote Storage path both reference the same id — the
   * receipt-attachments RLS policies rely on this invariant.
   */
  readonly receiptId: string;
  readonly state: ReceiptFormState;
  readonly setAmount: (next: number) => void;
  readonly setMethod: (next: PaymentMethod) => void;
  readonly setReceivedAtMs: (next: number) => void;
  readonly setNotes: (next: string) => void;
  readonly setAttachment: (next: AttachmentInput | null) => void;
  /**
   * Validation state reflecting the current form. `true` when submit() is
   * safe to call — amount is non-zero, method is valid.
   */
  readonly canSubmit: boolean;
  readonly submitting: boolean;
  readonly error: string | null;
  /** Resolves with the saved receipt id on success, or rejects. */
  readonly submit: () => Promise<string | null>;
}

const INITIAL_METHOD: PaymentMethod = 'pix';

export function useReceiptForm(params: UseReceiptFormParams): UseReceiptFormResult {
  // Stable session id. Generated once per form mount — subsequent
  // attachment re-picks overwrite the same staged file name.
  const receiptIdRef = useRef<string | null>(null);
  if (receiptIdRef.current === null) receiptIdRef.current = generateId();
  const receiptId = receiptIdRef.current;

  const [state, setState] = useState<ReceiptFormState>(() => ({
    amount: 0,
    method: INITIAL_METHOD,
    receivedAtMs: Date.now(),
    notes: '',
    attachment: null,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAmount = useCallback((next: number) => {
    setState((s) => ({ ...s, amount: next }));
  }, []);
  const setMethod = useCallback((next: PaymentMethod) => {
    setState((s) => ({ ...s, method: next }));
  }, []);
  const setReceivedAtMs = useCallback((next: number) => {
    setState((s) => ({ ...s, receivedAtMs: next }));
  }, []);
  const setNotes = useCallback((next: string) => {
    setState((s) => ({ ...s, notes: next }));
  }, []);
  const setAttachment = useCallback((next: AttachmentInput | null) => {
    setState((s) => ({ ...s, attachment: next }));
  }, []);

  // For corrections, any non-zero amount is acceptable (the spec allows
  // upward + downward adjustments). For create(), only amount > 0.
  const isCorrection = params.correctionOf !== undefined;
  const canSubmit = isCorrection ? state.amount !== 0 : state.amount > 0;

  const submit = useCallback(async (): Promise<string | null> => {
    if (submitting) return null;
    if (!canSubmit) {
      setError(
        isCorrection
          ? 'Informe o valor da correção (pode ser positivo ou negativo).'
          : 'Informe um valor maior que zero.',
      );
      return null;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        id: receiptId,
        amount: state.amount,
        method: state.method,
        receivedAtMs: state.receivedAtMs,
        ...(state.notes.trim() !== '' ? { notes: state.notes.trim() } : {}),
        ...(state.attachment !== null ? { attachment: state.attachment } : {}),
      };

      const record = isCorrection
        ? await paymentReceiptsRepository.createCorrection({
            originalId: params.correctionOf as string,
            ...payload,
          })
        : await paymentReceiptsRepository.create({
            orderId: params.orderId,
            ...payload,
          });
      return record.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, isCorrection, params, receiptId, state, submitting]);

  return {
    receiptId,
    state,
    setAmount,
    setMethod,
    setReceivedAtMs,
    setNotes,
    setAttachment,
    canSubmit,
    submitting,
    error,
    submit,
  };
}
