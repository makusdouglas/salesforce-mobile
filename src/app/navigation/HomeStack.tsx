import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DatabaseInspectorScreen } from '@/features/_debug/screens/DatabaseInspectorScreen';
import { DataLayerSmokeScreen } from '@/features/_debug/screens/DataLayerSmokeScreen';
import { CatalogScreen, ProductDetailScreen } from '@/features/catalog';
import {
  ClientFormScreen,
  ClientProfileScreen,
  ClientsScreen,
  NewOrderStubScreen,
} from '@/features/clients';
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
      <Stack.Screen
        name="Catalog"
        component={CatalogScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Clients"
        component={ClientsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ClientForm"
        component={ClientFormScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="ClientProfile"
        component={ClientProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NewOrder"
        component={NewOrderStubScreen}
        options={{ headerShown: false }}
      />
      {__DEV__ ? (
        <Stack.Screen
          name="DataLayerSmoke"
          component={DataLayerSmokeScreen}
          options={{ title: '[dev] Data Layer' }}
        />
      ) : null}
      {__DEV__ ? (
        <Stack.Screen
          name="DatabaseInspector"
          component={DatabaseInspectorScreen}
          options={{ title: '[dev] DB Inspector' }}
        />
      ) : null}
    </Stack.Navigator>
  );
}
