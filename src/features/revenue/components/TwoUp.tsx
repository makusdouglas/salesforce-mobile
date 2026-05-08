// 017-revenue-dashboard — responsive two-up wrapper used by Top
// clients + Top products (FR-022). Side-by-side on tablet, stacked on
// phone. Each child becomes flex: 1 when on tablet so widths are
// balanced.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useViewport } from '../hooks/useViewport';

export interface TwoUpProps {
  readonly left: ReactNode;
  readonly right: ReactNode;
  readonly gap?: number;
}

export function TwoUp({ left, right, gap = 12 }: TwoUpProps) {
  const isTablet = useViewport() === 'tablet';
  const containerStyle = isTablet ? styles.tablet : styles.phone;
  const cellStyle = isTablet ? styles.cellTablet : styles.cellPhone;
  return (
    <View style={[containerStyle, { gap }]}>
      <View style={cellStyle}>{left}</View>
      <View style={cellStyle}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  phone: {
    flexDirection: 'column',
  },
  tablet: {
    flexDirection: 'row',
  },
  cellPhone: {
    flexShrink: 0,
    flexGrow: 0,
  },
  cellTablet: {
    flex: 1,
  },
});
