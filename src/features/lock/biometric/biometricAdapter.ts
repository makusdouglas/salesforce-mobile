import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricResult = 'success' | 'failed' | 'cancelled' | 'unavailable';

let cachedAvailable: boolean | null = null;

function mapAuthResult(
  result: LocalAuthentication.LocalAuthenticationResult,
): BiometricResult {
  if (result.success) return 'success';
  const error = result.error;
  switch (error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
    case 'user_fallback':
      return 'cancelled';
    case 'authentication_failed':
      return 'failed';
    case 'lockout':
    case 'not_available':
    case 'not_enrolled':
    case 'passcode_not_set':
      return 'unavailable';
    default:
      return 'unavailable';
  }
}

export const biometricAdapter = {
  async isAvailable(): Promise<boolean> {
    if (cachedAvailable !== null) return cachedAvailable;
    try {
      const [hasHardware, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      cachedAvailable = hasHardware && enrolled;
      return cachedAvailable;
    } catch {
      cachedAvailable = false;
      return false;
    }
  },

  async authenticate(options: {
    promptMessage: string;
    cancelLabel: string;
  }): Promise<BiometricResult> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: options.promptMessage,
        cancelLabel: options.cancelLabel,
        disableDeviceFallback: true,
        requireConfirmation: false,
      });
      return mapAuthResult(result);
    } catch {
      return 'unavailable';
    }
  },
};
