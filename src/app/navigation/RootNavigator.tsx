import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ReloginScreen, useSession } from '@/features/auth';

import { AuthStack } from './AuthStack';
import { HomeStack } from './HomeStack';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status } = useSession();
  const authenticated = status !== 'NotAuthenticated';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {authenticated ? (
        <Stack.Screen name="Home" component={HomeStack} />
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
