/**
 * Unit tests for the pure validator behind useSellerForm.
 * Covers the edge cases called out in tasks.md T035.
 *
 * Imports the validator from its standalone module so the Supabase
 * client is never instantiated during the test run.
 */

import {
  validateSellerForm,
  type FormMode,
  type FormState,
} from '../hooks/validateSellerForm';

const CREATE: FormMode = { kind: 'create' };

function formState(overrides: Partial<FormState> = {}): FormState {
  return {
    name: 'Maria',
    email: 'maria@empresa.com',
    credentialMode: 'invite',
    password: '',
    active: true,
    ...overrides,
  };
}

describe('validateSellerForm', () => {
  it('rejects empty name', () => {
    expect(validateSellerForm(formState({ name: '' }), CREATE)).toEqual({
      code: 'validation_error',
      field: 'name',
    });
  });

  it('rejects whitespace-only name', () => {
    expect(validateSellerForm(formState({ name: '   ' }), CREATE)).toEqual({
      code: 'validation_error',
      field: 'name',
    });
  });

  it('rejects malformed email', () => {
    expect(validateSellerForm(formState({ email: 'not-an-email' }), CREATE)).toEqual({
      code: 'validation_error',
      field: 'email',
    });
  });

  it('rejects password shorter than 8 chars in password mode', () => {
    expect(
      validateSellerForm(
        formState({ credentialMode: 'password', password: 'short' }),
        CREATE,
      ),
    ).toEqual({ code: 'validation_error', field: 'password' });
  });

  it('accepts an invite-mode form with no password', () => {
    expect(validateSellerForm(formState({ credentialMode: 'invite' }), CREATE)).toBeNull();
  });

  it('accepts a password-mode form with an 8+ char password', () => {
    expect(
      validateSellerForm(
        formState({ credentialMode: 'password', password: 'longerthan8' }),
        CREATE,
      ),
    ).toBeNull();
  });

  it('does not validate password in edit mode (password field is ignored)', () => {
    const edit: FormMode = {
      kind: 'edit',
      seller: {
        auth_user_id: 'a1',
        salespeople_id: 's1',
        name: 'Maria',
        email: 'maria@empresa.com',
        active: true,
      },
    };
    expect(
      validateSellerForm(
        formState({ credentialMode: 'password', password: '' }),
        edit,
      ),
    ).toBeNull();
  });
});
