// Excel export (PRD FR-12, PLAN Phase 3): her 30-column layout, as a real .xlsx so it can be
// imported again unchanged (dates are Excel date cells, money is a number). Every text value is
// written as a string cell ("t: s"), which Excel never runs as a formula, so a name starting
// with = stays text without changing it (SECURITY.md §A8).
// Loaded only when someone exports, so the Excel library isn't in the first page load.
import { utils, write } from 'xlsx';
import { EXPECTED_HEADERS } from '../../lib/import/seed-rules';
import type { Client, Engagement, TeamMember } from '../types/crm';

const isoToDate = (iso?: string) => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const text = (v?: string | null) => {
  const s = (v ?? '').trim();
  return s === '' ? null : s;
};

export function exportRows(
  clientsById: Record<string, Client>,
  engagements: Engagement[],
  membersById: Record<string, TeamMember>,
  includeFinancials: boolean,
): (string | number | Date | null)[][] {
  const rows = engagements
    .filter((e) => !e.archived)
    .map((e) => {
      const c = clientsById[e.clientId];
      return [
        text(c?.code),
        text(c?.name),
        text(c?.industry),
        text(c?.address),
        text(c?.city),
        text(c?.stateCountry),
        text(c?.contactPerson),
        text(c?.designation),
        text(c?.email),
        text(c?.phone),
        text(c?.website),
        text(e.service),
        text(e.standardFramework),
        text(e.scope),
        text(e.status),
        isoToDate(e.initialEngagementDate),
        isoToDate(e.certificationCompletionDate),
        text(e.certificateNo),
        isoToDate(e.certificateValidFrom),
        isoToDate(e.certificateValidTo),
        text(e.certificationBodyOrLA),
        isoToDate(e.surveillanceRenewalDueDate),
        isoToDate(e.lastAuditReviewDate),
        isoToDate(e.nextAuditReviewDate),
        includeFinancials ? (e.contractValueINR ?? null) : null,
        includeFinancials ? text(e.paymentStatus) : null,
        text(e.ownerId ? membersById[e.ownerId]?.name : ''),
        text(e.leadSource || c?.leadSource),
        text(c?.rating),
        text(e.remarks),
      ];
    });
  return [[...EXPECTED_HEADERS], ...rows];
}

/** The workbook as bytes (sheet "Client Database", like her template). */
export function exportWorkbook(rows: (string | number | Date | null)[][]): Uint8Array {
  const sheet = utils.aoa_to_sheet(rows, { cellDates: true, dateNF: 'dd-mmm-yyyy' });
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, 'Client Database');
  return write(book, { type: 'array', bookType: 'xlsx', cellDates: true }) as Uint8Array;
}

export function downloadWorkbook(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
