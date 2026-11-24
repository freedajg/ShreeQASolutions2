// Inserts and updates made by the add and edit forms (Add and Edit, session 1). Each function
// sends only columns the database lets the app write (20261006100000_clients_engagements_rls.sql
// lines 253–272: never id, created_by, created_at or updated_at), turns off supabase-js's own
// retries (changes are never retried) and throws a DataError from toSaveError. Row-level
// security decides who may save what; the forms only hide what a role can't use.
import type {
  ClientInput,
  EngagementChanges,
  EngagementInput,
  FinancialsInput,
} from '../../types/crm';
import type { TablesInsert, TablesUpdate } from '../../types/database';
import type { DrishtiClient } from '../supabase/client';
import { DataError, toSaveError } from './errors';

// camelCase field → database column. Only granted insert/update columns are listed.
const CLIENT_COLUMN = {
  clientCode: 'client_code',
  name: 'name',
  industry: 'industry',
  address: 'address',
  city: 'city',
  stateCountry: 'state_country',
  contactPerson: 'contact_person',
  designation: 'designation',
  email: 'email',
  phone: 'phone',
  website: 'website',
  priority: 'priority',
  doNotContact: 'do_not_contact',
} as const satisfies Record<keyof ClientInput, string>;

const ENGAGEMENT_COLUMN = {
  clientId: 'client_id',
  certificationType: 'certification_type',
  standardFramework: 'standard_framework',
  scope: 'scope',
  status: 'status',
  initialEngagementDate: 'initial_engagement_date',
  completionDate: 'completion_date',
  certificateNumber: 'certificate_number',
  validFrom: 'valid_from',
  validTo: 'valid_to',
  certificationBody: 'certification_body',
  surveillanceDueDate: 'surveillance_due_date',
  lastAuditDate: 'last_audit_date',
  nextAuditDate: 'next_audit_date',
  ownerId: 'owner_id',
  leadSource: 'lead_source',
  remarks: 'remarks',
  lastContactedOn: 'last_contacted_on',
  nextFollowUpOn: 'next_follow_up_on',
} as const satisfies Record<keyof EngagementInput, string>;

/** Fields an engagement edit never sends (see EngagementChanges). */
const NOT_EDITABLE: readonly (keyof EngagementInput)[] = ['clientId', 'status'];

type Row = Record<string, string | number | boolean | null>;

/** Maps the given fields to columns; keys not in `columns` are dropped. */
function toRow<T extends object>(
  fields: Partial<T>,
  columns: Record<string, string>,
  skip: readonly string[] = [],
): Row {
  const row: Row = {};
  for (const [field, value] of Object.entries(fields)) {
    const column = columns[field];
    if (column && !skip.includes(field) && value !== undefined) {
      row[column] = value as Row[string];
    }
  }
  return row;
}

/** The fields whose value differs between the loaded record and the form (edit sends only these). */
export function changedFields<T extends object>(before: T, after: T): Partial<T> {
  const changes: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (before[key] !== after[key]) changes[key] = after[key];
  }
  return changes;
}

/** The only shape written to engagement_financials (a currency joins it in the next step). */
export function toFinancialsWrite(input: FinancialsInput): {
  contract_value: number | null;
  payment_status: string | null;
} {
  return { contract_value: input.contractValue, payment_status: input.paymentStatus };
}

export async function insertClient(
  client: DrishtiClient,
  input: ClientInput,
): Promise<{ id: string; clientCode: string | null }> {
  const { data, error, status } = await client
    .from('clients')
    .insert(toRow(input, CLIENT_COLUMN) as TablesInsert<'clients'>)
    .select('id, client_code')
    .single()
    .retry(false);
  if (error || !data) throw toSaveError(error, status);
  return { id: data.id, clientCode: data.client_code };
}

export async function insertEngagement(
  client: DrishtiClient,
  input: EngagementInput,
): Promise<{ id: string }> {
  const { data, error, status } = await client
    .from('engagements')
    .insert(toRow(input, ENGAGEMENT_COLUMN) as TablesInsert<'engagements'>)
    .select('id')
    .single()
    .retry(false);
  if (error || !data) throw toSaveError(error, status);
  return { id: data.id };
}

/**
 * Saves a client's changed fields. Matches the loaded `updated_at` too: if someone saved in
 * between (the touch_updated_at trigger moved it), or row-level security hides the row from
 * updates, no row matches and nothing is overwritten. Returns the new `updated_at`, or the
 * loaded one when there was nothing to save (no request).
 */
export async function updateClient(
  client: DrishtiClient,
  id: string,
  changes: Partial<ClientInput>,
  loadedUpdatedAt: string,
): Promise<string> {
  const row = toRow(changes, CLIENT_COLUMN);
  if (Object.keys(row).length === 0) return loadedUpdatedAt;
  const { data, error, status } = await client
    .from('clients')
    .update(row as TablesUpdate<'clients'>)
    .eq('id', id)
    .eq('updated_at', loadedUpdatedAt)
    .select('id, updated_at')
    .retry(false);
  if (error) throw toSaveError(error, status);
  if (!data || data.length !== 1) throw new DataError('changed-or-refused');
  return data[0].updated_at;
}

/** Same as updateClient, for an engagement. Never sends its client or its status. */
export async function updateEngagement(
  client: DrishtiClient,
  id: string,
  changes: EngagementChanges,
  loadedUpdatedAt: string,
): Promise<string> {
  const row = toRow(changes, ENGAGEMENT_COLUMN, NOT_EDITABLE);
  if (Object.keys(row).length === 0) return loadedUpdatedAt;
  const { data, error, status } = await client
    .from('engagements')
    .update(row as TablesUpdate<'engagements'>)
    .eq('id', id)
    .eq('updated_at', loadedUpdatedAt)
    .select('id, updated_at')
    .retry(false);
  if (error) throw toSaveError(error, status);
  if (!data || data.length !== 1) throw new DataError('changed-or-refused');
  return data[0].updated_at;
}

/**
 * Writes an engagement's contract value and payment status. No upsert: an upsert would also
 * set engagement_id, which has no update grant. `exists` (from the financials read) picks
 * insert or update. A cleared amount is saved as null; nothing is deleted.
 */
export async function saveFinancials(
  client: DrishtiClient,
  engagementId: string,
  input: FinancialsInput,
  exists: boolean,
): Promise<void> {
  const values = toFinancialsWrite(input);
  if (exists) {
    const { data, error, status } = await client
      .from('engagement_financials')
      .update(values)
      .eq('engagement_id', engagementId)
      .select('engagement_id')
      .retry(false);
    if (error) throw toSaveError(error, status);
    if (!data || data.length !== 1) throw new DataError('changed-or-refused');
    return;
  }
  const { error, status } = await client
    .from('engagement_financials')
    .insert({ engagement_id: engagementId, ...values })
    .retry(false);
  if (error) throw toSaveError(error, status);
}

// ---------------------------------------------------------------------------
// Add Lead: client (new or existing) → engagement → financials, as three requests (answer Q2).
// ---------------------------------------------------------------------------

export interface NewLead {
  /** A new client's details, or the id of an existing client. */
  client: ClientInput | { existingId: string };
  engagement: Omit<EngagementInput, 'clientId'>;
  /** Only for a user with values access who entered something; otherwise null (no request). */
  financials: FinancialsInput | null;
}

/** What is already saved from an earlier try, so Try again doesn't add anything twice. */
export interface SavedLeadParts {
  clientId?: string;
  engagementId?: string;
}

/** A save that stopped part-way: `saved` says what is already in the database. */
export class LeadSaveError extends Error {
  readonly error: DataError;
  readonly step: 'client' | 'engagement' | 'financials';
  readonly saved: SavedLeadParts;

  constructor(error: DataError, step: LeadSaveError['step'], saved: SavedLeadParts) {
    super(error.message);
    this.name = 'LeadSaveError';
    this.error = error;
    this.step = step;
    this.saved = saved;
  }
}

/**
 * Saves a new lead, skipping the parts already saved by an earlier try. Throws a LeadSaveError
 * that names the step that failed and what was saved before it.
 */
export async function saveLead(
  client: DrishtiClient,
  lead: NewLead,
  saved: SavedLeadParts = {},
): Promise<{ clientId: string; engagementId: string }> {
  let clientId = saved.clientId ?? ('existingId' in lead.client ? lead.client.existingId : '');
  let engagementId = saved.engagementId ?? '';
  let step: LeadSaveError['step'] = 'client';
  try {
    if (!clientId && !('existingId' in lead.client)) {
      clientId = (await insertClient(client, lead.client)).id;
    }
    step = 'engagement';
    if (!engagementId) {
      engagementId = (await insertEngagement(client, { ...lead.engagement, clientId })).id;
    }
    step = 'financials';
    if (lead.financials) await saveFinancials(client, engagementId, lead.financials, false);
    return { clientId, engagementId };
  } catch (error) {
    const partial: SavedLeadParts = {};
    if (clientId && !('existingId' in lead.client)) partial.clientId = clientId;
    if (engagementId) partial.engagementId = engagementId;
    throw new LeadSaveError(toSaveError(error), step, partial);
  }
}
