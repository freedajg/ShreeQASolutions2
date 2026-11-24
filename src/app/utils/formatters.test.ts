import { describe, expect, it } from 'vitest';
import type { AppSettings, Engagement } from '../types/crm';
import {
  addMonths,
  computeRenewalInfo,
  formatTimestampIST,
  generate30ColumnCSV,
} from './formatters';

// The same cycles as the certification_types lookup (supabase/migrations/…_lookups.sql).
const settings = {
  serviceCycles: {
    'ISO 27001': { surveillanceMonths: 12, recertMonths: 36 },
    'ISO 9001': { surveillanceMonths: 12, recertMonths: 36 },
    CMMI: { surveillanceMonths: null, recertMonths: 36 },
    'SOC 2': { surveillanceMonths: null, recertMonths: 12 },
    DPDP: { surveillanceMonths: null, recertMonths: null },
  },
} as unknown as AppSettings;

const eng = (patch: Partial<Engagement>): Engagement =>
  ({
    id: 'e',
    clientId: 'c',
    service: 'ISO 27001',
    status: 'Certified',
    notes: [],
    emails: [],
    ...patch,
  }) as Engagement;

// Reference date of the DUMMY workbook's Test Notes sheet.
const AS_OF = '2026-09-29';

describe('computeRenewalInfo (same rule as app.renewal_info in the database)', () => {
  it('ISO 27001 certified 14 months ago with no dates is Overdue, estimated (PRD FR-4)', () => {
    const r = computeRenewalInfo(
      eng({ certificationCompletionDate: '2025-07-29' }),
      AS_OF,
      settings,
    );
    expect(r.bucket).toBe('Overdue');
    expect(r.isEstimated).toBe(true);
    expect(r.eventKind).toBe('Surveillance audit');
  });

  it('CMMI appraised 2 years 10 months ago is in 31–90 days (PRD FR-4)', () => {
    const r = computeRenewalInfo(
      eng({ service: 'CMMI', certificationCompletionDate: '2023-11-29' }),
      AS_OF,
      settings,
    );
    expect(r.bucket).toBe('31–90 days');
    expect(r.eventKind).toBe('Recertification');
  });

  it('uses Surveillance Due before Next Audit before Valid To', () => {
    const r = computeRenewalInfo(
      eng({
        surveillanceRenewalDueDate: '2026-01-09',
        nextAuditReviewDate: '2026-05-01',
        certificateValidTo: '2027-01-01',
      }),
      AS_OF,
      settings,
    );
    expect(r.dueDate).toBe('2026-01-09');
    expect(r.isEstimated).toBe(false);
  });

  it('matches the Test Notes rows (16, 46 days)', () => {
    expect(
      computeRenewalInfo(
        eng({ service: 'SOC 2', nextAuditReviewDate: '2026-10-15' }),
        AS_OF,
        settings,
      ),
    ).toMatchObject({
      bucket: 'Due in 30 days',
      daysDelta: 16,
    });
    expect(
      computeRenewalInfo(
        eng({ service: 'CMMI', certificateValidTo: '2026-11-14' }),
        AS_OF,
        settings,
      ),
    ).toMatchObject({
      bucket: '31–90 days',
      daysDelta: 46,
      eventKind: 'Recertification',
    });
  });

  it('gives no date for a type with no cycle (DPDP stays off the Radar)', () => {
    const r = computeRenewalInfo(
      eng({ service: 'DPDP', certificationCompletionDate: '2025-01-01' }),
      AS_OF,
      settings,
    );
    expect(r.dueDate).toBeNull();
    expect(r.bucket).toBeNull();
  });
});

describe('addMonths', () => {
  it('clamps to the end of a shorter month, like Postgres', () => {
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2025-08-05', 12)).toBe('2026-08-05');
  });
});

describe('formatTimestampIST', () => {
  it('converts a UTC timestamp to IST', () => {
    expect(formatTimestampIST('2026-09-13T04:10:00+00:00')).toBe('13-Sep-2026 · 09:40 IST');
    expect(formatTimestampIST('2026-09-30T20:00:00Z')).toBe('01-Oct-2026 · 01:30 IST');
  });
  it('shows a bare date as a date, and nothing as a dash', () => {
    expect(formatTimestampIST('2026-09-13')).toBe('13-Sep-2026');
    expect(formatTimestampIST(undefined)).toBe('—');
  });
});

describe('generate30ColumnCSV', () => {
  const client = {
    id: 'c',
    code: 'SQAS-C001',
    name: '=HYPERLINK("x")',
    industry: '',
    address: '',
    city: '',
    stateCountry: '',
    contactPerson: '',
    designation: '',
    email: '',
    phone: '',
    website: '',
    leadSource: '',
    rating: '',
  };
  it('has the 30 columns in her order and neutralises spreadsheet formulas', () => {
    const csv = generate30ColumnCSV({ c: client }, [eng({ contractValueINR: 500000 })], {}, false);
    const [header, row] = csv.split('\n');
    expect(header.split(',')).toHaveLength(30);
    expect(row.startsWith('SQAS-C001,"\'=HYPERLINK(""x"")"')).toBe(true);
    // Values hidden when the person has no values access.
    expect(row).not.toContain('500000');
  });
});
