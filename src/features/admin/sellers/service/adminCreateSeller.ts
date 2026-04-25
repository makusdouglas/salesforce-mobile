import { supabase } from '@/data/supabase';
import { triggerSyncAfterAdminWrite } from '@/features/sync/triggers/adminWriteTrigger';

import type { SellerApiError, SellerRecord } from './sellersApi';

export type CreateSellerInput =
  | { name: string; email: string; mode: 'password'; password: string }
  | { name: string; email: string; mode: 'invite' };

type EdgeResponse =
  | {
      seller: {
        auth_user_id: string;
        salespeople_id: string;
        name: string;
        email: string;
        active: true;
      };
    }
  | { error: string; details?: string };

export async function adminCreateSeller(input: CreateSellerInput): Promise<SellerRecord> {
  const { data, error } = await supabase.functions.invoke<EdgeResponse>('admin-create-seller', {
    body: input,
  });

  if (error) {
    // Edge Functions return a FunctionsError; try to extract the JSON
    // body for a usable error code.
    const ctx = (error as unknown as { context?: { status?: number; body?: unknown } }).context;
    const status = ctx?.status ?? 0;
    const parsed = parseErrorBody(ctx?.body);
    if (parsed) throw mapErrorCode(parsed.error, parsed.details, status);
    if (status === 401) throw { code: 'unauthenticated' } satisfies SellerApiError;
    if (status === 403) throw { code: 'not_admin' } satisfies SellerApiError;
    if (status === 409) throw { code: 'email_in_use' } satisfies SellerApiError;
    throw { code: 'unknown', message: error.message ?? 'functions_invoke_failed' } satisfies SellerApiError;
  }

  if (!data || 'error' in data) {
    throw mapErrorCode(
      data && 'error' in data ? (data as { error: string }).error : 'unknown',
      data && 'details' in data ? (data as { details?: string }).details : undefined,
      0,
    );
  }

  void triggerSyncAfterAdminWrite();
  return data.seller;
}

function parseErrorBody(body: unknown): { error: string; details?: string } | null {
  if (typeof body === 'string') {
    try {
      const j = JSON.parse(body) as { error?: unknown; details?: unknown };
      if (typeof j.error === 'string') {
        return typeof j.details === 'string'
          ? { error: j.error, details: j.details }
          : { error: j.error };
      }
    } catch {
      return null;
    }
  }
  if (body && typeof body === 'object' && 'error' in body) {
    const obj = body as { error?: unknown; details?: unknown };
    if (typeof obj.error === 'string') {
      return typeof obj.details === 'string'
        ? { error: obj.error, details: obj.details }
        : { error: obj.error };
    }
  }
  return null;
}

function mapErrorCode(code: string, details: string | undefined, status: number): SellerApiError {
  switch (code) {
    case 'unauthenticated':
      return { code: 'unauthenticated' };
    case 'not_admin':
      return { code: 'not_admin' };
    case 'email_in_use':
      return { code: 'email_in_use' };
    case 'validation_error': {
      const field = (['name', 'email', 'password', 'mode'] as const).find((f) => f === details);
      return { code: 'validation_error', field: field ?? 'name' };
    }
    default:
      return { code: 'unknown', message: `${code}${details ? `:${details}` : ''} (status ${status})` };
  }
}
