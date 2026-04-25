// 010-repeat-last-order: owns the status-branching for a repeat tap.
//
// For non-Draft sources (sent, canceled) it delegates to
// `ordersService.repeat` to clone; for Draft sources it short-circuits to
// "resume" (no cloning — see research R-003) and hands back the source's own
// order id so the caller can navigate to the OrderSummary with the same
// draft. Errors are mapped into a discriminated-union outcome so the screen
// can render a blocking notice without try/catch scaffolding in render code.

import { useCallback } from 'react';

import { ordersRepository } from '@/data/repositories/ordersRepository';

import {
  AllItemsUnavailableError,
  OrderNotFoundError,
  ordersService,
  type RepeatPreview,
} from '../services/ordersService';

export type RepeatOutcome =
  | { kind: 'landed'; orderId: string; droppedNames: string[] }
  | { kind: 'blocked'; reason: 'all_unavailable' }
  | { kind: 'error'; reason: 'not_found' };

// 016-product-lifecycle-roles — surface of the preview step. Hook
// consumers decide whether to open `RepeatOrderDiscontinuedAlert`
// based on `discontinuedProductNames.length > 0`.
export type RepeatPreviewOutcome =
  | { kind: 'resume'; orderId: string }
  | { kind: 'preview'; preview: RepeatPreview }
  | { kind: 'error'; reason: 'not_found' };

export interface UseRepeatOrderResult {
  readonly repeat: (sourceOrderId: string) => Promise<RepeatOutcome>;
  readonly preview: (sourceOrderId: string) => Promise<RepeatPreviewOutcome>;
}

/**
 * Core flow — exported for unit-testing without needing React test harness.
 * The hook is a thin `useCallback` wrapper over this function; see the hook
 * export below.
 */
export async function runRepeatOrder(sourceOrderId: string): Promise<RepeatOutcome> {
  const source = await ordersRepository.findById(sourceOrderId);
  if (!source) {
    // Mirrors the service's OrderNotFoundError but surfaced as a typed
    // outcome so the UI can render a small "não encontrado" toast rather
    // than propagating an exception.
    return { kind: 'error', reason: 'not_found' };
  }

  // Draft short-circuit — resume without cloning (R-003).
  if (source.status === 'draft') {
    return { kind: 'landed', orderId: source.id, droppedNames: [] };
  }

  try {
    const result = await ordersService.repeat({ sourceOrderId });
    return {
      kind: 'landed',
      orderId: result.orderId,
      droppedNames: result.droppedProductNames,
    };
  } catch (err) {
    if (err instanceof AllItemsUnavailableError) {
      return { kind: 'blocked', reason: 'all_unavailable' };
    }
    if (err instanceof OrderNotFoundError) {
      return { kind: 'error', reason: 'not_found' };
    }
    throw err;
  }
}

/**
 * 016-product-lifecycle-roles — read-only scan of a repeat target.
 * Returns `resume` for Draft sources (no preview needed), or `preview`
 * carrying the clonable count + discontinued/unavailable names.
 */
export async function runRepeatPreview(
  sourceOrderId: string,
): Promise<RepeatPreviewOutcome> {
  const source = await ordersRepository.findById(sourceOrderId);
  if (!source) return { kind: 'error', reason: 'not_found' };
  if (source.status === 'draft') {
    return { kind: 'resume', orderId: source.id };
  }
  try {
    const preview = await ordersService.previewRepeat({ sourceOrderId });
    return { kind: 'preview', preview };
  } catch (err) {
    if (err instanceof OrderNotFoundError) {
      return { kind: 'error', reason: 'not_found' };
    }
    throw err;
  }
}

export function useRepeatOrder(): UseRepeatOrderResult {
  const repeat = useCallback(runRepeatOrder, []);
  const preview = useCallback(runRepeatPreview, []);
  return { repeat, preview };
}
