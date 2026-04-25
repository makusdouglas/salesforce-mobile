import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { adminColors, adminFonts, adminRadii } from '../theme';
import type { CredentialMode } from '../hooks/useSellerForm';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

type Props = {
  value: CredentialMode;
  onChange: (v: CredentialMode) => void;
  variant: 'phone' | 'tablet';
};

export function CredentialPicker({ value, onChange, variant }: Props) {
  if (variant === 'phone') {
    return (
      <View style={styles.phoneSeg}>
        <SegmentButton
          label="Definir senha"
          active={value === 'password'}
          onPress={() => onChange('password')}
        />
        <SegmentButton
          label="Enviar convite"
          active={value === 'invite'}
          onPress={() => onChange('invite')}
        />
      </View>
    );
  }

  return (
    <View style={styles.tabletGrid}>
      <CardOption
        label="Definir senha inicial"
        description="Você digita, o vendedor troca no 1º acesso."
        icon="key"
        active={value === 'password'}
        onPress={() => onChange('password')}
      />
      <CardOption
        label="Enviar convite por e-mail"
        description="O vendedor define a senha pelo link."
        icon="mail"
        active={value === 'invite'}
        onPress={() => onChange('invite')}
      />
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.segBtn,
        active && styles.segBtnActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.segLabel, active && styles.segLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function CardOption({
  label,
  description,
  icon,
  active,
  onPress,
}: {
  label: string;
  description: string;
  icon: FeatherIcon;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        active && styles.cardActive,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Feather
        name={icon}
        size={20}
        color={active ? adminColors.textPrimary : adminColors.textMuted}
      />
      <Text style={styles.cardTitle}>{label}</Text>
      <Text style={styles.cardDesc}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  phoneSeg: {
    flexDirection: 'row',
    backgroundColor: adminColors.surfaceMuted,
    borderRadius: adminRadii.input,
    padding: 4,
    gap: 4,
    height: 40,
  },
  segBtn: {
    flex: 1,
    borderRadius: adminRadii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnActive: {
    backgroundColor: adminColors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  segLabel: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
  segLabelActive: {
    color: adminColors.textPrimary,
    fontWeight: '600',
  },
  tabletGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: adminColors.surface,
    borderWidth: 1,
    borderColor: adminColors.stroke,
    borderRadius: adminRadii.modal - 4,
    padding: 16,
    gap: 6,
  },
  cardActive: {
    backgroundColor: adminColors.background,
    borderColor: adminColors.textPrimary,
    borderWidth: 2,
  },
  cardTitle: {
    color: adminColors.textPrimary,
    fontFamily: adminFonts.heading,
    fontSize: 15,
    fontWeight: '600',
  },
  cardDesc: {
    color: adminColors.textMuted,
    fontFamily: adminFonts.body,
    fontSize: 12,
  },
});
