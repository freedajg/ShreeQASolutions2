-- Phases 4-6 pieces: assistant usage cap, Outlook reply subscriptions, the scheduled morning
-- digest, and the monthly retention cleanup (PRD §8 retention, FR-8, FR-10, FR-11).

alter table public.activity_log drop constraint activity_log_kind_check;
alter table public.activity_log add constraint activity_log_kind_check check (kind in (
  'status_change', 'engagement_created', 'engagement_updated', 'client_created', 'client_updated',
  'archived', 'restored', 'note_added', 'email_sent', 'email_failed', 'email_replied',
  'draft_skipped', 'draft_rescheduled', 'import_committed', 'proposal_applied', 'team_changed',
  'settings_changed', 'mailbox_changed', 'invoice', 'whatsapp', 'voice_call', 'web_lead',
  'reminder_run', 'retention_run'
));

-- ---------------------------------------------------------------------------
-- Assistant usage: one row per person per IST day. Written only by the server (the
-- drishti-assistant function, service role); a person may read their own count.
-- ---------------------------------------------------------------------------
create table public.assistant_usage (
  profile_id uuid not null references public.profiles (id) on delete restrict,
  day date not null default app.today_ist(),
  questions integer not null default 0 check (questions >= 0),
  primary key (profile_id, day)
);

alter table public.assistant_usage enable row level security;
revoke all on table public.assistant_usage from public, anon, authenticated;
grant select on table public.assistant_usage to authenticated;
grant all on table public.assistant_usage to service_role;

create policy "assistant_usage: read own"
  on public.assistant_usage for select to authenticated
  using (profile_id = (select auth.uid()));

alter table public.app_settings
  add column assistant_daily_limit integer not null default 40 check (assistant_daily_limit between 0 and 500);
grant update (assistant_daily_limit) on table public.app_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Microsoft Graph change-notification subscriptions (reply detection, FR-8). Server only.
-- client_state is the shared secret Graph echoes back; graph-webhook ignores any call whose
-- clientState doesn't match a stored subscription.
-- ---------------------------------------------------------------------------
create table public.mailbox_subscriptions (
  id text primary key, -- Graph subscription id
  profile_id uuid not null references public.profiles (id) on delete restrict,
  client_state text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index mailbox_subscriptions_profile_idx on public.mailbox_subscriptions (profile_id);

alter table public.mailbox_subscriptions enable row level security;
revoke all on table public.mailbox_subscriptions from public, anon, authenticated;
grant all on table public.mailbox_subscriptions to service_role;

-- ---------------------------------------------------------------------------
-- Scheduled calls to Edge Functions: pg_cron + pg_net post with a random secret that only the
-- server can read. The function compares the header with this table (no secret in code).
-- ---------------------------------------------------------------------------
create table public.server_jobs (
  name text primary key,
  -- The function's full URL on this project; set once per project (data, not a migration),
  -- e.g. https://<ref>.supabase.co/functions/v1/daily-digest. Empty = the job does nothing.
  url text,
  secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);

alter table public.server_jobs enable row level security;
revoke all on table public.server_jobs from public, anon, authenticated;
grant all on table public.server_jobs to service_role;

insert into public.server_jobs (name) values ('daily-digest');

create extension if not exists pg_net;

-- Posts to an Edge Function with the job's secret, if its URL is set on this project.
create function app.call_server_job(p_job text, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select s.url from public.server_jobs s where s.name = p_job);
  v_secret text := (select s.secret from public.server_jobs s where s.name = p_job);
begin
  if v_url is null or v_url = '' or v_secret is null then
    return; -- not configured on this database (e.g. the local test stack)
  end if;
  perform net.http_post(
    url := v_url,
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-job-secret', v_secret)
  );
end;
$$;

revoke all on function app.call_server_job(text, jsonb) from public;

-- 06:15 IST: morning summary + reply re-check + subscription renewal (after the 06:00 drafts).
select cron.schedule(
  'drishti-daily-digest',
  '45 0 * * *',
  $$select app.call_server_job('daily-digest', '{"mode": "run"}'::jsonb)$$
);

-- ---------------------------------------------------------------------------
-- Retention (PRD §8, settings in app_settings). Monthly, logged. What it does:
--   closed/lost leads older than N years: contact details removed (company and numbers kept)
--   email content older than N years after the engagement closed: body cleared (dates kept)
--   open tracking older than N months: opened_at/open_count cleared, link clicks deleted
-- Active clients, the activity log and invoices are never touched.
-- ---------------------------------------------------------------------------
create function app.run_retention(p_as_of date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.app_settings%rowtype;
  v_clients integer;
  v_bodies integer;
  v_opens integer;
  v_clicks integer;
  v_result jsonb;
begin
  select * into v_s from public.app_settings where id = 1;

  -- Clients whose every engagement is Closed and last changed before the cutoff.
  with stale as (
    select c.id
    from public.clients c
    where exists (select 1 from public.engagements e where e.client_id = c.id)
      and not exists (
        select 1 from public.engagements e
        where e.client_id = c.id
          and (e.status is distinct from 'Closed'
               or e.updated_at > (p_as_of - make_interval(years => v_s.closed_leads_retention_years)))
      )
      and (c.contact_person is not null or c.email is not null or c.phone is not null
           or c.designation is not null or c.address is not null)
  )
  update public.clients c
  set contact_person = null, email = null, phone = null, designation = null, address = null
  from stale where c.id = stale.id;
  get diagnostics v_clients = row_count;

  update public.email_messages m
  set body = '[removed by retention]'
  from public.engagements e
  where e.id = m.engagement_id
    and e.status = 'Closed'
    and e.updated_at < (p_as_of - make_interval(years => v_s.email_retention_years))
    and m.body <> '[removed by retention]';
  get diagnostics v_bodies = row_count;

  update public.email_messages
  set opened_at = null, open_count = 0
  where opened_at is not null
    and sent_at < (p_as_of - make_interval(months => v_s.open_tracking_retention_months));
  get diagnostics v_opens = row_count;

  delete from public.email_link_clicks
  where clicked_at < (p_as_of - make_interval(months => v_s.open_tracking_retention_months));
  get diagnostics v_clicks = row_count;

  v_result := jsonb_build_object('as_of', p_as_of, 'clients_contacts_removed', v_clients,
    'email_bodies_removed', v_bodies, 'open_tracking_cleared', v_opens, 'link_clicks_deleted', v_clicks);
  insert into public.activity_log (actor_id, source, kind, meta)
  values ((select auth.uid()), case when (select auth.uid()) is null then 'system' else 'manual' end,
    'retention_run', v_result);
  return v_result;
end;
$$;

revoke all on function app.run_retention(date) from public;
grant execute on function app.run_retention(date) to service_role;

-- Owners can run it now (Settings → Privacy), e.g. after changing a retention setting.
create function public.run_retention(p_as_of date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_owner() then
    raise exception 'Only an Owner can run the retention cleanup' using errcode = '42501';
  end if;
  return app.run_retention(coalesce(p_as_of, app.today_ist()));
end;
$$;

revoke all on function public.run_retention(date) from public, anon, authenticated;
grant execute on function public.run_retention(date) to authenticated, service_role;

-- Monthly: 20:30 UTC on the 1st (02:00 IST on the 2nd).
select cron.schedule('drishti-monthly-retention', '30 20 1 * *', $$select app.run_retention(app.today_ist())$$);
