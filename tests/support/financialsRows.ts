// Sample rows the fake Supabase (./auth.ts) answers for `engagement_financials` (step 2-f): the
// only source of values on screen. Same amounts as the view rows carried before 2-f, keyed by
// the same engagement ids (./rowBuilders.ts `sampleRow`), so the Owner's screens are unchanged.
// Two empty cases, as in the database: pipeline 03 has no row at all (added by someone without
// values access), active 24 has a row with no amount (like the seed's row 18, seed.sql line 344).
// Must not import ./auth.ts: unit tests import this file, and Vitest must not load Playwright.
// Dummy data only (CLAUDE.md rule 9): made-up amounts; nothing here is a real client.
import type { EngagementFinancialsRow } from '../../src/lib/data/queries';

const id = (n: string) => `e1a90000-0000-4000-8000-0000000000${n}`;
const row = (
  n: string,
  contract_value: number | null,
  payment_status: string | null = null,
): EngagementFinancialsRow => ({ engagement_id: id(n), contract_value, payment_status });

export const SAMPLE_FINANCIALS_ROWS: readonly EngagementFinancialsRow[] = [
  // pipeline (./pipelineRows.ts); 03 has no row
  row('01', 1200000),
  row('02', 450000),
  row('07', 350000),
  row('04', 800000),
  row('05', 600000),
  row('08', 300000), // archived engagement: never shown
  row('06', 250000),
  // active_clients (./activeClientRows.ts)
  row('21', 650000, 'Paid'),
  row('22', 1500000, 'Partially Paid'),
  row('23', 300000, 'Paid'),
  row('24', null, 'Not Invoiced'), // a row with no amount: "—" for Client10
  row('25', 700000, 'Not Invoiced'),
  row('26', 400000, 'Overdue'),
  row('27', 550000, 'Paid'),
];
