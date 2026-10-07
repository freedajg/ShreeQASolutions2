// Fake Supabase for the browser tests (Phase 1, step 12): no local stack, no real users, no real
// passwords. Every request to the stack is answered here or aborted, so a test can never reach
// a database even if one is running.
import type { Page, Route } from '@playwright/test';

export const STACK_URL = 'http://127.0.0.1:54321';
const STACK_PATTERN = /^http:\/\/(127\.0\.0\.1|localhost):54321\//;
const AUTH_STORAGE_KEY = 'drishti-auth'; // src/lib/supabase/config.ts
const SEEDED_FLAG = 'e2e-session-seeded';

// The only password the fake Auth accepts. Not a real password anywhere.
export const TEST_PASSWORD = 'not-a-real-password';

// Expires 01-Jan-2100, so no test (frozen clock or not) ever triggers a token refresh.
const EXPIRES_AT = 4102444800;

/** Unsigned JWT-shaped token, built at run time (nothing key-shaped in the repo). */
export function fakeJwt(payload: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}.fake-signature`;
}

// Passes src/lib/supabase/config.ts (an anon JWT); the fake stack ignores it.
export const TEST_ANON_KEY = fakeJwt({ iss: 'supabase-demo', role: 'anon', exp: EXPIRES_AT });

export type FakeAccount = {
  id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'consultant' | 'marketing' | null;
  can_see_values: boolean;
  // false: RLS hides the row from its own user ("own row while active"), so no row comes back.
  active: boolean;
};

const account = (n: string, role: FakeAccount['role'], name: string, email: string) => ({
  id: `e2e00000-0000-4000-8000-0000000000${n}`,
  email,
  full_name: name,
  role,
  can_see_values: role === 'owner',
  active: true,
});

export const ACCOUNTS = {
  owner: account('01', 'owner', 'Demo Owner 1', 'demo.owner1@example.com'),
  consultant: account('11', 'consultant', 'Demo Consultant 1', 'demo.consultant1@example.com'),
  marketing: account('21', 'marketing', 'Demo Marketing 1', 'demo.marketing1@example.com'),
  roleless: account('31', null, 'Demo Roleless', 'demo.roleless@example.com'),
  inactive: {
    ...account('41', 'consultant', 'Demo Inactive', 'demo.inactive@example.com'),
    active: false,
  },
} satisfies Record<string, FakeAccount>;

// `userMetadata` is what a user can edit about themselves; it appears in the token and the user
// object, as with real Supabase. The app must ignore it for roles.
function fakeSession(user: FakeAccount, userMetadata: Record<string, unknown> = {}) {
  return {
    access_token: fakeJwt({
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      aud: 'authenticated',
      exp: EXPIRES_AT,
      user_metadata: userMetadata,
    }),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: EXPIRES_AT,
    refresh_token: 'fake-refresh-token',
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: userMetadata,
      created_at: '2026-10-01T00:00:00Z',
    },
  };
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type FakeStack = {
  /** "METHOD /path" of every request the app made to the stack, in order. */
  calls: string[];
};

/**
 * Answers the app's calls to Supabase. `signedInAs` starts the test with a saved session for
 * that account (once per test, so a sign-out isn't undone by a reload). Sign-in accepts the
 * accounts in ACCOUNTS with TEST_PASSWORD. `userMetadata` goes into every session and user the
 * fake Auth hands out (e.g. a self-set `role`, which the app must ignore). `profileFails`
 * aborts every profile request, as if the database were unreachable.
 */
export async function mockSupabase(
  page: Page,
  options: {
    signedInAs?: FakeAccount;
    rateLimited?: boolean;
    userMetadata?: Record<string, unknown>;
    profileFails?: boolean;
  } = {},
): Promise<FakeStack> {
  const stack: FakeStack = { calls: [] };
  const accounts: FakeAccount[] = Object.values(ACCOUNTS);
  let current = options.signedInAs;
  const sessionFor = (user: FakeAccount) => fakeSession(user, options.userMetadata);

  if (options.signedInAs) {
    await page.addInitScript(
      ({ key, flag, session }) => {
        if (sessionStorage.getItem(flag)) return;
        sessionStorage.setItem(flag, '1');
        localStorage.setItem(key, JSON.stringify(session));
      },
      { key: AUTH_STORAGE_KEY, flag: SEEDED_FLAG, session: sessionFor(options.signedInAs) },
    );
  }

  await page.route(STACK_PATTERN, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    stack.calls.push(`${method} ${url.pathname}`);

    if (method === 'POST' && url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'password') {
        if (options.rateLimited) {
          return json(route, 429, { error_code: 'over_request_rate_limit', msg: 'Rate limit' });
        }
        const body = (request.postDataJSON() ?? {}) as { email?: string; password?: string };
        const match = accounts.find((a) => a.email === body.email);
        if (!match || body.password !== TEST_PASSWORD) {
          return json(route, 400, {
            error_code: 'invalid_credentials',
            msg: 'Invalid login credentials',
          });
        }
        current = match;
        return json(route, 200, sessionFor(match));
      }
      if (current) return json(route, 200, sessionFor(current)); // refresh_token
      return json(route, 400, { error_code: 'refresh_token_not_found', msg: 'Invalid token' });
    }

    if (method === 'POST' && url.pathname === '/auth/v1/logout') {
      current = undefined;
      return route.fulfill({ status: 204, headers: CORS });
    }

    if (method === 'GET' && url.pathname === '/auth/v1/user' && current) {
      return json(route, 200, sessionFor(current).user);
    }

    if (method === 'GET' && url.pathname === '/rest/v1/profiles') {
      if (options.profileFails) return route.abort('connectionrefused');
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      const row = accounts.find((a) => a.id === id && a.active);
      const rows = row
        ? [
            {
              id: row.id,
              full_name: row.full_name,
              role: row.role,
              can_see_values: row.can_see_values,
              active: row.active,
            },
          ]
        : [];
      return json(route, 200, rows);
    }

    return route.abort();
  });

  return stack;
}
