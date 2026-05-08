import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { adminColors, adminFonts, adminRadii } from '../theme';

type Props = {
  imageUrl: string | null;
  onPick: () => void;
  uploading: boolean;
};

export function ProductImagePicker({ imageUrl, onPick, uploading }: Props) {
  if (imageUrl) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: imageUrl }} style={styles.image} />
        <Pressable
          onPress={uploading ? undefined : onPick}
          style={styles.changeBtn}
        >
          {uploading ? (
            <ActivityIndicator color={adminColors.textPrimary} />
          ) : (
            <Text style={styles.changeBtnText}>Trocar imagem</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={uploading ? undefined : onPick}
      style={styles.dropZone}
    >
      {uploading ? (
        <ActivityIndicator color={adminColors.textMuted} />
      ) : (
        <>
          <View style={styles.iconStack}>
            <Feather name="image" size={28} color={adminColors.textMuted} />
            <View style={styles.plusBadge}>
              <Feather name="plus" size={12} color={adminColors.surface} />
            </View>
          </View>
          <Text style={styles.hint}>Toque para escolher imagem</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 4:3 ratio — matches the cropped uploaded image so the drop zone
  // always shows exactly what the admin will save.
  container: { gap: 8 },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: adminRadii.card,
    backgroundColor: adminColors.surfaceMuted,
  },
  dropZone: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: adminColors.surfaceMuted,
    borderRadius: adminRadii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: adminColors.strokeMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconStack: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  plusBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: adminColors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
  },
  changeBtn: {
    height: 36,
    borderRadius: adminRadii.control,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBtnText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
});
