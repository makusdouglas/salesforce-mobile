import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}
