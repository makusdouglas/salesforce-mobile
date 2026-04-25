import { useCallback, useMemo, useState } from 'react';

import { adminCreateSeller, type CreateSellerInput } from '../service/adminCreateSeller';
import { updateSellerName } from '../service/sellersApi';
import type { SellerApiError, SellerRecord } from '../service/sellersApi.types';

import {
  validateSellerForm,
  type CredentialMode,
  type FormMode,
  type FormState,
} from './validateSellerForm';

export type { CredentialMode, FormMode, FormState };
export { validateSellerForm };

export type SubmitOutcome =
  | { kind: 'created'; seller: SellerRecord }
  | { kind: 'updated'; seller: SellerRecord }
  | { kind: 'error'; error: SellerApiError };

export function useSellerForm(mode: FormMode, selfAuthUserId: string | null) {
  const [form, setForm] = useState<FormState>(() => {
    if (mode.kind === 'edit') {
      return {
        name: mode.seller.name,
        email: mode.seller.email,
        credentialMode: 'invite',
        password: '',
        active: mode.seller.active,
      };
    }
    return { name: '', email: '', credentialMode: 'invite', password: '', active: true };
  });
  const [submitting, setSubmitting] = useState(false);

  const isSelf = useMemo(
    () => mode.kind === 'edit' && selfAuthUserId !== null && mode.seller.auth_user_id === selfAuthUserId,
    [mode, selfAuthUserId],
  );

  const setName = useCallback((v: string) => setForm((f) => ({ ...f, name: v })), []);
  const setEmail = useCallback((v: string) => setForm((f) => ({ ...f, email: v })), []);
  const setCredentialMode = useCallback(
    (v: CredentialMode) => setForm((f) => ({ ...f, credentialMode: v })),
    [],
  );
  const setPassword = useCallback((v: string) => setForm((f) => ({ ...f, password: v })), []);
  const setActive = useCallback((v: boolean) => setForm((f) => ({ ...f, active: v })), []);

  const validate = useCallback((): SellerApiError | null => validateSellerForm(form, mode), [form, mode]);

  const submit = useCallback(async (): Promise<SubmitOutcome> => {
    const vErr = validate();
    if (vErr) return { kind: 'error', error: vErr };

    setSubmitting(true);
    try {
      if (mode.kind === 'create') {
        const payload: CreateSellerInput =
          form.credentialMode === 'password'
            ? {
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                mode: 'password',
                password: form.password,
              }
            : {
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                mode: 'invite',
              };
        const seller = await adminCreateSeller(payload);
        return { kind: 'created', seller };
      }

      // edit mode: persist name changes only. Status changes (active/
      // inactive) are applied immediately by the screen via the toggle,
      // not bundled into Salvar.
      const original = mode.seller;
      if (form.name.trim() !== original.name) {
        await updateSellerName(original.salespeople_id, form.name);
      }
      return {
        kind: 'updated',
        seller: { ...original, name: form.name.trim() },
      };
    } catch (err) {
      const error = err as SellerApiError;
      if (error && typeof error === 'object' && 'code' in error) {
        return { kind: 'error', error };
      }
      return { kind: 'error', error: { code: 'unknown', message: String(err) } };
    } finally {
      setSubmitting(false);
    }
  }, [form, mode, validate]);

  return {
    form,
    setName,
    setEmail,
    setCredentialMode,
    setPassword,
    setActive,
    submit,
    submitting,
    isSelf,
    validate,
  } as const;
}
