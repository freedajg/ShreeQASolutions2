// daily-digest: the 06:00 IST morning summary for each Owner (PRD FR-10) and the daily
// re-check for client replies (PRD §8 "a missed reply is caught by a daily re-check").
//   POST {mode: 'preview'}  (signed-in Owner) -> the summary per Owner, nothing sent
//   POST {mode: 'run'}      (server: service-role key, from pg_cron) -> re-check replies, then
//                            send each Owner their summary from their own mailbox to themselves.
// In email test mode, 'run' only records the summary in the activity log.
import { adminClient, corsHeaders, escapeHtml, getCaller, json } from '../_shared/util.ts';
import { accessTokenFor, msConfigured, repliesSince, sendFromMailbox } from '../_shared/graph.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const { mode } = await req.json().catch(() => ({ mode: 'preview' }));
  const admin = adminClient();

  const isServer =
    (req.headers.get('Authorization') ?? '') ===
    `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
  if (mode === 'run' && !isServer) return json({ error: 'Server only' }, 403);
  if (mode !== 'run') {
    const caller = await getCaller(req);
    if (caller?.role !== 'owner') return json({ error: 'Owners only' }, 403);
  }

  const { data: settings } = await admin.from('app_settings').select('*').eq('id', 1).single();
  const testMode = settings?.email_test_mode !== false || !msConfigured();

  let repliesFound = 0;
  if (mode === 'run' && !testMode) repliesFound = await recheckReplies(admin);

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

  if (mode === 'run' && settings?.daily_digest_enabled) {
    for (const s of summaries) {
      const owner = (owners ?? []).find((o) => o.id === s.ownerId)!;
      if (!testMode && owner.mailbox_connected) {
        const token = await accessTokenFor(admin, owner.id);
        if (token) {
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
    }
    await admin.from('activity_log').insert({
      actor_id: null,
      source: 'system',
      kind: 'reminder_run',
      meta: { digest: true, testMode, repliesFound },
    });
  }

  return json({ testMode, repliesFound, summaries });
});

/** For every thread with an outbound email in the last 30 days, look for client replies. */
async function recheckReplies(admin: ReturnType<typeof adminClient>): Promise<number> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: threads } = await admin
    .from('email_threads')
    .select('id, engagement_id, client_id, owner_id, conversation_id, profiles:owner_id(email)')
    .not('conversation_id', 'is', null)
    .gte('created_at', since);
  let found = 0;
  for (const t of threads ?? []) {
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
      (t as any).profiles?.email ?? '',
    );
    for (const r of replies) {
      const { data: seen } = await admin
        .from('email_messages')
        .select('id')
        .eq('provider_message_id', r.id)
        .maybeSingle();
      if (seen) continue;
      await admin.from('email_messages').insert({
        thread_id: t.id,
        engagement_id: t.engagement_id,
        client_id: t.client_id,
        direction: 'inbound',
        from_email: r.from?.emailAddress?.address ?? '',
        to_email: (t as any).profiles?.email ?? '',
        subject: r.subject ?? '',
        body: r.bodyPreview ?? '',
        provider: 'outlook',
        provider_message_id: r.id,
        internet_message_id: r.internetMessageId ?? null,
        sent_at: r.receivedDateTime,
      });
      found++;
    }
  }
  return found;
}
