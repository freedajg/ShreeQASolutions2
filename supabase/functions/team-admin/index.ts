// team-admin: Owners invite, deactivate and reactivate members (PRD FR-1). Invite-only:
// public sign-up stays off; this is the only way a login is created.
//   POST {action: 'invite', email, fullName, role}
//   POST {action: 'deactivate' | 'reactivate', memberId}
// Role changes and values access are plain profile updates (row rules + the guard trigger).
import { adminClient, corsHeaders, getCaller, json, userClient } from '../_shared/util.ts';

const ROLES = new Set(['owner', 'consultant', 'marketing']);
const APP = Deno.env.get('APP_ORIGIN') ?? 'http://localhost:3000';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const caller = await getCaller(req);
  if (!caller || caller.role !== 'owner')
    return json({ error: 'Only an Owner (with MFA) can manage the team' }, 403);

  const body = await req.json().catch(() => ({}));
  const admin = adminClient();

  if (body.action === 'invite') {
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    const fullName = String(body.fullName ?? '')
      .trim()
      .slice(0, 200);
    const role = String(body.role ?? '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return json({ error: 'Enter a valid email' }, 400);
    if (!ROLES.has(role)) return json({ error: 'Choose a role' }, 400);

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: APP,
    });
    if (error || !data.user) return json({ error: error?.message ?? 'Invite failed' }, 400);
    // The role is server-set data (app_metadata) and the profile row, never user-editable data.
    await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { role } });
    await admin.from('profiles').update({ role, full_name: fullName }).eq('id', data.user.id);
    await admin.from('activity_log').insert({
      actor_id: caller.id,
      source: 'manual',
      kind: 'team_changed',
      meta: { member: fullName || email, member_id: data.user.id, columns: ['invited', role] },
    });
    return json({ ok: true, memberId: data.user.id });
  }

  if (body.action === 'deactivate' || body.action === 'reactivate') {
    const memberId = String(body.memberId ?? '');
    const active = body.action === 'reactivate';
    // As the Owner (row rules, the guard and the log apply): the last active Owner can't be
    // deactivated, and the log shows who did it.
    const { data: changed, error } = await userClient(req)
      .from('profiles')
      .update({ active })
      .eq('id', memberId)
      .select('id')
      .maybeSingle();
    if (error || !changed) return json({ error: error?.message ?? 'Member not found' }, 400);
    // A deactivated member can't log in at all; their history keeps their name.
    await admin.auth.admin.updateUserById(memberId, { ban_duration: active ? 'none' : '876000h' });
    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
