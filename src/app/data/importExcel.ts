// Excel import (PRD FR-3): reads her 30-column template in the browser, flags every gap with the
// same rules as the seed (src/lib/import/seed-rules.ts — nothing invented), and prepares the rows
// for commit_import(). The file never leaves the browser except as the rows a person confirms.
import { read, type WorkBook } from 'xlsx';
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

function sheetRows(wb: WorkBook, firstRow: number): { rows: SheetRow[]; problem?: string } {
  const sheetName = wb.SheetNames.includes(CLIENT_SHEET) ? CLIENT_SHEET : wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws || !ws['!ref']) return { rows: [], problem: 'The workbook has no data sheet.' };

  const header = LETTERS.map((l) => String(ws[`${l}1`]?.v ?? '').trim());
  const mismatch = header.findIndex(
    (h, i) => h.toLowerCase() !== EXPECTED_HEADERS[i].toLowerCase(),
  );
  if (mismatch !== -1) {
    return {
      rows: [],
      problem: `This isn't the 30-column SQAS template: column ${LETTERS[mismatch]} should be “${EXPECTED_HEADERS[mismatch]}”.`,
    };
  }

  const rows: SheetRow[] = [];
  for (let r = firstRow; r <= MAX_IMPORT_ROWS + 1; r++) {
    const cells: RawCell[] = LETTERS.map((l) => {
      const c = ws[`${l}${r}`];
      if (!c || c.v === undefined || c.v === null || c.v === '') return { kind: 'empty' };
      return c.t === 'n'
        ? { kind: 'number', value: Number(c.v) }
        : { kind: 'text', value: String(c.v) };
    });
    if (cells.every((c) => c.kind === 'empty')) break;
    // The DUMMY file's footer row is a note, not data.
    if (cells[0].kind === 'text' && /all data is fictitious/i.test(cells[0].value)) break;
    rows.push({ row: r, cells });
  }
  return { rows };
}

// skipExampleRow: SQAS's own template has an example in row 2 (client answer, 22-Nov-2026).
export async function previewImport(
  file: File,
  team: TeamMember[],
  existing: Client[],
  options: { skipExampleRow: boolean } = { skipExampleRow: true },
): Promise<ImportPreview | string> {
  if (!/\.xlsx?$/i.test(file.name)) return 'Choose an Excel file (.xlsx).';
  if (file.size > 10 * 1024 * 1024) return 'The file is larger than 10 MB.';
  let wb: WorkBook;
  try {
    wb = read(await file.arrayBuffer(), { type: 'array' });
  } catch {
    return "The file couldn't be read as an Excel workbook.";
  }
  const { rows, problem } = sheetRows(wb, options.skipExampleRow ? 3 : 2);
  if (problem) return problem;
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
