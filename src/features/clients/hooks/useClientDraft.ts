import { useCallback, useSyncExternalStore } from 'react';

import { clientDraftStore } from '../drafts/clientDraftStore';
import { EMPTY_DRAFT, type ClientDraft } from '../types';

export type UseClientDraftResult = {
  readonly draft: ClientDraft;
  readonly setDraft: (patch: Partial<ClientDraft>) => void;
  readonly clearDraft: () => void;
};

export function useClientDraft(): UseClientDraftResult {
  const stored = useSyncExternalStore(
    clientDraftStore.subscribe,
    clientDraftStore.get,
    clientDraftStore.get,
  );

  const draft = stored ?? EMPTY_DRAFT;

  const setDraft = useCallback((patch: Partial<ClientDraft>) => {
    const base = clientDraftStore.get() ?? EMPTY_DRAFT;
    clientDraftStore.set({ ...base, ...patch });
  }, []);

  const clearDraft = useCallback(() => {
    clientDraftStore.clear();
  }, []);

  return { draft, setDraft, clearDraft };
}
