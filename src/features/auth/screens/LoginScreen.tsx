import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
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

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const brandSize = isTablet ? 64 : 48;
  const brandRadius = isTablet ? radii['2xl'] : radii.lg;
  const brandIconSize = isTablet ? 26 : 20;
  const titleSize = isTablet ? fontSizes.display : fontSizes['3xl'];
  const titleSpacing = isTablet ? 3 : 2;
  const subtitleSize = isTablet ? fontSizes.lg : fontSizes.base;
  const cardMaxWidth = isTablet ? 440 : undefined;

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

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0 && !isSubmitting,
    [email, password, isSubmitting],
  );

  const submit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorCode(null);
    try {
      await authService.login({ email: email.trim(), password });
      setPassword('');
    } catch (err) {
      setErrorCode(err instanceof AuthError ? err.code : 'ACCOUNT_ISSUE');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: isTablet ? 'center' : 'flex-start',
            paddingTop: isTablet ? 0 : 56,
            paddingBottom: spacing['2xl'],
            paddingHorizontal: spacing['2xl'],
            gap: spacing['3xl'],
            backgroundColor: colors.background,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              width: brandSize,
              height: brandSize,
              backgroundColor: colors.primary,
              borderRadius: brandRadius,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="shopping-bag" size={brandIconSize} color={colors.primaryForeground} />
          </View>

          <View style={{ alignItems: 'center', gap: spacing.sm, width: '100%', maxWidth: cardMaxWidth }}>
            <Text
              style={{
                fontFamily: font.family,
                fontSize: titleSize,
                fontWeight: font.weights.bold,
                color: colors.foreground,
                letterSpacing: titleSpacing,
              }}
            >
              SALESFORCE
            </Text>
            <Text
              style={{
                fontFamily: font.family,
                fontSize: subtitleSize,
                color: colors.mutedForeground,
                textAlign: 'center',
              }}
            >
              Entre para acessar sua conta.
            </Text>
          </View>

          <Card style={{ width: '100%', maxWidth: cardMaxWidth }}>
            <Input
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@empresa.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
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
            <Button onPress={submit} disabled={!canSubmit} loading={isSubmitting}>
              Entrar
            </Button>
          </Card>

          <Text
            style={{
              fontFamily: font.family,
              fontSize: fontSizes.xs,
              color: colors.mutedForeground,
              textAlign: 'center',
              maxWidth: cardMaxWidth,
            }}
          >
            Precisa de acesso? Fale com o administrador.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
