import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';
import { type OrderHistoryRowDTO } from '../types';

import { OrderHistoryEmptyView } from './OrderHistoryEmptyView';
import { OrderHistoryRow } from './OrderHistoryRow';

export type OrderHistoryListProps = {
  readonly rows: readonly OrderHistoryRowDTO[];
  readonly viewport: Viewport;
  /**
   * 010-repeat-last-order: optional slot rendered on the trailing edge of
   * each row. The client profile passes a <RepeatIconButton> here so every
   * past order is one tap away from being cloned into a new draft (US2).
   */
  readonly renderRowTrailing?: (row: OrderHistoryRowDTO) => ReactNode;
  /**
   * 010-repeat-last-order: optional slot rendered directly beneath a row.
   * Used by the client profile to show the `AllUnavailableNotice` adjacent
   * to the row whose per-row ↺ was just blocked (FR-008).
   */
  readonly renderBelowRow?: (row: OrderHistoryRowDTO) => ReactNode;
  /**
   * 011-order-email-delivery: optional row tap handler. Called when the
   * user taps the body of a row (not the trailing button). Used on sent
   * rows to re-open the stored PDF.
   */
  readonly onRowPress?: (row: OrderHistoryRowDTO) => void;
};

export function OrderHistoryList({
  rows,
  viewport,
  renderRowTrailing,
  renderBelowRow,
  onRowPress,
}: OrderHistoryListProps) {
  if (rows.length === 0) {
    return <OrderHistoryEmptyView viewport={viewport} />;
  }
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View key={row.id} style={styles.rowWrapper}>
          <OrderHistoryRow
            row={row}
            viewport={viewport}
            trailing={renderRowTrailing?.(row)}
            {...(onRowPress ? { onPress: () => onRowPress(row) } : {})}
          />
          {renderBelowRow?.(row)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  rowWrapper: {
    gap: 8,
  },
});
