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
  if (!res.ok) return null;
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
