// graph-webhook: Microsoft Graph change notifications for new Inbox messages (PLAN Phase 5,
// PRD FR-8). Public by necessity (Graph can't send a Supabase login), so:
//   - the subscription handshake only echoes Graph's validationToken as plain text;
//   - every notification must carry the clientState stored for that subscription, else it is
//     ignored (nothing is read or written);
//   - the message itself is fetched from Graph with the mailbox owner's token, never trusted
//     from the request body.
import { adminClient, safeEqual } from '../_shared/util.ts';
import { accessTokenFor, getMessage, recordInbound } from '../_shared/graph.ts';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const validationToken = url.searchParams.get('validationToken');
  if (validationToken) {
    return new Response(validationToken.slice(0, 1000), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const body = await req.json().catch(() => null);
  const notes: Array<Record<string, any>> = Array.isArray(body?.value)
    ? body.value.slice(0, 50)
    : [];
  const admin = adminClient();

  for (const n of notes) {
    const { data: sub } = await admin
      .from('mailbox_subscriptions')
      .select('profile_id, client_state')
      .eq('id', String(n.subscriptionId ?? ''))
      .maybeSingle();
    if (!sub || !safeEqual(sub.client_state, String(n.clientState ?? ''))) continue; // unknown or forged: ignored
    const messageId = n.resourceData?.id;
    if (typeof messageId !== 'string') continue;
    const { data: owner } = await admin
      .from('profiles')
      .select('email, active')
      .eq('id', sub.profile_id)
      .single();
    if (!owner?.active) continue;
    const token = await accessTokenFor(admin, sub.profile_id);
    if (!token) continue;
    const message = await getMessage(token, messageId);
    if (message) await recordInbound(admin, sub.profile_id, owner.email, message);
  }
  // Graph expects a quick 202 whatever happened.
  return new Response(null, { status: 202 });
});
