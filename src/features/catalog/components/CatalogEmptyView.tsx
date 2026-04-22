import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Viewport } from '../hooks/useViewport';

export type CatalogEmptyViewProps = {
  onSyncPress: () => void;
  viewport: Viewport;
};

export function CatalogEmptyView({ onSyncPress, viewport }: CatalogEmptyViewProps) {
  const isTablet = viewport === 'tablet';
  const heroSize = isTablet ? 160 : 128;
  const innerMaxWidth = isTablet ? 460 : undefined;

  return (
    <View style={styles.container}>
      <View style={[styles.inner, { maxWidth: innerMaxWidth }]}>
        <View style={[styles.hero, { width: heroSize, height: heroSize, borderRadius: heroSize / 2 }]}>
          <View
            style={[
              styles.heroIcon,
              { width: isTablet ? 72 : 56, height: isTablet ? 72 : 56 },
            ]}
          />
        </View>
        <Text style={[styles.heading, isTablet && styles.headingTablet]}>
          Seu catálogo está vazio
        </Text>
        <Text style={[styles.body, isTablet && styles.bodyTablet]}>
          Ainda não baixamos os produtos neste aparelho. Toque em Sincronizar agora para carregar tudo.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onSyncPress}
          style={({ pressed }) => [
            styles.cta,
            { height: isTablet ? 52 : 48 },
            pressed && styles.ctaPressed,
          ]}
        >
          <Text style={[styles.ctaLabel, isTablet && styles.ctaLabelTablet]}>
            Sincronizar agora
          </Text>
        </Pressable>
        <Text style={[styles.footnote, isTablet && styles.footnoteTablet]}>
          Você precisa de internet só na primeira vez.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  inner: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  hero: {
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#71717A',
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0A0A0A',
    textAlign: 'center',
  },
  headingTablet: {
    fontSize: 26,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#52525B',
    textAlign: 'center',
  },
  bodyTablet: {
    fontSize: 15,
    lineHeight: 22,
  },
  cta: {
    width: '100%',
    backgroundColor: '#18181B',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaLabel: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
  },
  ctaLabelTablet: {
    fontSize: 16,
  },
  footnote: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
  },
  footnoteTablet: {
    fontSize: 13,
  },
});
