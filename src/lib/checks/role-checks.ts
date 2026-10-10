// Pure parts of the per-role check (Phase 1, step 13): what each demo user should see, how a
// response is judged, the redacted report, and the hidden-password key handling.
// The runner is scripts/check-roles.ts (bun run check:roles). Nothing here touches the network.
//
// Expected counts come from the DUMMY seed (supabase/seed-checks/seed_check.sql,
// supabase/seed-report.md): 21 clients, 23 engagements, 23 financials rows (every one with a
// payment status); pipeline 9 · delivery 3 · active_clients 9 · closed 1 · needs_review 1.
import { DEMO_USERS, type DemoUser, type DemoUserKey } from '../import/seed-rules';

// ---------------------------------------------------------------------------
// Hidden password input: one pure step per chunk of key presses
// ---------------------------------------------------------------------------
export type KeyResult =
  { kind: 'more'; buffer: string } | { kind: 'done'; value: string } | { kind: 'cancel' };

/**
 * Applies one chunk from a raw-mode terminal (a key press or a whole paste) to the buffer.
 * Enter (\r or \n) ends the input, so only the line ending is dropped; spaces are kept.
 * Anything after the Enter in the same chunk is ignored. Enter on an empty buffer is ignored,
 * so a stray line ending left over from the previous paste can't submit an empty password.
 * Backspace removes one character; Ctrl+C cancels; other control keys and escape sequences
 * (arrow keys, bracketed-paste markers) are ignored.
 */
export function applyKeys(buffer: string, chunk: string): KeyResult {
  let chars = Array.from(buffer);
  const input = Array.from(chunk);
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '\x03') return { kind: 'cancel' };
    if (ch === '\r' || ch === '\n') {
      if (chars.length === 0) continue;
      return { kind: 'done', value: chars.join('') };
    }
    if (ch === '\x7f' || ch === '\b') {
      chars = chars.slice(0, -1);
      continue;
    }
    if (ch === '\x1b') {
      // CSI sequence: ESC [ parameters, ended by a byte in @..~ (e.g. ESC[A, ESC[200~).
      if (input[i + 1] === '[') {
        i += 2;
        while (i < input.length && !/[@-~]/.test(input[i])) i++;
      }
      continue;
    }
    if (ch < ' ') continue;
    chars.push(ch);
  }
  return { kind: 'more', buffer: chars.join('') };
}

// ---------------------------------------------------------------------------
// What each user should see
// ---------------------------------------------------------------------------
export const CHECK_OBJECTS = [
  'profiles',
  'team_members',
  'statuses',
  'certification_types',
  'clients',
  'engagements',
  'engagement_financials',
  'pipeline',
  'delivery',
  'active_clients',
  'closed',
  'needs_review',
] as const;
export type CheckObject = (typeof CHECK_OBJECTS)[number];

/** Objects that carry contract_value / payment_status. */
export const VALUE_OBJECTS: ReadonlySet<CheckObject> = new Set([
  'engagement_financials',
  'pipeline',
  'delivery',
  'active_clients',
  'closed',
  'needs_review',
]);

export const PIPELINE_STATUSES: ReadonlySet<string> = new Set(['Lead', 'Proposal', 'On Hold']);

export type CheckUser = DemoUserKey | 'anon';

/** `refused`: an error or 0 rows (anon). `rows`: exactly this many; values on all or none. */
export type Expectation =
  { kind: 'refused' } | { kind: 'rows'; count: number; values: 'all' | 'none' | 'n/a' };

const ALL_ROWS: Record<CheckObject, number> = {
  profiles: 5,
  team_members: 5,
  statuses: 10, // statuses and certification_types come from the lookups migration
  certification_types: 16,
  clients: 21,
  engagements: 23,
  engagement_financials: 23,
  pipeline: 9,
  delivery: 3,
  active_clients: 9,
  closed: 1,
  needs_review: 1,
};

const MARKETING_ROWS: Record<CheckObject, number> = {
  ...ALL_ROWS,
  profiles: 1,
  clients: 9,
  engagements: 9,
  engagement_financials: 0,
  delivery: 0,
  active_clients: 0,
  closed: 0,
  needs_review: 0,
};

function expectedCount(user: DemoUser, object: CheckObject): number {
  if (user.role === 'marketing') return MARKETING_ROWS[object];
  if (user.role === 'consultant') {
    if (object === 'profiles') return 1; // own row only
    if (object === 'engagement_financials' && !user.canSeeValues) return 0;
  }
  return ALL_ROWS[object];
}

export function seesValues(user: DemoUser): boolean {
  return user.role === 'owner' || (user.role === 'consultant' && user.canSeeValues);
}

export function expectationFor(userKey: CheckUser, object: CheckObject): Expectation {
  if (userKey === 'anon') return { kind: 'refused' };
  const user = demoUser(userKey);
  const count = expectedCount(user, object);
  if (!VALUE_OBJECTS.has(object)) return { kind: 'rows', count, values: 'n/a' };
  // Every seeded engagement has a payment status, so "sees values" means on every row.
  return { kind: 'rows', count, values: seesValues(user) ? 'all' : 'none' };
}

export function demoUser(key: DemoUserKey): DemoUser {
  const user = DEMO_USERS.find((u) => u.key === key);
  if (!user) throw new Error(`Unknown demo user ${key}`);
  return user;
}

// ---------------------------------------------------------------------------
// Judging one response
// ---------------------------------------------------------------------------
export type Row = Record<string, unknown>;
export type ApiError = { code: string; status: number };
export type Response = { rows: Row[] | null; error: ApiError | null };

export type Verdict = 'PASS' | 'FAIL';

export type ReportLine = {
  user: string;
  object: string;
  rows: string;
  columns: string; // a column-set label (C1, C2…) or '–'
  values: string;
  rupee: string;
  leak: string;
  result: Verdict;
  note?: string;
};

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/** Rows with a non-empty contract_value or payment_status. */
export function rowsWithValues(rows: Row[]): number {
  return rows.filter((r) => !isEmpty(r.contract_value) || !isEmpty(r.payment_status)).length;
}

export function containsRupee(rows: Row[]): boolean {
  return JSON.stringify(rows).includes('₹');
}

/** The distinct contract values an Owner can read, for the leak scan. */
export function knownValues(financials: Row[]): Set<number> {
  const values = new Set<number>();
  for (const r of financials) {
    const n = toNumber(r.contract_value);
    if (n !== undefined) values.add(n);
  }
  return values;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) return Number(value);
  return undefined;
}

/** True if any field of any row equals a known contract value (as a number or numeric text). */
export function leaksKnownValue(rows: Row[], known: ReadonlySet<number>): boolean {
  const visit = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(visit);
    if (value !== null && typeof value === 'object') return Object.values(value).some(visit);
    const n = toNumber(value);
    return n !== undefined && known.has(n);
  };
  return rows.some(visit);
}

/** Gives each distinct column list a short label, so the report lists names once. */
export class ColumnSets {
  private readonly sets = new Map<string, string>();

  label(rows: Row[]): string {
    if (rows.length === 0) return '(no rows)';
    const key = Object.keys(rows[0]).join(', ');
    let label = this.sets.get(key);
    if (label === undefined) {
      label = `C${this.sets.size + 1}`;
      this.sets.set(key, label);
    }
    return label;
  }

  entries(): { label: string; columns: string; count: number }[] {
    return [...this.sets].map(([columns, label]) => ({
      label,
      columns,
      count: columns.split(', ').length,
    }));
  }
}

export type JudgeOptions = {
  /** Owner 1's contract values; scanned for users without values access. Undefined: not run. */
  known?: ReadonlySet<number>;
};

export function judge(
  userKey: CheckUser,
  object: CheckObject,
  response: Response,
  columnSets: ColumnSets,
  options: JudgeOptions = {},
): ReportLine {
  const user = userKey === 'anon' ? 'anon' : demoUser(userKey).email;
  const expected = expectationFor(userKey, object);
  const base = { user, object };

  if (response.error) {
    const rows = `error ${response.error.code}/${response.error.status}`;
    const ok = expected.kind === 'refused';
    return {
      ...base,
      rows,
      columns: '–',
      values: '–',
      rupee: '–',
      leak: '–',
      result: ok ? 'PASS' : 'FAIL',
      note: ok ? undefined : `expected ${describe(expected)}`,
    };
  }

  const rows = response.rows ?? [];
  const problems: string[] = [];
  const hasValueColumns = VALUE_OBJECTS.has(object);
  const valueRows = hasValueColumns ? rowsWithValues(rows) : 0;
  const rupee = containsRupee(rows);
  if (rupee) problems.push('₹ in response');

  let leak = '–';
  const scan = userKey !== 'anon' && !seesValues(demoUser(userKey));
  if (scan) {
    if (options.known === undefined || options.known.size === 0) {
      leak = 'not run';
      problems.push('no known values to scan for (Owner 1 financials missing)');
    } else if (leaksKnownValue(rows, options.known)) {
      leak = 'YES';
      problems.push('a known contract value appears');
    } else {
      leak = 'no';
    }
  }

  if (expected.kind === 'refused') {
    if (rows.length !== 0) problems.push(`expected an error or 0 rows, got ${rows.length}`);
  } else {
    if (rows.length !== expected.count) {
      problems.push(`expected ${expected.count} rows, got ${rows.length}`);
    }
    if (expected.values === 'all' && valueRows !== rows.length) {
      problems.push(`values on ${valueRows} of ${rows.length} rows, expected all`);
    }
    if (expected.values === 'none' && valueRows !== 0) {
      problems.push(`values on ${valueRows} rows, expected none`);
    }
  }

  if (userKey !== 'anon' && object === 'pipeline') {
    const outside = rows.filter((r) => !PIPELINE_STATUSES.has(String(r.status))).length;
    if (outside > 0) problems.push(`${outside} rows outside Lead / Proposal / On Hold`);
  }

  return {
    ...base,
    rows: String(rows.length),
    columns: columnSets.label(rows),
    values: hasValueColumns ? `${valueRows} rows` : '–',
    rupee: rupee ? 'YES' : 'no',
    leak,
    result: problems.length === 0 ? 'PASS' : 'FAIL',
    note: problems.length === 0 ? undefined : problems.join('; '),
  };
}

function describe(expected: Expectation): string {
  return expected.kind === 'refused' ? 'an error or 0 rows' : `${expected.count} rows`;
}

/** Marketing: the clients it reads are exactly the clients behind its pipeline rows. */
export function judgeMarketingClients(pipeline: Row[], clients: Row[]): ReportLine {
  const behind = new Set(pipeline.map((r) => String(r.client_id)));
  const seen = new Set(clients.map((r) => String(r.id)));
  const extra = [...seen].filter((id) => !behind.has(id)).length;
  const missing = [...behind].filter((id) => !seen.has(id)).length;
  const ok = extra === 0 && missing === 0;
  return {
    user: demoUser('marketing1').email,
    object: 'clients = pipeline clients',
    rows: `${seen.size} / ${behind.size}`,
    columns: '–',
    values: '–',
    rupee: '–',
    leak: '–',
    result: ok ? 'PASS' : 'FAIL',
    note: ok ? undefined : `${extra} extra, ${missing} missing`,
  };
}

/** The signed-in user's own profile has the expected role and values access. */
export function judgeLogin(
  key: DemoUserKey,
  outcome: { error: ApiError | null; profile: Row | null },
): ReportLine {
  const user = demoUser(key);
  const line = {
    user: user.email,
    object: 'login',
    columns: '–',
    values: '–',
    rupee: '–',
    leak: '–',
  };
  if (outcome.error) {
    return {
      ...line,
      rows: `error ${outcome.error.code}/${outcome.error.status}`,
      result: 'FAIL',
      note:
        outcome.error.status === 429
          ? 'Rate limited by local Auth; wait 5 minutes and run again. Data checks skipped'
          : 'data checks skipped',
    };
  }
  const p = outcome.profile;
  const ok =
    p !== null &&
    p.id === user.id &&
    p.role === user.role &&
    p.can_see_values === user.canSeeValues &&
    p.active === true;
  return {
    ...line,
    rows: ok ? 'signed in' : 'signed in, profile wrong',
    result: ok ? 'PASS' : 'FAIL',
    note: ok ? undefined : 'own profile missing or role / values access / active not as seeded',
  };
}

/** Sign-up must be refused with exactly signup_disabled; any other outcome fails. */
export function judgeSignup(error: ApiError | null): ReportLine {
  const ok = error !== null && error.code === 'signup_disabled';
  return {
    user: '(sign-up)',
    object: 'signUp step13-signup-…@example.com',
    rows: error ? `error ${error.code}/${error.status}` : 'ACCEPTED',
    columns: '–',
    values: '–',
    rupee: '–',
    leak: '–',
    result: ok ? 'PASS' : 'FAIL',
    note: ok
      ? undefined
      : error
        ? 'expected signup_disabled'
        : 'a new login was created; clean up with supabase db reset, db:seed, seed:passwords (with approval)',
  };
}

export function judgeProfileCount(before: number | null, after: number | null): ReportLine {
  const ok = before !== null && after !== null && before === after && before === 5;
  return {
    user: '(sign-up)',
    object: 'profiles before / after (as Owner 1)',
    rows: `${before ?? '?'} / ${after ?? '?'}`,
    columns: '–',
    values: '–',
    rupee: '–',
    leak: '–',
    result: ok ? 'PASS' : 'FAIL',
    note: ok ? undefined : 'expected 5 / 5',
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
export type ReportMeta = { when: string; host: string; commit: string };

function cell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

export function renderReport(
  meta: ReportMeta,
  lines: ReportLine[],
  columnSets: ColumnSets,
): string {
  const pass = lines.filter((l) => l.result === 'PASS').length;
  const fail = lines.length - pass;
  const out = [
    `# Step 13 role check: ${meta.when}`,
    '',
    `Stack: local (${meta.host}) · Seed: DUMMY (21 clients / 23 engagements) · Run: check:roles @ ${meta.commit}`,
    '',
    '| User | Object | Rows | Columns | Values shown | ₹ | Known value leak | Result | Note |',
    '|---|---|---|---|---|---|---|---|---|',
    ...lines.map(
      (l) =>
        `| ${[
          l.user,
          l.object,
          l.rows,
          l.columns,
          l.values,
          l.rupee,
          l.leak,
          l.result,
          l.note ?? '',
        ]
          .map(cell)
          .join(' | ')} |`,
    ),
    '',
    `**Total: ${pass} PASS, ${fail} FAIL**`,
    '',
  ];
  const sets = columnSets.entries();
  if (sets.length > 0) {
    out.push('## Column sets', '');
    for (const s of sets) out.push(`- **${s.label}** (${s.count}): ${s.columns}`);
    out.push('');
  }
  return out.join('\n');
}

/**
 * Reasons the text must not be shown or saved: anything shaped like a JWT or Supabase key, or
 * any of the given secrets (passwords, the anon key). Empty when the text is safe.
 */
export function findSecrets(text: string, secrets: readonly string[]): string[] {
  const reasons: string[] = [];
  if (/eyJ[A-Za-z0-9_-]{10,}/.test(text)) reasons.push('a JWT');
  if (/sb_(secret|publishable)_/.test(text)) reasons.push('a Supabase key');
  if (secrets.some((s) => s.length > 0 && text.includes(s))) reasons.push('a supplied secret');
  return reasons;
}
