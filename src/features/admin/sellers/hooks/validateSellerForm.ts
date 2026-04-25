import type { SellerApiError, SellerRecord } from '../service/sellersApi.types';

export type FormMode =
  | { kind: 'create' }
  | { kind: 'edit'; seller: SellerRecord };

export type CredentialMode = 'password' | 'invite';

export type FormState = {
  name: string;
  email: string;
  credentialMode: CredentialMode;
  password: string;
  active: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pure validator for the seller form. Extracted here so unit tests can
 * import it without pulling the Supabase client through the hook.
 */
export function validateSellerForm(
  form: FormState,
  mode: FormMode,
): SellerApiError | null {
  if (form.name.trim().length === 0) {
    return { code: 'validation_error', field: 'name' };
  }
  if (!EMAIL_RE.test(form.email.trim())) {
    return { code: 'validation_error', field: 'email' };
  }
  if (mode.kind === 'create' && form.credentialMode === 'password') {
    if (form.password.length < 8) {
      return { code: 'validation_error', field: 'password' };
    }
  }
  return null;
}
