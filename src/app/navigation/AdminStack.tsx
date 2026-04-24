import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  AdminBarcodeMatchScreen,
  AdminBarcodeScannerScreen,
  AdminImageSourceScreen,
  AdminProductFormScreen,
  AdminProductSourceScreen,
  AdminProductsListScreen,
} from '@/features/admin/products';

import type { AdminStackParamList } from './types';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminProducts" component={AdminProductsListScreen} />
      <Stack.Screen
        name="AdminProductSource"
        component={AdminProductSourceScreen}
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="AdminBarcodeScanner"
        component={AdminBarcodeScannerScreen}
      />
      <Stack.Screen
        name="AdminBarcodeMatch"
        component={AdminBarcodeMatchScreen}
      />
      <Stack.Screen name="AdminProductForm" component={AdminProductFormScreen} />
      <Stack.Screen
        name="AdminImageSource"
        component={AdminImageSourceScreen}
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}
