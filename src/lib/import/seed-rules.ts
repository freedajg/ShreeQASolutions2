// Rules for turning the DUMMY workbook's rows into seed data (Phase 1, step 10).
// Pure functions: no file, database or network access, so they are unit-tested and can be
// reused by the Phase 3 import. scripts/build-seed.ts reads the workbook and writes the files.
//
// CLAUDE.md rule 7: a missing or bad value is left empty and flagged, never guessed. So:
// - dates are accepted only from real Excel date cells (numbers); text in a date column is
//   flagged, even if it looks like a date (dd/mm and mm/dd can't be told apart);
// - money is accepted only from numeric cells ("4.5 L" is never turned into 450000);
// - dropdown columns must match a lookup code exactly, after trimming;
// - an owner name must match the fixed name map exactly, after trimming.

// ---------------------------------------------------------------------------
// The DUMMY file and its guard values
// ---------------------------------------------------------------------------
export const DUMMY_RELATIVE_PATH = 'test-data/SQAS_Client_Database_DUMMY.xlsx';
// SHA-256 of the DUMMY file (Get-FileHash, 06-Oct-2026). If the file changes, the build refuses
// until this is updated in a reviewed commit.
export const DUMMY_SHA256 = '9d479cf62f129e3a64a2a5b69f2219799f7ad3f1b753b7b1f094d917ce2b37e6';
export const CLIENT_SHEET = 'Client Database';
export const TEST_NOTES_SHEET = 'Test Notes (dummy data)';
export const FICTITIOUS_FOOTER = 'All data is fictitious';
export const MAX_DATA_ROWS = 100;

// ---------------------------------------------------------------------------
// Columns A-AD of the "Client Database" sheet
// ---------------------------------------------------------------------------
// prettier-ignore
export const LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD',
] as const;
export type Letter = (typeof LETTERS)[number];

export const EXPECTED_HEADERS: readonly string[] = [
  'Client ID',
  'Client Name',
  'Industry / Sector',
  'Address',
  'City',
  'State / Country',
  'Contact Person',
  'Designation',
  'Email',
  'Phone',
  'Website',
  'Service / Certification',
  'Standard / Framework',
  'Scope of Certification / Service',
  'Certification / Service Status',
  'Initial Engagement Date',
  'Certification / Completion Date',
  'Certificate / Report No.',
  'Certificate Valid From',
  'Certificate Valid To',
  'Certification Body / External LA',
  'Surveillance / Renewal Due Date',
  'Last Audit / Review Date',
  'Next Audit / Review Date',
  'Contract Value',
  'Payment Status',
  'Relationship Owner',
  'Lead Source',
  'Client Rating / Priority',
  'Remarks',
];

// Short names for the report.
const SHORT_NAMES: Readonly<Record<Letter, string>> = {
  A: 'Client ID',
  B: 'Client Name',
  C: 'Industry',
  D: 'Address',
  E: 'City',
  F: 'State / Country',
  G: 'Contact Person',
  H: 'Designation',
  I: 'Email',
  J: 'Phone',
  K: 'Website',
  L: 'Service',
  M: 'Standard',
  N: 'Scope',
  O: 'Status',
  P: 'Initial Engagement',
  Q: 'Completion',
  R: 'Certificate No.',
  S: 'Valid From',
  T: 'Valid To',
  U: 'Certification Body',
  V: 'Surveillance Due',
  W: 'Last Audit',
  X: 'Next Audit',
  Y: 'Value',
  Z: 'Payment Status',
  AA: 'Owner',
  AB: 'Lead Source',
  AC: 'Priority',
  AD: 'Remarks',
};

export function columnLabel(letter: Letter): string {
  return `${letter} ${SHORT_NAMES[letter]}`;
}

// Client fields compared across a client's rows (A is the grouping key itself).
const CLIENT_LETTERS: readonly Letter[] = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'AC'];

// ---------------------------------------------------------------------------
// Lookups: the exact codes from the step 6 migration (…_lookups.sql). A mismatch here would
// also fail the seed's foreign keys, so the two can't drift silently.
// ---------------------------------------------------------------------------
export const CERTIFICATION_TYPES: ReadonlySet<string> = new Set([
  'ISO 9001',
  'ISO 20000-1',
  'ISO 27001',
  'ISO 22301',
  'ISO 27701',
  'ISO 42001',
  'ISO 13485',
  'CMMI',
  'CMMC',
  'SOC 1',
  'SOC 2',
  'GDPR',
  'DPDP',
  'HIPAA',
  'VAPT',
  'Other',
]);
export const STATUSES: ReadonlySet<string> = new Set([
  'Lead',
  'Proposal',
  'In Progress',
  'Implemented',
  'Audit Completed',
  'Certified',
  'Renewal Due',
  'Completed',
  'On Hold',
  'Closed',
]);
export const PAYMENT_STATUSES: ReadonlySet<string> = new Set([
  'Not Invoiced',
  'Partially Paid',
  'Paid',
  'Overdue',
  'NA',
]);
export const PRIORITIES: ReadonlySet<string> = new Set(['High', 'Medium', 'Low']);
export const LEAD_SOURCES: ReadonlySet<string> = new Set([
  'Referral',
  'Website',
  'LinkedIn',
  'Existing Client',
  'Partner',
  'Event',
  'Other',
]);

// ---------------------------------------------------------------------------
// Demo users and the owner map (DECISIONS: option B, plain fake names, @example.com)
// ---------------------------------------------------------------------------
export type DemoUserKey = 'owner1' | 'owner2' | 'consultant1' | 'consultant2' | 'marketing1';

export interface DemoUser {
  key: DemoUserKey;
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'consultant' | 'marketing';
  canSeeValues: boolean; // Consultants only; Owners always see values
}

export const DEMO_USERS: readonly DemoUser[] = [
  {
    key: 'owner1',
    id: '5eed0001-0000-4000-8000-000000000001',
    email: 'demo.owner1@example.com',
    fullName: 'Demo Owner 1',
    role: 'owner',
    canSeeValues: false,
  },
  {
    key: 'owner2',
    id: '5eed0001-0000-4000-8000-000000000002',
    email: 'demo.owner2@example.com',
    fullName: 'Demo Owner 2',
    role: 'owner',
    canSeeValues: false,
  },
  {
    key: 'consultant1',
    id: '5eed0001-0000-4000-8000-000000000011',
    email: 'demo.consultant1@example.com',
    fullName: 'Demo Consultant 1',
    role: 'consultant',
    canSeeValues: false,
  },
  {
    key: 'consultant2',
    id: '5eed0001-0000-4000-8000-000000000012',
    email: 'demo.consultant2@example.com',
    fullName: 'Demo Consultant 2',
    role: 'consultant',
    canSeeValues: true,
  },
  {
    key: 'marketing1',
    id: '5eed0001-0000-4000-8000-000000000021',
    email: 'demo.marketing1@example.com',
    fullName: 'Demo Marketing 1',
    role: 'marketing',
    canSeeValues: false,
  },
];

// Names in the DUMMY sheet's column AA → demo user. Exact match after trimming; anything else
// is left empty and flagged. Marketing owns nothing (it is never an engagement owner).
export const OWNER_MAP: ReadonlyMap<string, DemoUserKey> = new Map([
  ['Mahesh Bhaskara', 'owner1'],
  ['Pramila Pullela', 'owner2'],
  ['Sarath Chandra', 'consultant1'],
  ['Teenu Puri', 'consultant2'],
]);

function demoUser(key: DemoUserKey): DemoUser {
  const user = DEMO_USERS.find((u) => u.key === key);
  if (!user) throw new Error(`Unknown demo user ${key}`);
  return user;
}

// Fixed ids, numbered by Excel row, so the seed diff is stable. Prefix 5eed… can't collide with
// the pgTAP fixtures (a0…, b9…, e8…, e9…).
export function clientIdForRow(row: number): string {
  return `5eed0002-0000-4000-8000-${String(row).padStart(12, '0')}`;
}
export function engagementIdForRow(row: number): string {
  return `5eed0003-0000-4000-8000-${String(row).padStart(12, '0')}`;
}

// ---------------------------------------------------------------------------
// Cells and flags
// ---------------------------------------------------------------------------
export type RawCell =
  { kind: 'empty' } | { kind: 'text'; value: string } | { kind: 'number'; value: number };

export const EMPTY_CELL: RawCell = { kind: 'empty' };

export interface SheetRow {
  row: number; // Excel row number (data starts at 2)
  cells: readonly RawCell[]; // index 0 = column A
}

export type FlagCode =
  | 'MISSING_CLIENT_ID'
  | 'MISSING_CLIENT_NAME'
  | 'ROW_SKIPPED'
  | 'MISSING_EMAIL'
  | 'INVALID_EMAIL'
  | 'UNKNOWN_SERVICE'
  | 'UNKNOWN_STATUS'
  | 'UNKNOWN_PAYMENT_STATUS'
  | 'UNKNOWN_LEAD_SOURCE'
  | 'UNKNOWN_PRIORITY'
  | 'MISSING_OWNER'
  | 'UNMATCHED_OWNER'
  | 'INVALID_DATE'
  | 'NON_NUMERIC_VALUE'
  | 'INVALID_VALUE'
  | 'MISSING_VALUE'
  | 'TOO_LONG'
  | 'PRIORITY_CONFLICT'
  | 'CLIENT_FIELD_CONFLICT'
  | 'POSSIBLE_DUPLICATE';

export interface Flag {
  row: number;
  clientCode: string | null;
  column: string; // e.g. "O Status"
  raw: string | null; // the cell as typed (trimmed); null = empty
  seededAs: string;
  code: FlagCode;
  level: 'flag' | 'info';
}

// Trimmed text of a cell; null when empty. Numbers in text columns keep their plain digits.
export function cellText(cell: RawCell): string | null {
  if (cell.kind === 'empty') return null;
  const text = (cell.kind === 'text' ? cell.value : String(cell.value)).trim();
  return text === '' ? null : text;
}

// Excel date serial → ISO date (yyyy-mm-dd). Null for anything outside 1950-2100, which in a
// date column means a mistyped number, not a date.
export function excelSerialToIsoDate(serial: number, date1904: boolean): string | null {
  if (!Number.isFinite(serial)) return null;
  const days = Math.floor(serial);
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const date = new Date(base + days * 86_400_000);
  const year = date.getUTCFullYear();
  if (year < 1950 || year > 2100) return null;
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Same pattern as the clients.email check in the step 7 migration.
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
export interface SeedClient {
  id: string;
  clientCode: string | null;
  name: string;
  industry: string | null;
  address: string | null;
  city: string | null;
  stateCountry: string | null;
  contactPerson: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  priority: string | null;
  firstRow: number;
}

export interface SeedEngagement {
  id: string;
  clientId: string;
  row: number;
  certificationType: string | null;
  standardFramework: string | null;
  scope: string | null;
  status: string | null;
  initialEngagementDate: string | null;
  completionDate: string | null;
  certificateNumber: string | null;
  validFrom: string | null;
  validTo: string | null;
  certificationBody: string | null;
  surveillanceDueDate: string | null;
  lastAuditDate: string | null;
  nextAuditDate: string | null;
  ownerId: string | null;
  leadSource: string | null;
  remarks: string | null;
}

export interface SeedFinancials {
  engagementId: string;
  contractValue: number | null;
  paymentStatus: string | null;
}

export interface OwnerMapping {
  name: string;
  user: DemoUser;
  rows: number[];
}

export interface SeedData {
  rowsRead: number;
  clients: SeedClient[];
  engagements: SeedEngagement[];
  financials: SeedFinancials[];
  flags: Flag[];
  owners: OwnerMapping[];
}

// Builds clients (one per Client ID), engagements (one per row) and financials from the sheet.
export function parseRows(rows: readonly SheetRow[], options: { date1904: boolean }): SeedData {
  const flags: Flag[] = [];
  const clients: SeedClient[] = [];
  const engagements: SeedEngagement[] = [];
  const financials: SeedFinancials[] = [];
  const clientsByCode = new Map<string, { client: SeedClient; cells: readonly RawCell[] }>();
  const ownerRows = new Map<string, number[]>();

  for (const { row, cells } of rows) {
    const cell = (letter: Letter): RawCell => cells[LETTERS.indexOf(letter)] ?? EMPTY_CELL;
    let clientCode = cellText(cell('A'));

    const flag = (
      letter: Letter,
      code: FlagCode,
      seededAs = 'empty',
      level: Flag['level'] = 'flag',
    ): void => {
      flags.push({
        row,
        clientCode,
        column: columnLabel(letter),
        raw: cellText(cell(letter)),
        seededAs,
        code,
        level,
      });
    };

    // A text column: trimmed, empty → null, too long → null + flag (never truncated).
    const textField = (letter: Letter, max: number): string | null => {
      const value = cellText(cell(letter));
      if (value === null) return null;
      if (value.length > max) {
        flag(letter, 'TOO_LONG');
        return null;
      }
      return value;
    };

    const lookupField = (letter: Letter, codes: ReadonlySet<string>, code: FlagCode) => {
      const value = cellText(cell(letter));
      if (value === null) return null;
      if (!codes.has(value)) {
        flag(letter, code);
        return null;
      }
      return value;
    };

    const dateField = (letter: Letter): string | null => {
      const raw = cell(letter);
      if (raw.kind === 'empty' || cellText(raw) === null) return null;
      const iso = raw.kind === 'number' ? excelSerialToIsoDate(raw.value, options.date1904) : null;
      if (iso === null) flag(letter, 'INVALID_DATE');
      return iso;
    };

    if (clientCode !== null && clientCode.length > 50) {
      flag('A', 'TOO_LONG', 'empty (own client)');
      clientCode = null;
    } else if (clientCode === null) {
      flag('A', 'MISSING_CLIENT_ID', 'empty (own client)');
    }

    // ----- client -----
    let client: SeedClient;
    const known = clientCode === null ? undefined : clientsByCode.get(clientCode);
    if (known) {
      client = known.client;
      for (const letter of CLIENT_LETTERS) {
        const first = cellText(known.cells[LETTERS.indexOf(letter)] ?? EMPTY_CELL);
        if (first !== cellText(cell(letter))) {
          flag(
            letter,
            letter === 'AC' ? 'PRIORITY_CONFLICT' : 'CLIENT_FIELD_CONFLICT',
            `kept ${first ?? 'empty'} (row ${client.firstRow})`,
          );
        }
      }
    } else {
      const name = cellText(cell('B'));
      if (name === null || name.length > 200) {
        flag('B', name === null ? 'MISSING_CLIENT_NAME' : 'TOO_LONG', 'row not seeded');
        flag('A', 'ROW_SKIPPED', 'row not seeded');
        continue;
      }

      let email = cellText(cell('I'));
      if (email === null) {
        flag('I', 'MISSING_EMAIL');
      } else if (!EMAIL_PATTERN.test(email) || email.length > 320) {
        flag('I', 'INVALID_EMAIL');
        email = null;
      }

      client = {
        id: clientIdForRow(row),
        clientCode,
        name,
        industry: textField('C', 200),
        address: textField('D', 1000),
        city: textField('E', 200),
        stateCountry: textField('F', 200),
        contactPerson: textField('G', 200),
        designation: textField('H', 200),
        email,
        phone: textField('J', 50),
        website: textField('K', 500),
        priority: lookupField('AC', PRIORITIES, 'UNKNOWN_PRIORITY'),
        firstRow: row,
      };

      // Same email under a different Client ID: seed both, flag the later one (never merged).
      if (email !== null) {
        const earlier = clients.find((c) => c.email?.toLowerCase() === email.toLowerCase());
        if (earlier) {
          flag(
            'I',
            'POSSIBLE_DUPLICATE',
            `own client (possible duplicate of ${earlier.clientCode ?? `row ${earlier.firstRow}`})`,
          );
        }
      }

      clients.push(client);
      if (clientCode !== null) clientsByCode.set(clientCode, { client, cells });
    }

    // ----- engagement -----
    let ownerId: string | null = null;
    const ownerName = cellText(cell('AA'));
    if (ownerName === null) {
      flag('AA', 'MISSING_OWNER');
    } else {
      const key = OWNER_MAP.get(ownerName);
      if (key === undefined) {
        flag('AA', 'UNMATCHED_OWNER');
      } else {
        ownerId = demoUser(key).id;
        ownerRows.set(ownerName, [...(ownerRows.get(ownerName) ?? []), row]);
      }
    }

    const engagement: SeedEngagement = {
      id: engagementIdForRow(row),
      clientId: client.id,
      row,
      certificationType: lookupField('L', CERTIFICATION_TYPES, 'UNKNOWN_SERVICE'),
      standardFramework: textField('M', 200),
      scope: textField('N', 2000),
      status: lookupField('O', STATUSES, 'UNKNOWN_STATUS'),
      initialEngagementDate: dateField('P'),
      completionDate: dateField('Q'),
      certificateNumber: textField('R', 200),
      validFrom: dateField('S'),
      validTo: dateField('T'),
      certificationBody: textField('U', 200),
      surveillanceDueDate: dateField('V'),
      lastAuditDate: dateField('W'),
      nextAuditDate: dateField('X'),
      ownerId,
      leadSource: lookupField('AB', LEAD_SOURCES, 'UNKNOWN_LEAD_SOURCE'),
      remarks: textField('AD', 5000),
    };
    engagements.push(engagement);

    // ----- financials: written when the value or payment cell has anything in it -----
    const valueCell = cell('Y');
    let contractValue: number | null = null;
    if (cellText(valueCell) === null) {
      flag('Y', 'MISSING_VALUE', 'empty', 'info');
    } else if (valueCell.kind !== 'number') {
      flag('Y', 'NON_NUMERIC_VALUE');
    } else {
      const v = valueCell.value;
      const cents = v * 100;
      if (!Number.isFinite(v) || v < 0 || v >= 1e10 || Math.abs(Math.round(cents) - cents) > 1e-6) {
        flag('Y', 'INVALID_VALUE');
      } else {
        contractValue = v;
      }
    }
    const paymentStatus = lookupField('Z', PAYMENT_STATUSES, 'UNKNOWN_PAYMENT_STATUS');
    if (cellText(valueCell) !== null || cellText(cell('Z')) !== null) {
      financials.push({ engagementId: engagement.id, contractValue, paymentStatus });
    }
  }

  const owners: OwnerMapping[] = [...OWNER_MAP].map(([name, key]) => ({
    name,
    user: demoUser(key),
    rows: ownerRows.get(name) ?? [],
  }));

  return { rowsRead: rows.length, clients, engagements, financials, flags, owners };
}

// ---------------------------------------------------------------------------
// Guards (run by build-seed.ts before and after the workbook is opened)
// ---------------------------------------------------------------------------
function normalisePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export interface InputPathCheck {
  args: readonly string[]; // command-line arguments: there must be none
  repoRoot: string; // real path of the repo root
  inputRealPath: string; // real path of the input (symlinks and junctions followed)
  isSymlink: boolean;
  isFile: boolean;
}

// Returns the reasons to refuse; empty = allowed. Paths compare case-insensitively (Windows).
export function checkInputPath(input: InputPathCheck): string[] {
  const errors: string[] = [];
  if (input.args.length > 0) {
    errors.push('build-seed takes no arguments; it only reads the DUMMY file');
  }
  const root = normalisePath(input.repoRoot);
  const actual = normalisePath(input.inputRealPath);
  if (actual !== `${root}/${DUMMY_RELATIVE_PATH.toLowerCase()}`) {
    errors.push(`the input is not ${DUMMY_RELATIVE_PATH} inside the repo`);
  }
  if (!actual.startsWith(`${root}/`)) errors.push('the input is outside the repo');
  if (actual.split('/').includes('real-data')) errors.push('the input path contains real-data');
  if (input.isSymlink) errors.push('the input is a link, not the DUMMY file itself');
  if (!input.isFile) errors.push('the input is not a regular file');
  return errors;
}

export function checkFingerprint(sha256: string): string[] {
  return sha256.toLowerCase() === DUMMY_SHA256
    ? []
    : [`the file's SHA-256 (${sha256.toLowerCase()}) is not the pinned DUMMY hash`];
}

export interface WorkbookShapeCheck {
  sheetNames: readonly string[];
  headers: readonly string[]; // row 1 of the client sheet
  testNotesTexts: readonly string[]; // every text cell of the Test Notes sheet
  dataRowCount: number;
  emails: readonly string[]; // non-empty column I values
}

export function checkWorkbookShape(shape: WorkbookShapeCheck): string[] {
  const errors: string[] = [];
  if (!shape.sheetNames.includes(CLIENT_SHEET)) errors.push(`no "${CLIENT_SHEET}" sheet`);
  if (!shape.sheetNames.includes(TEST_NOTES_SHEET)) errors.push(`no "${TEST_NOTES_SHEET}" sheet`);
  if (!shape.testNotesTexts.some((t) => t.includes(FICTITIOUS_FOOTER))) {
    errors.push(`the Test Notes sheet has no "${FICTITIOUS_FOOTER}" footer`);
  }
  const headersMatch =
    shape.headers.length === EXPECTED_HEADERS.length &&
    EXPECTED_HEADERS.every((h, i) => (shape.headers[i] ?? '').trim() === h);
  if (!headersMatch) errors.push('the client sheet headers are not the expected A-AD columns');
  if (shape.dataRowCount > MAX_DATA_ROWS) {
    errors.push(`${shape.dataRowCount} data rows (more than ${MAX_DATA_ROWS})`);
  }
  const realLooking = shape.emails.filter((e) => !/[@.]example\.com$/i.test(e.trim()));
  if (realLooking.length > 0) {
    errors.push(`${realLooking.length} email(s) not at example.com, so this is not dummy data`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// seed.sql
// ---------------------------------------------------------------------------
export function sqlText(value: string | null): string {
  if (value === null) return 'null';
  if (value.includes('\u0000')) throw new Error('A text value contains a NUL character');
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlDate(value: string | null): string {
  if (value === null) return 'null';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Not an ISO date: ${value}`);
  return `'${value}'`;
}

function sqlNumber(value: number | null): string {
  return value === null ? 'null' : value.toFixed(2);
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ');
}

function describeFlag(f: Flag): string {
  const raw = f.raw === null ? '(empty)' : `"${f.raw}"`;
  return `row ${f.row} ${f.clientCode ?? '(no ID)'} ${f.column}: ${raw} -> ${f.seededAs} [${f.code}]`;
}

// Demo users. Role in raw_app_meta_data (server-only): the step 5 trigger makes each profile.
// Token columns are '' (not null) because Auth fails on nulls there. encrypted_password is ''
// so nobody can log in until seed:passwords sets a password locally.
function userRow(u: DemoUser): string {
  const app = JSON.stringify({ provider: 'email', providers: ['email'], role: u.role });
  const meta = JSON.stringify({ full_name: u.fullName });
  return [
    `  ('00000000-0000-0000-0000-000000000000', ${sqlText(u.id)}, 'authenticated', 'authenticated',`,
    `   ${sqlText(u.email)}, '', now(), ${sqlText(app)}::jsonb, ${sqlText(meta)}::jsonb, now(), now(),`,
    `   '', '', '', '', '', '', '', '')`,
  ].join('\n');
}

function identityRow(u: DemoUser): string {
  const identity = JSON.stringify({ sub: u.id, email: u.email, email_verified: true });
  return `  (${sqlText(u.id)}, ${sqlText(u.id)}, ${sqlText(identity)}::jsonb, 'email', now(), now())`;
}

function clientRow(c: SeedClient): string {
  return [
    `  (${sqlText(c.id)}, ${sqlText(c.clientCode)}, ${sqlText(c.name)}, ${sqlText(c.industry)},`,
    `   ${sqlText(c.address)}, ${sqlText(c.city)}, ${sqlText(c.stateCountry)},`,
    `   ${sqlText(c.contactPerson)}, ${sqlText(c.designation)}, ${sqlText(c.email)},`,
    `   ${sqlText(c.phone)}, ${sqlText(c.website)}, ${sqlText(c.priority)}, null)`,
  ].join('\n');
}

function engagementRow(e: SeedEngagement): string {
  return [
    `  (${sqlText(e.id)}, ${sqlText(e.clientId)}, ${sqlText(e.certificationType)},`,
    `   ${sqlText(e.standardFramework)}, ${sqlText(e.scope)}, ${sqlText(e.status)},`,
    `   ${sqlDate(e.initialEngagementDate)}, ${sqlDate(e.completionDate)},`,
    `   ${sqlText(e.certificateNumber)}, ${sqlDate(e.validFrom)}, ${sqlDate(e.validTo)},`,
    `   ${sqlText(e.certificationBody)}, ${sqlDate(e.surveillanceDueDate)},`,
    `   ${sqlDate(e.lastAuditDate)}, ${sqlDate(e.nextAuditDate)},`,
    `   ${sqlText(e.ownerId)}, ${sqlText(e.leadSource)}, ${sqlText(e.remarks)}, null)`,
  ].join('\n');
}

function financialsRow(f: SeedFinancials): string {
  const value = sqlNumber(f.contractValue);
  return `  (${sqlText(f.engagementId)}, ${value}, ${sqlText(f.paymentStatus)})`;
}

function roleCheckRow(u: DemoUser): string {
  return `(${sqlText(u.id)}::uuid, ${sqlText(u.role)}::public.app_role, ${u.canSeeValues})`;
}

// Rows of one insert: comma between rows, semicolon after the last.
function valueRows(rows: readonly string[]): string {
  return `${rows.join(',\n')};`;
}

export function buildSeedSql(data: SeedData, meta: { sha256: string }): string {
  const lines: string[] = [];
  const out = (...l: string[]) => lines.push(...l);
  const counts = [
    `Rows read: ${data.rowsRead}`,
    `clients: ${data.clients.length}`,
    `engagements: ${data.engagements.length}`,
    `financials rows: ${data.financials.length}`,
    `demo users: ${DEMO_USERS.length}`,
  ].join(' · ');

  out(
    '-- Seed data for the LOCAL database only (Phase 1, step 10).',
    '-- GENERATED by scripts/build-seed.ts from test-data/SQAS_Client_Database_DUMMY.xlsx.',
    '-- Do not edit by hand: change the script and run `bun run seed:build`.',
    `-- Source SHA-256: ${meta.sha256.toLowerCase()}`,
    `-- ${counts}`,
    '--',
    '-- Bad or missing values are seeded EMPTY and FLAGGED, never guessed (CLAUDE.md rule 7).',
    '-- created_by is null on every row: the seed runs as the server, not as a user.',
    '-- Demo users have NO password here; set them locally with `bun run seed:passwords`.',
    '--',
    `-- Flags (${data.flags.length}; details in supabase/seed-report.md):`,
    ...data.flags.map((f) => `--   ${oneLine(describeFlag(f))}`),
    '',
    '-- Refuse to load twice, or into a database that already has data.',
    'do $$',
    'begin',
    '  if exists (select 1 from public.clients)',
    '    or exists (select 1 from public.engagements)',
    "    or exists (select 1 from auth.users where email like '%@example.com') then",
    "    raise exception 'Seed not loaded: the database already has clients, engagements or demo users';",
    '  end if;',
    'end',
    '$$;',
    '',
  );

  out(
    '-- Demo users (fake names, @example.com). The new-login trigger creates their profiles.',
    'insert into auth.users (instance_id, id, aud, role, email, encrypted_password,',
    '  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,',
    '  confirmation_token, recovery_token, email_change_token_new, email_change,',
    '  email_change_token_current, phone_change, phone_change_token, reauthentication_token)',
    'values',
    valueRows(DEMO_USERS.map(userRow)),
    '',
    'insert into auth.identities',
    '  (provider_id, user_id, identity_data, provider, created_at, updated_at)',
    'values',
    valueRows(DEMO_USERS.map(identityRow)),
    '',
  );

  const valuesUserIds = DEMO_USERS.filter((u) => u.canSeeValues).map((u) => sqlText(u.id));
  if (valuesUserIds.length > 0) {
    const ids = valuesUserIds.join(', ');
    out(
      '-- Values access (server work, so the step 5 guard allows it).',
      `update public.profiles set can_see_values = true where id in (${ids});`,
      '',
    );
  }

  out(
    '-- Clients: one per Client ID, fields from its first row.',
    'insert into public.clients (id, client_code, name, industry, address, city, state_country,',
    '  contact_person, designation, email, phone, website, priority, created_by)',
    'values',
    valueRows(data.clients.map(clientRow)),
    '',
    '-- Engagements: one per Excel row (id ends in the row number).',
    'insert into public.engagements (id, client_id, certification_type, standard_framework, scope,',
    '  status, initial_engagement_date, completion_date, certificate_number, valid_from, valid_to,',
    '  certification_body, surveillance_due_date, last_audit_date, next_audit_date, owner_id,',
    '  lead_source, remarks, created_by)',
    'values',
    valueRows(data.engagements.map(engagementRow)),
    '',
  );

  if (data.financials.length > 0) {
    out(
      '-- Contract value (Y) and payment status (Z).',
      'insert into public.engagement_financials (engagement_id, contract_value, payment_status)',
      'values',
      valueRows(data.financials.map(financialsRow)),
      '',
    );
  }

  const roleChecks = DEMO_USERS.map(roleCheckRow).join(', ');
  out(
    '-- Sanity check: counts and roles as generated, or the whole load rolls back.',
    'do $$',
    'begin',
    `  if (select count(*) from public.clients where id::text like '5eed0002-%') <> ${data.clients.length}`,
    `    or (select count(*) from public.engagements where id::text like '5eed0003-%') <> ${data.engagements.length}`,
    `    or (select count(*) from public.engagement_financials where engagement_id::text like '5eed0003-%') <> ${data.financials.length}`,
    '  then',
    "    raise exception 'Seed check failed: row counts differ from the generated data';",
    '  end if;',
    '  if exists (',
    `    select 1 from (values ${roleChecks}) as v(id, role, can_see_values)`,
    '    left join public.profiles p on p.id = v.id',
    '    where p.id is null or p.role is distinct from v.role',
    '      or p.can_see_values is distinct from v.can_see_values or not p.active',
    '  ) then',
    "    raise exception 'Seed check failed: a demo profile is missing or has the wrong role';",
    '  end if;',
    'end',
    '$$;',
  );

  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// seed-report.md (written already Prettier-formatted, so format:check passes)
// ---------------------------------------------------------------------------
function code(value: string): string {
  return `\`${value.replace(/`/g, "'").replace(/\|/g, '/')}\``;
}

function markdownTable(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  const widths = header.map((h, i) => Math.max(3, h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: readonly string[]) =>
    `| ${cells.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`;
  return [line(header), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)];
}

function valuesAccess(u: DemoUser): string {
  if (u.role === 'owner') return 'always';
  return u.canSeeValues ? 'yes' : 'no';
}

export function buildReport(data: SeedData, meta: { sha256: string }): string {
  const flagCount = data.flags.filter((f) => f.level === 'flag').length;
  const infoCount = data.flags.length - flagCount;
  const lines = [
    '# Seed report',
    '',
    'Generated by `scripts/build-seed.ts` from the DUMMY file. Do not edit by hand; run `bun run seed:build`.',
    '',
    `- Source: \`${DUMMY_RELATIVE_PATH}\``,
    `- SHA-256: \`${meta.sha256.toLowerCase()}\``,
    `- Rows read: ${data.rowsRead}`,
    `- Clients: ${data.clients.length}`,
    `- Engagements: ${data.engagements.length}`,
    `- Financials rows: ${data.financials.length}`,
    `- Demo users: ${DEMO_USERS.length}`,
    '',
    `## Flags (${flagCount} flags, ${infoCount} info)`,
    '',
    'Every flagged value was seeded empty (or as described), never guessed.',
    '',
    ...markdownTable(
      ['Row', 'Client ID', 'Column', 'Raw value', 'Seeded as', 'Flag', 'Level'],
      data.flags.map((f) => [
        String(f.row),
        f.clientCode ?? '(none)',
        f.column,
        f.raw === null ? '(empty)' : code(f.raw),
        f.seededAs.replace(/\|/g, '/'),
        code(f.code),
        f.level,
      ]),
    ),
    '',
    '## Owner names mapped',
    '',
    'Exact match after trimming. Any other name is left empty and flagged `UNMATCHED_OWNER`.',
    '',
    ...markdownTable(
      ['Name in sheet', 'Demo user', 'Role', 'Rows'],
      data.owners.map((o) => [
        o.name,
        o.user.fullName,
        o.user.role,
        o.rows.length > 0 ? o.rows.join(', ') : '(none)',
      ]),
    ),
    '',
    '## Demo users',
    '',
    'No passwords are stored here or in `seed.sql`. Set them locally with `bun run seed:passwords`.',
    '',
    ...markdownTable(
      ['Email', 'Name', 'Role', 'Values access'],
      DEMO_USERS.map((u) => [code(u.email), u.fullName, u.role, valuesAccess(u)]),
    ),
  ];
  return `${lines.join('\n')}\n`;
}
