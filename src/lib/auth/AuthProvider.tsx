// Login state for the whole app (Phase 1, step 12): the saved session, the user's own profile
// row and the sign-in / sign-out actions. Email and password only, against the local stack.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, supabaseConfig } from '../supabase/client';
import { MESSAGES, PROFILE_COLUMNS, decideAccess, loginErrorMessage, type Access } from './access';
import { AuthContext, type AuthContextValue, type AuthState } from './context';

// If the first sign-in check hasn't finished by then, show the login page instead of "Loading…".
const STARTUP_GUARD_MS = 15_000;

/** Ends the session on the server (all devices); if that fails, at least in this browser. */
async function endSession(client: SupabaseClient): Promise<void> {
  try {
    const { error } = await client.auth.signOut();
    if (!error) return;
  } catch {
    // fall through to the local sign-out
  }
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // Nothing more to try; the login page is shown either way.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    supabaseConfig.ok
      ? { status: 'loading' }
      : { status: 'not-configured', problem: supabaseConfig.problem },
  );
  // Set while signIn() handles its own profile check, so the auth listener doesn't repeat it.
  const signingIn = useRef(false);
  const signedInUserId = useRef<string | null>(null);

  // Reads the user's own profile row (RLS: own row while active) and decides access.
  // Returns the message to show, or null when signed in. Never throws: any failure of the
  // check ends the session and shows the connection message.
  const resolveSession = useCallback(
    async (client: SupabaseClient, userId: string): Promise<string | null> => {
      let access: Access | null = null;
      try {
        const { data, error } = await client
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', userId)
          // Fail fast: no silent 1 s / 2 s / 4 s retries while the user waits on "Loading…".
          .retry(false)
          .maybeSingle();
        if (!error) access = decideAccess(data);
      } catch {
        access = null;
      }
      if (access?.ok) {
        signedInUserId.current = access.user.id;
        // Owners need a second factor (aal2) before the database gives them any data.
        if (access.user.role === 'owner') {
          const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aal?.currentLevel !== 'aal2') {
            setState({
              status: 'mfa',
              mode: aal?.nextLevel === 'aal2' ? 'verify' : 'enroll',
              user: access.user,
            });
            return null;
          }
        }
        setState({ status: 'signed-in', user: access.user });
        return null;
      }
      const notice = access ? MESSAGES.noAccess : MESSAGES.connection;
      signedInUserId.current = null;
      await endSession(client);
      setState({ status: 'signed-out', notice });
      return notice;
    },
    [],
  );

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!session) {
        // Keep a notice set by resolveSession (e.g. no access) when the session ends.
        signedInUserId.current = null;
        setState((prev) => (prev.status === 'signed-out' ? prev : { status: 'signed-out' }));
        return;
      }
      const isNewUser = session.user.id !== signedInUserId.current;
      if (
        event === 'INITIAL_SESSION' ||
        (event === 'SIGNED_IN' && isNewUser && !signingIn.current)
      ) {
        // Started, not awaited: supabase-js wants this callback to return at once, and no
        // timer is involved. The outcome (or any error) is handled in the promise itself.
        resolveSession(client, session.user.id).catch(() => {
          signedInUserId.current = null;
          setState({ status: 'signed-out', notice: MESSAGES.connection });
        });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [resolveSession]);

  // Start-up guard: never leave a user on "Loading…" indefinitely (e.g. a request that hangs).
  useEffect(() => {
    const guard = setTimeout(() => {
      setState((prev) =>
        prev.status === 'loading' ? { status: 'signed-out', notice: MESSAGES.connection } : prev,
      );
    }, STARTUP_GUARD_MS);
    return () => clearTimeout(guard);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (!supabase) return MESSAGES.generic;
      const cleanEmail = email.trim();
      if (cleanEmail === '' || password === '') return MESSAGES.empty;
      signingIn.current = true;
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error || !data.session) return loginErrorMessage(error);
        return await resolveSession(supabase, data.session.user.id);
      } catch (error) {
        return loginErrorMessage(error);
      } finally {
        signingIn.current = false;
      }
    },
    [resolveSession],
  );

  const sendMagicLink = useCallback(async (email: string): Promise<string> => {
    const neutral = 'If that email has a Drishti account, a sign-in link is on its way.';
    const cleanEmail = email.trim();
    if (!supabase) return MESSAGES.generic;
    if (cleanEmail === '') return 'Enter your email.';
    try {
      // shouldCreateUser: false keeps sign-up closed (invite-only, PRD FR-1).
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
      });
      if (error && (error.status === 429 || error.code === 'over_email_send_rate_limit')) {
        return MESSAGES.tooMany;
      }
    } catch {
      return MESSAGES.connection;
    }
    return neutral;
  }, []);

  const startMfaEnrollment = useCallback(async () => {
    if (!supabase) return MESSAGES.generic;
    // Remove any half-finished factor from an earlier attempt, then start a fresh one.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator app',
    });
    if (error || !data) return "Couldn't start authenticator set-up. Please try again.";
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  }, []);

  const verifyMfa = useCallback(
    async (code: string, factorId?: string): Promise<string | null> => {
      if (!supabase) return MESSAGES.generic;
      const clean = code.replace(/\s/g, '');
      if (!/^\d{6}$/.test(clean)) return 'Enter the 6-digit code from your authenticator app.';
      let id = factorId;
      if (!id) {
        const { data } = await supabase.auth.mfa.listFactors();
        id = data?.totp.find((f) => f.status === 'verified')?.id;
      }
      if (!id) return "Couldn't find your authenticator. Set it up again.";
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code: clean });
      if (error) return 'That code is not right, or it expired. Try the current code.';
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return MESSAGES.generic;
      return resolveSession(supabase, session.session.user.id);
    },
    [resolveSession],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    signedInUserId.current = null;
    await endSession(supabase);
    setState({ status: 'signed-out' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, sendMagicLink, startMfaEnrollment, verifyMfa, signOut }),
    [state, signIn, sendMagicLink, startMfaEnrollment, verifyMfa, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
