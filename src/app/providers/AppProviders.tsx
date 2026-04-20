import '@/data';

import type { ReactNode } from 'react';
// eslint-disable-next-line import/no-named-as-default
import PrivacySnapshot from 'react-native-privacy-snapshot';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/features/auth';
import { LockProvider } from '@/features/lock';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <PrivacySnapshot>
      <SessionProvider>
        <LockProvider>
          <SafeAreaProvider>{children}</SafeAreaProvider>
        </LockProvider>
      </SessionProvider>
    </PrivacySnapshot>
  );
}
