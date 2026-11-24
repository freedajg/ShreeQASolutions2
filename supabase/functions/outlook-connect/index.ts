// outlook-connect: each team member connects their own Outlook mailbox (PRD FR-1, FR-7).
//   POST {action: 'start'}       (signed in) -> { url } to open Microsoft's consent page
//   POST {action: 'disconnect'}  (signed in) -> removes the stored token
//   GET  ?code&state             Microsoft's redirect back here; stores the encrypted token
// Needs MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID, TOKEN_ENC_KEY and APP_ORIGIN.
import {
  adminClient,
  safeEqual,
  corsHeaders,
  encrypt,
  getCaller,
  json,
  sign,
  SUPABASE_URL,
} from '../_shared/util.ts';
import { GRAPH_SCOPES, msConfigured, subscribeMailbox, tokenUrl } from '../_shared/graph.ts';

const REDIRECT = `${SUPABASE_URL}/functions/v1/outlook-connect`;
const APP = Deno.env.get('APP_ORIGIN') ?? 'http://localhost:3000';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method === 'GET') return callback(new URL(req.url));

  const caller = await getCaller(req);
  // A role is required (an Owner must have passed MFA); a role-less login can't connect.
  if (!caller?.role) return json({ error: 'Not signed in, or no access' }, 401);
  const { action } = await req.json().catch(() => ({ action: '' }));

  if (action === 'disconnect') {
    const admin = adminClient();
    await admin.from('mailbox_subscriptions').delete().eq('profile_id', caller.id);
    await admin.from('mailbox_connections').delete().eq('profile_id', caller.id);
    await admin.from('profiles').update({ mailbox_connected: false }).eq('id', caller.id);
    await admin.from('activity_log').insert({
      actor_id: caller.id,
      source: 'manual',
      kind: 'mailbox_changed',
      meta: { connected: false },
    });
    return json({ ok: true });
  }

  // Go-live checklist (Settings): which server-side pieces are in place. Owners only; it returns
  // yes/no answers and public addresses, never a secret value.
  if (action === 'status') {
    if (caller.role !== 'owner') return json({ error: 'Owners only' }, 403);
    return json({
      microsoftAppSet: msConfigured(),
      encryptionKeySet: Boolean(Deno.env.get('TOKEN_ENC_KEY')),
      appOriginSet: Boolean(Deno.env.get('APP_ORIGIN')),
      redirectUri: REDIRECT,
      webhookUrl: `${SUPABASE_URL}/functions/v1/graph-webhook`,
    });
  }

  if (action !== 'start') return json({ error: 'Unknown action' }, 400);
  if (!msConfigured()) {
    return json(
      {
        error:
          'Outlook can’t be connected yet: SQAS’s Microsoft 365 isn’t linked to Drishti. See Settings → Outlook for the steps left.',
      },
      503,
    );
  }
  const state = `${caller.id}.${Date.now() + 10 * 60_000}`;
  const url = new URL(
    `https://login.microsoftonline.com/${Deno.env.get('MS_TENANT_ID')}/oauth2/v2.0/authorize`,
  );
  url.search = new URLSearchParams({
    client_id: Deno.env.get('MS_CLIENT_ID') ?? '',
    response_type: 'code',
    redirect_uri: REDIRECT,
    response_mode: 'query',
    scope: GRAPH_SCOPES,
    login_hint: caller.email,
    prompt: 'select_account',
    state: `${state}.${await sign(state)}`,
  }).toString();
  return json({ url: url.toString() });
});

async function callback(url: URL): Promise<Response> {
  const back = (status: string) => Response.redirect(`${APP}/?outlook=${status}`, 302);
  const code = url.searchParams.get('code');
  const [uid, exp, sig] = (url.searchParams.get('state') ?? '').split('.');
  if (!code || !uid || !exp || !sig) return back('failed');
  if (Number(exp) < Date.now() || !safeEqual(await sign(`${uid}.${exp}`), sig))
    return back('expired');

  const res = await fetch(tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('MS_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('MS_CLIENT_SECRET') ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      scope: GRAPH_SCOPES,
    }),
  });
  if (!res.ok) return back('failed');
  const tok = await res.json();
  const me = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  }).then((r) => r.json());

  const admin = adminClient();
  const { data: profile } = await admin.from('profiles').select('email').eq('id', uid).single();
  const mailbox = String(me.mail ?? me.userPrincipalName ?? '').toLowerCase();
  // The mailbox must be the member's own: Drishti never sends as someone else (CLAUDE.md rule 4).
  if (!profile || mailbox !== profile.email.toLowerCase()) return back('wrong-mailbox');

  await admin.from('mailbox_connections').upsert({
    profile_id: uid,
    mailbox_address: mailbox,
    ms_user_id: me.id,
    refresh_token: await encrypt(tok.refresh_token),
    access_token_expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  await admin.from('profiles').update({ mailbox_connected: true }).eq('id', uid);
  // Reply detection: notifications for new Inbox mail (renewed daily by daily-digest).
  await subscribeMailbox(admin, tok.access_token, uid).catch(() => false);
  await admin.from('activity_log').insert({
    actor_id: uid,
    source: 'manual',
    kind: 'mailbox_changed',
    meta: { connected: true },
  });
  return back('connected');
}
