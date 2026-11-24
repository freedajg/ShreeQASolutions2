// Excel import (PRD FR-3): reads her 30-column template in the browser, flags every gap with the
// same rules as the seed (src/lib/import/seed-rules.ts — nothing invented), and prepares the rows
// for commit_import(). The file never leaves the browser except as the rows a person confirms.
import { read, utils, type WorkBook } from 'xlsx';
import {
  CLIENT_SHEET,
  EXPECTED_HEADERS,
  LETTERS,
  parseRows,
  type Flag,
  type RawCell,
  type SheetRow,
} from '../../lib/import/seed-rules';
import type { Client, TeamMember } from '../types/crm';

export const MAX_IMPORT_ROWS = 5000;

/** The file's columns don't match the template: the person maps them first (PLAN Phase 3). */
export interface MappingNeeded {
  needsMapping: true;
  fileHeaders: string[];
  /** For each of the 30 template columns, the suggested file column (index) or -1. */
  suggested: number[];
}

export interface ImportPreview {
  fileName: string;
  rows: unknown[]; // payload for commit_import()
  counts: {
    total: number;
    accepted: number;
    flagged: number;
    duplicates: number;
    rejected: number;
  };
  flags: Flag[];
  newClients: number;
  existingClients: number;
}

// Date columns P, Q, S, T, V, W, X (0-based positions in the template).
const DATE_COLUMNS = new Set([15, 16, 18, 19, 21, 22, 23]);
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * CSV dates arrive as text. Only unambiguous forms become dates: 12-Mar-2024 and 2024-03-12.
 * Anything else (03/04/2024 could be March or April) stays text and is flagged, never guessed.
 */
export function csvDateSerial(text: string): number | null {
  const t = text.trim();
  let y: number, m: number, d: number;
  const a = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(t);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (a) {
    d = Number(a[1]);
    m = MONTHS.indexOf(a[2].toLowerCase()) + 1;
    y = Number(a[3]);
  } else if (b) {
    y = Number(b[1]);
    m = Number(b[2]);
    d = Number(b[3]);
  } else return null;
  const ms = Date.UTC(y, m - 1, d);
  const dt = new Date(ms);
  if (m < 1 || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return ms / 86_400_000 + 25_569; // days since 1899-12-30
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Best guess for each template column: an exact match of the header after normalising. */
export function suggestMapping(fileHeaders: string[]): number[] {
  return EXPECTED_HEADERS.map((h) => fileHeaders.findIndex((f) => f && norm(f) === norm(h)));
}

function sheetRows(
  wb: WorkBook,
  firstRow: number,
  mapping?: number[],
  csv = false,
): { rows: SheetRow[]; problem?: string; mapping?: MappingNeeded } {
  const sheetName = wb.SheetNames.includes(CLIENT_SHEET) ? CLIENT_SHEET : wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws || !ws['!ref']) return { rows: [], problem: 'The workbook has no data sheet.' };
  const lastCol = Math.min(utils.decode_range(ws['!ref']).e.c, 199);
  const fileHeaders = Array.from({ length: lastCol + 1 }, (_, c) =>
    String(ws[utils.encode_cell({ r: 0, c })]?.v ?? '').trim(),
  );

  // Source column for each of the 30 template columns.
  let source: number[];
  if (mapping) {
    if (mapping.length !== LETTERS.length)
      return { rows: [], problem: 'The column mapping is incomplete.' };
    source = mapping;
  } else {
    const exact = EXPECTED_HEADERS.every(
      (h, i) => (fileHeaders[i] ?? '').toLowerCase() === h.toLowerCase(),
    );
    if (!exact) {
      return {
        rows: [],
        mapping: { needsMapping: true, fileHeaders, suggested: suggestMapping(fileHeaders) },
      };
    }
    source = LETTERS.map((_, i) => i);
  }

  const rows: SheetRow[] = [];
  for (let r = firstRow; r < firstRow + MAX_IMPORT_ROWS; r++) {
    const cells: RawCell[] = source.map((c, target) => {
      if (c < 0) return { kind: 'empty' };
      const cell = ws[utils.encode_cell({ r: r - 1, c })];
      if (!cell || cell.v === undefined || cell.v === null || cell.v === '')
        return { kind: 'empty' };
      if (csv) {
        const raw = String(cell.v);
        const serial = DATE_COLUMNS.has(target) ? csvDateSerial(raw) : null;
        if (serial !== null) return { kind: 'number', value: serial };
        // Money (column Y) only as a plain number, like an Excel number cell.
        if (target === 24 && /^\d+(\.\d{1,2})?$/.test(raw.trim()))
          return { kind: 'number', value: Number(raw) };
        return { kind: 'text', value: raw };
      }
      return cell.t === 'n'
        ? { kind: 'number', value: Number(cell.v) }
        : { kind: 'text', value: String(cell.v) };
    });
    if (cells.every((c) => c.kind === 'empty')) break;
    // The DUMMY file's footer row is a note, not data.
    if (cells[0].kind === 'text' && /all data is fictitious/i.test(cells[0].value)) break;
    rows.push({ row: r, cells });
  }
  // Never cut a file short without saying so: over the limit is refused as a whole.
  const after = firstRow + MAX_IMPORT_ROWS;
  if (
    rows.length === MAX_IMPORT_ROWS &&
    source.some((c) => c >= 0 && ws[utils.encode_cell({ r: after - 1, c })])
  ) {
    return {
      rows: [],
      problem: `The file has more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files.`,
    };
  }
  return { rows };
}

export async function previewImport(
  file: File,
  team: TeamMember[],
  existing: Client[],
  options: { skipExampleRow: boolean; mapping?: number[] } = { skipExampleRow: true },
): Promise<ImportPreview | MappingNeeded | string> {
  // Not the old .xls format: its parser has known security problems (review 24-Nov-2026).
  if (!/\.(xlsx|csv)$/i.test(file.name)) return 'Choose an Excel file (.xlsx) or a CSV file.';
  if (file.size > 10 * 1024 * 1024) return 'The file is larger than 10 MB.';
  const csv = /\.csv$/i.test(file.name);
  let wb: WorkBook;
  try {
    // CSV: every cell as text (raw), so the library never guesses a date.
    wb = csv
      ? read(await file.text(), { type: 'string', raw: true })
      : read(await file.arrayBuffer(), { type: 'array' });
  } catch {
    return "The file couldn't be read as an Excel workbook.";
  }
  const { rows, problem, mapping } = sheetRows(
    wb,
    options.skipExampleRow ? 3 : 2,
    options.mapping,
    csv,
  );
  if (problem) return problem;
  if (mapping) return mapping;
  if (rows.length === 0) return 'The sheet has no rows to import.';

  const byName = new Map(
    team.filter((m) => m.role !== 'Marketing').map((m) => [m.name.trim().toLowerCase(), m.id]),
  );
  const data = parseRows(rows, {
    date1904: Boolean(wb.Workbook?.WBProps?.date1904),
    resolveOwner: (name) => byName.get(name.trim().toLowerCase()) ?? null,
  });

  // Duplicates against what is already in Drishti: same email under another Client ID.
  const existingByCode = new Map(existing.filter((c) => c.code).map((c) => [c.code, c]));
  const existingEmails = new Map(
    existing.filter((c) => c.email).map((c) => [c.email.toLowerCase(), c]),
  );
  const flags = [...data.flags];
  for (const c of data.clients) {
    const twin = c.email ? existingEmails.get(c.email.toLowerCase()) : undefined;
    if (twin && twin.code !== c.clientCode) {
      flags.push({
        row: c.firstRow,
        clientCode: c.clientCode,
        column: 'I Email',
        raw: c.email,
        seededAs: `own client (possible duplicate of ${twin.code || twin.name})`,
        code: 'POSSIBLE_DUPLICATE',
        level: 'flag',
      });
    }
  }

  const clientById = new Map(data.clients.map((c) => [c.id, c]));
  const moneyOf = new Map(data.financials.map((f) => [f.engagementId, f]));
  const payload = data.engagements.map((e) => {
    const c = clientById.get(e.clientId)!;
    const f = moneyOf.get(e.id);
    return {
      client: {
        client_code: c.clientCode ?? '',
        name: c.name,
        industry: c.industry ?? '',
        address: c.address ?? '',
        city: c.city ?? '',
        state_country: c.stateCountry ?? '',
        contact_person: c.contactPerson ?? '',
        designation: c.designation ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        website: c.website ?? '',
        priority: c.priority ?? '',
      },
      engagement: {
        certification_type: e.certificationType ?? '',
        standard_framework: e.standardFramework ?? '',
        scope: e.scope ?? '',
        status: e.status ?? '',
        initial_engagement_date: e.initialEngagementDate ?? '',
        completion_date: e.completionDate ?? '',
        certificate_number: e.certificateNumber ?? '',
        valid_from: e.validFrom ?? '',
        valid_to: e.validTo ?? '',
        certification_body: e.certificationBody ?? '',
        surveillance_due_date: e.surveillanceDueDate ?? '',
        last_audit_date: e.lastAuditDate ?? '',
        next_audit_date: e.nextAuditDate ?? '',
        owner_id: e.ownerId ?? '',
        lead_source: e.leadSource ?? '',
        remarks: e.remarks ?? '',
      },
      financials: f
        ? { contract_value: f.contractValue ?? '', payment_status: f.paymentStatus ?? '' }
        : null,
    };
  });

  const flagged = new Set(
    flags.filter((f) => f.level === 'flag' && f.code !== 'ROW_SKIPPED').map((f) => f.row),
  );
  const dupRows = new Set(flags.filter((f) => f.code === 'POSSIBLE_DUPLICATE').map((f) => f.row));
  const rejected = new Set(flags.filter((f) => f.code === 'ROW_SKIPPED').map((f) => f.row));
  const savedRows = new Set(data.engagements.map((e) => e.row));
  const accepted = [...savedRows].filter((r) => !flagged.has(r)).length;

  return {
    fileName: file.name,
    rows: payload,
    counts: {
      total: rows.length,
      accepted,
      flagged: [...savedRows].filter((r) => flagged.has(r)).length,
      duplicates: [...savedRows].filter((r) => dupRows.has(r)).length,
      rejected: rejected.size,
    },
    flags,
    newClients: data.clients.filter((c) => !c.clientCode || !existingByCode.has(c.clientCode))
      .length,
    existingClients: data.clients.filter((c) => c.clientCode && existingByCode.has(c.clientCode))
      .length,
  };
}
