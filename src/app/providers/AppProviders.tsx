import '@/data';

import { useEffect, type ReactNode } from 'react';
import PrivacySnapshot from 'react-native-privacy-snapshot';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/features/auth';
import { LockProvider } from '@/features/lock';

type AppProvidersProps = {
  children: ReactNode;
};

/**
 * Mount-once imperative enable of the OS task-switcher snapshot mask
 * (FR-022). Keeps the mask active for the lifetime of the app process.
 */
function usePrivacySnapshot(): void {
  useEffect(() => {
    PrivacySnapshot.enabled(true);
    return () => {
      PrivacySnapshot.enabled(false);
    };
  }, []);
}

export function AppProviders({ children }: AppProvidersProps) {
  usePrivacySnapshot();
  return (
    <SessionProvider>
      <LockProvider>
        <SafeAreaProvider>{children}</SafeAreaProvider>
      </LockProvider>
    </SessionProvider>
  );
}
