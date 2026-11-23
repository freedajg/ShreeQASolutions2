// Fake Supabase for the browser tests (Phase 1, step 12): no local stack, no real users, no real
// passwords. Every request to the stack is answered here or aborted, so a test can never reach
// a database even if one is running.
// Step 2-c: also the `pipeline` view and change_engagement_status(), following the step 8 rules
// (quoted from the migrations in the step 2-c review notes), with the rows in ./pipelineRows.ts.
// Step 2-d: also the `active_clients` view (read-only), with the rows in ./activeClientRows.ts.
// Step 2-e: also the `team_members` view (read-only): every profile in ACCOUNTS for a caller
// with a role, nothing otherwise (20261003161427_profiles_roles.sql lines 230–235). The own
// profile read (`profiles?id=eq.<own id>`) is unchanged.
// Step 2-f: also `engagement_financials` (./financialsRows.ts), the only source of values. Who
// gets values follows app.can_see_values() (20261003161427_profiles_roles.sql line 84): Owners
// always, Consultants with can_see_values, Marketing never; read policy
// 20261006100000_clients_engagements_rls.sql lines 400–402. Every fake account has
// can_see_values false except CONSULTANT_WITH_VALUES, as the seed has (seed.sql line 362), so
// an Owner sees values only if the app applies the role rule.
// Step 2-g: narrowing options only, all off by default: `pipelineEmpty` / `activeClientsEmpty`
// answer no rows; `pipelineFailsFirst` / `activeClientsFailsFirst` abort the first N reads and
// then answer normally (Try again); `holdReads` makes those reads wait until
// `stack.releaseReads()` (the loading line). A test using `holdReads` must call releaseReads()
// in `finally`.
// Add and Edit (session 2): the five lookup lists, the `clients` table (read), and inserts into
// clients, engagements and engagement_financials, each following the migration rule cited next
// to it. `created_by` is always the caller (rls.sql lines 173–191). Every write attempt is
// recorded in `stack.writes` (aborted ones too, with `aborted: true`). `writeFails` aborts the
// first N writes to a table (network failure). Deletes are refused: there is no delete grant.
// Written rows stay in this test's copy, so the next read shows them.
import type { Page, Route } from '@playwright/test';
import { SAMPLE_ACTIVE_CLIENT_ROWS } from './activeClientRows';
import { SAMPLE_FINANCIALS_ROWS } from './financialsRows';
import {
  CERTIFICATION_TYPE_ROWS,
  LEAD_SOURCE_ROWS,
  PAYMENT_STATUS_ROWS,
  PRIORITY_ROWS,
  STATUS_ROWS,
} from './lookupRows';
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
  // As the seed: false for everyone, Owners included (their flag is ignored by the database).
  can_see_values: false,
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

/**
 * A Consultant an Owner has given values access (like the seed's Demo Consultant 2). Not in
 * ACCOUNTS, so the team list and the screenshots of every other test stay as they are; the fake
 * knows it only in a test signed in as it.
 */
export const CONSULTANT_WITH_VALUES: FakeAccount = {
  ...account('12', 'consultant', 'Demo Consultant 2', 'demo.consultant2@example.com'),
  can_see_values: true,
};

/** app.can_see_values() (20261003161427_profiles_roles.sql lines 75–90). */
export function seesValues(user: FakeAccount | undefined): boolean {
  return (
    !!user &&
    user.active &&
    (user.role === 'owner' || (user.role === 'consultant' && user.can_see_values))
  );
}

/**
 * What a status view's two value columns hold for this caller. The app never selects them
 * (step 2-f); a caller with values access gets a decoy, so a screen that ever read values from
 * a view again would show "₹99" and fail a test. Everyone else gets null, as RLS gives.
 */
const viewValues = (user: FakeAccount | undefined) =>
  seesValues(user)
    ? { contract_value: 99, payment_status: 'Paid' }
    : { contract_value: null, payment_status: null };

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

/**
 * The `team_members` view as a role-holder reads it: every profile, active or not (the view has
 * no active filter), with its six columns, ordered by name as the app's query asks
 * (20261003161427_profiles_roles.sql lines 230–235). `without`: ids to leave out, so a test
 * can show an owner who isn't on the team.
 */
export function teamMemberRows(accounts: readonly FakeAccount[], without: readonly string[] = []) {
  return accounts
    .filter((a) => !without.includes(a.id))
    .map(({ id, full_name, email, role, active }) => ({
      id,
      full_name,
      email,
      role,
      booking_link: null,
      active,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
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

// ---------------------------------------------------------------------------
// Add and Edit (session 2): writes
// ---------------------------------------------------------------------------

export type WriteTable = 'clients' | 'engagements' | 'engagement_financials';

export type FakeWrite = {
  table: WriteTable;
  method: string;
  body: Record<string, unknown>;
  /** true when `writeFails` aborted it (never reached the "database"). */
  aborted: boolean;
};

// Insert grants: rls.sql lines 253–254 (clients), 259–262 (engagements), 270 (financials).
const INSERT_COLUMNS: Record<WriteTable, readonly string[]> = {
  clients: [
    'client_code',
    'name',
    'industry',
    'address',
    'city',
    'state_country',
    'contact_person',
    'designation',
    'email',
    'phone',
    'website',
    'priority',
    'do_not_contact',
  ],
  engagements: [
    'client_id',
    'certification_type',
    'standard_framework',
    'scope',
    'status',
    'initial_engagement_date',
    'completion_date',
    'certificate_number',
    'valid_from',
    'valid_to',
    'certification_body',
    'surveillance_due_date',
    'last_audit_date',
    'next_audit_date',
    'owner_id',
    'lead_source',
    'remarks',
    'last_contacted_on',
    'next_follow_up_on',
    'date_is_estimated',
  ],
  engagement_financials: ['engagement_id', 'contract_value', 'payment_status'],
};

// Length checks: tables.sql lines 45–58 (clients), 76–94 (engagements). char_length counts
// characters, so [...s].length.
const MAX_LENGTH: Record<string, number> = {
  client_code: 50,
  name: 200,
  industry: 200,
  address: 1000,
  city: 200,
  state_country: 200,
  contact_person: 200,
  designation: 200,
  email: 320,
  phone: 50,
  website: 500,
  standard_framework: 200,
  scope: 2000,
  certificate_number: 200,
  certification_body: 200,
  remarks: 5000,
};
// tables.sql line 56, exactly.
const EMAIL_CHECK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const codes = (rows: readonly { code: string }[]) => new Set(rows.map((r) => r.code));
const CERTIFICATION_CODES = codes(CERTIFICATION_TYPE_ROWS);
const STATUS_GROUP = new Map(STATUS_ROWS.map((r) => [r.code, r.status_group]));
const LEAD_SOURCE_CODES = codes(LEAD_SOURCE_ROWS);
const PRIORITY_CODES = codes(PRIORITY_ROWS);
const PAYMENT_STATUS_CODES = codes(PAYMENT_STATUS_ROWS);

const rlsRefusal = (table: string) =>
  pgError('42501', `new row violates row-level security policy for table "${table}"`);
const grantRefusal = (table: string) => pgError('42501', `permission denied for table ${table}`);
const checkRefusal = (table: string) =>
  pgError('23514', `new row for relation "${table}" violates check constraint`);
const fkRefusal = (table: string) =>
  pgError('23503', `insert or update on table "${table}" violates foreign key constraint`);

/** HTTP status PostgREST uses for each error code. */
const HTTP_FOR: Record<string, number> = { '42501': 403, '23505': 409, '23503': 409, '23514': 400 };

/** The first refused column check in `body`, or null (tables.sql length and email checks). */
function checkViolation(table: WriteTable, body: Record<string, unknown>) {
  for (const [column, value] of Object.entries(body)) {
    const max = MAX_LENGTH[column];
    if (max !== undefined && typeof value === 'string' && [...value].length > max) {
      return checkRefusal(table);
    }
  }
  if (table === 'clients') {
    const name = body.name;
    // tables.sql line 48: name not null, btrim(name) <> ''.
    if (typeof name !== 'string' || name.trim() === '') return checkRefusal(table);
    // tables.sql line 56.
    if (body.email != null && !EMAIL_CHECK.test(String(body.email))) return checkRefusal(table);
    // tables.sql lines 45–47: client_code null, or trimmed and non-empty.
    const code = body.client_code;
    if (code != null && (typeof code !== 'string' || code === '' || code !== code.trim())) {
      return checkRefusal(table);
    }
  }
  if (table === 'engagement_financials') {
    // tables.sql line 111: contract_value >= 0.
    const value = body.contract_value;
    if (value != null && !(Number(value) >= 0)) return checkRefusal(table);
  }
  return null;
}

type FakeClientRow = {
  id: string;
  client_code: string | null;
  name: string;
  industry: string | null;
  address: string | null;
  city: string | null;
  state_country: string | null;
  contact_person: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  priority: string | null;
  do_not_contact: boolean;
  created_by: string | null;
  archived_at: string | null;
  updated_at: string;
};

/** One `clients` row per client in the sample view rows (seeded clients: no creator). */
function sampleClientRows(): FakeClientRow[] {
  const byId = new Map<string, FakeClientRow>();
  for (const row of [...SAMPLE_PIPELINE_ROWS, ...SAMPLE_ACTIVE_CLIENT_ROWS]) {
    if (!row.client_id || !row.client_name || byId.has(row.client_id)) continue;
    byId.set(row.client_id, {
      id: row.client_id,
      client_code: row.client_code,
      name: row.client_name,
      industry: row.client_industry,
      address: row.client_address,
      city: row.client_city,
      state_country: row.client_state_country,
      contact_person: row.client_contact_person,
      designation: row.client_designation,
      email: row.client_email,
      phone: row.client_phone,
      website: row.client_website,
      priority: row.client_priority,
      do_not_contact: row.client_do_not_contact ?? false,
      created_by: null,
      archived_at: row.client_archived_at,
      updated_at: '2026-10-01T10:00:00+05:30',
    });
  }
  return [...byId.values()];
}

/** A `pipeline` view row for a newly inserted lead (the view joins the client, status_views.sql). */
function viewRowFor(engagement: Record<string, unknown>, client: FakeClientRow): StatusRow {
  const blank = Object.fromEntries(
    Object.keys(SAMPLE_PIPELINE_ROWS[0]).map((key) => [key, null]),
  ) as StatusRow;
  const status = engagement.status as string;
  return {
    ...blank,
    ...(Object.fromEntries(
      INSERT_COLUMNS.engagements.map((c) => [c, engagement[c] ?? null]),
    ) as Partial<StatusRow>),
    id: engagement.id as string,
    status,
    status_group: STATUS_GROUP.get(status) ?? null,
    status_sort_order: PIPELINE_ORDER[status] ?? null,
    date_is_estimated: (engagement.date_is_estimated as boolean | undefined) ?? false,
    created_by: engagement.created_by as string,
    client_code: client.client_code,
    client_name: client.name,
    client_industry: client.industry,
    client_address: client.address,
    client_city: client.city,
    client_state_country: client.state_country,
    client_contact_person: client.contact_person,
    client_designation: client.designation,
    client_email: client.email,
    client_phone: client.phone,
    client_website: client.website,
    client_priority: client.priority,
    client_do_not_contact: client.do_not_contact,
    client_archived_at: client.archived_at,
  };
}

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
  /** Lets the reads held by `holdReads` answer. Safe to call more than once. */
  releaseReads: () => void;
  /** Every insert attempt (Add and Edit), in order, aborted ones included. */
  writes: FakeWrite[];
};

/** Reads a test can hold back with `holdReads` (step 2-g). */
export type HeldRead = 'pipeline' | 'active_clients';

/**
 * Answers the app's calls to Supabase. `signedInAs` starts the test with a saved session for
 * that account (once per test, so a sign-out isn't undone by a reload). Sign-in accepts the
 * accounts in ACCOUNTS with TEST_PASSWORD. `userMetadata` goes into every session and user the
 * fake Auth hands out (e.g. a self-set `role`, which the app must ignore). `profileFails`
 * aborts every profile request, as if the database were unreachable.
 * The `pipeline` view answers SAMPLE_PIPELINE_ROWS (a fresh copy per test), with the decoy value
 * columns from viewValues. A status change that's allowed updates that copy, so the
 * board's refetch shows it. `pipelineFails` aborts every pipeline read; `statusChange:
 * 'refuse'` refuses every status change, whoever asks.
 * The `active_clients` view answers SAMPLE_ACTIVE_CLIENT_ROWS to an Owner or Consultant (decoy
 * value columns as above) and nothing to Marketing, as RLS does. `activeClientsFails` aborts
 * every active_clients read.
 * `engagement_financials` answers SAMPLE_FINANCIALS_ROWS to a caller with values access and
 * nothing to anyone else (step 2-f). `financialsFails` aborts every financials read.
 * The `team_members` view answers every account in ACCOUNTS to a caller with a role and
 * nothing to a role-less or inactive one (the view's gate). `teamWithout` leaves those ids
 * out (an "Unknown owner"); `teamMembersFails` aborts every team_members read.
 * Step 2-g: `pipelineEmpty` / `activeClientsEmpty` answer `[]`; `pipelineFailsFirst` /
 * `activeClientsFailsFirst` abort only the first N reads; `holdReads` holds those reads until
 * `releaseReads()`.
 */
export async function mockSupabase(
  page: Page,
  options: {
    signedInAs?: FakeAccount;
    rateLimited?: boolean;
    userMetadata?: Record<string, unknown>;
    profileFails?: boolean;
    pipelineFails?: boolean;
    pipelineFailsFirst?: number;
    pipelineEmpty?: boolean;
    statusChange?: 'refuse';
    activeClientsFails?: boolean;
    activeClientsFailsFirst?: number;
    activeClientsEmpty?: boolean;
    holdReads?: HeldRead[];
    teamMembersFails?: boolean;
    teamWithout?: string[];
    financialsFails?: boolean;
    /** Aborts the first N writes to each listed table (network failure), e.g. { engagements: 1 }. */
    writeFails?: Partial<Record<WriteTable, number>>;
  } = {},
): Promise<FakeStack> {
  // Held reads wait on this promise (the test runner's clock, not the page's frozen one).
  let releaseHeld: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    releaseHeld = resolve;
  });
  const stack: FakeStack = {
    calls: [],
    statusChanges: [],
    releaseReads: () => releaseHeld(),
    writes: [],
  };
  const isHeld = (read: HeldRead) => options.holdReads?.includes(read) ?? false;
  let pipelineReads = 0;
  let activeClientsReads = 0;
  const accounts: FakeAccount[] = [
    ...Object.values(ACCOUNTS),
    ...(options.signedInAs?.id === CONSULTANT_WITH_VALUES.id ? [CONSULTANT_WITH_VALUES] : []),
  ];
  let current = options.signedInAs;
  const sessionFor = (user: FakeAccount) => fakeSession(user, options.userMetadata);
  // This test's own copy: a status change here never leaks into another test.
  const pipelineRows: StatusRow[] = SAMPLE_PIPELINE_ROWS.map((row) => ({ ...row }));
  // This test's own copies for Add and Edit: written rows never leak into another test.
  const clientRows: FakeClientRow[] = sampleClientRows();
  const financialsRows = SAMPLE_FINANCIALS_ROWS.map((row) => ({ ...row }));
  // Engagements that aren't on the pipeline view (the active ones): enough to answer
  // client_has_engagements / client_has_lead for the insert rules.
  const otherEngagements = SAMPLE_ACTIVE_CLIENT_ROWS.map((row) => ({
    id: row.id,
    client_id: row.client_id,
    status: row.status,
    owner_id: row.owner_id,
  }));
  const writeAttempts: Partial<Record<WriteTable, number>> = {};
  const allEngagements = () => [...pipelineRows, ...otherEngagements];
  // rls.sql lines 55–68: app.client_has_lead (a lead status = pipeline or paused group, 39–52).
  const clientHasLead = (clientId: unknown) =>
    allEngagements().some((e) => e.client_id === clientId && isLead(e.status));
  // rls.sql lines 72–80: app.client_has_engagements.
  const clientHasEngagements = (clientId: unknown) =>
    allEngagements().some((e) => e.client_id === clientId);
  // rls.sql lines 85–97: app.is_own_new_client.
  const isOwnNewClient = (clientId: unknown) =>
    clientRows.some((c) => c.id === clientId && c.created_by === current?.id) &&
    !clientHasEngagements(clientId);
  // rls.sql lines 114–125: app.owns_engagement.
  const ownsEngagement = (engagementId: unknown) =>
    allEngagements().some((e) => e.id === engagementId && e.owner_id === current?.id);
  // profiles.sql lines 52–62: app.current_app_role() is null for a role-less or inactive user.
  const roleOf = () => (current?.active ? current.role : null);

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
      pipelineReads += 1;
      if (options.pipelineFails) return route.abort('connectionrefused');
      if (pipelineReads <= (options.pipelineFailsFirst ?? 0)) {
        return route.abort('connectionrefused');
      }
      if (isHeld('pipeline')) await held;
      // RLS: a role-less or inactive user reads nothing.
      if (!current?.role || !current.active) return json(route, 200, []);
      if (options.pipelineEmpty) return json(route, 200, []);
      // Array order, not re-sorted: before any change this is exactly SAMPLE_PIPELINE_ROWS.
      const rows = pipelineRows
        .filter((row) => isLead(row.status))
        .map((row) => ({ ...row, ...viewValues(current) }));
      return json(route, 200, rows);
    }

    if (method === 'GET' && url.pathname === '/rest/v1/active_clients') {
      activeClientsReads += 1;
      if (options.activeClientsFails) return route.abort('connectionrefused');
      if (activeClientsReads <= (options.activeClientsFailsFirst ?? 0)) {
        return route.abort('connectionrefused');
      }
      if (isHeld('active_clients')) await held;
      // RLS: a role-less or inactive user reads nothing; Marketing reads leads only, so no
      // active engagement (20261006100000_clients_engagements_rls.sql lines 335–340;
      // supabase/tests/status_views.test.sql lines 417–418).
      if (!current?.role || !current.active || current.role === 'marketing') {
        return json(route, 200, []);
      }
      if (options.activeClientsEmpty) return json(route, 200, []);
      const rows = SAMPLE_ACTIVE_CLIENT_ROWS.map((row) => ({ ...row, ...viewValues(current) }));
      return json(route, 200, rows);
    }

    if (method === 'GET' && url.pathname === '/rest/v1/engagement_financials') {
      if (options.financialsFails) return route.abort('connectionrefused');
      // Read policy: using (app.can_see_values()); anyone else gets no rows, not an error.
      return json(route, 200, seesValues(current) ? financialsRows : []);
    }

    if (method === 'GET' && url.pathname === '/rest/v1/team_members') {
      if (options.teamMembersFails) return route.abort('connectionrefused');
      // Gate: app.current_app_role() is not null (20261003161427_profiles_roles.sql line 235).
      if (!current?.role || !current.active) return json(route, 200, []);
      return json(route, 200, teamMemberRows(accounts, options.teamWithout));
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

    // ---- Add and Edit (session 2) ------------------------------------------------------

    // Lookups. Read: `using ((select app.current_app_role()) is not null)` for all five
    // (lookups.sql lines 156–158, 167–169, 171–173, 182–184, 193–195). The app orders by
    // sort_order; the rows are already in that order.
    const LOOKUPS: Record<string, readonly object[]> = {
      '/rest/v1/certification_types': CERTIFICATION_TYPE_ROWS,
      '/rest/v1/statuses': STATUS_ROWS,
      '/rest/v1/lead_sources': LEAD_SOURCE_ROWS,
      '/rest/v1/priorities': PRIORITY_ROWS,
      '/rest/v1/payment_statuses': PAYMENT_STATUS_ROWS,
    };
    if (method === 'GET' && url.pathname in LOOKUPS) {
      return json(route, 200, roleOf() ? LOOKUPS[url.pathname] : []);
    }

    // clients (read). Owners and Consultants: every client (rls.sql lines 277–279). Marketing:
    // clients with a lead, or one it added that has no engagements yet (rls.sql lines 284–292).
    // Role-less or inactive: nothing (no policy matches). Ordered by name, as the app asks.
    if (method === 'GET' && url.pathname === '/rest/v1/clients') {
      const role = roleOf();
      const rows = clientRows
        .filter(
          (c) =>
            role === 'owner' ||
            role === 'consultant' ||
            (role === 'marketing' &&
              (clientHasLead(c.id) ||
                (c.created_by === current?.id && !clientHasEngagements(c.id)))),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      return json(route, 200, rows);
    }

    // Deletes: nobody has a delete grant (rls.sql lines 242, 247–272: select, insert and update
    // only).
    if (method === 'DELETE' && url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.slice('/rest/v1/'.length);
      return json(route, 403, pgError('42501', `permission denied for table ${table}`));
    }

    // Inserts.
    const writeTable = (['clients', 'engagements', 'engagement_financials'] as const).find(
      (t) => url.pathname === `/rest/v1/${t}`,
    );
    if (method === 'POST' && writeTable) {
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      writeAttempts[writeTable] = (writeAttempts[writeTable] ?? 0) + 1;
      const aborted = writeAttempts[writeTable] <= (options.writeFails?.[writeTable] ?? 0);
      stack.writes.push({ table: writeTable, method, body, aborted });
      if (aborted) return route.abort('connectionrefused');

      const refuse = (error: ReturnType<typeof pgError>) =>
        json(route, HTTP_FOR[error.code] ?? 400, error);
      // .single() asks for one object back (supabase-js sets this Accept header).
      const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      const reply = (row: Record<string, unknown>) => json(route, 201, wantsObject ? row : [row]);
      const role = roleOf();

      // Column grants first: a column outside the insert grant is refused whoever asks.
      if (Object.keys(body).some((c) => !INSERT_COLUMNS[writeTable].includes(c))) {
        return refuse(grantRefusal(writeTable));
      }

      if (writeTable === 'clients') {
        // rls.sql lines 294–299: any role-holder; created_by = auth.uid() (set by the trigger,
        // rls.sql lines 173–191, so it always holds for a logged-in caller).
        if (!role) return refuse(rlsRefusal('clients'));
        const bad = checkViolation('clients', body);
        if (bad) return refuse(bad);
        // tables.sql line 60: priority references priorities(code).
        if (body.priority != null && !PRIORITY_CODES.has(String(body.priority))) {
          return refuse(fkRefusal('clients'));
        }
        // tables.sql line 45: client_code unique.
        if (
          body.client_code != null &&
          clientRows.some((c) => c.client_code === body.client_code)
        ) {
          return refuse(
            pgError(
              '23505',
              'duplicate key value violates unique constraint "clients_client_code_key"',
            ),
          );
        }
        const row: FakeClientRow = {
          id: crypto.randomUUID(),
          client_code: (body.client_code as string | null) ?? null,
          name: body.name as string,
          industry: (body.industry as string | null) ?? null,
          address: (body.address as string | null) ?? null,
          city: (body.city as string | null) ?? null,
          state_country: (body.state_country as string | null) ?? null,
          contact_person: (body.contact_person as string | null) ?? null,
          designation: (body.designation as string | null) ?? null,
          email: (body.email as string | null) ?? null,
          phone: (body.phone as string | null) ?? null,
          website: (body.website as string | null) ?? null,
          priority: (body.priority as string | null) ?? null,
          // tables.sql line 61: not null default false.
          do_not_contact: (body.do_not_contact as boolean | undefined) ?? false,
          created_by: current?.id ?? null, // rls.sql lines 173–191
          archived_at: null,
          updated_at: new Date().toISOString(),
        };
        clientRows.push(row);
        return reply({ id: row.id, client_code: row.client_code });
      }

      if (writeTable === 'engagements') {
        const status = body.status == null ? null : String(body.status);
        // Policies (created_by = auth.uid() holds through the trigger, rls.sql 190–191):
        //   Owner: any (rls.sql lines 342–347).
        //   Consultant: owner_id null or self (rls.sql lines 349–355).
        //   Marketing: owner_id null, a lead status, and the client has a lead or is its own
        //   new client (rls.sql lines 357–365).
        const allowed =
          role === 'owner' ||
          (role === 'consultant' && (body.owner_id == null || body.owner_id === current?.id)) ||
          (role === 'marketing' &&
            body.owner_id == null &&
            isLead(status) &&
            (clientHasLead(body.client_id) || isOwnNewClient(body.client_id)));
        if (!allowed) return refuse(rlsRefusal('engagements'));
        const bad = checkViolation('engagements', body);
        if (bad) return refuse(bad);
        // Foreign keys: client (tables.sql line 74), certification_type (75), status (78),
        // owner (90), lead_source (93).
        const client = clientRows.find((c) => c.id === body.client_id);
        if (
          !client ||
          (body.certification_type != null &&
            !CERTIFICATION_CODES.has(String(body.certification_type))) ||
          (status !== null && !STATUS_GROUP.has(status)) ||
          (body.owner_id != null && !accounts.some((a) => a.id === body.owner_id)) ||
          (body.lead_source != null && !LEAD_SOURCE_CODES.has(String(body.lead_source)))
        ) {
          return refuse(fkRefusal('engagements'));
        }
        const id = crypto.randomUUID();
        const saved = { ...body, id, created_by: current?.id ?? null };
        // A lead appears on the next pipeline read (the view's statuses, status_views.sql);
        // any other status is kept for the insert rules only.
        if (isLead(status)) pipelineRows.push(viewRowFor(saved, client));
        else
          otherEngagements.push({
            id,
            client_id: client.id,
            status,
            owner_id: (body.owner_id as string | null) ?? null,
          });
        return reply({ id });
      }

      // engagement_financials.
      //   Owner: any (rls.sql lines 404–406).
      //   Consultant with values access, for an engagement they own (rls.sql lines 409–415).
      const allowed =
        role === 'owner' ||
        (role === 'consultant' && seesValues(current) && ownsEngagement(body.engagement_id));
      if (!allowed) return refuse(rlsRefusal('engagement_financials'));
      const bad = checkViolation('engagement_financials', body);
      if (bad) return refuse(bad);
      // tables.sql line 110: engagement_id primary key, references engagements.
      if (!allEngagements().some((e) => e.id === body.engagement_id)) {
        return refuse(fkRefusal('engagement_financials'));
      }
      if (financialsRows.some((f) => f.engagement_id === body.engagement_id)) {
        return refuse(
          pgError(
            '23505',
            'duplicate key value violates unique constraint "engagement_financials_pkey"',
          ),
        );
      }
      // tables.sql line 112: payment_status references payment_statuses(code).
      if (body.payment_status != null && !PAYMENT_STATUS_CODES.has(String(body.payment_status))) {
        return refuse(fkRefusal('engagement_financials'));
      }
      financialsRows.push({
        engagement_id: body.engagement_id as string,
        contract_value: (body.contract_value as number | null) ?? null,
        payment_status: (body.payment_status as string | null) ?? null,
      });
      // No .select() on this insert (return=minimal).
      return route.fulfill({ status: 201, headers: CORS });
    }

    return route.abort();
  });

  return stack;
}
