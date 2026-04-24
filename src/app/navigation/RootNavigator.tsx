import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ReloginScreen, useSession } from '@/features/auth';
import { LockGate } from '@/features/lock';

import { AuthStack } from './AuthStack';
import { RootTabs } from './RootTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status } = useSession();
  const authenticated = status !== 'NotAuthenticated';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {authenticated ? (
        <Stack.Screen name="Home">
          {() => (
            <LockGate>
              <RootTabs />
            </LockGate>
          )}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
      <Stack.Screen
        name="Relogin"
        component={ReloginScreen}
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}
