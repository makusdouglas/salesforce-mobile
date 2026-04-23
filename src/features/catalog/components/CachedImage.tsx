import { Feather } from '@expo/vector-icons';
import { Image, type ImageResizeMode, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { useCachedImage } from '../hooks/useCachedImage';

export type CachedImageProps = {
  source: string | null;
  style?: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
  accessibilityLabel?: string;
};

export function CachedImage({
  source,
  style,
  resizeMode = 'cover',
  accessibilityLabel = 'Imagem do produto',
}: CachedImageProps) {
  const { uri, status } = useCachedImage(source);

  return (
    <View
      style={[styles.wrapper, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {status === 'ready' && uri !== null ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
        />
      ) : (
        <View style={styles.placeholderInner}>
          <Feather name="package" size={48} color="#71717A" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#A1A1AA',
  },
});
