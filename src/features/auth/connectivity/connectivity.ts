import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { authService } from '../service/authService';
import { _internalSessionStore } from '../session/session';

const DEBOUNCE_MS = 500;

function isOnline(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable === true;
}

export function startConnectivityListener(): () => void {
  let wasOnline = false;
  let debounceHandle: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = NetInfo.addEventListener((state) => {
    const online = isOnline(state);
    const transitionedUp = !wasOnline && online;
    wasOnline = online;
    if (!transitionedUp) return;
    if (_internalSessionStore.getInternal()._isRefreshing) return;

    if (debounceHandle !== null) {
      clearTimeout(debounceHandle);
    }
    debounceHandle = setTimeout(() => {
      debounceHandle = null;
      void authService.refresh({ reason: 'connectivity' }).catch(() => {
        // AuthError NETWORK: next event retries.
        // AuthError RELOGIN_REQUIRED: state already transitioned; nothing to do here.
      });
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
