import React from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useSyncStatus } from '../hooks/useSyncStatus';
import type { SyncStatus } from '../state/derive';

// Viewport split: dot-only on phone (tight 390 pt portrait), dot + label on
// tablet where there's horizontal room for the word. Matches the convention
// documented in specs/007-client-registration/design/screens.md and applies
// project-wide so catalog / clients / home look consistent.
const TABLET_MIN_WIDTH = 768;

type StatusMeta = {
  readonly color: string;
  readonly label: string;
};

const STATUS: Record<SyncStatus, StatusMeta> = {
  'in-sync': { color: '#16A34A', label: 'Dados em dia' },
  syncing: { color: '#F59E0B', label: 'Sincronizando…' },
  offline: { color: '#A1A1AA', label: 'Sem internet' },
  failed: { color: '#DC2626', label: 'Falha ao sincronizar' },
};

type Props = {
  readonly style?: StyleProp<ViewStyle>;
};

export function SyncStatusIndicator({ style }: Props): React.ReactElement {
  const { status } = useSyncStatus();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const meta = STATUS[status];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={meta.label}
      style={[styles.row, style]}
    >
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      {isTablet ? <Text style={styles.label}>{meta.label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    columnGap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 13,
    color: '#52525B',
  },
});
