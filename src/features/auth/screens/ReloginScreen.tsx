import { Feather } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { rootNavigationRef } from '@/app/navigation/navigationRef';
import type { RootStackParamList } from '@/app/navigation/types';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { PasswordField } from '../components/PasswordField';
import { authService } from '../service/authService';
import { AuthError, type AuthErrorCode } from '../service/errors';
import { secureStore } from '../storage/secureStore';
import { colors, font, fontSizes, radii, spacing } from '../theme/tokens';

const ERROR_COPY: Record<AuthErrorCode, string> = {
  NETWORK: 'Sem conexão com a internet. Tente novamente quando estiver online.',
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos. Verifique e tente novamente.',
  ACCOUNT_ISSUE: 'Não foi possível entrar com essa conta. Fale com o administrador.',
  NOT_AUTHENTICATED: 'Não foi possível entrar com essa conta. Fale com o administrador.',
  RELOGIN_REQUIRED: 'Não foi possível entrar com essa conta. Fale com o administrador.',
};

type ReloginScreenProps = {
  route: RouteProp<RootStackParamList, 'Relogin'>;
};

export function ReloginScreen({ route }: ReloginScreenProps) {
  const { resolve, reject } = route.params;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settled, setSettled] = useState(false);

  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await secureStore.getLastEmail();
      if (!cancelled && saved !== null) setEmail(saved);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(() => password.length > 0 && !isSubmitting, [password, isSubmitting]);

  const submit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorCode(null);
    try {
      await authService.relogin({ email: email.trim(), password });
      setPassword('');
      setSettled(true);
      resolve();
      if (rootNavigationRef.isReady()) rootNavigationRef.goBack();
    } catch (err) {
      setErrorCode(err instanceof AuthError ? err.code : 'ACCOUNT_ISSUE');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancel = () => {
    if (settled) return;
    setSettled(true);
    reject();
    if (rootNavigationRef.isReady()) rootNavigationRef.goBack();
  };

  const cardStyle = isTablet
    ? {
        width: 460,
        borderRadius: radii['2xl'],
        borderWidth: 1,
        borderColor: colors.border,
      }
    : {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        width: '100%' as const,
      };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: isTablet ? 'center' : 'flex-end',
        alignItems: 'center',
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ width: '100%', alignItems: 'center' }}
      >
        <View
          style={[
            {
              backgroundColor: colors.background,
              paddingHorizontal: spacing['2xl'],
              paddingTop: isTablet ? spacing['3xl'] : spacing.md,
              paddingBottom: isTablet ? spacing['3xl'] : spacing['3xl'] + spacing.md,
              gap: spacing.xl,
            },
            cardStyle,
          ]}
        >
          {!isTablet ? (
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: radii.full,
                  backgroundColor: colors.border,
                }}
              />
            </View>
          ) : null}

          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: isTablet ? 52 : 44,
                height: isTablet ? 52 : 44,
                borderRadius: radii.full,
                backgroundColor: colors.muted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather
                name="refresh-cw"
                size={isTablet ? 22 : 20}
                color={colors.foreground}
              />
            </View>
            <Text
              style={{
                fontFamily: font.family,
                fontSize: isTablet ? fontSizes['2xl'] : fontSizes.xl,
                fontWeight: font.weights.semibold,
                color: colors.foreground,
              }}
            >
              Sessão expirada
            </Text>
            <Text
              style={{
                fontFamily: font.family,
                fontSize: fontSizes.base,
                color: colors.mutedForeground,
                textAlign: 'center',
                lineHeight: fontSizes.base * 1.45,
              }}
            >
              Seus dados continuam no dispositivo. Entre novamente para sincronizar.
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            <Input
              value={email}
              readOnly
              rightSlot={<Feather name="lock" size={14} color={colors.mutedForeground} />}
            />
            <PasswordField
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="Sua senha"
            />
            {errorCode !== null ? (
              <Text
                style={{
                  fontFamily: font.family,
                  fontSize: fontSizes.sm,
                  color: colors.destructive,
                }}
              >
                {ERROR_COPY[errorCode]}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: spacing.sm }}>
            <Button onPress={submit} disabled={!canSubmit} loading={isSubmitting}>
              Entrar e sincronizar
            </Button>
            <Pressable
              onPress={cancel}
              style={{ alignItems: 'center', justifyContent: 'center', height: 40 }}
            >
              <Text
                style={{
                  fontFamily: font.family,
                  fontSize: fontSizes.base,
                  fontWeight: font.weights.medium,
                  color: colors.mutedForeground,
                }}
              >
                Cancelar
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
