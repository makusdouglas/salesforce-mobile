import '@/data';

import { type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/features/auth';
import { CatalogProvider } from '@/features/catalog';
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
          <CatalogProvider>
            <SafeAreaProvider>{children}</SafeAreaProvider>
          </CatalogProvider>
        </SyncProvider>
      </LockProvider>
    </SessionProvider>
  );
}
