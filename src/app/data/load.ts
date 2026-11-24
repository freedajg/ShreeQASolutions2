// Loads everything the signed-in person may see and maps it to the screen types.
// Every read goes through the caller's own session, so row-level security decides what comes
// back (CLAUDE.md rule 3): Marketing simply receives leads only, no values, no email.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { SignedInUser } from '../../lib/auth/access';
import type {
  ActivityLogEntry,
  AppSettings,
  Client,
  ClientRating,
  ClosedReason,
  EmailRecord,
  Engagement,
  EngagementStatus,
  FollowUpDraft,
  ImportBatchRecord,
  InvoiceRecord,
  LeadSource,
  PaymentStatus,
  Role,
  ServiceType,
  Tag,
  TeamMember,
  VoiceCallRecord,
  WhatsAppThread,
} from '../types/crm';

type Db = SupabaseClient<Database>;

export interface CrmData {
  team: TeamMember[];
  clients: Client[];
  engagements: Engagement[];
  drafts: FollowUpDraft[];
  activityLog: ActivityLogEntry[];
  imports: ImportBatchRecord[];
  settings: AppSettings;
  tags: Tag[];
  invoices: InvoiceRecord[];
  whatsapp: WhatsAppThread[];
  voiceCalls: VoiceCallRecord[];
}

const ROLE_NAMES: Record<string, Role> = {
  owner: 'Owner/Admin',
  consultant: 'Consultant',
  marketing: 'Marketing',
};

const PAGE = 1000;

/** Reads every row of a query, page by page (the API returns at most 1000 rows at a time). */
async function all<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '—';

export async function loadCrmData(db: Db, me: SignedInUser): Promise<CrmData> {
  const isOwner = me.role === 'owner';
  const canEmail = me.role !== 'marketing';

  const [
    teamRows,
    myProfile,
    clientRows,
    engagementRows,
    financialRows,
    noteRows,
    tagRows,
    clientTagRows,
    settingsRow,
    certRows,
    lookups,
  ] = await Promise.all([
    isOwner
      ? db
          .from('profiles')
          .select(
            'id, full_name, email, role, booking_link, active, can_see_values, mailbox_connected',
          )
      : db.from('team_members').select('id, full_name, email, role, booking_link, active'),
    db
      .from('profiles')
      .select('id, booking_link, mailbox_connected, can_see_values')
      .eq('id', me.id)
      .maybeSingle(),
    all((a, b) => db.from('clients').select('*').order('name').range(a, b)),
    all((a, b) => db.from('engagements').select('*').order('created_at').range(a, b)),
    me.canSeeValues
      ? all((a, b) =>
          db
            .from('engagement_financials')
            .select('engagement_id, contract_value, payment_status')
            .range(a, b),
        )
      : Promise.resolve([]),
    all((a, b) =>
      db.from('engagement_notes').select('*').order('held_on', { ascending: false }).range(a, b),
    ),
    db.from('tags').select('id, name, tone').order('name'),
    all((a, b) => db.from('client_tags').select('client_id, tag_id').range(a, b)),
    db.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    db
      .from('certification_types')
      .select('code, surveillance_months, recert_months, active, sort_order')
      .order('sort_order'),
    Promise.all([
      db.from('payment_statuses').select('code').order('sort_order'),
      db.from('lead_sources').select('code').order('sort_order'),
      db.from('priorities').select('code').order('sort_order'),
    ]),
  ]);

  const [emailRows, threadRows, draftRows] = canEmail
    ? await Promise.all([
        all((a, b) => db.from('email_messages').select('*').order('sent_at').range(a, b)),
        all((a, b) => db.from('email_threads').select('id, engagement_id').range(a, b)),
        all((a, b) =>
          db.from('email_drafts').select('*').order('created_at', { ascending: false }).range(a, b),
        ),
      ])
    : [[], [], []];

  const [logRows, importRows, invoiceRows, waRows, callRows, itemRows] = await Promise.all([
    me.role === 'marketing'
      ? Promise.resolve([])
      : db
          .from('activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300)
          .then((r) => r.data ?? []),
    isOwner
      ? db
          .from('import_batches')
          .select('*')
          .order('imported_at', { ascending: false })
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    me.canSeeValues
      ? db
          .from('invoices')
          .select('*')
          .order('issued_on', { ascending: false })
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    canEmail
      ? db
          .from('whatsapp_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    canEmail
      ? db
          .from('voice_calls')
          .select('*')
          .order('called_at', { ascending: false })
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    canEmail
      ? db
          .from('delivery_items')
          .select('*')
          .order('sort_order')
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  // ---- team
  const own = myProfile.data;
  const team: TeamMember[] = (teamRows.data ?? []).map((p) => {
    const full = p as typeof p & { can_see_values?: boolean; mailbox_connected?: boolean };
    const role = ROLE_NAMES[p.role ?? ''] ?? 'Consultant';
    const isMe = p.id === me.id;
    return {
      id: p.id!,
      name: p.full_name || p.email || 'Team member',
      initials: initials(p.full_name || p.email || ''),
      title: role,
      role,
      email: p.email ?? '',
      bookingLink: (isMe ? own?.booking_link : p.booking_link) ?? '',
      outlookConnected: Boolean(isMe ? own?.mailbox_connected : full.mailbox_connected),
      mfaEnabled: role === 'Owner/Admin',
      active: p.active ?? true,
      canViewContractValues:
        role === 'Owner/Admin' || Boolean(isMe ? own?.can_see_values : full.can_see_values),
    };
  });
  const nameOf = new Map(team.map((t) => [t.id, t.name]));

  // ---- tags
  const tags: Tag[] = (tagRows.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    tone: t.tone as Tag['tone'],
  }));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const tagsOfClient = new Map<string, Tag[]>();
  for (const ct of clientTagRows) {
    const tag = tagById.get(ct.tag_id);
    if (tag) tagsOfClient.set(ct.client_id, [...(tagsOfClient.get(ct.client_id) ?? []), tag]);
  }

  // ---- engagements (+ values, notes, emails, workroom)
  const valueOf = new Map(financialRows.map((f) => [f.engagement_id, f]));
  const notesOf = new Map<string, Engagement['notes']>();
  for (const n of noteRows) {
    notesOf.set(n.engagement_id, [
      ...(notesOf.get(n.engagement_id) ?? []),
      {
        id: n.id,
        date: n.held_on,
        heldById: n.held_by ?? '',
        heldByName: (n.held_by && nameOf.get(n.held_by)) || 'Former member',
        summary: n.summary,
        nextStep: n.next_step ?? '',
        source: n.source as Engagement['notes'][number]['source'],
      },
    ]);
  }

  const emailsOf = new Map<string, EmailRecord[]>();
  for (const m of emailRows.filter((r) => r.direction === 'outbound')) {
    emailsOf.set(m.engagement_id, [
      ...(emailsOf.get(m.engagement_id) ?? []),
      {
        id: m.id,
        threadId: m.thread_id,
        subject: m.subject,
        body: m.body,
        sentAt: m.sent_at,
        sentById: m.sender_id ?? '',
        sentByName: (m.sender_id && nameOf.get(m.sender_id)) || m.from_email,
        sentFromEmail: m.from_email,
        likelyOpenedAt: m.opened_at ?? undefined,
      },
    ]);
  }
  // A client reply marks the latest email sent before it in the same thread.
  for (const r of emailRows.filter((m) => m.direction === 'inbound')) {
    const list = emailsOf.get(r.engagement_id) ?? [];
    const target = [...list]
      .reverse()
      .find((e) => e.threadId === r.thread_id && e.sentAt <= r.sent_at);
    if (target) {
      target.repliedAt = r.sent_at;
      target.replySnippet = r.body.slice(0, 280);
    }
  }

  const itemsOf = new Map<string, typeof itemRows>();
  for (const it of itemRows)
    itemsOf.set(it.engagement_id, [...(itemsOf.get(it.engagement_id) ?? []), it]);

  const engagements: Engagement[] = engagementRows.map((e) => {
    const v = valueOf.get(e.id);
    const items = itemsOf.get(e.id) ?? [];
    return {
      id: e.id,
      clientId: e.client_id,
      service: (e.certification_type ?? '') as ServiceType,
      standardFramework: e.standard_framework ?? '',
      scope: e.scope ?? '',
      status: (e.status ?? '') as EngagementStatus,
      closedReason: (e.closed_reason ?? undefined) as ClosedReason | undefined,
      initialEngagementDate: e.initial_engagement_date ?? undefined,
      certificationCompletionDate: e.completion_date ?? undefined,
      certificateNo: e.certificate_number ?? undefined,
      certificateValidFrom: e.valid_from ?? undefined,
      certificateValidTo: e.valid_to ?? undefined,
      certificationBodyOrLA: e.certification_body ?? undefined,
      surveillanceRenewalDueDate: e.surveillance_due_date ?? undefined,
      lastAuditReviewDate: e.last_audit_date ?? undefined,
      nextAuditReviewDate: e.next_audit_date ?? undefined,
      contractValueINR: v?.contract_value ?? undefined,
      paymentStatus: (v?.payment_status ?? undefined) as PaymentStatus | undefined,
      ownerId: e.owner_id ?? '',
      leadSource: (e.lead_source ?? undefined) as LeadSource | undefined,
      remarks: e.remarks ?? undefined,
      repliedAt: e.replied_at ?? undefined,
      createdById: e.created_by ?? '',
      lastContactedDate: e.last_contacted_on ?? undefined,
      nextFollowUpDate: e.next_follow_up_on ?? undefined,
      followUpCount: e.follow_up_count,
      notes: notesOf.get(e.id) ?? [],
      emails: emailsOf.get(e.id) ?? [],
      archived: e.archived_at !== null,
      checklist: items
        .filter((i) => i.kind === 'checklist')
        .map((i) => ({
          id: i.id,
          clause: i.label,
          task: i.detail ?? '',
          done: i.state === 'done',
        })),
      gapAnalysis: items
        .filter((i) => i.kind === 'gap')
        .map((i) => ({
          id: i.id,
          domain: i.label,
          currentState: i.state as 'Compliant' | 'Partial Gap' | 'Missing',
          ownerNote: i.detail ?? '',
        })),
      documents: items
        .filter((i) => i.kind === 'document')
        .map((i) => ({
          id: i.id,
          docName: i.label,
          status: i.state as 'Collected' | 'Pending Client' | 'Under Review',
          updatedAt: i.updated_at.slice(0, 10),
        })),
    };
  });

  // ---- clients (lead source shown from the client's first engagement that has one)
  const firstSource = new Map<string, LeadSource>();
  for (const e of engagements)
    if (e.leadSource && !firstSource.has(e.clientId)) firstSource.set(e.clientId, e.leadSource);
  const clients: Client[] = clientRows.map((c) => ({
    id: c.id,
    code: c.client_code ?? '',
    tags: tagsOfClient.get(c.id) ?? [],
    name: c.name,
    industry: c.industry ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    stateCountry: c.state_country ?? '',
    contactPerson: c.contact_person ?? '',
    designation: c.designation ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    website: c.website ?? '',
    leadSource: (firstSource.get(c.id) ?? '') as LeadSource,
    rating: (c.priority ?? '') as ClientRating,
    doNotContact: c.do_not_contact,
    archived: c.archived_at !== null,
    createdAt: c.created_at.slice(0, 10),
  }));
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  // ---- drafts
  const threadOf = new Map(threadRows.map((t) => [t.id, t.engagement_id]));
  const drafts: FollowUpDraft[] = draftRows.map((d) => ({
    id: d.id,
    engagementId: d.engagement_id,
    clientId: d.client_id,
    ownerId: d.owner_id ?? '',
    kind: d.kind === 'follow_up' ? 'lead-followup' : (d.kind as FollowUpDraft['kind']),
    triggerReason: d.trigger_reason ?? '',
    threadMode: d.thread_id && threadOf.has(d.thread_id) ? 'reply' : 'new-thread',
    threadId: d.thread_id ?? undefined,
    toEmail: d.to_email ?? undefined,
    subject: d.subject,
    body: d.body,
    scheduledFor: d.scheduled_for,
    status: d.status as FollowUpDraft['status'],
    failureReason: d.failure_reason ?? undefined,
    sentAt: d.sent_at ?? undefined,
    batchId: d.batch_id ?? undefined,
  }));

  // ---- activity log
  const activityLog: ActivityLogEntry[] = logRows.map((l) =>
    describeLog(l, nameOf, clientName, engagementRows),
  );

  // ---- settings
  const s = settingsRow.data;
  const certs = certRows.data ?? [];
  const settings: AppSettings = {
    followUpIntervalDays: (s?.follow_up_interval_days ?? 7) as 7 | 15,
    maxFollowUps: s?.max_follow_ups ?? 3,
    renewalReminderWindowsDays: [
      s?.renewal_windows_days?.[0] ?? 90,
      s?.renewal_windows_days?.[1] ?? 30,
    ],
    services: certs.filter((c) => c.active).map((c) => c.code as ServiceType),
    paymentStatuses: (lookups[0].data ?? []).map((r) => r.code as PaymentStatus),
    leadSources: (lookups[1].data ?? []).map((r) => r.code as LeadSource),
    ratings: (lookups[2].data ?? []).map((r) => r.code as ClientRating),
    cycles: certs.map((c) => ({
      serviceGroup: c.code,
      surveillanceYears: c.surveillance_months === null ? null : c.surveillance_months / 12,
      recertificationYears: c.recert_months === null ? null : c.recert_months / 12,
      description: c.surveillance_months
        ? `Surveillance every ${c.surveillance_months} months; recertification every ${c.recert_months} months`
        : c.recert_months
          ? `Cycle of ${c.recert_months} months`
          : 'No automatic cycle unless a date is entered',
    })),
    serviceCycles: Object.fromEntries(
      certs.map((c) => [
        c.code,
        { surveillanceMonths: c.surveillance_months, recertMonths: c.recert_months },
      ]),
    ),
    emailTestMode: s?.email_test_mode ?? true,
    m365Provider: (s?.m365_provider ?? 'unknown') as AppSettings['m365Provider'],
    m365AdminConsent: s?.m365_admin_consent ?? false,
    retention: {
      closedLeadsYears: s?.closed_leads_retention_years ?? 3,
      emailContentYears: s?.email_retention_years ?? 2,
      openTrackingMonths: s?.open_tracking_retention_months ?? 12,
      dataResidencyRegion: 'ap-south-1 (Mumbai, India)',
    },
  };

  const imports: ImportBatchRecord[] = importRows.map((b) => ({
    id: b.id,
    importedAt: b.imported_at,
    importedByName: (b.imported_by && nameOf.get(b.imported_by)) || '—',
    fileName: b.file_name,
    totalRows: b.total_rows,
    acceptedCount: b.accepted_count,
    flaggedCount: b.flagged_count,
    duplicateCount: b.duplicate_count,
    rejectedCount: b.rejected_count,
  }));

  const clientOfEngagement = new Map(engagementRows.map((e) => [e.id, e.client_id]));
  const invoices: InvoiceRecord[] = invoiceRows.map((i) => ({
    id: i.id,
    invoiceNo: i.invoice_no,
    clientId: clientOfEngagement.get(i.engagement_id) ?? '',
    engagementId: i.engagement_id,
    issuedDate: i.issued_on,
    dueDate: i.due_on,
    amountINR: Number(i.amount),
    gstAmountINR: Number(i.gst_amount),
    status: i.status as InvoiceRecord['status'],
    syncProvider: (i.sync_provider ?? 'Tally Prime') as InvoiceRecord['syncProvider'],
    syncStatus: i.sync_status === 'synced' ? 'Synced' : 'Not synced',
  }));

  const whatsapp: WhatsAppThread[] = waRows.map((w) => ({
    id: w.id,
    clientId: w.client_id,
    engagementId: w.engagement_id ?? '',
    contactPhone: w.contact_phone ?? '',
    templateUsed: w.template ?? '',
    lastMessageAt: w.created_at,
    direction: w.direction as WhatsAppThread['direction'],
    preview: w.body,
    deliveryStatus: (w.delivery_status.charAt(0).toUpperCase() +
      w.delivery_status.slice(1)) as WhatsAppThread['deliveryStatus'],
  }));

  const voiceCalls: VoiceCallRecord[] = callRows.map((v) => ({
    id: v.id,
    clientId: v.client_id,
    engagementId: v.engagement_id ?? '',
    ownerId: v.owner_id ?? '',
    calledAt: v.called_at,
    durationSec: v.duration_sec ?? 0,
    outcome: v.outcome as VoiceCallRecord['outcome'],
    bookedSlot: v.booked_slot ?? undefined,
    transcriptSummary: v.summary ?? '',
  }));

  return {
    team,
    clients,
    engagements,
    drafts,
    activityLog,
    imports,
    settings,
    tags,
    invoices,
    whatsapp,
    voiceCalls,
  };
}

const KIND_LABELS: Record<string, [string, ActivityLogEntry['entityType']]> = {
  status_change: ['Stage Updated', 'engagement'],
  engagement_created: ['Engagement Added', 'engagement'],
  engagement_updated: ['Engagement Updated', 'engagement'],
  client_created: ['Client Added', 'client'],
  client_updated: ['Client Updated', 'client'],
  archived: ['Archived', 'engagement'],
  restored: ['Restored', 'engagement'],
  note_added: ['Meeting Note Logged', 'engagement'],
  email_sent: ['Email Sent', 'email'],
  email_failed: ['Email Failed', 'email'],
  email_replied: ['Client Replied', 'email'],
  draft_skipped: ['Draft Skipped', 'email'],
  draft_rescheduled: ['Draft Rescheduled', 'email'],
  import_committed: ['Excel Import Committed', 'import'],
  proposal_applied: ['Drishti Proposal Applied', 'engagement'],
  team_changed: ['Team Updated', 'team'],
  settings_changed: ['Settings Updated', 'settings'],
  mailbox_changed: ['Mailbox Connection Changed', 'team'],
  invoice: ['Invoice Updated', 'phase2'],
  whatsapp: ['WhatsApp Message Queued', 'phase2'],
  voice_call: ['Call Logged', 'phase2'],
  web_lead: ['Web Lead Received', 'engagement'],
  reminder_run: ['Daily Reminder Run', 'email'],
};

function describeLog(
  l: Database['public']['Tables']['activity_log']['Row'],
  nameOf: Map<string, string>,
  clientName: Map<string, string>,
  engagementRows: Database['public']['Tables']['engagements']['Row'][],
): ActivityLogEntry {
  const [action, entityType] = KIND_LABELS[l.kind] ?? [l.kind, 'engagement'];
  const meta = (l.meta ?? {}) as Record<string, unknown>;
  const eng = l.engagement_id ? engagementRows.find((e) => e.id === l.engagement_id) : undefined;
  const cId = l.client_id ?? eng?.client_id;
  const label =
    (cId && clientName.get(cId)
      ? `${clientName.get(cId)}${eng?.certification_type ? ` · ${eng.certification_type}` : ''}`
      : '') ||
    (typeof meta.member === 'string' ? meta.member : '') ||
    (typeof meta.file === 'string' ? meta.file : '') ||
    '—';
  let details = '';
  if (l.kind === 'status_change')
    details = `Moved from ${l.from_status ?? '—'} to ${l.to_status ?? '—'}.`;
  else if (Array.isArray(meta.columns))
    details = `Changed: ${(meta.columns as string[]).map((c) => c.replace(/_/g, ' ')).join(', ')}`;
  else if (l.kind === 'reminder_run' && 'renewal_drafts' in meta)
    details = `${meta.renewal_drafts} renewal and ${meta.follow_up_drafts} follow-up draft(s) for ${meta.as_of}`;
  else if (l.kind === 'email_sent')
    details = `Sent from ${String(meta.from ?? '')}${meta.provider === 'test' ? ' (test mode: not delivered)' : ''}`;
  else if (l.kind === 'email_failed') details = String(meta.reason ?? '');
  else if (l.kind === 'import_committed') details = `${String(meta.rows ?? '')} row(s) saved`;
  return {
    id: String(l.id),
    timestamp: l.created_at,
    actorId: l.actor_id ?? '',
    actorName:
      (l.actor_id && nameOf.get(l.actor_id)) ||
      (l.source === 'system' ? 'Drishti (system)' : 'Former member'),
    source: l.source as ActivityLogEntry['source'],
    action,
    entityType,
    entityLabel: label,
    details,
  };
}
