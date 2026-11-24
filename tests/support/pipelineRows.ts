// Sample rows the fake Supabase (./auth.ts) answers for the `pipeline` view. Moved here from
// src/lib/data/sampleRows.ts in step 2-c, when the board started reading the database, so the
// app no longer ships them. Same rows and order as since 2-b, so the screenshots don't change.
// Built with ./rowBuilders.ts (moved out of the app in 2-d); owner ids from ./team.ts (2-e).
// Must not import ./auth.ts: unit tests import this file, and Vitest must not load Playwright.
// Dummy data only (CLAUDE.md rule 9): fake companies, contacts, @example.com emails,
// +91 00000 phones; amounts are in ./financialsRows.ts. Nothing here is a real client.
import type { StatusViewRow } from '../../src/lib/data/queries';
import { SAMPLE_CLIENT_01, sampleClient, sampleRow } from './rowBuilders';
import { SAMPLE_OWNER_IDS } from './team';

const C01 = SAMPLE_CLIENT_01;
const C02 = sampleClient('02', 'Bengaluru', 'Fintech');
const C03 = sampleClient('03', 'Chennai', 'Manufacturing');
const C04 = sampleClient('04', 'Hyderabad', 'SaaS');
const C05 = sampleClient('05', 'Mumbai', 'AI Products');
const C06 = sampleClient('06', 'Noida', 'IT Services');
const C07 = sampleClient('07', 'Kochi', 'Telecom');
const C08 = sampleClient('08', 'Indore', 'Logistics');

/** `pipeline` view: Lead, Proposal, On Hold, in the view's order (sort order, client name). */
export const SAMPLE_PIPELINE_ROWS: readonly StatusViewRow[] = [
  sampleRow('01', 'Lead', C01, {
    certification_type: 'CMMI',
    standard_framework: 'DEV ML3',
    owner_id: SAMPLE_OWNER_IDS.owner,
    lead_source: 'Referral',
    last_contacted_on: '2026-09-28',
    next_follow_up_on: '2026-10-05',
    remarks: 'Demo remark.',
  }),
  sampleRow('02', 'Lead', C02, {
    certification_type: 'ISO 27001',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    lead_source: 'LinkedIn',
    last_contacted_on: '2026-09-15',
    remarks: 'Demo remark.',
  }),
  // No financials row (./financialsRows.ts): no amount on the card, "—" in the table, adds
  // nothing to the column total.
  sampleRow('03', 'Lead', C03, {
    certification_type: 'ISO 9001',
    owner_id: SAMPLE_OWNER_IDS.marketing,
    lead_source: 'Website',
  }),
  sampleRow('07', 'Lead', C07, {
    certification_type: 'ISO 20000-1',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    lead_source: 'Event',
    last_contacted_on: '2026-09-24',
  }),
  sampleRow('04', 'Proposal', C04, {
    certification_type: 'SOC 2',
    owner_id: SAMPLE_OWNER_IDS.owner,
    lead_source: 'Partner',
    last_contacted_on: '2026-09-30',
    next_follow_up_on: '2026-10-07',
    remarks: 'Demo remark.',
  }),
  // No owner: every lead must have one (PRD FR-5); the screen says "No owner".
  sampleRow('05', 'Proposal', C05, {
    certification_type: 'ISO 42001',
    lead_source: 'Website',
    last_contacted_on: '2026-09-10',
  }),
  // Archived: left out by the mapping code, so it never shows.
  sampleRow('08', 'Proposal', C08, {
    certification_type: 'ISO 22301',
    owner_id: SAMPLE_OWNER_IDS.owner,
    archived_at: '2026-09-01T10:00:00+05:30',
  }),
  sampleRow('06', 'On Hold', C06, {
    certification_type: 'VAPT',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    lead_source: 'Existing Client',
    last_contacted_on: '2026-08-20',
    remarks: 'Demo remark.',
  }),
];
