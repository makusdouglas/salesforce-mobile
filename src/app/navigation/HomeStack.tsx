import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomePlaceholderScreen } from '@/features/home/screens/HomePlaceholderScreen';

import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HomePlaceholder"
        component={HomePlaceholderScreen}
        options={{ title: 'Início' }}
      />
    </Stack.Navigator>
  );
}
