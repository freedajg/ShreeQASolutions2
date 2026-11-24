// daily-digest: the morning summary for each Owner (PRD FR-10), the daily re-check for client
// replies (PRD §8 "a missed reply is caught by a daily re-check") and the renewal of Outlook
// reply subscriptions (PLAN Phase 5).
//   POST {mode: 'preview'}  signed-in Owner -> the summary, nothing sent
//   POST {mode: 'run'}      pg_cron at 06:15 IST (header x-job-secret = server_jobs row) ->
//                           renew subscriptions, re-check replies, then send each Owner their
//                           summary from their own mailbox to themselves.
// In email test mode, 'run' only records that it ran.
import {
  adminClient,
  corsHeaders,
  escapeHtml,
  getCaller,
  isJobCall,
  json,
} from '../_shared/util.ts';
import {
  accessTokenFor,
  msConfigured,
  recordInbound,
  renewSubscriptions,
  repliesSince,
  sendFromMailbox,
} from '../_shared/graph.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const { mode } = await req.json().catch(() => ({ mode: 'preview' }));
  const admin = adminClient();

  if (mode === 'run') {
    if (!(await isJobCall(req, 'daily-digest'))) return json({ error: 'Server only' }, 403);
  } else {
    const caller = await getCaller(req);
    if (caller?.role !== 'owner') return json({ error: 'Owners only' }, 403);
  }

  const { data: settings } = await admin.from('app_settings').select('*').eq('id', 1).single();
  const testMode = settings?.email_test_mode !== false || !msConfigured();

  let repliesFound = 0;
  let subscriptionsRenewed = 0;
  if (mode === 'run' && msConfigured()) {
    subscriptionsRenewed = await renewSubscriptions(admin);
    repliesFound = await recheckReplies(admin);
  }

  const { data: owners } = await admin
    .from('profiles')
    .select('id, full_name, email, mailbox_connected')
    .eq('role', 'owner')
    .eq('active', true);
  const { data: drafts } = await admin
    .from('email_drafts')
    .select('owner_id')
    .in('status', ['waiting', 'rescheduled', 'failed']);
  const { data: renewals } = await admin.from('v_renewals').select('owner_id, bucket');
  const cutoff = new Date(Date.now() - (settings?.follow_up_interval_days ?? 7) * 86400_000)
    .toISOString()
    .slice(0, 10);
  const { data: quiet } = await admin
    .from('engagements')
    .select('owner_id')
    .in('status', ['Lead', 'Proposal'])
    .is('archived_at', null)
    .or(`last_contacted_on.is.null,last_contacted_on.lte.${cutoff}`);

  // Team-wide numbers (Owners see everything) plus what waits in the Owner's own mailbox.
  const summaries = (owners ?? []).map((o) => ({
    ownerId: o.id,
    name: o.full_name,
    email: o.email,
    draftsWaiting: (drafts ?? []).length,
    myDrafts: (drafts ?? []).filter((d) => d.owner_id === o.id).length,
    renewalsOverdue: (renewals ?? []).filter((r) => r.bucket === 'Overdue').length,
    renewalsDue30: (renewals ?? []).filter((r) => r.bucket === 'Due in 30 days').length,
    leadsGoneQuiet: (quiet ?? []).length,
  }));

  if (mode === 'run' && settings?.daily_digest_enabled && !testMode) {
    for (const s of summaries) {
      const owner = (owners ?? []).find((o) => o.id === s.ownerId)!;
      if (!owner.mailbox_connected) continue;
      const token = await accessTokenFor(admin, owner.id);
      if (!token) continue;
      const html = escapeHtml(
        `Good morning ${s.name}.\n\nDrafts waiting for review: ${s.draftsWaiting} (${s.myDrafts} from your mailbox)\nRenewals overdue: ${s.renewalsOverdue}\nRenewals due in 30 days: ${s.renewalsDue30}\nLeads gone quiet: ${s.leadsGoneQuiet}\n\nOpen Drishti to review.`,
      ).replace(/\n/g, '<br>');
      await sendFromMailbox(token, {
        to: owner.email,
        subject: 'Drishti — your morning summary',
        html,
      }).catch(() => null);
    }
  }
  if (mode === 'run') {
    await admin.from('activity_log').insert({
      actor_id: null,
      source: 'system',
      kind: 'reminder_run',
      meta: { digest: true, testMode, repliesFound, subscriptionsRenewed },
    });
  }

  return json({ testMode, repliesFound, subscriptionsRenewed, summaries });
});

/** For every thread started in the last 30 days, look for client replies the webhook missed. */
async function recheckReplies(admin: ReturnType<typeof adminClient>): Promise<number> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: threads } = await admin
    .from('email_threads')
    .select('id, owner_id, conversation_id, profiles:owner_id(email)')
    .not('conversation_id', 'is', null)
    .gte('created_at', since);
  let found = 0;
  for (const t of threads ?? []) {
    const ownerEmail: string = (t as { profiles?: { email?: string } }).profiles?.email ?? '';
    const token = await accessTokenFor(admin, t.owner_id);
    if (!token) continue;
    const { data: last } = await admin
      .from('email_messages')
      .select('sent_at')
      .eq('thread_id', t.id)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const replies = await repliesSince(
      token,
      t.conversation_id!,
      last?.sent_at ?? since,
      ownerEmail,
    );
    for (const r of replies) {
      if (
        await recordInbound(admin, t.owner_id, ownerEmail, {
          ...r,
          conversationId: t.conversation_id,
        })
      ) {
        found++;
      }
    }
  }
  return found;
}
