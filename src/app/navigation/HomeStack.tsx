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
import { DraftsListScreen, HomeScreen, SettingsScreen } from '@/features/home';

import { OrdersStack } from './OrdersStack';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator>
      {/* Route name 'HomePlaceholder' is preserved for back-compat with
          auth/lock post-action navigation (see research.md R-002). The
          component is the new HomeScreen. */}
      <Stack.Screen
        name="HomePlaceholder"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Configurações' }}
      />
      <Stack.Screen name="Catalog" component={CatalogScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Clients" component={ClientsScreen} options={{ headerShown: false }} />
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
      {/* 009-order-assembly: nested stack for OrderDraft / AddToOrder / OrderSummary. */}
      <Stack.Screen
        name="Orders"
        component={OrdersStack}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DraftsList"
        component={DraftsListScreen}
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
