// send-email: sends drafts a person chose and pressed Send on (CLAUDE.md rule 4, PRD FR-7).
// One draft or many (bulk). Each one goes from its engagement's Relationship Owner's own
// mailbox, in the existing thread when there is one. If that owner hasn't connected Outlook,
// the draft fails with "Connect mailbox" — never another sender.
//
// POST { draftIds: string[], edits?: { [draftId]: { subject?: string, body?: string } } }
// Caller rights are proved by writing the edit (or a no-op) through the caller's own client,
// so the database row rules decide (Owners: any; Consultants: their own engagements; Marketing: none).
// While app_settings.email_test_mode is on, nothing leaves Drishti: the send is recorded with
// provider 'test'.
import {
  adminClient,
  corsHeaders,
  escapeHtml,
  getCaller,
  json,
  SUPABASE_URL,
  userClient,
} from '../_shared/util.ts';
import { accessTokenFor, msConfigured, sendFromMailbox } from '../_shared/graph.ts';

interface Result {
  draftId: string;
  status: 'sent' | 'failed';
  reason?: string;
  from?: string;
}

const MAX_PER_CALL = 200;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const caller = await getCaller(req);
  if (!caller || !caller.role) return json({ error: 'Not signed in, or no access' }, 401);
  if (caller.role === 'marketing') return json({ error: 'Marketing can’t send email' }, 403);

  let payload: { draftIds?: unknown; edits?: Record<string, { subject?: string; body?: string }> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  const ids = Array.isArray(payload.draftIds)
    ? payload.draftIds.filter((x): x is string => typeof x === 'string')
    : [];
  if (ids.length === 0) return json({ error: 'No drafts chosen' }, 400);
  if (ids.length > MAX_PER_CALL)
    return json({ error: `At most ${MAX_PER_CALL} emails per send` }, 400);

  const asUser = userClient(req);
  const admin = adminClient();
  const { data: settings } = await admin
    .from('app_settings')
    .select('email_test_mode')
    .eq('id', 1)
    .single();
  const testMode = settings?.email_test_mode !== false || !msConfigured();

  const results: Result[] = [];
  for (const draftId of ids) {
    results.push(
      await sendOne(draftId, payload.edits?.[draftId] ?? {}, caller.id, asUser, admin, testMode),
    );
  }

  // Bulk batches keep their counts.
  const { data: batches } = await admin
    .from('email_drafts')
    .select('batch_id')
    .in('id', ids)
    .not('batch_id', 'is', null);
  for (const batchId of new Set((batches ?? []).map((b) => b.batch_id as string))) {
    const { data: rows } = await admin
      .from('email_drafts')
      .select('status')
      .eq('batch_id', batchId);
    const count = (s: string) => (rows ?? []).filter((r) => r.status === s).length;
    await admin
      .from('email_batches')
      .update({
        sent_count: count('sent'),
        failed_count: count('failed'),
        skipped_count: count('skipped'),
      })
      .eq('id', batchId);
  }

  return json({ testMode, results });
});

async function sendOne(
  draftId: string,
  edit: { subject?: string; body?: string },
  callerId: string,
  asUser: ReturnType<typeof userClient>,
  admin: ReturnType<typeof adminClient>,
  testMode: boolean,
): Promise<Result> {
  // 1. Prove the caller may send this draft: the update runs under their own row rules.
  const patch: Record<string, string> = {};
  if (typeof edit.subject === 'string') patch.subject = edit.subject.slice(0, 300);
  if (typeof edit.body === 'string') patch.body = edit.body.slice(0, 10000);
  const { data: allowed, error: permError } = await asUser
    .from('email_drafts')
    .update(Object.keys(patch).length ? patch : { status: 'waiting' })
    .eq('id', draftId)
    .in('status', ['waiting', 'rescheduled', 'failed'])
    .select('id')
    .maybeSingle();
  if (permError || !allowed) {
    return {
      draftId,
      status: 'failed',
      reason: 'You can’t send this draft, or it was already sent',
    };
  }

  // 2. Claim it (no double send if two people press Send at once).
  const { data: draft } = await admin
    .from('email_drafts')
    .update({ status: 'sending', failure_reason: null })
    .eq('id', draftId)
    .in('status', ['waiting', 'rescheduled', 'failed'])
    .select('id, engagement_id, client_id, owner_id, thread_id, to_email, subject, body, batch_id')
    .maybeSingle();
  if (!draft) return { draftId, status: 'failed', reason: 'Already being sent' };

  const fail = async (reason: string): Promise<Result> => {
    await admin
      .from('email_drafts')
      .update({ status: 'failed', failure_reason: reason })
      .eq('id', draftId);
    await admin.from('activity_log').insert({
      actor_id: callerId,
      source: 'manual',
      kind: 'email_failed',
      engagement_id: draft.engagement_id,
      client_id: draft.client_id,
      meta: { draft_id: draftId, reason },
    });
    return { draftId, status: 'failed', reason };
  };

  const { data: client } = await admin
    .from('clients')
    .select('email, do_not_contact, archived_at')
    .eq('id', draft.client_id)
    .single();
  if (client?.do_not_contact) return fail('Client is marked do-not-contact');
  if (client?.archived_at) return fail('Client is archived');
  const to = draft.to_email ?? client?.email;
  if (!to) return fail('Client has no email address');
  if (!draft.owner_id) return fail('Engagement has no Relationship Owner');

  const { data: owner } = await admin
    .from('profiles')
    .select('full_name, email, active, mailbox_connected')
    .eq('id', draft.owner_id)
    .single();
  if (!owner?.active) return fail('Relationship Owner is deactivated');

  // 3. Thread: reuse the owner's thread for this engagement, else start one.
  let threadId: string | null = draft.thread_id;
  let replyTo: string | null = null;
  if (threadId) {
    const { data: root } = await admin
      .from('email_messages')
      .select('provider_message_id')
      .eq('thread_id', threadId)
      .eq('direction', 'outbound')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    replyTo = root?.provider_message_id ?? null;
  }

  const trackingToken = crypto.randomUUID();
  const html =
    escapeHtml(draft.body).replace(/\r?\n/g, '<br>') +
    `<img src="${SUPABASE_URL}/functions/v1/track-open?t=${trackingToken}" width="1" height="1" alt="" style="display:none">`;

  let sent: {
    providerMessageId: string | null;
    internetMessageId: string | null;
    conversationId: string | null;
  };
  let provider: 'outlook' | 'test';
  if (testMode) {
    provider = 'test';
    sent = { providerMessageId: null, internetMessageId: null, conversationId: null };
  } else {
    if (!owner.mailbox_connected)
      return fail(`Connect mailbox: ${owner.full_name || owner.email} hasn’t connected Outlook`);
    const token = await accessTokenFor(admin, draft.owner_id);
    if (!token)
      return fail(
        `Connect mailbox: ${owner.full_name || owner.email}’s Outlook connection has expired`,
      );
    try {
      sent = await sendFromMailbox(token, {
        to,
        subject: draft.subject,
        html,
        replyToMessageId: replyTo,
      });
      provider = 'outlook';
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Outlook error');
    }
  }

  if (!threadId) {
    const { data: thread } = await admin
      .from('email_threads')
      .insert({
        engagement_id: draft.engagement_id,
        client_id: draft.client_id,
        owner_id: draft.owner_id,
        subject: draft.subject,
        conversation_id: sent.conversationId,
        root_internet_message_id: sent.internetMessageId,
      })
      .select('id')
      .single();
    threadId = thread!.id;
  }

  const sentAt = new Date().toISOString();
  await admin.from('email_messages').insert({
    thread_id: threadId,
    engagement_id: draft.engagement_id,
    client_id: draft.client_id,
    draft_id: draftId,
    direction: 'outbound',
    sender_id: draft.owner_id,
    approved_by: callerId,
    from_email: owner.email,
    to_email: to,
    subject: draft.subject,
    body: draft.body,
    provider,
    provider_message_id: sent.providerMessageId,
    internet_message_id: sent.internetMessageId,
    sent_at: sentAt,
    tracking_token: trackingToken,
  });
  await admin
    .from('email_drafts')
    .update({
      status: 'sent',
      sent_at: sentAt,
      approved_by: callerId,
      thread_id: threadId,
      failure_reason: null,
    })
    .eq('id', draftId);

  return { draftId, status: 'sent', from: owner.email };
}
