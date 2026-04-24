import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AdminStackParamList } from '@/app/navigation/types';

import { useAdminProductsLayout } from '../responsive/useAdminProductsLayout';
import { imageSourceChannel } from '../service/imageSourceChannel';
import { adminColors, adminFonts, adminRadii } from '../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminImageSource'>;

export function AdminImageSourceScreen() {
  const nav = useNavigation<Nav>();
  const viewport = useAdminProductsLayout();

  // If the user dismisses the chooser without picking, drop the pending
  // request so stale handlers don't fire on the next open.
  useEffect(() => {
    return () => {
      imageSourceChannel.cancel();
    };
  }, []);

  const pick = (source: 'camera' | 'library') => {
    imageSourceChannel.resolve(source);
    nav.goBack();
  };

  if (viewport === 'tablet') {
    return (
      <TabletLayout
        onPickCamera={() => pick('camera')}
        onPickLibrary={() => pick('library')}
        onCancel={() => nav.goBack()}
      />
    );
  }

  return (
    <PhoneLayout
      onPickCamera={() => pick('camera')}
      onPickLibrary={() => pick('library')}
      onCancel={() => nav.goBack()}
    />
  );
}

type LayoutProps = {
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onCancel: () => void;
};

function PhoneLayout({ onPickCamera, onPickLibrary, onCancel }: LayoutProps) {
  return (
    <View style={phoneStyles.backdrop}>
      <SafeAreaView style={phoneStyles.safe} edges={['top', 'bottom']}>
        <View style={phoneStyles.card}>
          <Text style={phoneStyles.title}>Adicionar imagem</Text>
          <Text style={phoneStyles.subtitle}>
            Escolha de onde virá a foto do produto.
          </Text>

          <PhoneOption
            icon="camera"
            title="Tirar foto"
            hint="Usar a câmera do aparelho"
            onPress={onPickCamera}
          />
          <PhoneOption
            icon="image"
            title="Escolher da galeria"
            hint="Selecionar uma foto já salva"
            onPress={onPickLibrary}
          />

          <Text style={phoneStyles.hint}>
            A imagem é reduzida automaticamente para ficar leve.
          </Text>

          <Pressable style={phoneStyles.cancel} onPress={onCancel}>
            <Text style={phoneStyles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function PhoneOption({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={phoneStyles.option} onPress={onPress}>
      <View style={phoneStyles.optionIcon}>
        <Feather name={icon} size={18} color={adminColors.textPrimary} />
      </View>
      <View style={phoneStyles.optionCol}>
        <Text style={phoneStyles.optionTitle}>{title}</Text>
        <Text style={phoneStyles.optionHint}>{hint}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={adminColors.textFaint} />
    </Pressable>
  );
}

function TabletLayout({ onPickCamera, onPickLibrary, onCancel }: LayoutProps) {
  return (
    <View style={tabletStyles.backdrop}>
      <View style={tabletStyles.card}>
        <Text style={tabletStyles.title}>Adicionar imagem</Text>
        <Text style={tabletStyles.subtitle}>
          Escolha de onde virá a foto do produto.
        </Text>

        <View style={tabletStyles.grid}>
          <TabletOption
            icon="camera"
            title="Tirar foto"
            hint="Usar a câmera do aparelho."
            onPress={onPickCamera}
          />
          <TabletOption
            icon="image"
            title="Escolher da galeria"
            hint="Selecionar uma foto já salva."
            onPress={onPickLibrary}
          />
        </View>

        <Text style={tabletStyles.hint}>
          A imagem é reduzida automaticamente para ficar leve.
        </Text>

        <Pressable style={tabletStyles.cancel} onPress={onCancel}>
          <Text style={tabletStyles.cancelText}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TabletOption({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={tabletStyles.option} onPress={onPress}>
      <View style={tabletStyles.optionIcon}>
        <Feather name={icon} size={22} color={adminColors.textPrimary} />
      </View>
      <Text style={tabletStyles.optionTitle}>{title}</Text>
      <Text style={tabletStyles.optionHint}>{hint}</Text>
    </Pressable>
  );
}

// -----------------------------------------------------------------------
// Styles mirror frames J9WnG (phone) and ZWNU2 (tablet) from layout.pen.
// -----------------------------------------------------------------------

const phoneStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: adminColors.scrim,
    justifyContent: 'flex-end',
  },
  safe: { padding: 16 },
  card: {
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.modal,
    padding: 20,
    gap: 14,
  },
  title: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 72,
    paddingHorizontal: 14,
    backgroundColor: adminColors.background,
    borderRadius: adminRadii.card,
    borderWidth: 1,
    borderColor: adminColors.stroke,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: adminRadii.control,
    backgroundColor: adminColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCol: { flex: 1, gap: 2 },
  optionTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
  optionHint: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 12,
  },
  hint: {
    color: adminColors.textFaint,
    fontFamily: adminFonts.body,
    fontSize: 12,
    paddingTop: 4,
  },
  cancel: {
    height: 40,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
});

const tabletStyles = StyleSheet.create({
  // Tablet frame ZWNU2 uses absolute placement for the centered card.
  backdrop: {
    flex: 1,
    backgroundColor: adminColors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  card: {
    width: 460,
    backgroundColor: adminColors.surface,
    borderRadius: adminRadii.bigModal,
    padding: 28,
    gap: 18,
  },
  title: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 22,
    fontWeight: '600',
  },
  subtitle: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    gap: 14,
  },
  option: {
    flex: 1,
    backgroundColor: adminColors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    padding: 20,
    gap: 10,
    alignItems: 'flex-start',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: adminRadii.input,
    backgroundColor: adminColors.surface,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 16,
    fontWeight: '600',
  },
  optionHint: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
  },
  hint: {
    color: adminColors.textFaint,
    fontFamily: adminFonts.body,
    fontSize: 12,
  },
  cancel: {
    height: 44,
    borderRadius: adminRadii.input,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
});
