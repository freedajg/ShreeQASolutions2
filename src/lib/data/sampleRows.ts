// Sample data the app still ships until the screens read the database: the Clients rows (until
// 2-d reads `active_clients`) and the owner names (until 2-e reads `team_members`). They have
// the views' own 43-column shape and go through the same mapping code as live rows.
// The Pipeline rows moved to tests/support/pipelineRows.ts in 2-c (the board reads `pipeline`);
// they reuse the builders below. 2-d moves the rest to tests/support/; 2-e deletes this file.
// Dummy data only (CLAUDE.md rule 9): fake companies, contacts, @example.com emails,
// +91 00000 phones, made-up amounts. Nothing here is a real client.
import type { StatusViewRow } from './queries';

// Must match ACCOUNTS in tests/support/auth.ts (ids and names); sampleRows.test.ts checks it.
export const SAMPLE_OWNER_IDS = {
  owner: 'e2e00000-0000-4000-8000-000000000001',
  consultant: 'e2e00000-0000-4000-8000-000000000011',
  marketing: 'e2e00000-0000-4000-8000-000000000021',
} as const;

/** Names for owner ids until 2-e reads `team_members`. */
export const SAMPLE_TEAM: readonly { id: string; fullName: string }[] = [
  { id: SAMPLE_OWNER_IDS.owner, fullName: 'Demo Owner 1' },
  { id: SAMPLE_OWNER_IDS.consultant, fullName: 'Demo Consultant 1' },
  { id: SAMPLE_OWNER_IDS.marketing, fullName: 'Demo Marketing 1' },
];

const BLANK: StatusViewRow = {
  archived_at: null,
  certificate_number: null,
  certification_body: null,
  certification_type: null,
  client_address: null,
  client_archived_at: null,
  client_city: null,
  client_code: null,
  client_contact_person: null,
  client_designation: null,
  client_do_not_contact: null,
  client_email: null,
  client_id: null,
  client_industry: null,
  client_name: null,
  client_phone: null,
  client_priority: null,
  client_state_country: null,
  client_website: null,
  completion_date: null,
  contract_value: null,
  created_at: null,
  created_by: null,
  date_is_estimated: null,
  id: null,
  initial_engagement_date: null,
  last_audit_date: null,
  last_contacted_on: null,
  lead_source: null,
  next_audit_date: null,
  next_follow_up_on: null,
  owner_id: null,
  payment_status: null,
  remarks: null,
  scope: null,
  standard_framework: null,
  status: null,
  status_group: null,
  status_sort_order: null,
  surveillance_due_date: null,
  updated_at: null,
  valid_from: null,
  valid_to: null,
};

const SORT_ORDER: Record<string, number> = {
  Lead: 1,
  Proposal: 2,
  Certified: 6,
  'Renewal Due': 7,
  Completed: 8,
  'On Hold': 9,
};

const GROUP: Record<string, StatusViewRow['status_group']> = {
  Lead: 'pipeline',
  Proposal: 'pipeline',
  Certified: 'active',
  'Renewal Due': 'active',
  Completed: 'active',
  'On Hold': 'paused',
};

// Client NN: "ClientNN Demo Ltd", contact "Contact NN", clientNN@example.com, +91 00000 000NN.
export function sampleClient(nn: string, city: string, industry: string): Partial<StatusViewRow> {
  return {
    client_id: `5a3d1e00-0000-4000-8000-0000000000${nn}`,
    client_code: `C0${nn}`,
    client_name: `Client${nn} Demo Ltd`,
    client_contact_person: `Contact ${nn}`,
    client_designation: 'Quality Head',
    client_email: `client${nn}@example.com`,
    client_phone: `+91 00000 000${nn}`,
    client_city: city,
    client_state_country: 'India',
    client_industry: industry,
    client_priority: 'Medium',
    client_do_not_contact: false,
  };
}

/** One status-view row: engagement NN of the given client, every other column empty. */
export function sampleRow(
  n: string,
  status: string,
  clientFields: Partial<StatusViewRow>,
  fields: Partial<StatusViewRow>,
): StatusViewRow {
  return {
    ...BLANK,
    ...clientFields,
    id: `e1a90000-0000-4000-8000-0000000000${n}`,
    status,
    status_group: GROUP[status],
    status_sort_order: SORT_ORDER[status],
    ...fields,
  };
}

/** Client01 is both a client here and a lead in tests/support/pipelineRows.ts. */
export const SAMPLE_CLIENT_01 = sampleClient('01', 'Pune', 'IT Services');
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
