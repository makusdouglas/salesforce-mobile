import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { homeCopy } from '../copy/copy';
import type { Viewport } from '../hooks/useViewport';

type Props = {
  readonly viewport: Viewport;
  readonly onSettingsPress: () => void;
  /**
   * Slot for HomeSyncPill. Phase 3 passes null/placeholder; Phase 5 (US3)
   * drops the real pill component in here.
   */
  readonly syncPillSlot: React.ReactNode;
};

/**
 * Top bar of the Home hub: title + sync pill slot + gear icon.
 *
 * 56 pt on phone (matches ClientList top bar already shipped), 64 pt on
 * tablet. White fill with 1 pt bottom border.
 */
export function HomeTopBar(props: Props): React.ReactElement {
  const { viewport, onSettingsPress, syncPillSlot } = props;
  const isTablet = viewport === 'tablet';
  return (
    <View style={[styles.container, isTablet ? styles.containerTablet : styles.containerPhone]}>
      <Text accessibilityRole="header" style={isTablet ? styles.titleTablet : styles.titlePhone}>
        {homeCopy.screenTitle}
      </Text>
      <View style={styles.right}>
        {syncPillSlot}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={homeCopy.settingsA11y}
          onPress={onSettingsPress}
          hitSlop={12}
          style={({ pressed }) => [styles.gear, pressed && styles.gearPressed]}
        >
          <Text style={styles.gearGlyph}>⚙︎</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
  },
  containerPhone: {
    height: 56,
    paddingHorizontal: 16,
  },
  containerTablet: {
    height: 64,
    paddingHorizontal: 28,
  },
  titlePhone: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '600',
  },
  titleTablet: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '700',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gear: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearGlyph: {
    color: '#52525B',
    fontSize: 20,
  },
  gearPressed: {
    opacity: 0.6,
  },
});
