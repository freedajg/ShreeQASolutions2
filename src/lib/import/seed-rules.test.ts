import { format } from 'prettier';
import { describe, expect, it } from 'vitest';
import {
  DEMO_USERS,
  DUMMY_SHA256,
  EXPECTED_HEADERS,
  LETTERS,
  TEST_NOTES_SHEET,
  buildReport,
  buildSeedSql,
  checkFingerprint,
  checkInputPath,
  checkWorkbookShape,
  clientIdForRow,
  engagementIdForRow,
  excelSerialToIsoDate,
  parseRows,
  sqlText,
  type Flag,
  type Letter,
  type RawCell,
  type SheetRow,
  type WorkbookShapeCheck,
} from './seed-rules';

// ---------------------------------------------------------------------------
// Helpers: a valid DUMMY-style row, overridden per test
// ---------------------------------------------------------------------------
type CellInput = RawCell | string | number | null;

function toCell(value: CellInput): RawCell {
  if (value === null) return { kind: 'empty' };
  if (typeof value === 'string') return { kind: 'text', value };
  if (typeof value === 'number') return { kind: 'number', value };
  return value;
}

const BASE: Partial<Record<Letter, CellInput>> = {
  A: 'SQAS-C001',
  B: 'BrightPath Technologies Pvt Ltd',
  C: 'IT Services',
  E: 'Pune',
  G: 'Rohan Kulkarni',
  I: 'rohan.k@brightpath.example.com',
  J: '+91 98220 11111',
  L: 'CMMI',
  M: 'CMMI-DEV v2.0 ML3',
  O: 'Certified',
  P: 45078, // 01-Jun-2023
  T: 46340, // 14-Nov-2026
  Y: 850000,
  Z: 'Paid',
  AA: 'Mahesh Bhaskara',
  AB: 'Referral',
  AC: 'High',
  AD: 'Appraisal went well',
};

function sheetRow(row: number, overrides: Partial<Record<Letter, CellInput>> = {}): SheetRow {
  const values = { ...BASE, ...overrides };
  return { row, cells: LETTERS.map((letter) => toCell(values[letter] ?? null)) };
}

function parse(...rows: SheetRow[]) {
  return parseRows(rows, { date1904: false });
}

function codes(flags: readonly Flag[]): string[] {
  return flags.map((f) => `${f.row} ${f.column} ${f.code}`);
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------
describe('checkInputPath', () => {
  const repoRoot = 'D:\\Projects\\ShreeQASolutions2';
  const ok = {
    args: [],
    repoRoot,
    inputRealPath: `${repoRoot}\\test-data\\SQAS_Client_Database_DUMMY.xlsx`,
    isSymlink: false,
    isFile: true,
  };

  it('accepts the DUMMY file in test-data, in any letter case (Windows paths)', () => {
    const otherCase = ok.inputRealPath.toUpperCase().replace('D:', 'd:');
    expect(checkInputPath(ok)).toEqual([]);
    expect(checkInputPath({ ...ok, inputRealPath: otherCase })).toEqual([]);
  });

  it('refuses any command-line argument', () => {
    const errors = checkInputPath({ ...ok, args: ['C:\\Users\\me\\Downloads\\clients.xlsx'] });
    expect(errors).toContain('build-seed takes no arguments; it only reads the DUMMY file');
  });

  it('refuses a copy of the DUMMY file anywhere else', () => {
    const errors = checkInputPath({
      ...ok,
      inputRealPath: 'C:\\Users\\me\\Downloads\\SQAS_Client_Database_DUMMY.xlsx',
    });
    expect(errors).toContain(
      'the input is not test-data/SQAS_Client_Database_DUMMY.xlsx inside the repo',
    );
    expect(errors).toContain('the input is outside the repo');
  });

  it('refuses a file reached through real-data (e.g. test-data linked to it)', () => {
    const errors = checkInputPath({
      ...ok,
      inputRealPath: `${repoRoot}\\real-data\\SQAS_Client_Database_DUMMY.xlsx`,
    });
    expect(errors).toContain('the input path contains real-data');
    expect(errors.length).toBeGreaterThan(1);
  });

  it('refuses a link or something that is not a regular file', () => {
    const link = checkInputPath({ ...ok, isSymlink: true });
    const notFile = checkInputPath({ ...ok, isFile: false });
    expect(link).toContain('the input is a link, not the DUMMY file itself');
    expect(notFile).toContain('the input is not a regular file');
  });
});

describe('checkFingerprint', () => {
  it('accepts only the pinned DUMMY hash (either letter case)', () => {
    expect(checkFingerprint(DUMMY_SHA256)).toEqual([]);
    expect(checkFingerprint(DUMMY_SHA256.toUpperCase())).toEqual([]);
    expect(checkFingerprint('0'.repeat(64))).toHaveLength(1);
  });
});

describe('checkWorkbookShape', () => {
  const ok: WorkbookShapeCheck = {
    sheetNames: ['Client Database', 'Lists & Guidance', TEST_NOTES_SHEET],
    headers: EXPECTED_HEADERS,
    testNotesTexts: ['Row', 'All data is fictitious. Emails use example.com.'],
    dataRowCount: 23,
    emails: ['rohan.k@brightpath.example.com', 'someone@example.com'],
  };

  it('accepts the DUMMY workbook shape', () => {
    expect(checkWorkbookShape(ok)).toEqual([]);
  });

  it('refuses a workbook without the Test Notes sheet or its footer', () => {
    const noNotes = { ...ok, sheetNames: ['Client Database'], testNotesTexts: [] };
    const errors = checkWorkbookShape(noNotes);
    expect(errors).toContain(`no "${TEST_NOTES_SHEET}" sheet`);
    expect(errors).toContain('the Test Notes sheet has no "All data is fictitious" footer');
    expect(errors).toHaveLength(2);
  });

  it('refuses changed headers', () => {
    const errors = checkWorkbookShape({ ...ok, headers: EXPECTED_HEADERS.slice(1) });
    expect(errors).toEqual(['the client sheet headers are not the expected A-AD columns']);
  });

  it('refuses any email that is not at example.com', () => {
    const emails = [...ok.emails, 'ceo@realcompany.in', 'x@example.com.in'];
    const errors = checkWorkbookShape({ ...ok, emails });
    expect(errors).toEqual(['2 email(s) not at example.com, so this is not dummy data']);
  });

  it('refuses more than 100 rows', () => {
    const errors = checkWorkbookShape({ ...ok, dataRowCount: 101 });
    expect(errors).toEqual(['101 data rows (more than 100)']);
  });
});

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------
describe('excelSerialToIsoDate', () => {
  it('converts 1900-system serials', () => {
    expect(excelSerialToIsoDate(45078, false)).toBe('2023-06-01');
    expect(excelSerialToIsoDate(46340, false)).toBe('2026-11-14');
    expect(excelSerialToIsoDate(46340.75, false)).toBe('2026-11-14'); // time of day ignored
  });

  it('converts 1904-system serials', () => {
    expect(excelSerialToIsoDate(45078 - 1462, true)).toBe('2023-06-01');
  });

  it('rejects numbers that are not plausible dates', () => {
    expect(excelSerialToIsoDate(850000, false)).toBeNull();
    expect(excelSerialToIsoDate(5, false)).toBeNull();
    expect(excelSerialToIsoDate(Number.NaN, false)).toBeNull();
  });
});

describe('parseRows: bad values are left empty and flagged', () => {
  it('seeds a clean row with no flags', () => {
    const data = parse(sheetRow(2));
    expect(data.flags).toEqual([]);
    expect(data.engagements[0]).toMatchObject({
      id: engagementIdForRow(2),
      clientId: clientIdForRow(2),
      status: 'Certified',
      initialEngagementDate: '2023-06-01',
      validTo: '2026-11-14',
      ownerId: DEMO_USERS[0].id,
      leadSource: 'Referral',
      remarks: 'Appraisal went well',
    });
    expect(data.financials).toEqual([
      { engagementId: engagementIdForRow(2), contractValue: 850000, paymentStatus: 'Paid' },
    ]);
  });

  it('misspelt status "Certifed" → empty, UNKNOWN_STATUS (not guessed as Certified)', () => {
    const data = parse(sheetRow(19, { O: 'Certifed' }));
    expect(data.engagements[0].status).toBeNull();
    expect(data.flags).toMatchObject([
      { row: 19, column: 'O Status', raw: 'Certifed', code: 'UNKNOWN_STATUS', level: 'flag' },
    ]);
  });

  it('impossible text date "31/02/2027" → empty, INVALID_DATE', () => {
    const data = parse(sheetRow(20, { T: '31/02/2027' }));
    expect(data.engagements[0].validTo).toBeNull();
    expect(codes(data.flags)).toEqual(['20 T Valid To INVALID_DATE']);
  });

  it('a text date that looks valid is still flagged, never parsed', () => {
    const data = parse(sheetRow(2, { S: '01-06-2026' }));
    expect(data.engagements[0].validFrom).toBeNull();
    expect(codes(data.flags)).toEqual(['2 S Valid From INVALID_DATE']);
  });

  it('value "4.5 L" → empty, NON_NUMERIC_VALUE; the payment status is kept', () => {
    const data = parse(sheetRow(20, { Y: '4.5 L', Z: 'Paid' }));
    expect(data.financials).toEqual([
      { engagementId: engagementIdForRow(20), contractValue: null, paymentStatus: 'Paid' },
    ]);
    expect(codes(data.flags)).toEqual(['20 Y Value NON_NUMERIC_VALUE']);
  });

  it('negative or fractional-paise values → empty, INVALID_VALUE', () => {
    expect(codes(parse(sheetRow(2, { Y: -5 })).flags)).toEqual(['2 Y Value INVALID_VALUE']);
    expect(codes(parse(sheetRow(2, { Y: 10.005 })).flags)).toEqual(['2 Y Value INVALID_VALUE']);
  });

  it('unlisted service "PCI-DSS" → empty, UNKNOWN_SERVICE; Standard kept as typed', () => {
    const data = parse(sheetRow(11, { L: 'PCI-DSS', M: 'PCI DSS v4.0' }));
    expect(data.engagements[0].certificationType).toBeNull();
    expect(data.engagements[0].standardFramework).toBe('PCI DSS v4.0');
    expect(codes(data.flags)).toEqual(['11 L Service UNKNOWN_SERVICE']);
  });

  it('owner names: mapped exactly; unknown → UNMATCHED_OWNER; empty → MISSING_OWNER', () => {
    const data = parse(
      sheetRow(2, { AA: '  Teenu Puri ' }),
      sheetRow(3, { A: 'SQAS-C002', I: 'b@x.example.com', AA: 'Mahesh B.' }),
      sheetRow(4, { A: 'SQAS-C003', I: 'c@x.example.com', AA: null }),
    );
    expect(data.engagements.map((e) => e.ownerId)).toEqual([DEMO_USERS[3].id, null, null]);
    expect(codes(data.flags)).toEqual(['3 AA Owner UNMATCHED_OWNER', '4 AA Owner MISSING_OWNER']);
    expect(data.owners.find((o) => o.name === 'Teenu Puri')?.rows).toEqual([2]);
  });

  it('no Marketing user is ever an owner', () => {
    const data = parse(sheetRow(2, { AA: 'Demo Marketing 1' }));
    expect(data.engagements[0].ownerId).toBeNull();
  });

  it('missing email → empty, MISSING_EMAIL; malformed email → empty, INVALID_EMAIL', () => {
    expect(codes(parse(sheetRow(10, { I: null })).flags)).toEqual(['10 I Email MISSING_EMAIL']);
    const bad = parse(sheetRow(10, { I: 'not an email' }));
    expect(bad.clients[0].email).toBeNull();
    expect(codes(bad.flags)).toEqual(['10 I Email INVALID_EMAIL']);
  });

  it('missing value → MISSING_VALUE as info only', () => {
    const data = parse(sheetRow(12, { Y: null, Z: 'Not Invoiced' }));
    expect(data.flags).toMatchObject([{ code: 'MISSING_VALUE', level: 'info' }]);
    expect(data.financials).toHaveLength(1);
  });

  it('no financials row when both value and payment are empty', () => {
    expect(parse(sheetRow(2, { Y: null, Z: null })).financials).toEqual([]);
  });

  it('an empty string is stored as empty, without a flag', () => {
    const data = parse(sheetRow(18, { N: '' }));
    expect(data.engagements[0].scope).toBeNull();
    expect(data.flags).toEqual([]);
  });

  it('a value longer than its column is never truncated: empty + TOO_LONG', () => {
    const data = parse(sheetRow(2, { J: '9'.repeat(51) }));
    expect(data.clients[0].phone).toBeNull();
    expect(codes(data.flags)).toEqual(['2 J Phone TOO_LONG']);
  });

  it('unknown priority, lead source and payment status are each flagged', () => {
    const data = parse(sheetRow(2, { AC: 'Urgent', AB: 'Google', Z: 'Half paid' }));
    expect(codes(data.flags)).toEqual([
      '2 AC Priority UNKNOWN_PRIORITY',
      '2 AB Lead Source UNKNOWN_LEAD_SOURCE',
      '2 Z Payment Status UNKNOWN_PAYMENT_STATUS',
    ]);
  });
});

describe('parseRows: clients and engagements', () => {
  it('one client per Client ID; each row is its own engagement', () => {
    const data = parse(sheetRow(2), sheetRow(3, { L: 'ISO 27001', AB: 'Existing Client' }));
    expect(data.clients).toHaveLength(1);
    expect(data.engagements.map((e) => [e.clientId, e.leadSource])).toEqual([
      [clientIdForRow(2), 'Referral'],
      [clientIdForRow(2), 'Existing Client'],
    ]);
    expect(data.flags).toEqual([]);
  });

  it('priority conflict: the first row wins and the later row is flagged', () => {
    const data = parse(sheetRow(4), sheetRow(5, { AC: 'Medium' }));
    expect(data.clients[0].priority).toBe('High');
    expect(data.flags).toMatchObject([
      {
        row: 5,
        column: 'AC Priority',
        raw: 'Medium',
        seededAs: 'kept High (row 4)',
        code: 'PRIORITY_CONFLICT',
      },
    ]);
  });

  it('other client fields that disagree are flagged CLIENT_FIELD_CONFLICT', () => {
    const data = parse(sheetRow(2), sheetRow(3, { E: 'Mumbai' }));
    expect(data.clients[0].city).toBe('Pune');
    expect(codes(data.flags)).toEqual(['3 E City CLIENT_FIELD_CONFLICT']);
  });

  it('same email, other Client ID: both seeded, the later one POSSIBLE_DUPLICATE', () => {
    const email = 'kavya.shah@arjunfin.example.com';
    const c005 = { A: 'SQAS-C005', B: 'Arjun Fintech Pvt Ltd', I: email };
    const c015 = { A: 'SQAS-C015', B: 'Arjun FinTech', I: email.toUpperCase() };
    const data = parse(sheetRow(8, c005), sheetRow(18, c015));
    expect(data.clients.map((c) => c.clientCode)).toEqual(['SQAS-C005', 'SQAS-C015']);
    expect(data.flags).toMatchObject([
      {
        row: 18,
        clientCode: 'SQAS-C015',
        code: 'POSSIBLE_DUPLICATE',
        seededAs: 'own client (possible duplicate of SQAS-C005)',
      },
    ]);
  });

  it('a row without a Client ID becomes its own client (never grouped by name)', () => {
    const data = parse(sheetRow(2, { A: null }), sheetRow(3, { A: null, I: 'z@x.example.com' }));
    expect(data.clients.map((c) => c.clientCode)).toEqual([null, null]);
    expect(codes(data.flags)).toEqual([
      '2 A Client ID MISSING_CLIENT_ID',
      '3 A Client ID MISSING_CLIENT_ID',
    ]);
  });

  it('a new client with no name is not seeded, and says so', () => {
    const data = parse(sheetRow(2, { B: null }));
    expect(data.clients).toEqual([]);
    expect(data.engagements).toEqual([]);
    expect(codes(data.flags)).toEqual([
      '2 B Client Name MISSING_CLIENT_NAME',
      '2 A Client ID ROW_SKIPPED',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Output files
// ---------------------------------------------------------------------------
describe('buildSeedSql', () => {
  const data = parse(
    sheetRow(2, { G: "D'Souza" }),
    sheetRow(19, { A: 'SQAS-C016', I: 'r@x.example.com', O: 'Certifed' }),
  );
  const sql = buildSeedSql(data, { sha256: DUMMY_SHA256 });

  it('is deterministic', () => {
    expect(buildSeedSql(data, { sha256: DUMMY_SHA256 })).toBe(sql);
  });

  it('has the double-load guard and the final sanity check', () => {
    expect(sql).toContain('Seed not loaded: the database already has clients');
    expect(sql).toContain('Seed check failed: row counts differ');
  });

  it('holds no password: encrypted_password is empty and nothing is hashed', () => {
    expect(sql).not.toMatch(/crypt\(|gen_salt|bcrypt/i);
    expect(sql.match(/'', now\(\)/g)).toHaveLength(DEMO_USERS.length);
  });

  it('gives values access only to Demo Consultant 2', () => {
    expect(sql).toContain(
      "update public.profiles set can_see_values = true where id in ('5eed0001-0000-4000-8000-000000000012');",
    );
  });

  it('sets created_by to null on every client and engagement', () => {
    const rowEnds = sql.match(/, null\)[,;]/g) ?? [];
    expect(rowEnds).toHaveLength(data.clients.length + data.engagements.length);
  });

  it("escapes quotes (D'Souza) and writes empty values as null", () => {
    expect(sql).toContain("'D''Souza'");
    expect(sqlText(null)).toBe('null');
  });

  it('lists the flags in its header', () => {
    expect(sql).toContain('--   row 19 SQAS-C016 O Status: "Certifed" -> empty [UNKNOWN_STATUS]');
  });
});

describe('buildReport', () => {
  it('is already Prettier-formatted, so format:check passes on the generated file', async () => {
    const data = parse(
      sheetRow(4),
      sheetRow(5, { AC: 'Medium' }),
      sheetRow(20, { A: 'SQAS-C017', I: 'n@x.example.com', T: '31/02/2027', Y: '4.5 L' }),
    );
    const report = buildReport(data, { sha256: DUMMY_SHA256 });
    const formatted = await format(report, {
      parser: 'markdown',
      singleQuote: true,
      printWidth: 100,
      trailingComma: 'all',
      endOfLine: 'lf',
    });
    expect(report).toBe(formatted);
    expect(report).toContain('`31/02/2027`');
    expect(report).toContain('`NON_NUMERIC_VALUE`');
  });
});
