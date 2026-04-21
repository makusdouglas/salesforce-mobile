import '@/data';

import { type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/features/auth';
import { LockProvider } from '@/features/lock';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SessionProvider>
      <LockProvider>
        <SafeAreaProvider>{children}</SafeAreaProvider>
      </LockProvider>
    </SessionProvider>
  );
}
