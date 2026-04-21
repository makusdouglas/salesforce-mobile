import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, fontSizes, radii, spacing } from '@/features/auth/theme/tokens';

import { PinPad } from '../components/PinPad';
import { useLockFailedAttempts } from '../hooks/useLockFailedAttempts';
import { lockService } from '../service/lockService';
import { LockError } from '../service/errors';
import { getProgressiveDelayMs } from '../state/lockStore';

import { PinRecoveryConfirmScreen } from './PinRecoveryConfirmScreen';

export function LockScreen() {
  const [pin, setPin] = useState('');
  const [showPinPad, setShowPinPad] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [biometricTried, setBiometricTried] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdownMs, setCountdownMs] = useState(0);
  const [showRecoveryConfirm, setShowRecoveryConfirm] = useState(false);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const failedAttempts = useLockFailedAttempts();
  const delayMs = getProgressiveDelayMs(failedAttempts);
  const locked = delayMs === Infinity;
  const inDelay = delayMs > 0 && delayMs !== Infinity;

  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const brandSize = tablet ? 64 : 48;
  const brandRadius = tablet ? radii.xl : radii.lg;
  const brandIconSize = tablet ? 28 : 20;
  const wordmarkSize = tablet ? fontSizes.display : fontSizes['3xl'];
  const subtitleSize = tablet ? fontSizes.lg : fontSizes.base;
  const cardMaxWidth = tablet ? 460 : undefined;
  const cardRadius = tablet ? radii['2xl'] : radii.xl;
  const cardPadding = tablet ? spacing['3xl'] : spacing['2xl'];

  // On mount: try biometric if available, else show PIN pad directly.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await lockService.unlockWithBiometric();
        if (cancelled) return;
        if (result === 'success') {
          // LockGate unmounts this screen on next frame.
          return;
        }
        setBiometricTried(result === 'failed' || result === 'cancelled');
        setShowPinPad(true);
      } catch {
        if (!cancelled) setShowPinPad(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Kick off / reset countdown timer whenever delayMs changes.
  useEffect(() => {
    if (countdownTimer.current !== null) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    if (!inDelay) {
      setCountdownMs(0);
      return;
    }
    setCountdownMs(delayMs);
    const startedAt = Date.now();
    countdownTimer.current = setInterval(() => {
      const remaining = Math.max(0, delayMs - (Date.now() - startedAt));
      setCountdownMs(remaining);
      if (remaining === 0 && countdownTimer.current !== null) {
        clearInterval(countdownTimer.current);
        countdownTimer.current = null;
      }
    }, 250);
    return () => {
      if (countdownTimer.current !== null) {
        clearInterval(countdownTimer.current);
        countdownTimer.current = null;
      }
    };
  }, [delayMs, inDelay]);

  const handleChange = (next: string): void => {
    setErrorText(null);
    setPin(next);
  };

  const handleSubmit = async (): Promise<void> => {
    if (pin.length < 4 || isSubmitting || countdownMs > 0) return;
    setIsSubmitting(true);
    try {
      const ok = await lockService.verifyPin(pin);
      setPin('');
      if (!ok) setErrorText('PIN incorreto.');
    } catch (err) {
      if (err instanceof LockError && err.code === 'TOO_MANY_ATTEMPTS') {
        setErrorText('Muitas tentativas. Redefinir PIN pelo login.');
        setShowRecoveryConfirm(true);
      } else {
        setErrorText('Erro ao verificar PIN. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgot = (): void => {
    setShowRecoveryConfirm(true);
  };

  const padDisabled = countdownMs > 0 || locked || isSubmitting || !showPinPad;
  const countdownSeconds = Math.ceil(countdownMs / 1000);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          tablet ? styles.scrollContentTablet : styles.scrollContentPhone,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.brand,
            { width: brandSize, height: brandSize, borderRadius: brandRadius },
          ]}
        >
          <Feather
            name="shopping-bag"
            size={brandIconSize}
            color={colors.primaryForeground}
          />
        </View>

        <View style={styles.header}>
          <Text
            style={[
              styles.wordmark,
              { fontSize: wordmarkSize, fontFamily: font.family, color: colors.foreground },
            ]}
          >
            SALESFORCE
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                fontSize: subtitleSize,
                fontFamily: font.family,
                color: colors.mutedForeground,
              },
            ]}
          >
            Digite seu PIN para continuar.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              borderRadius: cardRadius,
              padding: cardPadding,
              maxWidth: cardMaxWidth,
              width: '100%',
            },
          ]}
        >
          {biometricTried ? (
            <View style={styles.bioHint}>
              <Feather name="smile" size={12} color="#52525B" />
              <Text style={styles.bioHintText}>Face ID tentado</Text>
            </View>
          ) : null}

          <View style={styles.dotsRow}>
            {Array.from({ length: 6 }).map((_, idx) => {
              const filled = idx < pin.length;
              return (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    { backgroundColor: filled ? colors.primary : colors.background },
                    filled ? null : styles.dotEmpty,
                  ]}
                />
              );
            })}
          </View>

          <PinPad
            value={pin}
            onChange={handleChange}
            maxLength={6}
            size={tablet ? 'tablet' : 'phone'}
            disabled={padDisabled}
          />

          {countdownMs > 0 ? (
            <Text style={styles.countdownText}>
              Aguarde {countdownSeconds}s antes da próxima tentativa.
            </Text>
          ) : null}

          {errorText !== null ? (
            <Text style={styles.errorText}>{errorText}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Desbloquear"
            disabled={pin.length < 4 || padDisabled}
            onPress={() => {
              void handleSubmit();
            }}
            style={({ pressed }) => [
              styles.submit,
              {
                height: tablet ? 48 : 44,
                borderRadius: radii.lg,
                backgroundColor:
                  pin.length >= 4 && !padDisabled ? colors.primary : colors.muted,
              },
              pressed && pin.length >= 4 && !padDisabled ? styles.submitPressed : null,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text
                style={[
                  styles.submitLabel,
                  {
                    color:
                      pin.length >= 4 && !padDisabled
                        ? colors.primaryForeground
                        : colors.placeholder,
                    fontFamily: font.family,
                    fontSize: tablet ? fontSizes.md : fontSizes.base,
                  },
                ]}
              >
                Desbloquear
              </Text>
            )}
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Esqueci meu PIN"
          onPress={handleForgot}
          style={({ pressed }) => [
            styles.forgotBtn,
            pressed ? styles.forgotBtnPressed : null,
          ]}
        >
          <Text style={styles.forgotLabel}>Esqueci meu PIN</Text>
        </Pressable>
      </ScrollView>

      {showRecoveryConfirm ? (
        <PinRecoveryConfirmScreen
          onCancel={() => setShowRecoveryConfirm(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing['3xl'],
  },
  scrollContentPhone: {
    paddingTop: spacing['3xl'] * 2,
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  scrollContentTablet: {
    paddingTop: 120,
    paddingHorizontal: spacing['3xl'],
    paddingBottom: 64,
  },
  brand: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  wordmark: {
    fontWeight: font.weights.bold,
    letterSpacing: 2,
  },
  subtitle: {
    fontWeight: font.weights.regular,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing['2xl'],
  },
  bioHint: {
    alignSelf: 'flex-start',
    height: 28,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bioHintText: {
    color: '#52525B',
    fontFamily: font.family,
    fontSize: fontSizes.xs - 1,
    fontWeight: font.weights.medium,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },
  dotEmpty: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  countdownText: {
    fontFamily: font.family,
    fontSize: fontSizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  errorText: {
    color: colors.destructive,
    fontFamily: font.family,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  submit: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitPressed: {
    opacity: 0.85,
  },
  submitLabel: {
    fontWeight: font.weights.medium,
  },
  forgotBtn: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  forgotBtnPressed: {
    opacity: 0.6,
  },
  forgotLabel: {
    color: colors.mutedForeground,
    fontFamily: font.family,
    fontSize: fontSizes.sm,
    fontWeight: font.weights.medium,
  },
});
