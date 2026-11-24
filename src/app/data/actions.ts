// Every change the screens make. Each one runs as the signed-in person, so the database row
// rules and triggers decide what is allowed and write the activity log (FR-12). Nothing here
// sends email: only sendDrafts() asks the send-email function, after a person pressed Send.
import type { DrishtiClient } from '../../lib/supabase/client';
import type { Database } from '../../types/database';
import { dataErrorMessage, toSaveError } from '../../lib/data/errors';
import type {
  Client,
  Engagement,
  EngagementStatus,
  Role,
  ServiceType,
  TagTone,
} from '../types/crm';

type Db = DrishtiClient;
type Tables = Database['public']['Tables'];

/** Throws an Error with a message fit for a toast. */
function check(error: unknown): void {
  if (error) throw new Error(toSaveError(error).message);
}

const ROLE_CODES: Record<Role, 'owner' | 'consultant' | 'marketing'> = {
  'Owner/Admin': 'owner',
  Consultant: 'consultant',
  Marketing: 'marketing',
};

const empty = (v: string | undefined | null) => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

// ---------------------------------------------------------------------------
// Clients and engagements
// ---------------------------------------------------------------------------
const CLIENT_COLUMNS: Partial<Record<keyof Client, string>> = {
  code: 'client_code',
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
  rating: 'priority',
  doNotContact: 'do_not_contact',
};

export async function updateClient(db: Db, clientId: string, patch: Partial<Client>) {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const col = CLIENT_COLUMNS[key as keyof Client];
    if (col) row[col] = typeof value === 'string' ? empty(value) : value;
    if (key === 'archived') row.archived_at = value ? new Date().toISOString() : null;
  }
  if (Object.keys(row).length === 0) return;
  const { data, error } = await db
    .from('clients')
    .update(row as Tables['clients']['Update'])
    .eq('id', clientId)
    .select('id');
  check(error);
  if (!data?.length) throw new Error("You can't change this client.");
}

const ENGAGEMENT_COLUMNS: Partial<Record<keyof Engagement, string>> = {
  service: 'certification_type',
  standardFramework: 'standard_framework',
  scope: 'scope',
  closedReason: 'closed_reason',
  initialEngagementDate: 'initial_engagement_date',
  certificationCompletionDate: 'completion_date',
  certificateNo: 'certificate_number',
  certificateValidFrom: 'valid_from',
  certificateValidTo: 'valid_to',
  certificationBodyOrLA: 'certification_body',
  surveillanceRenewalDueDate: 'surveillance_due_date',
  lastAuditReviewDate: 'last_audit_date',
  nextAuditReviewDate: 'next_audit_date',
  ownerId: 'owner_id',
  leadSource: 'lead_source',
  remarks: 'remarks',
  lastContactedDate: 'last_contacted_on',
  nextFollowUpDate: 'next_follow_up_on',
};

export async function updateEngagement(db: Db, engagementId: string, patch: Partial<Engagement>) {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const col = ENGAGEMENT_COLUMNS[key as keyof Engagement];
    if (col) row[col] = typeof value === 'string' ? empty(value) : (value ?? null);
    if (key === 'archived') row.archived_at = value ? new Date().toISOString() : null;
  }
  if (Object.keys(row).length > 0) {
    const { data, error } = await db
      .from('engagements')
      .update(row as Tables['engagements']['Update'])
      .eq('id', engagementId)
      .select('id');
    check(error);
    if (!data?.length) throw new Error("You can't change this engagement.");
  }
  if (patch.status) await changeStatus(db, engagementId, patch.status);
  if ('contractValueINR' in patch || 'paymentStatus' in patch) {
    const money: Tables['engagement_financials']['Update'] = {};
    if ('contractValueINR' in patch) money.contract_value = patch.contractValueINR ?? null;
    if ('paymentStatus' in patch) money.payment_status = patch.paymentStatus ?? null;
    // Update first (engagement_id itself is never updatable); add the row if there is none yet.
    const { data: updated, error } = await db
      .from('engagement_financials')
      .update(money)
      .eq('engagement_id', engagementId)
      .select('engagement_id');
    check(error);
    if (!updated?.length) {
      const { error: insertError } = await db
        .from('engagement_financials')
        .insert({ ...money, engagement_id: engagementId });
      check(insertError);
    }
  }
}

export async function changeStatus(db: Db, engagementId: string, status: EngagementStatus) {
  const { error } = await db.rpc('change_engagement_status', {
    p_engagement_id: engagementId,
    p_new_status: status,
  });
  check(error);
}

export async function addNote(
  db: Db,
  engagementId: string,
  summary: string,
  nextStep: string,
  heldById: string,
) {
  const { error } = await db.from('engagement_notes').insert({
    engagement_id: engagementId,
    summary: summary.trim(),
    next_step: empty(nextStep),
    held_by: heldById || null,
  });
  check(error);
}

export interface NewLeadInput {
  existingClientId?: string;
  client?: { name: string; contactPerson: string; email: string; city: string; phone: string };
  service: ServiceType | '';
  standardFramework: string;
  leadSource: string;
  ownerId: string;
  contractValue?: number;
  note: string;
}

/** Adds a lead: a new client (or an existing one) and its first engagement. Nothing invented. */
export async function createLead(db: Db, input: NewLeadInput): Promise<void> {
  let clientId = input.existingClientId;
  if (!clientId) {
    const c = input.client!;
    const { data, error } = await db
      .from('clients')
      .insert({
        name: c.name.trim(),
        contact_person: empty(c.contactPerson),
        email: empty(c.email)?.toLowerCase() ?? null,
        city: empty(c.city),
        phone: empty(c.phone),
      })
      .select('id')
      .single();
    check(error);
    clientId = data!.id;
  }
  const { data: eng, error } = await db
    .from('engagements')
    .insert({
      client_id: clientId,
      certification_type: empty(input.service),
      standard_framework: empty(input.standardFramework),
      status: 'Lead',
      lead_source: empty(input.leadSource),
      owner_id: empty(input.ownerId),
      initial_engagement_date: new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10),
    })
    .select('id')
    .single();
  if (error)
    throw new Error(
      input.existingClientId
        ? dataErrorMessage(toSaveError(error))
        : `The client was saved, but the lead wasn't. ${toSaveError(error).message}`,
    );
  if (input.contractValue !== undefined && Number.isFinite(input.contractValue)) {
    const { error: e2 } = await db
      .from('engagement_financials')
      .insert({ engagement_id: eng.id, contract_value: input.contractValue });
    check(e2);
  }
  if (input.note.trim()) await addNote(db, eng.id, input.note, '', input.ownerId);
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
export async function createTag(db: Db, name: string, tone: TagTone): Promise<string> {
  const { data, error } = await db
    .from('tags')
    .insert({ name: name.trim(), tone })
    .select('id')
    .single();
  check(error);
  return data!.id;
}

export async function setClientTag(db: Db, clientId: string, tagId: string, on: boolean) {
  const { error } = on
    ? await db.from('client_tags').insert({ client_id: clientId, tag_id: tagId })
    : await db.from('client_tags').delete().eq('client_id', clientId).eq('tag_id', tagId);
  check(error);
}

export async function tagClients(db: Db, clientIds: string[], tagId: string) {
  const { error } = await db.from('client_tags').upsert(
    clientIds.map((client_id) => ({ client_id, tag_id: tagId })),
    { onConflict: 'client_id,tag_id', ignoreDuplicates: true },
  );
  check(error);
}

// ---------------------------------------------------------------------------
// Email: drafts are created here; sending is only sendDrafts() (a person pressed Send)
// ---------------------------------------------------------------------------
export async function createDraft(
  db: Db,
  d: {
    engagementId: string;
    kind: 'renewal' | 'manual' | 'bulk';
    subject: string;
    body: string;
    reason?: string;
    batchId?: string;
  },
): Promise<string> {
  const { data, error } = await db
    .from('email_drafts')
    // client_id, owner_id and to_email are filled by the database from the engagement.
    .insert({
      engagement_id: d.engagementId,
      kind: d.kind,
      subject: d.subject,
      body: d.body,
      trigger_reason: d.reason ?? null,
      batch_id: d.batchId ?? null,
    } as unknown as Tables['email_drafts']['Insert'])
    .select('id')
    .single();
  check(error);
  return data!.id;
}

export async function createBatch(
  db: Db,
  subject: string,
  body: string,
  filterSummary: string,
  total: number,
): Promise<string> {
  const { data, error } = await db
    .from('email_batches')
    .insert({
      subject_template: subject,
      body_template: body,
      filter_summary: filterSummary.slice(0, 1000),
      total,
    })
    .select('id')
    .single();
  check(error);
  return data!.id;
}

export interface SendResult {
  testMode: boolean;
  results: { draftId: string; status: 'sent' | 'failed'; reason?: string; from?: string }[];
}

export async function sendDrafts(
  db: Db,
  draftIds: string[],
  edits?: Record<string, { subject?: string; body?: string }>,
): Promise<SendResult> {
  const { data, error } = await db.functions.invoke<SendResult>('send-email', {
    body: { draftIds, edits },
  });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? "Couldn't reach the email service. Try again.");
  }
  return data!;
}

export async function skipDraft(db: Db, draftId: string) {
  const { error } = await db.from('email_drafts').update({ status: 'skipped' }).eq('id', draftId);
  check(error);
}

export async function rescheduleDraft(db: Db, draftId: string, date: string) {
  const { error } = await db
    .from('email_drafts')
    .update({ status: 'rescheduled', scheduled_for: date })
    .eq('id', draftId);
  check(error);
}

export async function runReminderEngine(db: Db, asOf: string) {
  const { data, error } = await db.rpc('run_reminder_engine', { p_as_of: asOf });
  check(error);
  const row = Array.isArray(data) ? data[0] : data;
  return { renewal: row?.renewal_drafts ?? 0, followUp: row?.follow_up_drafts ?? 0 };
}

// ---------------------------------------------------------------------------
// Team and settings
// ---------------------------------------------------------------------------
async function invokeOrThrow(db: Db, fn: string, body: Record<string, unknown>) {
  const { data, error } = await db.functions.invoke(fn, { body });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? 'The request failed. Try again.');
  }
  return data;
}

export const inviteMember = (db: Db, fullName: string, email: string, role: Role) =>
  invokeOrThrow(db, 'team-admin', { action: 'invite', fullName, email, role: ROLE_CODES[role] });

export const setMemberActive = (db: Db, memberId: string, active: boolean) =>
  invokeOrThrow(db, 'team-admin', { action: active ? 'reactivate' : 'deactivate', memberId });

export async function updateProfile(
  db: Db,
  memberId: string,
  patch: {
    role?: Role;
    canSeeValues?: boolean;
    bookingLink?: string;
    theme?: 'light' | 'dark' | 'system';
  },
) {
  const row: Record<string, unknown> = {};
  if (patch.role) row.role = ROLE_CODES[patch.role];
  if (patch.canSeeValues !== undefined) row.can_see_values = patch.canSeeValues;
  if (patch.bookingLink !== undefined) row.booking_link = empty(patch.bookingLink);
  if (patch.theme) row.theme_preference = patch.theme;
  const { data, error } = await db
    .from('profiles')
    .update(row as Tables['profiles']['Update'])
    .eq('id', memberId)
    .select('id');
  check(error);
  if (!data?.length) throw new Error("You can't change this member.");
}

export async function connectOutlook(db: Db) {
  const data = (await invokeOrThrow(db, 'outlook-connect', { action: 'start' })) as { url: string };
  window.location.assign(data.url);
}

export const disconnectOutlook = (db: Db) =>
  invokeOrThrow(db, 'outlook-connect', { action: 'disconnect' });

export async function updateSettings(db: Db, patch: Record<string, unknown>) {
  const { error } = await db
    .from('app_settings')
    .update(patch as Tables['app_settings']['Update'])
    .eq('id', 1);
  check(error);
}

export async function updateCycle(
  db: Db,
  code: string,
  surveillanceMonths: number | null,
  recertMonths: number | null,
) {
  const { error } = await db
    .from('certification_types')
    .update({ surveillance_months: surveillanceMonths, recert_months: recertMonths })
    .eq('code', code);
  check(error);
}

// ---------------------------------------------------------------------------
// Import, Drishti, workroom, invoices, outreach, web leads
// ---------------------------------------------------------------------------
export async function commitImport(
  db: Db,
  fileName: string,
  rows: unknown[],
  counts: {
    total: number;
    accepted: number;
    flagged: number;
    duplicates: number;
    rejected: number;
  },
  flags: unknown[],
) {
  const { error } = await db.rpc('commit_import', {
    p_file_name: fileName,
    p_rows: rows as never,
    p_counts: counts as never,
    p_flags: flags as never,
  });
  check(error);
}

export async function applyProposal(
  db: Db,
  engagementId: string,
  changes: {
    status?: string;
    next_follow_up_on?: string;
    note_summary?: string;
    note_next_step?: string;
  },
) {
  const { error } = await db.rpc('apply_drishti_proposal', {
    p_engagement_id: engagementId,
    p_changes: changes as never,
  });
  check(error);
}

export async function updateDeliveryItem(db: Db, itemId: string, state: string) {
  const { error } = await db.from('delivery_items').update({ state }).eq('id', itemId);
  check(error);
}

export async function addDeliveryItem(
  db: Db,
  engagementId: string,
  kind: 'checklist' | 'gap' | 'document',
  label: string,
  detail: string,
) {
  const state = kind === 'checklist' ? 'open' : kind === 'gap' ? 'Missing' : 'Pending Client';
  const { error } = await db.from('delivery_items').insert({
    engagement_id: engagementId,
    kind,
    label: label.trim(),
    detail: empty(detail),
    state,
  });
  check(error);
}

export async function createInvoice(
  db: Db,
  engagementId: string,
  amount: number,
  provider: 'Tally Prime' | 'Zoho Books',
  invoiceNo: string,
) {
  const today = new Date(Date.now() + 330 * 60_000);
  const due = new Date(today.getTime() + 30 * 86400_000);
  const { error } = await db.from('invoices').insert({
    invoice_no: invoiceNo.trim(),
    engagement_id: engagementId,
    issued_on: today.toISOString().slice(0, 10),
    due_on: due.toISOString().slice(0, 10),
    amount,
    gst_amount: Math.round(amount * 0.18),
    status: 'Draft',
    sync_provider: provider,
  });
  check(error);
}

export async function setInvoiceStatus(
  db: Db,
  invoiceId: string,
  status: 'Sent' | 'Paid' | 'Partially Paid' | 'Overdue',
) {
  const { error } = await db.from('invoices').update({ status }).eq('id', invoiceId);
  check(error);
}

export async function queueWhatsApp(
  db: Db,
  clientId: string,
  engagementId: string,
  phone: string,
  template: string,
  body: string,
) {
  const { error } = await db.from('whatsapp_messages').insert({
    client_id: clientId,
    engagement_id: engagementId,
    contact_phone: empty(phone),
    template,
    body,
  });
  check(error);
}

export async function logCall(
  db: Db,
  c: {
    clientId: string;
    engagementId: string;
    ownerId: string;
    outcome: string;
    durationSec?: number;
    bookedSlot?: string;
    summary?: string;
  },
) {
  const { error } = await db.from('voice_calls').insert({
    client_id: c.clientId,
    engagement_id: c.engagementId,
    owner_id: c.ownerId || null,
    outcome: c.outcome,
    duration_sec: c.durationSec ?? null,
    booked_slot: empty(c.bookedSlot),
    summary: empty(c.summary),
  });
  check(error);
}

export async function submitWebLead(
  db: Db,
  p: {
    company: string;
    contact: string;
    email: string;
    phone: string;
    city: string;
    service: string;
    notes: string;
  },
) {
  const { error } = await db.rpc('submit_web_lead', {
    p_company: p.company,
    p_contact: p.contact,
    p_email: p.email,
    p_phone: p.phone,
    p_city: p.city,
    p_service: p.service,
    p_notes: p.notes,
  });
  check(error);
}

export async function askDrishti(db: Db, question: string) {
  const { data, error } = await db.functions.invoke('drishti-assistant', { body: { question } });
  if (error) throw new Error('Drishti is unavailable right now. Try again in a moment.');
  return data as {
    answer: string;
    source: 'gemini' | 'rules';
    proposals: {
      engagementId: string;
      clientName: string;
      summary: string;
      changes: {
        status?: string;
        next_follow_up_on?: string;
        note_summary?: string;
        note_next_step?: string;
      };
      before: { status: string | null; next_follow_up_on: string | null };
    }[];
  };
}
