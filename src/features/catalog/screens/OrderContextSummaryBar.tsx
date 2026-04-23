// 009-order-assembly: sticky bottom bar shown on Catalog / ProductDetail
// when the route carries `inOrderId`. Observes the target draft's items
// and derives count + running total via computeOrderTotals.

import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type OrderItem from '@/data/models/OrderItem';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { ordersRepository } from '@/data/repositories/ordersRepository';
import type Order from '@/data/models/Order';

import { computeOrderTotals } from '@/features/orders/totals/computeOrderTotals';
import type { OrderLineForTotals } from '@/features/orders/totals/types';
import { formatBRL } from '@/features/orders/formatting/formatBRL';

export interface OrderContextSummaryBarProps {
  readonly orderId: string;
  readonly onPress: () => void;
}

function linesFor(items: readonly OrderItem[]): OrderLineForTotals[] {
  return items.map((line) => ({
    id: line.id,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: { mode: line.discountMode, value: line.discountAmount },
  }));
}

export function OrderContextSummaryBar({
  orderId,
  onPress,
}: OrderContextSummaryBarProps) {
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    const sub = ordersRepository.observe(orderId).subscribe({
      next: (row) => setOrder(row),
    });
    return () => sub.unsubscribe();
  }, [orderId]);

  useEffect(() => {
    const sub = orderItemsRepository.observeByOrder(orderId).subscribe({
      next: (rows) => setItems(rows),
    });
    return () => sub.unsubscribe();
  }, [orderId]);

  const totals = computeOrderTotals(
    {
      discount: order
        ? { mode: order.discountMode, value: order.discountAmount }
        : { mode: 'amount', value: 0 },
    },
    linesFor(items),
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar ao pedido"
      onPress={onPress}
      style={({ pressed }) => [
        styles.bar,
        { paddingBottom: 16 + insets.bottom },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.left}>
        <Text style={styles.count}>
          {items.length} {items.length === 1 ? 'item' : 'itens'}
        </Text>
        <Text style={styles.total}>{formatBRL(totals.total)}</Text>
      </View>
      <View style={styles.ctaWrap}>
        <Text style={styles.cta}>Voltar ao pedido</Text>
        <Feather name="chevron-right" size={18} color="#FAFAFA" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#171717',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  left: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  count: { color: '#A3A3A3', fontSize: 12 },
  total: { color: '#FAFAFA', fontSize: 15, fontWeight: '700' },
  ctaWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cta: { color: '#FAFAFA', fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
