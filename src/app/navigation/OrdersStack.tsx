import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  AddToOrderScreen,
  OrderDraftScreen,
  OrderSentScreen,
  OrderSummaryScreen,
} from '@/features/orders';

import type { OrdersStackParamList } from './types';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrderDraft" component={OrderDraftScreen} />
      <Stack.Screen
        name="AddToOrder"
        component={AddToOrderScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="OrderSummary" component={OrderSummaryScreen} />
      <Stack.Screen name="OrderSent" component={OrderSentScreen} />
    </Stack.Navigator>
  );
}
