import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  AddToOrderScreen,
  OrderDraftScreen,
  OrderSentScreen,
  OrderSummaryScreen,
} from '@/features/orders';
// 012-payment-receipts: three receipts screens registered below. The
// screens are Phase-1 placeholders; real implementations land in Phases
// 3–6.
import {
  OrderReceiptsScreen,
  PaymentReceiptDetailScreen,
  PaymentReceiptFormScreen,
} from '@/features/orders/receipts';

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
      <Stack.Screen
        name="OrderSent"
        component={OrderSentScreen}
        options={{ gestureEnabled: false, headerBackVisible: false }}
      />
      <Stack.Screen name="OrderReceipts" component={OrderReceiptsScreen} />
      <Stack.Screen
        name="PaymentReceiptForm"
        component={PaymentReceiptFormScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="PaymentReceiptDetail" component={PaymentReceiptDetailScreen} />
    </Stack.Navigator>
  );
}
