// Builds supabase/seed.sql and supabase/seed-report.md from the DUMMY workbook only
// (Phase 1, step 10; DECISIONS 03-Oct-2026). Run: bun run seed:build
//
// Guard, in this order, before the workbook is parsed:
//   1. no command-line arguments (the input path is fixed below);
//   2. the input's real path (links followed) is exactly test-data/SQAS_Client_Database_DUMMY.xlsx
//      inside this repo, is a regular file, and has no real-data segment;
//   3. its SHA-256 equals the pinned DUMMY hash.
// Then the workbook must have the Test Notes sheet with its "fictitious" footer, the expected
// A-AD headers, at most 100 rows, and only example.com emails. Any failure: nothing is written.
// The rules for each value live in src/lib/import/seed-rules.ts (unit-tested).
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import {
  CLIENT_SHEET,
  DUMMY_RELATIVE_PATH,
  LETTERS,
  TEST_NOTES_SHEET,
  buildReport,
  buildSeedSql,
  cellText,
  checkFingerprint,
  checkInputPath,
  checkWorkbookShape,
  parseRows,
  type RawCell,
  type SheetRow,
} from '../src/lib/import/seed-rules';

function refuse(reasons: string[]): never {
  console.error('build-seed refused; nothing was written:');
  for (const reason of reasons) console.error(`  - ${reason}`);
  process.exit(1);
}

const repoRoot = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const inputPath = join(repoRoot, DUMMY_RELATIVE_PATH);

// 1-2. Arguments and path, before reading any bytes.
let inputRealPath: string;
let isSymlink: boolean;
let isFile: boolean;
try {
  const stat = lstatSync(inputPath);
  isSymlink = stat.isSymbolicLink();
  inputRealPath = realpathSync(inputPath);
  isFile = lstatSync(inputRealPath).isFile();
} catch {
  refuse([`${DUMMY_RELATIVE_PATH} not found`]);
}
const pathErrors = checkInputPath({
  args: process.argv.slice(2),
  repoRoot,
  inputRealPath,
  isSymlink,
  isFile,
});
if (pathErrors.length > 0) refuse(pathErrors);

// 3. Fingerprint, before parsing.
const bytes = readFileSync(inputRealPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const hashErrors = checkFingerprint(sha256);
if (hashErrors.length > 0) refuse(hashErrors);

// Parse. Values only: no formulas are evaluated, dates stay as Excel serial numbers.
const workbook = XLSX.read(bytes, { type: 'buffer', cellDates: false, cellFormula: false });
const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);

function toRawCell(cell: XLSX.CellObject | undefined): RawCell {
  if (!cell || cell.v === undefined || cell.v === null) return { kind: 'empty' };
  if (cell.t === 'n' && typeof cell.v === 'number') return { kind: 'number', value: cell.v };
  return { kind: 'text', value: String(cell.v) };
}

const clientSheet = workbook.Sheets[CLIENT_SHEET];
const notesSheet = workbook.Sheets[TEST_NOTES_SHEET];
const headers: string[] = [];
const rows: SheetRow[] = [];
const testNotesTexts: string[] = [];

if (clientSheet?.['!ref']) {
  const range = XLSX.utils.decode_range(clientSheet['!ref']);
  for (let c = 0; c < LETTERS.length; c++) {
    headers.push(cellText(toRawCell(clientSheet[XLSX.utils.encode_cell({ r: 0, c })])) ?? '');
  }
  for (let r = 1; r <= range.e.r; r++) {
    const cells = LETTERS.map((_, c) => toRawCell(clientSheet[XLSX.utils.encode_cell({ r, c })]));
    if (cells.every((cell) => cellText(cell) === null)) continue; // blank row
    rows.push({ row: r + 1, cells });
  }
}
if (notesSheet) {
  for (const [address, cell] of Object.entries(notesSheet)) {
    if (!address.startsWith('!') && typeof (cell as XLSX.CellObject).v === 'string') {
      testNotesTexts.push((cell as XLSX.CellObject).v as string);
    }
  }
}

const emailColumn = LETTERS.indexOf('I');
const shapeErrors = checkWorkbookShape({
  sheetNames: workbook.SheetNames,
  headers,
  testNotesTexts,
  dataRowCount: rows.length,
  emails: rows.map((r) => cellText(r.cells[emailColumn])).filter((e): e is string => e !== null),
});
if (shapeErrors.length > 0) refuse(shapeErrors);

// Build and write.
const data = parseRows(rows, { date1904 });
const sqlPath = join(repoRoot, 'supabase', 'seed.sql');
const reportPath = join(repoRoot, 'supabase', 'seed-report.md');
writeFileSync(sqlPath, buildSeedSql(data, { sha256 }), 'utf8');
writeFileSync(reportPath, buildReport(data, { sha256 }), 'utf8');

const flagCount = data.flags.filter((f) => f.level === 'flag').length;
console.log(`Read ${data.rowsRead} rows from ${DUMMY_RELATIVE_PATH} (SHA-256 ${sha256}).`);
console.log(
  `Clients: ${data.clients.length} · engagements: ${data.engagements.length} · ` +
    `financials rows: ${data.financials.length} · flags: ${flagCount} · info: ${data.flags.length - flagCount}`,
);
console.log('Wrote supabase/seed.sql and supabase/seed-report.md. Review the diff before loading.');
