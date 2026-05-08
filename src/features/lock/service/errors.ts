export type LockErrorCode =
  | 'PIN_INVALID_LENGTH'
  | 'PIN_MISMATCH'
  | 'BIOMETRIC_UNAVAILABLE'
  | 'BIOMETRIC_FAILED'
  | 'RECOVERY_OFFLINE'
  | 'TOO_MANY_ATTEMPTS'
  | 'STORAGE_UNAVAILABLE';

export class LockError extends Error {
  readonly code: LockErrorCode;

  constructor(code: LockErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'LockError';
    Object.setPrototypeOf(this, LockError.prototype);
  }
}
