import { clientDraftStore } from '../drafts/clientDraftStore';
import { EMPTY_DRAFT, type ClientDraft } from '../types';

describe('clientDraftStore', () => {
  afterEach(() => {
    clientDraftStore.__resetForTests();
  });

  test('initial get returns null', () => {
    expect(clientDraftStore.get()).toBeNull();
  });

  test('set then get returns the same value', () => {
    const draft: ClientDraft = { ...EMPTY_DRAFT, name: 'Loja A' };
    clientDraftStore.set(draft);
    expect(clientDraftStore.get()).toEqual(draft);
  });

  test('consecutive sets replace (no merge)', () => {
    clientDraftStore.set({ ...EMPTY_DRAFT, name: 'Loja A' });
    clientDraftStore.set({ ...EMPTY_DRAFT, taxId: '12345678000199' });
    expect(clientDraftStore.get()).toEqual({ ...EMPTY_DRAFT, taxId: '12345678000199' });
  });

  test('clear after set emits and returns to null', () => {
    const listener = jest.fn();
    clientDraftStore.subscribe(listener);
    clientDraftStore.set({ ...EMPTY_DRAFT, name: 'Loja A' });
    expect(listener).toHaveBeenCalledTimes(1);
    clientDraftStore.clear();
    expect(clientDraftStore.get()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test('clear when already empty does NOT emit', () => {
    const listener = jest.fn();
    clientDraftStore.subscribe(listener);
    clientDraftStore.clear();
    expect(listener).not.toHaveBeenCalled();
  });

  test('multiple subscribers all receive emissions', () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    clientDraftStore.subscribe(listenerA);
    clientDraftStore.subscribe(listenerB);
    clientDraftStore.set({ ...EMPTY_DRAFT, name: 'X' });
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
  });

  test('unsubscribe stops emissions', () => {
    const listener = jest.fn();
    const unsubscribe = clientDraftStore.subscribe(listener);
    unsubscribe();
    clientDraftStore.set({ ...EMPTY_DRAFT, name: 'X' });
    expect(listener).not.toHaveBeenCalled();
  });

  test('__resetForTests wipes draft and listeners', () => {
    const listener = jest.fn();
    clientDraftStore.subscribe(listener);
    clientDraftStore.set({ ...EMPTY_DRAFT, name: 'X' });
    clientDraftStore.__resetForTests();
    expect(clientDraftStore.get()).toBeNull();
    clientDraftStore.set({ ...EMPTY_DRAFT, name: 'Y' });
    expect(listener).toHaveBeenCalledTimes(1); // only the first set, not the post-reset one
  });
});
