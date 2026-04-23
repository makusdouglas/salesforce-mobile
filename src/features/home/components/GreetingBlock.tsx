import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Viewport } from '../hooks/useViewport';
import type { GreetingDTO } from '../snapshot/deriveHomeSnapshot';

type Props = {
  readonly viewport: Viewport;
  readonly greeting: GreetingDTO;
};

export function GreetingBlock(props: Props): React.ReactElement {
  const { viewport, greeting } = props;
  const isTablet = viewport === 'tablet';
  return (
    <View style={isTablet ? styles.wrapTablet : styles.wrapPhone}>
      <Text style={isTablet ? styles.titleTablet : styles.titlePhone}>{greeting.title}</Text>
      <Text style={isTablet ? styles.subtitleTablet : styles.subtitlePhone}>
        {greeting.subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapPhone: {
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 4,
  },
  wrapTablet: {
    paddingTop: 28,
    paddingBottom: 12,
    paddingHorizontal: 28,
    gap: 6,
  },
  titlePhone: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '700',
  },
  titleTablet: {
    color: '#0A0A0A',
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitlePhone: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 13,
  },
  subtitleTablet: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 15,
  },
});
