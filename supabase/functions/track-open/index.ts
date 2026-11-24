// track-open: the 1x1 image in each sent email (PRD FR-8 "likely opened"). Public (no login):
// the only input is the random tracking token; it reveals nothing and changes only open counts.
import { adminClient } from '../_shared/util.ts';

const GIF = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (c) =>
  c.charCodeAt(0),
);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rate limit (PLAN Phase 5): one counted open per token per minute, and at most 120 database
// lookups per minute per function instance, so the public URL can't be used to hammer the
// database. An unknown token records nothing.
const lastSeen = new Map<string, number>();
let windowStart = Date.now();
let lookups = 0;

function allowed(token: string): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    lookups = 0;
    lastSeen.clear();
  }
  if (lookups >= 120 || (lastSeen.get(token) ?? 0) > now - 60_000) return false;
  lookups++;
  lastSeen.set(token, now);
  return true;
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  if (UUID.test(token) && allowed(token)) {
    const admin = adminClient();
    const { data: msg } = await admin
      .from('email_messages')
      .select('id, opened_at, open_count')
      .eq('tracking_token', token)
      .maybeSingle();
    if (msg) {
      await admin
        .from('email_messages')
        .update({
          opened_at: msg.opened_at ?? new Date().toISOString(),
          open_count: (msg.open_count ?? 0) + 1,
        })
        .eq('id', msg.id);
    }
  }
  return new Response(GIF, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, max-age=0' },
  });
});
