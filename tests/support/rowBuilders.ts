// Builders for the sample status-view rows the fake Supabase (./auth.ts) answers. Moved here
// from src/lib/data/sampleRows.ts in step 2-d, when Clients started reading the database, so
// the app no longer ships them. Rows have the 41 view columns the app reads (no contract_value
// or payment_status since step 2-f: values come from ./financialsRows.ts, as the app reads them
// only from engagement_financials) and go through the same mapping code as live rows. Used by
// ./pipelineRows.ts and ./activeClientRows.ts.
// Must not import ./auth.ts: unit tests import this file, and Vitest must not load Playwright.
// Dummy data only (CLAUDE.md rule 9): fake companies, contacts, @example.com emails,
// +91 00000 phones. Nothing here is a real client.
import type { StatusViewRow } from '../../src/lib/data/queries';

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

/** Client01 is both a lead in ./pipelineRows.ts and a client in ./activeClientRows.ts. */
export const SAMPLE_CLIENT_01 = sampleClient('01', 'Pune', 'IT Services');
