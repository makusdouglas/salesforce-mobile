import type { ClientDraft } from '../types';

type Listener = () => void;

let current: ClientDraft | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of Array.from(listeners)) {
    listener();
  }
}

export const clientDraftStore = {
  get(): ClientDraft | null {
    return current;
  },

  set(next: ClientDraft): void {
    current = next;
    emit();
  },

  clear(): void {
    if (current === null) return;
    current = null;
    emit();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Test-only. Resets both the draft and the listener set. */
  __resetForTests(): void {
    current = null;
    listeners.clear();
  },
};
