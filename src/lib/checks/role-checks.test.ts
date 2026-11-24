import { describe, expect, it } from 'vitest';
import {
  CHECK_OBJECTS,
  ColumnSets,
  applyKeys,
  expectationFor,
  findSecrets,
  judge,
  judgeLogin,
  judgeMarketingClients,
  judgeProfileCount,
  judgeSignup,
  knownValues,
  leaksKnownValue,
  renderReport,
  type Row,
} from './role-checks';

// Feeds chunks one by one, as a raw-mode terminal would.
function typeChunks(...chunks: string[]) {
  let buffer = '';
  for (const chunk of chunks) {
    const result = applyKeys(buffer, chunk);
    if (result.kind !== 'more') return result;
    buffer = result.buffer;
  }
  return { kind: 'more' as const, buffer };
}

const rows = (n: number, make: (i: number) => Row = (i) => ({ id: `r${i}` })): Row[] =>
  Array.from({ length: n }, (_, i) => make(i));

const withValues = (n: number, extra: Row = {}): Row[] =>
  rows(n, (i) => ({
    id: `e${i}`,
    client_id: `c${i}`,
    status: 'Lead',
    contract_value: 850000,
    payment_status: 'Paid',
    ...extra,
  }));

const withoutValues = (n: number, extra: Row = {}): Row[] =>
  rows(n, (i) => ({
    id: `e${i}`,
    client_id: `c${i}`,
    status: 'Lead',
    contract_value: null,
    payment_status: null,
    ...extra,
  }));

describe('applyKeys (hidden password input)', () => {
  it('ends on Enter as \\r or \\n and drops only the line ending, keeping spaces', () => {
    expect(typeChunks('a', 'b', '\r')).toEqual({ kind: 'done', value: 'ab' });
    expect(typeChunks('ab\n')).toEqual({ kind: 'done', value: 'ab' });
    expect(typeChunks(' pass word \r\n')).toEqual({ kind: 'done', value: ' pass word ' });
  });

  it('takes a multi-character paste in one chunk, or split across chunks', () => {
    expect(typeChunks('Xy7#-_=+abc')).toEqual({ kind: 'more', buffer: 'Xy7#-_=+abc' });
    expect(typeChunks('Xy7#', '-_=+', 'abc\r')).toEqual({ kind: 'done', value: 'Xy7#-_=+abc' });
  });

  it('ignores anything after Enter in the same chunk', () => {
    expect(typeChunks('abc\r\nnext')).toEqual({ kind: 'done', value: 'abc' });
  });

  it('ignores Enter on an empty buffer (a stray line ending from the last paste)', () => {
    expect(typeChunks('\n', '\r\n', 'abc', '\r')).toEqual({ kind: 'done', value: 'abc' });
  });

  it('handles Backspace (DEL and BS), including past the start', () => {
    expect(typeChunks('abc', '\x7f', '\b', 'd\r')).toEqual({ kind: 'done', value: 'ad' });
    expect(typeChunks('\x7f\x7fa\r')).toEqual({ kind: 'done', value: 'a' });
  });

  it('cancels on Ctrl+C, even mid-paste', () => {
    expect(typeChunks('abc', '\x03')).toEqual({ kind: 'cancel' });
    expect(typeChunks('ab\x03cd\r')).toEqual({ kind: 'cancel' });
  });

  it('ignores arrow keys, bracketed-paste markers and other control keys', () => {
    expect(typeChunks('a\x1b[Ab\x1b[200~cd\x1b[201~\t\x04\r')).toEqual({
      kind: 'done',
      value: 'abcd',
    });
  });

  it('keeps non-ASCII characters whole', () => {
    expect(typeChunks('₹é\x7f\r')).toEqual({ kind: 'done', value: '₹' });
  });
});

describe('expectationFor', () => {
  it('expects anon to be refused everywhere', () => {
    for (const object of CHECK_OBJECTS) {
      expect(expectationFor('anon', object)).toEqual({ kind: 'refused' });
    }
  });

  it('matches the step 13 plan table', () => {
    expect(expectationFor('owner1', 'engagement_financials')).toEqual({
      kind: 'rows',
      count: 23,
      values: 'all',
    });
    expect(expectationFor('owner2', 'profiles')).toEqual({ kind: 'rows', count: 5, values: 'n/a' });
    expect(expectationFor('consultant1', 'engagement_financials')).toEqual({
      kind: 'rows',
      count: 0,
      values: 'none',
    });
    expect(expectationFor('consultant1', 'pipeline')).toEqual({
      kind: 'rows',
      count: 9,
      values: 'none',
    });
    expect(expectationFor('consultant1', 'profiles')).toEqual({
      kind: 'rows',
      count: 1,
      values: 'n/a',
    });
    expect(expectationFor('consultant2', 'engagement_financials')).toEqual({
      kind: 'rows',
      count: 23,
      values: 'all',
    });
    expect(expectationFor('marketing1', 'clients')).toEqual({
      kind: 'rows',
      count: 9,
      values: 'n/a',
    });
    expect(expectationFor('marketing1', 'pipeline')).toEqual({
      kind: 'rows',
      count: 9,
      values: 'none',
    });
    expect(expectationFor('marketing1', 'delivery')).toEqual({
      kind: 'rows',
      count: 0,
      values: 'none',
    });
    expect(expectationFor('marketing1', 'team_members')).toEqual({
      kind: 'rows',
      count: 5,
      values: 'n/a',
    });
  });
});

describe('judge', () => {
  const known = new Set([850000, 420000]);

  it('passes anon on an error or on 0 rows, and fails it on any row', () => {
    const sets = new ColumnSets();
    expect(
      judge('anon', 'clients', { rows: null, error: { code: '42501', status: 401 } }, sets).result,
    ).toBe('PASS');
    expect(judge('anon', 'clients', { rows: [], error: null }, sets).result).toBe('PASS');
    expect(judge('anon', 'clients', { rows: rows(1), error: null }, sets).result).toBe('FAIL');
  });

  it('fails a signed-in user on an error or a wrong row count', () => {
    const sets = new ColumnSets();
    const err = judge(
      'owner1',
      'clients',
      { rows: null, error: { code: '42501', status: 403 } },
      sets,
    );
    expect(err).toMatchObject({ result: 'FAIL', rows: 'error 42501/403' });
    expect(judge('owner1', 'clients', { rows: rows(20), error: null }, sets).result).toBe('FAIL');
    expect(judge('owner1', 'clients', { rows: rows(21), error: null }, sets).result).toBe('PASS');
  });

  it('passes an Owner with values on every row, fails one with a missing value', () => {
    const sets = new ColumnSets();
    expect(judge('owner1', 'pipeline', { rows: withValues(9), error: null }, sets).result).toBe(
      'PASS',
    );
    const gap = [...withValues(8), ...withoutValues(1)];
    expect(judge('owner1', 'pipeline', { rows: gap, error: null }, sets).result).toBe('FAIL');
  });

  it('passes Consultant 1 and Marketing only when every value is empty and nothing leaks', () => {
    const sets = new ColumnSets();
    const clean = judge('marketing1', 'pipeline', { rows: withoutValues(9), error: null }, sets, {
      known,
    });
    expect(clean).toMatchObject({ result: 'PASS', leak: 'no', rupee: 'no', values: '0 rows' });
    const shown = judge('consultant1', 'pipeline', { rows: withValues(9), error: null }, sets, {
      known,
    });
    expect(shown.result).toBe('FAIL');
  });

  it('fails on a known contract value hidden in another field, or on ₹', () => {
    const sets = new ColumnSets();
    const leaked = withoutValues(9, { remarks: null, note: '850000' });
    expect(
      judge('marketing1', 'pipeline', { rows: leaked, error: null }, sets, { known }),
    ).toMatchObject({
      result: 'FAIL',
      leak: 'YES',
    });
    const rupee = withoutValues(9, { remarks: 'Quoted ₹4.5 L' });
    expect(
      judge('consultant1', 'pipeline', { rows: rupee, error: null }, sets, { known }),
    ).toMatchObject({
      result: 'FAIL',
      rupee: 'YES',
    });
  });

  it('fails the leak scan when there are no known values to scan for', () => {
    const sets = new ColumnSets();
    const line = judge('marketing1', 'pipeline', { rows: withoutValues(9), error: null }, sets);
    expect(line).toMatchObject({ result: 'FAIL', leak: 'not run' });
  });

  it('fails pipeline rows outside Lead / Proposal / On Hold', () => {
    const sets = new ColumnSets();
    const bad = [...withoutValues(8), ...withoutValues(1, { status: 'Certified' })];
    expect(
      judge('marketing1', 'pipeline', { rows: bad, error: null }, sets, { known }).result,
    ).toBe('FAIL');
  });
});

describe('knownValues and leaksKnownValue', () => {
  it('collects distinct numeric contract values, skipping empty ones', () => {
    const values = knownValues([
      { contract_value: 850000 },
      { contract_value: '420000.00' },
      { contract_value: null },
      { contract_value: 850000 },
    ]);
    expect([...values].sort()).toEqual([420000, 850000]);
  });

  it('finds a value as a number or numeric text, but not inside other text', () => {
    const known = new Set([850000]);
    expect(leaksKnownValue([{ a: 850000 }], known)).toBe(true);
    expect(leaksKnownValue([{ a: '850000.00' }], known)).toBe(true);
    expect(leaksKnownValue([{ a: { b: [850000] } }], known)).toBe(true);
    expect(leaksKnownValue([{ a: 'call 850000 today' }, { b: 8500 }], known)).toBe(false);
  });
});

describe('judgeLogin', () => {
  const profile: Row = {
    id: '5eed0001-0000-4000-8000-000000000012',
    role: 'consultant',
    can_see_values: true,
    active: true,
  };

  it('passes when the own profile matches the seed', () => {
    expect(judgeLogin('consultant2', { error: null, profile }).result).toBe('PASS');
  });

  it('fails on a wrong password with invalid_credentials and says data checks are skipped', () => {
    const line = judgeLogin('consultant2', {
      error: { code: 'invalid_credentials', status: 400 },
      profile: null,
    });
    expect(line).toMatchObject({ result: 'FAIL', rows: 'error invalid_credentials/400' });
    expect(line.note).toContain('skipped');
  });

  it('fails when the profile is missing or not as seeded', () => {
    expect(judgeLogin('consultant2', { error: null, profile: null }).result).toBe('FAIL');
    expect(
      judgeLogin('consultant2', { error: null, profile: { ...profile, can_see_values: false } })
        .result,
    ).toBe('FAIL');
  });

  it('explains a rate limit', () => {
    const line = judgeLogin('owner1', {
      error: { code: 'over_request_rate_limit', status: 429 },
      profile: null,
    });
    expect(line.note).toContain('Rate limited');
  });
});

describe('judgeSignup and judgeProfileCount', () => {
  it('passes only on signup_disabled', () => {
    expect(judgeSignup({ code: 'signup_disabled', status: 422 }).result).toBe('PASS');
    expect(judgeSignup({ code: 'email_provider_disabled', status: 422 }).result).toBe('FAIL');
    expect(judgeSignup({ code: 'unknown', status: 0 }).result).toBe('FAIL');
    expect(judgeSignup(null)).toMatchObject({ result: 'FAIL', rows: 'ACCEPTED' });
  });

  it('passes only on 5 profiles before and after', () => {
    expect(judgeProfileCount(5, 5).result).toBe('PASS');
    expect(judgeProfileCount(5, 6).result).toBe('FAIL');
    expect(judgeProfileCount(null, null).result).toBe('FAIL');
  });
});

describe('judgeMarketingClients', () => {
  it('passes only when the clients are exactly those behind the pipeline rows', () => {
    const pipeline = [{ client_id: 'c1' }, { client_id: 'c2' }, { client_id: 'c2' }];
    expect(judgeMarketingClients(pipeline, [{ id: 'c1' }, { id: 'c2' }]).result).toBe('PASS');
    expect(judgeMarketingClients(pipeline, [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]).result).toBe(
      'FAIL',
    );
    expect(judgeMarketingClients(pipeline, [{ id: 'c1' }]).result).toBe('FAIL');
  });
});

// Fake secrets are built at runtime so the Gitleaks pre-commit hook doesn't flag this file.
const fakeJwt = 'eyJ' + 'a'.repeat(20) + '.x.y';
const fakeSecretKey = 'sb_' + 'secret_' + 'abc';
const fakePassword = ['Hunter2', 'long', 'pass'].join('-');
const unusedPassword = ['P4ssw0rd', 'from', 'manager'].join('-');

describe('renderReport and findSecrets', () => {
  it('lists counts, column names and verdicts, but no row contents', () => {
    const sets = new ColumnSets();
    const secretRow = {
      id: 'e1',
      client_name: 'Secret Client Pvt Ltd',
      client_email: 'x@client.example.com',
    };
    const lines = [
      judge(
        'owner1',
        'closed',
        { rows: [{ ...secretRow, contract_value: 1, payment_status: 'Paid' }], error: null },
        sets,
      ),
    ];
    const text = renderReport(
      { when: '10-Oct-2026 16:40 IST', host: '127.0.0.1', commit: 'abc1234' },
      lines,
      sets,
    );
    expect(text).toContain('| demo.owner1@example.com | closed | 1 | C1 |');
    expect(text).toContain('client_name, client_email');
    expect(text).toContain('**Total: 1 PASS, 0 FAIL**');
    expect(text).not.toContain('Secret Client');
    expect(text).not.toContain('x@client.example.com');
    expect(findSecrets(text, [unusedPassword])).toEqual([]);
  });

  it('flags JWTs, Supabase keys and supplied secrets', () => {
    expect(findSecrets(`token ${fakeJwt}`, [])).toEqual(['a JWT']);
    expect(findSecrets(fakeSecretKey, [])).toEqual(['a Supabase key']);
    expect(findSecrets(`pw: ${fakePassword}`, [fakePassword])).toEqual(['a supplied secret']);
    expect(findSecrets('anything', [''])).toEqual([]);
  });
});
