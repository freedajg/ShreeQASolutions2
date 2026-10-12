// Sample rows the fake Supabase (./auth.ts) answers for the `active_clients` view. Moved here
// from src/lib/data/sampleRows.ts in step 2-d, when the Clients list started reading the
// database, so the app no longer ships them. Same rows and order as since 2-b, so the Clients
// screenshots don't change. Built with ./rowBuilders.ts.
// Must not import ./auth.ts: unit tests import this file, and Vitest must not load Playwright.
// Dummy data only (CLAUDE.md rule 9): fake companies, contacts, @example.com emails,
// +91 00000 phones, made-up amounts. Nothing here is a real client.
import type { StatusViewRow } from '../../src/lib/data/queries';
import { SAMPLE_OWNER_IDS } from '../../src/lib/data/sampleRows';
import { SAMPLE_CLIENT_01, sampleClient, sampleRow } from './rowBuilders';

const C09 = sampleClient('09', 'Pune', 'IT Services');
const C10 = sampleClient('10', 'Ahmedabad', 'Medical Devices');
const C11 = sampleClient('11', 'Gurugram', 'BPO');
const C12 = sampleClient('12', 'Kolkata', 'Healthcare');

/** `active_clients` view: Certified, Renewal Due, Completed. */
export const SAMPLE_ACTIVE_CLIENT_ROWS: readonly StatusViewRow[] = [
  sampleRow('21', 'Certified', SAMPLE_CLIENT_01, {
    certification_type: 'ISO 27001',
    owner_id: SAMPLE_OWNER_IDS.owner,
    completion_date: '2024-03-15',
    valid_from: '2024-03-15',
    valid_to: '2027-03-14',
    last_audit_date: '2026-03-10',
    contract_value: 650000,
    payment_status: 'Paid',
  }),
  sampleRow('22', 'Certified', C09, {
    certification_type: 'CMMI',
    standard_framework: 'DEV ML3',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    completion_date: '2025-06-01',
    valid_to: '2028-05-31',
    last_audit_date: '2025-06-01',
    contract_value: 1500000,
    payment_status: 'Partially Paid',
  }),
  sampleRow('23', 'Renewal Due', C09, {
    certification_type: 'ISO 9001',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    completion_date: '2023-11-21',
    valid_to: '2026-11-20',
    last_audit_date: '2025-11-18',
    contract_value: 300000,
    payment_status: 'Paid',
  }),
  // Completed with no certificate dates: shown empty, never estimated in the browser.
  sampleRow('24', 'Completed', C10, {
    certification_type: 'ISO 13485',
    owner_id: SAMPLE_OWNER_IDS.owner,
    completion_date: '2025-02-10',
  }),
  sampleRow('25', 'Certified', C11, {
    certification_type: 'SOC 1',
    owner_id: SAMPLE_OWNER_IDS.owner,
    completion_date: '2026-01-31',
    valid_to: '2027-01-30',
    last_audit_date: '2026-01-31',
    contract_value: 700000,
    payment_status: 'Not Invoiced',
  }),
  sampleRow('26', 'Renewal Due', C11, {
    certification_type: 'ISO 27701',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    completion_date: '2023-10-30',
    valid_to: '2026-10-29',
    last_audit_date: '2025-10-28',
    contract_value: 400000,
    payment_status: 'Overdue',
  }),
  sampleRow('27', 'Certified', C12, {
    certification_type: 'ISO 27001',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    completion_date: '2025-08-12',
    valid_to: '2028-08-11',
    last_audit_date: '2025-08-12',
    contract_value: 550000,
    payment_status: 'Paid',
  }),
];
