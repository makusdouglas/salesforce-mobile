export type AuthErrorCode =
  | 'NETWORK'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_ISSUE'
  | 'NOT_AUTHENTICATED'
  | 'RELOGIN_REQUIRED';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'AuthError';
  }
}

type SupabaseLikeError = {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
};

function isNetworkError(err: SupabaseLikeError): boolean {
  if (err.name === 'AuthRetryableFetchError') return true;
  if (err.name === 'TypeError' && typeof err.message === 'string' && err.message.toLowerCase().includes('network')) {
    return true;
  }
  if (typeof err.status === 'number' && (err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504)) {
    return true;
  }
  return false;
}

function isInvalidCredentials(err: SupabaseLikeError): boolean {
  if (err.code === 'invalid_credentials' || err.code === 'invalid_grant') return true;
  if (err.status === 400 || err.status === 401) return true;
  const msg = (err.message ?? '').toLowerCase();
  if (msg.includes('invalid login credentials')) return true;
  if (msg.includes('invalid_grant')) return true;
  return false;
}

export function mapToAuthErrorCode(err: unknown): AuthErrorCode {
  if (err === null || err === undefined) return 'ACCOUNT_ISSUE';
  if (typeof err !== 'object') return 'ACCOUNT_ISSUE';
  const e = err as SupabaseLikeError;
  if (isNetworkError(e)) return 'NETWORK';
  if (isInvalidCredentials(e)) return 'INVALID_CREDENTIALS';
  return 'ACCOUNT_ISSUE';
}
