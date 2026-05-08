# Contract: `clientDraftStore` singleton

**Status**: authoritative for 007 Client Management
**File**: `src/features/clients/drafts/clientDraftStore.ts`

A module-level in-memory store holding at most one active "New client" form draft. Survives app backgrounding within the JS process; does not survive a full app restart or fresh install (spec Assumption).

## Public surface

```ts
type ClientDraft = {
  readonly name: string;
  readonly taxId: string;
  readonly addressLine: string;
  readonly contact: string;
  readonly notes: string;
};

export const clientDraftStore = {
  /** Current draft, or null if none exists. Stable reference equality when unchanged. */
  get(): ClientDraft | null;

  /** Overwrite the current draft. Emits to every subscriber. */
  set(next: ClientDraft): void;

  /** Remove the current draft. Emits to every subscriber if a draft was present; no-op otherwise. */
  clear(): void;

  /** Register a listener; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;

  /** Test-only. Clears the draft and unsubscribes every listener. */
  __resetForTests(): void;
};
```

## Semantics

- `get()` returns the same object reference until the next `set()` or `clear()`. Consumers may `useSyncExternalStore(subscribe, get)` safely — React's bailout machinery sees a stable reference when nothing changed.
- `set(next)` replaces the stored draft entirely. Listeners fire once per call. The store does NOT merge the new draft with the old one — merging belongs to the caller (`useClientDraft`).
- `clear()` sets the internal reference to `null`. If `get()` was already `null`, the call is a no-op and listeners do NOT fire.
- `subscribe(listener)` adds the listener to a `Set`. Returned unsubscribe removes it from the same `Set`. Listeners are called synchronously from `set` / `clear`.
- `__resetForTests()` wipes the draft and clears every listener. Never called in production paths.

## Lifecycle

| Event | Store transition |
|-------|------------------|
| Form screen mounts | `get()` → either null (fresh) or the previously saved draft |
| User types in a field | `set({ …current, field: newValue })` via `useClientDraft` |
| User taps `Salvar` and save succeeds | `clear()` inside `ClientFormScreen`'s save handler |
| User taps `Cancelar` | `clear()` (user explicitly discarded) |
| User navigates away without tapping Cancel | store retains the draft; next `ClientForm` mount restores it |
| App backgrounded | no change (process still alive) |
| App terminated / fresh install | store is re-initialized to null (process gone) |

## Why a module singleton rather than Context / persisted store

See plan.md Structure Decision point 3 and research R-005. Short version: matches the established pattern of 003 (`sessionStore`), 004 (`lockStore`), 005 (`syncStatusStore`), 006 (`imageCache`). Explicitly in-memory per spec Assumption.

## Test contract

- `clientDraftStore.test.ts` MUST cover:
  1. Initial `get()` returns `null`.
  2. `set({…})` followed by `get()` returns the set value.
  3. Consecutive `set()` calls replace without merging.
  4. `clear()` after `set()` returns to `null` and emits to subscribers.
  5. `clear()` before any `set()` does NOT emit.
  6. Multiple subscribers all receive each emission.
  7. Unsubscribed listeners do NOT receive subsequent emissions.
  8. `__resetForTests()` wipes draft and listeners — follow-up `set()` does not fire previously-subscribed listeners.
