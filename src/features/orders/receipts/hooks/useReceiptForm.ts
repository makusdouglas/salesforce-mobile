// 012-payment-receipts: capture-form state + submit.
//
// Wraps the repository — `create()` when `correctionOf` is absent,
// `createCorrection()` when it is set. Amount is stored as cents (integer)
// internally; the form binds to a BRL-formatted text input and parses on
// each keystroke. Attachment is wired as an opaque slot (pipeline runs
// in Phase 6 — the form just accepts an AttachmentInput or leaves it
// undefined).

import { useCallback, useState } from 'react';

import { paymentReceiptsRepository } from '@/data/repositories/paymentReceiptsRepository';
import type { AttachmentInput } from '@/data/repositories/paymentReceiptsRepository';
import type { PaymentMethod } from '@/data/types';

export interface UseReceiptFormParams {
  readonly orderId: string;
  /** When set, submit() dispatches to createCorrection() instead of create(). */
  readonly correctionOf?: string;
}

export interface ReceiptFormState {
  readonly amountCents: number; // 0 = unset / invalid
  readonly method: PaymentMethod;
  readonly receivedAtMs: number; // default: Date.now() at mount
  readonly notes: string;
  readonly attachment: AttachmentInput | null;
}

export interface UseReceiptFormResult {
  readonly state: ReceiptFormState;
  readonly setAmountCents: (next: number) => void;
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
  const [state, setState] = useState<ReceiptFormState>(() => ({
    amountCents: 0,
    method: INITIAL_METHOD,
    receivedAtMs: Date.now(),
    notes: '',
    attachment: null,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAmountCents = useCallback((next: number) => {
    setState((s) => ({ ...s, amountCents: next }));
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
  const canSubmit = isCorrection ? state.amountCents !== 0 : state.amountCents > 0;

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
        amount: state.amountCents,
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
  }, [canSubmit, isCorrection, params, state, submitting]);

  return {
    state,
    setAmountCents,
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
