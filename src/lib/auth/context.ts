import { createContext, useContext } from 'react';
import type { SignedInUser } from './access';

export type AuthState =
  | { status: 'loading' }
  | { status: 'not-configured'; problem: string }
  // `notice` explains why a session just ended (e.g. no access); shown on the login page.
  | { status: 'signed-out'; notice?: string }
  | { status: 'signed-in'; user: SignedInUser };

export type AuthContextValue = {
  state: AuthState;
  /** Resolves to a message to show, or null once signed in. */
  signIn: (email: string, password: string) => Promise<string | null>;
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
