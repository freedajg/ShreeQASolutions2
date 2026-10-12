// Fake Supabase for the browser tests (Phase 1, step 12): no local stack, no real users, no real
// passwords. Every request to the stack is answered here or aborted, so a test can never reach
// a database even if one is running.
// Step 2-c: also the `pipeline` view and change_engagement_status(), following the step 8 rules
// (quoted from the migrations in the step 2-c review notes), with the rows in ./pipelineRows.ts.
import type { Page, Route } from '@playwright/test';
import { SAMPLE_PIPELINE_ROWS } from './pipelineRows';

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

// The 10 statuses (20261003180745_lookups.sql) and the pipeline view's sort order for its three.
const STATUSES = new Set([
  'Lead',
  'Proposal',
  'On Hold',
  'In Progress',
  'Implemented',
  'Audit Completed',
  'Certified',
  'Renewal Due',
  'Completed',
  'Closed',
]);
const PIPELINE_ORDER: Record<string, number> = { Lead: 1, Proposal: 2, 'On Hold': 9 };
const isLead = (status: string | null) => status !== null && status in PIPELINE_ORDER;

type StatusRow = (typeof SAMPLE_PIPELINE_ROWS)[number];

/** PostgREST's error body; the app only shows its own text for these (src/lib/data/errors.ts). */
const pgError = (code: string, message: string) => ({ code, message, details: null, hint: null });

/**
 * change_engagement_status() for one caller: null when allowed, otherwise the database's error.
 * Owner: any row. Consultant: rows they own. Marketing: rows it created, and only to a lead
 * status. A row the caller may not change gets the same answer as a missing one.
 */
function statusChangeRefusal(
  user: FakeAccount | undefined,
  row: StatusRow | undefined,
  newStatus: string,
) {
  if (!user?.role || !user.active) {
    return pgError('42501', "You don't have access to change statuses");
  }
  if (!STATUSES.has(newStatus)) return pgError('22023', 'Unknown status');
  const mayChange =
    row !== undefined &&
    (user.role === 'owner' ||
      (user.role === 'consultant' && row.owner_id === user.id) ||
      (user.role === 'marketing' && row.created_by === user.id && isLead(row.status)));
  if (!row || !mayChange) {
    return pgError('42501', "Engagement not found, or you can't change its status");
  }
  if (row.status === newStatus) {
    return pgError('22023', 'The engagement already has that status');
  }
  if (user.role === 'marketing' && !isLead(newStatus)) {
    return pgError('42501', 'new row violates row-level security policy for table "engagements"');
  }
  return null;
}

export type FakeStack = {
  /** "METHOD /path" of every request the app made to the stack, in order. */
  calls: string[];
  /** Every change_engagement_status() call, allowed or not, in order. */
  statusChanges: { engagementId: string; newStatus: string }[];
};

/**
 * Answers the app's calls to Supabase. `signedInAs` starts the test with a saved session for
 * that account (once per test, so a sign-out isn't undone by a reload). Sign-in accepts the
 * accounts in ACCOUNTS with TEST_PASSWORD. `userMetadata` goes into every session and user the
 * fake Auth hands out (e.g. a self-set `role`, which the app must ignore). `profileFails`
 * aborts every profile request, as if the database were unreachable.
 * The `pipeline` view answers SAMPLE_PIPELINE_ROWS (a fresh copy per test), without values for
 * an account without values access. A status change that's allowed updates that copy, so the
 * board's refetch shows it. `pipelineFails` aborts every pipeline read; `statusChange:
 * 'refuse'` refuses every status change, whoever asks.
 */
export async function mockSupabase(
  page: Page,
  options: {
    signedInAs?: FakeAccount;
    rateLimited?: boolean;
    userMetadata?: Record<string, unknown>;
    profileFails?: boolean;
    pipelineFails?: boolean;
    statusChange?: 'refuse';
  } = {},
): Promise<FakeStack> {
  const stack: FakeStack = { calls: [], statusChanges: [] };
  const accounts: FakeAccount[] = Object.values(ACCOUNTS);
  let current = options.signedInAs;
  const sessionFor = (user: FakeAccount) => fakeSession(user, options.userMetadata);
  // This test's own copy: a status change here never leaks into another test.
  const pipelineRows: StatusRow[] = SAMPLE_PIPELINE_ROWS.map((row) => ({ ...row }));

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

    if (method === 'GET' && url.pathname === '/rest/v1/pipeline') {
      if (options.pipelineFails) return route.abort('connectionrefused');
      // RLS: a role-less or inactive user reads nothing.
      if (!current?.role || !current.active) return json(route, 200, []);
      const seesValues = current.can_see_values;
      // Array order, not re-sorted: before any change this is exactly SAMPLE_PIPELINE_ROWS.
      const rows = pipelineRows
        .filter((row) => isLead(row.status))
        .map((row) => (seesValues ? row : { ...row, contract_value: null, payment_status: null }));
      return json(route, 200, rows);
    }

    if (method === 'POST' && url.pathname === '/rest/v1/rpc/change_engagement_status') {
      const body = (request.postDataJSON() ?? {}) as {
        p_engagement_id?: string;
        p_new_status?: string;
      };
      const engagementId = body.p_engagement_id ?? '';
      const newStatus = body.p_new_status ?? '';
      stack.statusChanges.push({ engagementId, newStatus });
      const row = pipelineRows.find((r) => r.id === engagementId);
      const refusal =
        options.statusChange === 'refuse'
          ? pgError('42501', "Engagement not found, or you can't change its status")
          : statusChangeRefusal(current, row, newStatus);
      if (refusal) return json(route, refusal.code === '22023' ? 400 : 403, refusal);
      if (!row) return json(route, 500, pgError('XX000', 'fake stack: allowed change, no row'));
      // Allowed: the next pipeline read shows the new status.
      row.status = newStatus;
      row.status_sort_order = PIPELINE_ORDER[newStatus] ?? null;
      return route.fulfill({ status: 204, headers: CORS });
    }

    return route.abort();
  });

  return stack;
}
