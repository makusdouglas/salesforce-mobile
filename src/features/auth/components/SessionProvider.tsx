import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { startConnectivityListener } from '../connectivity/connectivity';
import { authService } from '../service/authService';
import { authBootstrap } from '../session/bootstrap';
import { fetchAndPublishRoles } from '../session/rolesRepository';
import { _internalSessionStore, sessionStore } from '../session/session';

type SessionProviderProps = {
  children: ReactNode;
};

export function SessionProvider({ children }: SessionProviderProps) {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await authBootstrap();
      if (cancelled) return;
      setBootstrapped(true);

      // If the bootstrap left us optimistically Authenticated and the device
      // is currently online, fire a background refresh to get an access token
      // and validate the stored credential with the server (plan.md Phase 4 T037).
      const internal = _internalSessionStore.getInternal();
      // accessToken '' means "optimistic, no live token yet".
      const optimistic = internal.accessToken === '';
      if (optimistic) {
        const netState = await NetInfo.fetch();
        if (netState.isConnected === true && netState.isInternetReachable === true) {
          void authService.refresh({ reason: 'boot' }).catch(() => {
            // NETWORK: connectivity listener will retry.
            // RELOGIN_REQUIRED: state already transitioned.
          });
        }
      }
    })();

    const stopConnectivity = startConnectivityListener();

    // 016-product-lifecycle-roles — SC-007/FR-027. Re-fetch roles when
    // the app comes back to the foreground so a role granted or revoked
    // by a superuser takes effect without forcing a logout. Gated on
    // Authenticated so a NotAuthenticated cold start does not fire.
    let previousAppState: AppStateStatus = AppState.currentState;
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (previousAppState !== 'active' && next === 'active') {
        if (sessionStore.getSnapshot().status === 'Authenticated') {
          void fetchAndPublishRoles();
        }
      }
      previousAppState = next;
    });

    return () => {
      cancelled = true;
      stopConnectivity();
      appStateSub.remove();
    };
  }, []);

  if (!fontsLoaded || !bootstrapped) return null;
  return <>{children}</>;
}
