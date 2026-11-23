// The dropdown lists the fake Supabase (./auth.ts) answers (Add and Edit, session 2), copied
// value for value from supabase/migrations/20261003180745_lookups.sql. Codes, groups and sort
// orders must match the migration exactly: the app sends these codes back as foreign keys.
// Must not import ./auth.ts: unit tests may import this file, and Vitest must not load Playwright.

export type FakeLookupRow = { code: string; sort_order: number; active: boolean };
export type FakeStatusRow = {
  code: string;
  status_group: 'pipeline' | 'delivery' | 'active' | 'paused' | 'ended';
  sort_order: number;
};

const active = (codes: readonly string[]): FakeLookupRow[] =>
  codes.map((code, i) => ({ code, sort_order: i + 1, active: true }));

/** lookups.sql lines 78–94 (16 values, sort_order 1–16, all active by default, line 31). */
export const CERTIFICATION_TYPE_ROWS = active([
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

/** lookups.sql lines 96–106 (code, status_group, sort_order; no `active` column, line 35–41). */
export const STATUS_ROWS: FakeStatusRow[] = [
  { code: 'Lead', status_group: 'pipeline', sort_order: 1 },
  { code: 'Proposal', status_group: 'pipeline', sort_order: 2 },
  { code: 'In Progress', status_group: 'delivery', sort_order: 3 },
  { code: 'Implemented', status_group: 'delivery', sort_order: 4 },
  { code: 'Audit Completed', status_group: 'delivery', sort_order: 5 },
  { code: 'Certified', status_group: 'active', sort_order: 6 },
  { code: 'Renewal Due', status_group: 'active', sort_order: 7 },
  { code: 'Completed', status_group: 'active', sort_order: 8 },
  { code: 'On Hold', status_group: 'paused', sort_order: 9 },
  { code: 'Closed', status_group: 'ended', sort_order: 10 },
];

/** lookups.sql lines 108–113. */
export const PAYMENT_STATUS_ROWS = active([
  'Not Invoiced',
  'Partially Paid',
  'Paid',
  'Overdue',
  'NA',
]);

/** lookups.sql lines 115–118. */
export const PRIORITY_ROWS = active(['High', 'Medium', 'Low']);

/** lookups.sql lines 120–127. */
export const LEAD_SOURCE_ROWS = active([
  'Referral',
  'Website',
  'LinkedIn',
  'Existing Client',
  'Partner',
  'Event',
  'Other',
]);
