import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { _internalSyncStatusStore } from '../state/syncStatusStore';

const DEBOUNCE_MS = 500;

function isOnline(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable === true;
}

export function startNetinfoBridge(): () => void {
  let debounceHandle: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = NetInfo.addEventListener((state) => {
    const next = isOnline(state);
    const current = _internalSyncStatusStore.getInternal()._online;
    if (next === current) return;

    if (debounceHandle !== null) {
      clearTimeout(debounceHandle);
    }
    debounceHandle = setTimeout(() => {
      debounceHandle = null;
      _internalSyncStatusStore.setOnline(next);
    }, DEBOUNCE_MS);
  });

  return () => {
    if (debounceHandle !== null) {
      clearTimeout(debounceHandle);
      debounceHandle = null;
    }
    unsubscribe();
  };
}
