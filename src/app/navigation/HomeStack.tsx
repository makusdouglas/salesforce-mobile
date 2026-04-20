import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DataLayerSmokeScreen } from '@/features/_debug/screens/DataLayerSmokeScreen';
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
      {__DEV__ ? (
        <Stack.Screen
          name="DataLayerSmoke"
          component={DataLayerSmokeScreen}
          options={{ title: '[dev] Data Layer' }}
        />
      ) : null}
    </Stack.Navigator>
  );
}
