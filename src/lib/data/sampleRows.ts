// Sample rows for Pipeline and Clients in step 2-b, before the screens read the database
// (2-c: `pipeline`, 2-d: `active_clients`). They have the views' own 43-column shape and go
// through the same mapping code as live rows, so in 2-c the fake Supabase in the browser tests
// can answer with these same rows and the screenshots don't change again.
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
function client(nn: string, city: string, industry: string): Partial<StatusViewRow> {
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

function row(
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

const C01 = client('01', 'Pune', 'IT Services');
const C02 = client('02', 'Bengaluru', 'Fintech');
const C03 = client('03', 'Chennai', 'Manufacturing');
const C04 = client('04', 'Hyderabad', 'SaaS');
const C05 = client('05', 'Mumbai', 'AI Products');
const C06 = client('06', 'Noida', 'IT Services');
const C07 = client('07', 'Kochi', 'Telecom');
const C08 = client('08', 'Indore', 'Logistics');
const C09 = client('09', 'Pune', 'IT Services');
const C10 = client('10', 'Ahmedabad', 'Medical Devices');
const C11 = client('11', 'Gurugram', 'BPO');
const C12 = client('12', 'Kolkata', 'Healthcare');

/** `pipeline` view: Lead, Proposal, On Hold, in the view's order (sort order, client name). */
export const SAMPLE_PIPELINE_ROWS: readonly StatusViewRow[] = [
  row('01', 'Lead', C01, {
    certification_type: 'CMMI',
    standard_framework: 'DEV ML3',
    owner_id: SAMPLE_OWNER_IDS.owner,
    lead_source: 'Referral',
    contract_value: 1200000,
    last_contacted_on: '2026-09-28',
    next_follow_up_on: '2026-10-05',
    remarks: 'Demo remark.',
  }),
  row('02', 'Lead', C02, {
    certification_type: 'ISO 27001',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    lead_source: 'LinkedIn',
    contract_value: 450000,
    last_contacted_on: '2026-09-15',
    remarks: 'Demo remark.',
  }),
  // No value yet: shows no amount, and adds nothing to the column total.
  row('03', 'Lead', C03, {
    certification_type: 'ISO 9001',
    owner_id: SAMPLE_OWNER_IDS.marketing,
    lead_source: 'Website',
  }),
  row('07', 'Lead', C07, {
    certification_type: 'ISO 20000-1',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    lead_source: 'Event',
    contract_value: 350000,
    last_contacted_on: '2026-09-24',
  }),
  row('04', 'Proposal', C04, {
    certification_type: 'SOC 2',
    owner_id: SAMPLE_OWNER_IDS.owner,
    lead_source: 'Partner',
    contract_value: 800000,
    last_contacted_on: '2026-09-30',
    next_follow_up_on: '2026-10-07',
    remarks: 'Demo remark.',
  }),
  // No owner: every lead must have one (PRD FR-5); the screen says "No owner".
  row('05', 'Proposal', C05, {
    certification_type: 'ISO 42001',
    lead_source: 'Website',
    contract_value: 600000,
    last_contacted_on: '2026-09-10',
  }),
  // Archived: left out by the mapping code, so it never shows.
  row('08', 'Proposal', C08, {
    certification_type: 'ISO 22301',
    owner_id: SAMPLE_OWNER_IDS.owner,
    contract_value: 300000,
    archived_at: '2026-09-01T10:00:00+05:30',
  }),
  row('06', 'On Hold', C06, {
    certification_type: 'VAPT',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    lead_source: 'Existing Client',
    contract_value: 250000,
    last_contacted_on: '2026-08-20',
    remarks: 'Demo remark.',
  }),
];

/** `active_clients` view: Certified, Renewal Due, Completed; Client01 is also a lead above. */
export const SAMPLE_ACTIVE_CLIENT_ROWS: readonly StatusViewRow[] = [
  row('21', 'Certified', C01, {
    certification_type: 'ISO 27001',
    owner_id: SAMPLE_OWNER_IDS.owner,
    completion_date: '2024-03-15',
    valid_from: '2024-03-15',
    valid_to: '2027-03-14',
    last_audit_date: '2026-03-10',
    contract_value: 650000,
    payment_status: 'Paid',
  }),
  row('22', 'Certified', C09, {
    certification_type: 'CMMI',
    standard_framework: 'DEV ML3',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    completion_date: '2025-06-01',
    valid_to: '2028-05-31',
    last_audit_date: '2025-06-01',
    contract_value: 1500000,
    payment_status: 'Partially Paid',
  }),
  row('23', 'Renewal Due', C09, {
    certification_type: 'ISO 9001',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    completion_date: '2023-11-21',
    valid_to: '2026-11-20',
    last_audit_date: '2025-11-18',
    contract_value: 300000,
    payment_status: 'Paid',
  }),
  // Completed with no certificate dates: shown empty, never estimated in the browser.
  row('24', 'Completed', C10, {
    certification_type: 'ISO 13485',
    owner_id: SAMPLE_OWNER_IDS.owner,
    completion_date: '2025-02-10',
  }),
  row('25', 'Certified', C11, {
    certification_type: 'SOC 1',
    owner_id: SAMPLE_OWNER_IDS.owner,
    completion_date: '2026-01-31',
    valid_to: '2027-01-30',
    last_audit_date: '2026-01-31',
    contract_value: 700000,
    payment_status: 'Not Invoiced',
  }),
  row('26', 'Renewal Due', C11, {
    certification_type: 'ISO 27701',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    completion_date: '2023-10-30',
    valid_to: '2026-10-29',
    last_audit_date: '2025-10-28',
    contract_value: 400000,
    payment_status: 'Overdue',
  }),
  row('27', 'Certified', C12, {
    certification_type: 'ISO 27001',
    owner_id: SAMPLE_OWNER_IDS.consultant,
    completion_date: '2025-08-12',
    valid_to: '2028-08-11',
    last_audit_date: '2025-08-12',
    contract_value: 550000,
    payment_status: 'Paid',
  }),
];
