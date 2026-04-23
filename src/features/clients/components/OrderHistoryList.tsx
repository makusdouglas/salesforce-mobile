import { StyleSheet, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import { type OrderHistoryRowDTO } from '../types';

import { OrderHistoryEmptyView } from './OrderHistoryEmptyView';
import { OrderHistoryRow } from './OrderHistoryRow';

export type OrderHistoryListProps = {
  readonly rows: readonly OrderHistoryRowDTO[];
  readonly viewport: Viewport;
};

export function OrderHistoryList({ rows, viewport }: OrderHistoryListProps) {
  if (rows.length === 0) {
    return <OrderHistoryEmptyView viewport={viewport} />;
  }
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <OrderHistoryRow key={row.id} row={row} viewport={viewport} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
});
