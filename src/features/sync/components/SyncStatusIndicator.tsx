import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

// Design tokens — this is the one allowed cross-feature import.
import { colors, fontSizes } from '@/features/auth/theme/tokens';

import { useSyncStatus } from '../hooks/useSyncStatus';

// Local palette extensions. The auth tokens are minimal shadcn-style
// (no success/warning). Kept scoped to this component rather than
// reaching across into the auth feature to widen its palette.
const SUCCESS = '#059669'; // emerald-600
const WARNING = '#D97706'; // amber-600
const TERTIARY = colors.placeholder; // lighter gray for offline / quieter states

type Props = {
  style?: StyleProp<ViewStyle>;
};

export function SyncStatusIndicator({ style }: Props): React.ReactElement {
  const { status } = useSyncStatus();

  let icon: React.ReactNode;
  let label: string;
  let color: string;

  switch (status) {
    case 'in-sync':
      icon = <Text style={[styles.glyph, { color: SUCCESS }]}>✓</Text>;
      label = 'Dados em dia';
      color = colors.mutedForeground;
      break;
    case 'syncing':
      icon = (
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      );
      label = 'Sincronizando…';
      color = colors.mutedForeground;
      break;
    case 'offline':
      icon = <Text style={[styles.glyph, { color: TERTIARY }]}>⊘</Text>;
      label = 'Sem internet';
      color = TERTIARY;
      break;
    case 'failed':
      icon = <Text style={[styles.glyph, { color: WARNING }]}>⚠</Text>;
      label = 'Falha ao sincronizar';
      color = WARNING;
      break;
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.row, style]}
    >
      {icon}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    columnGap: 4,
  },
  glyph: {
    fontSize: fontSizes.lg,
    lineHeight: 20,
  },
  label: {
    fontSize: fontSizes.base,
  },
});
