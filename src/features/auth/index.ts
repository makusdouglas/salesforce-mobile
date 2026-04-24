/**
 * Public barrel for the auth feature.
 *
 * Re-exports ONLY what feature/app code may consume. Do not re-export
 * sessionStore, _internalSessionStore, secureStore, the Supabase client,
 * the UI primitives (Card/Input/Button/PasswordField), bootstrap,
 * connectivity, or screen components.
 */

export { authService } from './service/authService';
export { AuthError, type AuthErrorCode } from './service/errors';
export { useSession } from './hooks/useSession';
export { useRoles, useHasRole } from './hooks/useRoles';
export { requireSession } from './session/requireSession';
export { SessionProvider } from './components/SessionProvider';
export { LoginScreen } from './screens/LoginScreen';
export { ReloginScreen } from './screens/ReloginScreen';
export type { SessionStatus, SessionSnapshot, SessionRole } from './session/session';
