// Who may use the app after a successful sign-in, and the sign-in messages (Phase 1, step 12).
// The role comes only from the user's own `profiles` row, read through RLS ("own row while
// active"); never from the login token or anything else the browser holds (SECURITY.md A3).

export type AppRole = 'owner' | 'consultant' | 'marketing';

/** The columns the app reads from `profiles` after sign-in. */
export type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  can_see_values: boolean | null;
  active: boolean | null;
};

export type SignedInUser = {
  id: string;
  fullName: string;
  role: AppRole;
  // For display only (2-f); the database decides what values each user receives. Same rule as
  // app.can_see_values() (20261003161427_profiles_roles.sql line 84): Owners always (their
  // profile flag is ignored, and is false in the seed), Consultants only with the flag,
  // Marketing never.
  canSeeValues: boolean;
};

export type Access = { ok: true; user: SignedInUser } | { ok: false };

const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Owner',
  consultant: 'Consultant',
  marketing: 'Marketing',
};

/** The role as the header shows it (step 2-e); the role itself comes from the profiles row. */
export const roleLabel = (role: AppRole): string => ROLE_LABELS[role];

export const PROFILE_COLUMNS = 'id, full_name, role, can_see_values, active';

const ROLES: readonly string[] = ['owner', 'consultant', 'marketing'] satisfies AppRole[];

/** No row (inactive, or no profile), no role or an unknown role: no access. */
export function decideAccess(row: ProfileRow | null | undefined): Access {
  if (!row || row.active !== true || row.role === null || !ROLES.includes(row.role)) {
    return { ok: false };
  }
  const role = row.role as AppRole;
  return {
    ok: true,
    user: {
      id: row.id,
      fullName: row.full_name?.trim() || 'Signed-in user',
      role,
      canSeeValues: role === 'owner' || (role === 'consultant' && row.can_see_values === true),
    },
  };
}

// One text for a wrong password and an unknown email, so the page never reveals whether an
// email has an account.
export const MESSAGES = {
  invalid: 'Email or password is incorrect.',
  empty: 'Enter your email and password.',
  noAccess: "Your account doesn't have access yet. Please contact an Owner.",
  tooMany: 'Too many attempts. Wait a few minutes and try again.',
  connection: "Can't reach the server. Check that the local database is running.",
  generic: "Sign-in didn't work. Please try again.",
} as const;

// Also used by the data layer's error mapping (src/lib/data/errors.ts).
export const NETWORK_FAILURE = /failed to fetch|networkerror|load failed|network request failed/i;

/** Maps an error from supabase-js (or a thrown fetch error) to a message. Never echoes input. */
export function loginErrorMessage(error: unknown): string {
  if (error === null || typeof error !== 'object') return MESSAGES.generic;
  const { code, status, name, message } = error as {
    code?: unknown;
    status?: unknown;
    name?: unknown;
    message?: unknown;
  };

  // A banned (deactivated) login gets the wrong-password text: Auth may check the ban before
  // the password, so anything more specific could confirm that the email exists.
  if (code === 'invalid_credentials' || code === 'user_banned') return MESSAGES.invalid;
  if (code === 'over_request_rate_limit' || status === 429) return MESSAGES.tooMany;
  if (
    name === 'AuthRetryableFetchError' ||
    (typeof message === 'string' && NETWORK_FAILURE.test(message))
  ) {
    return MESSAGES.connection;
  }
  return MESSAGES.generic;
}
