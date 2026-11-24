import { createContext, useContext } from 'react';
import type { SignedInUser } from './access';

export type AuthState =
  | { status: 'loading' }
  | { status: 'not-configured'; problem: string }
  // `notice` explains why a session just ended (e.g. no access); shown on the login page.
  | { status: 'signed-out'; notice?: string }
  // An Owner must pass MFA (authenticator app) before any data loads (PRD §8). `enroll` when
  // they have no verified factor yet, `verify` when they do.
  | { status: 'mfa'; mode: 'enroll' | 'verify'; user: SignedInUser }
  | { status: 'signed-in'; user: SignedInUser };

export type MfaEnrollment = { factorId: string; qrCode: string; secret: string };

export type AuthContextValue = {
  state: AuthState;
  /** Resolves to a message to show, or null once signed in. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Emails a sign-in link to an existing account. Same neutral message either way. */
  sendMagicLink: (email: string) => Promise<string>;
  /** Starts authenticator set-up: the QR code to scan. */
  startMfaEnrollment: () => Promise<MfaEnrollment | string>;
  /** Checks a 6-digit code; resolves to an error message, or null once verified. */
  verifyMfa: (code: string, factorId?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** The signed-in user; only for components rendered behind the sign-in gate. */
export function useSignedInUser(): SignedInUser {
  const { state } = useAuth();
  if (state.status !== 'signed-in') throw new Error('useSignedInUser needs a signed-in user');
  return state.user;
}
