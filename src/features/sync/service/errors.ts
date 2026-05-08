export type SyncErrorCode =
  | 'NETWORK'
  | 'AUTH_REJECTED'
  | 'SERVER'
  | 'PUSH_REJECTED'
  | 'PULL_REJECTED'
  | 'ABORTED';

export class SyncError extends Error {
  readonly code: SyncErrorCode;

  constructor(code: SyncErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'SyncError';
    this.code = code;
  }
}
