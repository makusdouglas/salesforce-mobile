import '@/data';

import { type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/features/auth';
import { LockProvider } from '@/features/lock';
import { SyncProvider } from '@/features/sync';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SessionProvider>
      <LockProvider>
        <SyncProvider>
          <SafeAreaProvider>{children}</SafeAreaProvider>
        </SyncProvider>
      </LockProvider>
    </SessionProvider>
  );
}
