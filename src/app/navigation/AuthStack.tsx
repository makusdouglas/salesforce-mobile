import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthPlaceholderScreen } from '@/features/auth/screens/AuthPlaceholderScreen';

import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AuthPlaceholder"
        component={AuthPlaceholderScreen}
        options={{ title: 'Autenticação' }}
      />
    </Stack.Navigator>
  );
}
