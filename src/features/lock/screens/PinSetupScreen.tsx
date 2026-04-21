import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
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
import { lockService } from '../service/lockService';
import { LockError, type LockErrorCode } from '../service/errors';

type Step = 'entering' | 'confirming';

const ERROR_COPY: Partial<Record<LockErrorCode, string>> = {
  PIN_INVALID_LENGTH: 'PIN deve ter de 4 a 6 dígitos.',
  PIN_MISMATCH: 'Os PINs não coincidem. Tente novamente.',
  STORAGE_UNAVAILABLE:
    'Erro no armazenamento seguro. Reinstale o app se o erro persistir.',
};

export function PinSetupScreen() {
  const [step, setStep] = useState<Step>('entering');
  const [enteredPin, setEnteredPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorCode, setErrorCode] = useState<LockErrorCode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const brandSize = tablet ? 64 : 48;
  const brandRadius = tablet ? radii.xl : radii.lg;
  const brandIconSize = tablet ? 28 : 20;
  const titleSize = tablet ? fontSizes.display : fontSizes['3xl'];
  const subtitleSize = tablet ? fontSizes.lg : fontSizes.base;
  const cardMaxWidth = tablet ? 460 : undefined;
  const cardRadius = tablet ? radii['2xl'] : radii.xl;
  const cardPadding = tablet ? spacing['3xl'] : spacing['2xl'];

  const activePin = step === 'entering' ? enteredPin : confirmPin;
  const expectedLen =
    step === 'entering'
      ? Math.min(6, Math.max(4, enteredPin.length || 4))
      : enteredPin.length;
  const canSubmit =
    step === 'entering'
      ? enteredPin.length >= 4 && enteredPin.length <= 6
      : confirmPin.length === enteredPin.length;

  const handleChange = (next: string): void => {
    setErrorCode(null);
    if (step === 'entering') setEnteredPin(next);
    else setConfirmPin(next);
  };

  const handleEnteringSubmit = (): void => {
    if (!canSubmit) return;
    setStep('confirming');
    setConfirmPin('');
  };

  const handleConfirmSubmit = async (): Promise<void> => {
    if (!canSubmit || isSubmitting) return;
    if (confirmPin !== enteredPin) {
      setErrorCode('PIN_MISMATCH');
      setStep('entering');
      setEnteredPin('');
      setConfirmPin('');
      return;
    }
    setIsSubmitting(true);
    try {
      await lockService.setupPin(enteredPin);
      setEnteredPin('');
      setConfirmPin('');
      // LockGate will observe status === 'Unlocked' and swap to children.
    } catch (err) {
      if (err instanceof LockError) setErrorCode(err.code);
      else setErrorCode('STORAGE_UNAVAILABLE');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (): void => {
    if (step === 'entering') handleEnteringSubmit();
    else void handleConfirmSubmit();
  };

  const heading = step === 'entering' ? 'Crie seu PIN' : 'Confirme seu PIN';
  const subtitle =
    step === 'entering'
      ? '4 a 6 dígitos. Usado para desbloquear o app.'
      : 'Digite novamente para confirmar.';
  const stepLabel = step === 'entering' ? 'Passo 1 de 2' : 'Passo 2 de 2';

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
            {
              width: brandSize,
              height: brandSize,
              borderRadius: brandRadius,
            },
          ]}
        >
          <Feather name="lock" size={brandIconSize} color={colors.primaryForeground} />
        </View>

        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { fontSize: titleSize, fontFamily: font.family, color: colors.foreground },
            ]}
          >
            {heading}
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
            {subtitle}
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
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>{stepLabel}</Text>
          </View>

          <View style={styles.dotsRow}>
            {Array.from({ length: expectedLen }).map((_, idx) => {
              const filled = idx < activePin.length;
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
            value={activePin}
            onChange={handleChange}
            maxLength={6}
            size={tablet ? 'tablet' : 'phone'}
            disabled={isSubmitting}
          />

          {errorCode !== null ? (
            <Text style={styles.errorText}>{ERROR_COPY[errorCode] ?? ''}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={step === 'entering' ? 'Avançar' : 'Confirmar'}
            disabled={!canSubmit || isSubmitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submit,
              {
                height: tablet ? 48 : 44,
                borderRadius: tablet ? radii.lg : radii.lg,
                backgroundColor: canSubmit ? colors.primary : colors.muted,
              },
              pressed && canSubmit ? styles.submitPressed : null,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text
                style={[
                  styles.submitLabel,
                  {
                    color: canSubmit ? colors.primaryForeground : colors.placeholder,
                    fontFamily: font.family,
                    fontSize: tablet ? fontSizes.md : fontSizes.base,
                  },
                ]}
              >
                {step === 'entering' ? 'Avançar' : 'Confirmar'}
              </Text>
            )}
          </Pressable>
        </View>

        <Text
          style={[
            styles.footer,
            { fontFamily: font.family, color: colors.mutedForeground },
          ]}
        >
          Você usará este PIN para desbloquear o app.
        </Text>
      </ScrollView>
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
  title: {
    fontWeight: font.weights.bold,
    letterSpacing: 0.2,
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
  stepBadge: {
    alignSelf: 'flex-start',
    height: 24,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    justifyContent: 'center',
  },
  stepText: {
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
  errorText: {
    color: colors.destructive,
    fontFamily: font.family,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  footer: {
    fontSize: fontSizes.xs,
    textAlign: 'center',
  },
});
