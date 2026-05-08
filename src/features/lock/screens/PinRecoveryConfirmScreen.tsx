import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { colors, font, fontSizes, radii, spacing } from '@/features/auth/theme/tokens';

import { LockError } from '../service/errors';
import { lockService } from '../service/lockService';

type PinRecoveryConfirmScreenProps = {
  onCancel: () => void;
};

function isOnline(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable === true;
}

export function PinRecoveryConfirmScreen({ onCancel }: PinRecoveryConfirmScreenProps) {
  const [offline, setOffline] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const state = await NetInfo.fetch();
      if (!cancelled) setOffline(!isOnline(state));
    })();
    const unsub = NetInfo.addEventListener((state) => {
      if (!cancelled) setOffline(!isOnline(state));
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const handleContinue = async (): Promise<void> => {
    if (offline || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await lockService.beginPinRecovery();
      // Navigation away happens implicitly: session transitions to
      // NotAuthenticated → RootNavigator unmounts the Home branch.
    } catch (err) {
      if (err instanceof LockError && err.code === 'RECOVERY_OFFLINE') {
        setOffline(true);
      } else {
        setErrorText('Erro ao iniciar redefinição. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const panelLayout = tablet ? styles.panelCentered : styles.panelBottom;
  const panelRadius = tablet ? styles.panelRadiusFull : styles.panelRadiusTop;
  const panelWidth = tablet ? { maxWidth: 460, width: '100%' as const } : { width: '100%' as const };
  const showBorder = tablet;

  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop, panelLayout]}>
      <View
        style={[
          styles.panel,
          panelRadius,
          panelWidth,
          showBorder ? styles.panelBorder : null,
          {
            paddingHorizontal: spacing['2xl'],
            paddingTop: tablet ? spacing['3xl'] : spacing.md,
            paddingBottom: tablet ? spacing['3xl'] : 36,
            gap: spacing.xl,
          },
        ]}
      >
        {tablet ? null : <View style={styles.grip} />}

        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Feather name="key" size={tablet ? 24 : 20} color={colors.primary} />
          </View>
          <Text
            style={[
              styles.heading,
              { fontSize: tablet ? fontSizes['3xl'] : fontSizes.xl },
            ]}
          >
            Redefinir PIN
          </Text>
          <Text style={styles.body}>
            Para redefinir seu PIN, você precisará entrar de novo com e-mail e senha.
            Seus dados continuam no aparelho.
          </Text>
        </View>

        <View style={styles.bulletsWrap}>
          <View style={styles.bulletRow}>
            <Feather
              name="wifi"
              size={tablet ? 18 : 16}
              color={colors.foreground}
            />
            <Text style={styles.bulletText}>Requer conexão com a internet</Text>
          </View>
          <View style={styles.bulletRow}>
            <Feather
              name="shield"
              size={tablet ? 18 : 16}
              color={colors.foreground}
            />
            <Text style={styles.bulletText}>
              Clientes, pedidos e rascunhos permanecem
            </Text>
          </View>
        </View>

        {offline ? (
          <Text style={styles.offlineText}>
            Conecte-se à internet para continuar.
          </Text>
        ) : null}
        {errorText !== null ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continuar"
            disabled={offline || isSubmitting}
            onPress={() => {
              void handleContinue();
            }}
            style={({ pressed }) => [
              styles.continuarBtn,
              {
                height: tablet ? 48 : 44,
                backgroundColor: offline ? colors.muted : colors.primary,
              },
              pressed && !offline && !isSubmitting ? styles.btnPressed : null,
            ]}
          >
            <Text
              style={[
                styles.continuarLabel,
                {
                  color: offline ? colors.placeholder : colors.primaryForeground,
                  fontSize: tablet ? fontSizes.md : fontSizes.base,
                },
              ]}
            >
              Continuar
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            disabled={isSubmitting}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cancelarBtn,
              { height: tablet ? 44 : 40 },
              pressed && !isSubmitting ? styles.btnPressed : null,
            ]}
          >
            <Text
              style={[
                styles.cancelarLabel,
                { fontSize: tablet ? fontSizes.md : fontSizes.base },
              ]}
            >
              Cancelar
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: colors.overlay,
  },
  panelBottom: {
    justifyContent: 'flex-end',
  },
  panelCentered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    backgroundColor: colors.background,
  },
  panelRadiusTop: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  panelRadiusFull: {
    borderRadius: radii['2xl'],
  },
  panelBorder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  grip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    color: colors.foreground,
    fontFamily: font.family,
    fontWeight: font.weights.semibold,
  },
  body: {
    color: colors.mutedForeground,
    fontFamily: font.family,
    fontSize: fontSizes.base,
    lineHeight: 20,
    textAlign: 'center',
  },
  bulletsWrap: {
    gap: spacing.md - 2,
    paddingTop: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 2,
  },
  bulletText: {
    color: colors.foreground,
    fontFamily: font.family,
    fontSize: fontSizes.sm,
    flex: 1,
  },
  offlineText: {
    color: colors.mutedForeground,
    fontFamily: font.family,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  errorText: {
    color: colors.destructive,
    fontFamily: font.family,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  continuarBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
  },
  continuarLabel: {
    fontFamily: font.family,
    fontWeight: font.weights.medium,
  },
  cancelarBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
  },
  cancelarLabel: {
    color: colors.mutedForeground,
    fontFamily: font.family,
    fontWeight: font.weights.medium,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
