import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

import { rootNavigationRef } from '@/app/navigation/navigationRef';
import { RootNavigator } from '@/app/navigation/RootNavigator';
import { AppProviders } from '@/app/providers/AppProviders';

export default function App() {
  return (
    <AppProviders>
      <NavigationContainer ref={rootNavigationRef}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="auto" />
    </AppProviders>
  );
}
