// Microsoft Graph: refresh an owner's token and send from their own mailbox (PRD FR-7).
// Needs MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID and TOKEN_ENC_KEY (Edge Function secrets).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { decrypt, encrypt } from './util.ts';

const GRAPH = 'https://graph.microsoft.com/v1.0';
export const GRAPH_SCOPES = 'offline_access openid email User.Read Mail.Send Mail.ReadWrite';

export function msConfigured(): boolean {
  return Boolean(
    Deno.env.get('MS_CLIENT_ID') &&
    Deno.env.get('MS_CLIENT_SECRET') &&
    Deno.env.get('MS_TENANT_ID'),
  );
}

export function tokenUrl(): string {
  return `https://login.microsoftonline.com/${Deno.env.get('MS_TENANT_ID')}/oauth2/v2.0/token`;
}

export async function accessTokenFor(
  admin: SupabaseClient,
  profileId: string,
): Promise<string | null> {
  const { data: conn } = await admin
    .from('mailbox_connections')
    .select('refresh_token')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (!conn?.refresh_token) return null;
  const res = await fetch(tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('MS_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('MS_CLIENT_SECRET') ?? '',
      grant_type: 'refresh_token',
      refresh_token: await decrypt(conn.refresh_token),
      scope: GRAPH_SCOPES,
    }),
  });
  if (!res.ok) {
    // Revoked or expired consent: show "Connect mailbox" instead of failing silently later.
    const detail = await res.json().catch(() => ({}));
    if (detail.error === 'invalid_grant') {
      await admin.from('profiles').update({ mailbox_connected: false }).eq('id', profileId);
    }
    return null;
  }
  const tok = await res.json();
  if (tok.refresh_token) {
    await admin
      .from('mailbox_connections')
      .update({
        refresh_token: await encrypt(tok.refresh_token),
        access_token_expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('profile_id', profileId);
  }
  return tok.access_token as string;
}

async function graph(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export interface SentMessage {
  providerMessageId: string;
  internetMessageId: string | null;
  conversationId: string | null;
}

/**
 * Send as the mailbox owner. With a root message id, reply in that same thread; otherwise start
 * a new conversation. Draft -> set body -> send, so the ids are known after sending.
 */
export async function sendFromMailbox(
  token: string,
  opts: { to: string; subject: string; html: string; replyToMessageId?: string | null },
): Promise<SentMessage> {
  let draft: Response;
  if (opts.replyToMessageId) {
    draft = await graph(
      token,
      `/me/messages/${encodeURIComponent(opts.replyToMessageId)}/createReply`,
      { method: 'POST' },
    );
  } else {
    draft = await graph(token, '/me/messages', {
      method: 'POST',
      body: JSON.stringify({
        subject: opts.subject,
        body: { contentType: 'HTML', content: opts.html },
        toRecipients: [{ emailAddress: { address: opts.to } }],
      }),
    });
  }
  if (!draft.ok) throw new Error(`Outlook refused the draft (${draft.status})`);
  const msg = await draft.json();

  if (opts.replyToMessageId) {
    const patch = await graph(token, `/me/messages/${msg.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        body: { contentType: 'HTML', content: opts.html },
        toRecipients: [{ emailAddress: { address: opts.to } }],
      }),
    });
    if (!patch.ok) throw new Error(`Outlook refused the reply text (${patch.status})`);
  }

  const sent = await graph(token, `/me/messages/${msg.id}/send`, { method: 'POST' });
  if (!sent.ok) throw new Error(`Outlook did not send the message (${sent.status})`);
  return {
    providerMessageId: msg.id,
    internetMessageId: msg.internetMessageId ?? null,
    conversationId: msg.conversationId ?? null,
  };
}

/** Messages in a conversation received after a time (reply detection, FR-8). */
export async function repliesSince(
  token: string,
  conversationId: string,
  sinceIso: string,
  ownAddress: string,
) {
  const filter = `conversationId eq '${conversationId.replace(/'/g, "''")}' and receivedDateTime gt ${sinceIso}`;
  const res = await graph(
    token,
    `/me/messages?$filter=${encodeURIComponent(filter)}&$select=id,from,subject,bodyPreview,receivedDateTime,internetMessageId`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.value as Array<Record<string, any>>).filter(
    (m) => (m.from?.emailAddress?.address ?? '').toLowerCase() !== ownAddress.toLowerCase(),
  );
}

// ---------------------------------------------------------------------------
// Reply detection by change notifications (PLAN Phase 5): one subscription per connected
// mailbox on new Inbox messages. Graph subscriptions for mail last under 3 days, so the daily
// job renews them; graph-webhook checks clientState before trusting any notification.
// ---------------------------------------------------------------------------
const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/graph-webhook`;
const SUBSCRIPTION_MINUTES = 4200; // ~2.9 days, under Graph's limit for mail

export async function subscribeMailbox(
  admin: SupabaseClient,
  token: string,
  profileId: string,
): Promise<boolean> {
  const clientState = crypto.randomUUID() + crypto.randomUUID();
  const res = await graph(token, '/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      changeType: 'created',
      notificationUrl: WEBHOOK_URL,
      resource: "me/mailFolders('inbox')/messages",
      expirationDateTime: new Date(Date.now() + SUBSCRIPTION_MINUTES * 60_000).toISOString(),
      clientState,
    }),
  });
  if (!res.ok) return false;
  const sub = await res.json();
  await admin.from('mailbox_subscriptions').delete().eq('profile_id', profileId);
  await admin.from('mailbox_subscriptions').insert({
    id: sub.id,
    profile_id: profileId,
    client_state: clientState,
    expires_at: sub.expirationDateTime,
  });
  return true;
}

/** Renews subscriptions that end within two days; re-creates any that Graph no longer knows. */
export async function renewSubscriptions(admin: SupabaseClient): Promise<number> {
  const soon = new Date(Date.now() + 2 * 86400_000).toISOString();
  const { data: subs } = await admin
    .from('mailbox_subscriptions')
    .select('id, profile_id')
    .lt('expires_at', soon);
  let renewed = 0;
  for (const s of subs ?? []) {
    const token = await accessTokenFor(admin, s.profile_id);
    if (!token) continue;
    const expires = new Date(Date.now() + SUBSCRIPTION_MINUTES * 60_000).toISOString();
    const res = await graph(token, `/subscriptions/${encodeURIComponent(s.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ expirationDateTime: expires }),
    });
    if (res.ok) {
      await admin.from('mailbox_subscriptions').update({ expires_at: expires }).eq('id', s.id);
      renewed++;
    } else if (await subscribeMailbox(admin, token, s.profile_id)) {
      renewed++;
    }
  }
  return renewed;
}

export async function getMessage(token: string, messageId: string) {
  const res = await graph(
    token,
    `/me/messages/${encodeURIComponent(messageId)}?$select=id,from,subject,bodyPreview,receivedDateTime,internetMessageId,conversationId`,
  );
  return res.ok ? ((await res.json()) as Record<string, any>) : null;
}

/**
 * Stores a client's reply in its thread, once. The database trigger then marks the engagement
 * replied, stops the follow-up sequence and logs it (FR-8). Messages from the owner's own
 * address, or in no thread Drishti started, are ignored. The body is kept as plain text.
 */
export async function recordInbound(
  admin: SupabaseClient,
  ownerId: string,
  ownerEmail: string,
  m: Record<string, any>,
): Promise<boolean> {
  const from = String(m.from?.emailAddress?.address ?? '').toLowerCase();
  if (!m.conversationId || !from || from === ownerEmail.toLowerCase()) return false;
  const { data: thread } = await admin
    .from('email_threads')
    .select('id, engagement_id, client_id')
    .eq('conversation_id', m.conversationId)
    .eq('owner_id', ownerId)
    .limit(1)
    .maybeSingle();
  if (!thread) return false;
  const { data: seen } = await admin
    .from('email_messages')
    .select('id')
    .eq('provider_message_id', m.id)
    .maybeSingle();
  if (seen) return false;
  await admin.from('email_messages').insert({
    thread_id: thread.id,
    engagement_id: thread.engagement_id,
    client_id: thread.client_id,
    direction: 'inbound',
    from_email: from,
    to_email: ownerEmail,
    subject: String(m.subject ?? '').slice(0, 300),
    body: String(m.bodyPreview ?? ''),
    provider: 'outlook',
    provider_message_id: m.id,
    internet_message_id: m.internetMessageId ?? null,
    sent_at: m.receivedDateTime ?? new Date().toISOString(),
  });
  return true;
}
