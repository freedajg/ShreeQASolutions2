-- Phase 1, step 16 (and the tables Phase 5-6 need): app_settings, import_batches, and email:
-- mailbox connections, threads, drafts, messages, link clicks and bulk batches.
-- PRD FR-3, FR-7, FR-8, FR-10, §8 retention; CLAUDE.md rule 4.
--
-- Email rules enforced here:
--   - Nothing in the database sends email. Only the send-email Edge Function sends, and only
--     for drafts a person chose and pressed Send on (CLAUDE.md rule 4).
--   - The sender is always the engagement's Relationship Owner (email_drafts.owner_id is copied
--     from the engagement and can't be changed through the API).
--   - Marketing sees none of these tables. Consultants see only their own engagements' rows.
--   - Mailbox tokens live in mailbox_connections, which only the service role can read.

-- ---------------------------------------------------------------------------
-- app_settings: one row
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  follow_up_interval_days integer not null default 7 check (follow_up_interval_days in (7, 15)),
  max_follow_ups integer not null default 3 check (max_follow_ups between 1 and 10),
  renewal_windows_days integer[] not null default '{90,30}'
    check (cardinality(renewal_windows_days) between 1 and 4),
  closed_leads_retention_years integer not null default 3 check (closed_leads_retention_years between 1 and 10),
  email_retention_years integer not null default 2 check (email_retention_years between 1 and 10),
  open_tracking_retention_months integer not null default 12 check (open_tracking_retention_months between 1 and 60),
  -- true until the Microsoft 365 app registration and admin consent exist: a "send" is recorded
  -- as sent by provider 'test' and nothing leaves the building.
  email_test_mode boolean not null default true,
  m365_provider text not null default 'unknown' check (m365_provider in ('microsoft', 'godaddy', 'unknown')),
  m365_admin_consent boolean not null default false,
  daily_digest_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

insert into public.app_settings (id) values (1);

create index app_settings_updated_by_idx on public.app_settings (updated_by);

alter table public.app_settings enable row level security;

create function app.stamp_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  perform app.log('settings_changed', null, null,
    jsonb_build_object('columns', app.changed_columns(to_jsonb(old), to_jsonb(new), array['updated_at', 'updated_by'])));
  return new;
end;
$$;

revoke all on function app.stamp_settings() from public;

create trigger stamp_settings before update on public.app_settings
  for each row execute function app.stamp_settings();

revoke all on table public.app_settings from anon, authenticated;
grant select on table public.app_settings to authenticated;
grant update (follow_up_interval_days, max_follow_ups, renewal_windows_days,
  closed_leads_retention_years, email_retention_years, open_tracking_retention_months,
  email_test_mode, m365_provider, m365_admin_consent, daily_digest_enabled)
  on table public.app_settings to authenticated;
grant all on table public.app_settings to service_role;

create policy "app_settings: role-holders read"
  on public.app_settings for select to authenticated
  using ((select app.current_app_role()) is not null);

create policy "app_settings: owners change"
  on public.app_settings for update to authenticated
  using ((select app.is_owner()))
  with check ((select app.is_owner()));

-- ---------------------------------------------------------------------------
-- import_batches: every import, who, when, counts and the flag report (FR-3). Owners only.
-- ---------------------------------------------------------------------------
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null check (char_length(file_name) <= 300),
  imported_by uuid references public.profiles (id) default auth.uid(),
  imported_at timestamptz not null default now(),
  total_rows integer not null default 0,
  accepted_count integer not null default 0,
  flagged_count integer not null default 0,
  duplicate_count integer not null default 0,
  rejected_count integer not null default 0,
  -- [{row, client_code, field, reason}] — the flag report, never cell values
  flags jsonb not null default '[]'::jsonb
);

create index import_batches_imported_by_idx on public.import_batches (imported_by);

alter table public.import_batches enable row level security;

revoke all on table public.import_batches from anon, authenticated;
grant select on table public.import_batches to authenticated;
grant all on table public.import_batches to service_role;

create policy "import_batches: owners read"
  on public.import_batches for select to authenticated
  using ((select app.is_owner()));

-- ---------------------------------------------------------------------------
-- Who may send for an engagement (FR-9): Owners any (they approve others' drafts; it still
-- goes from the Relationship Owner's mailbox); Consultants only their own leads... and own
-- engagements for renewals; Marketing never.
-- ---------------------------------------------------------------------------
create function app.can_email_engagement(p_engagement uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.current_app_role()
    when 'owner' then exists (select 1 from public.engagements e where e.id = p_engagement)
    when 'consultant' then app.owns_engagement(p_engagement)
    else false
  end
$$;

revoke all on function app.can_email_engagement(uuid) from public;
grant execute on function app.can_email_engagement(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- mailbox_connections: Microsoft 365 tokens. Service role only (no grant for anyone else).
-- ---------------------------------------------------------------------------
create table public.mailbox_connections (
  profile_id uuid primary key references public.profiles (id) on delete restrict,
  provider text not null default 'microsoft' check (provider in ('microsoft')),
  mailbox_address text not null,
  ms_user_id text,
  refresh_token text, -- encrypted by the Edge Function before it is stored
  access_token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mailbox_connections enable row level security;
revoke all on table public.mailbox_connections from public, anon, authenticated;
grant all on table public.mailbox_connections to service_role;

-- ---------------------------------------------------------------------------
-- email_batches: one per bulk send (the person, when, how many, the filters used)
-- ---------------------------------------------------------------------------
create table public.email_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  subject_template text not null check (char_length(subject_template) <= 300),
  body_template text not null check (char_length(body_template) <= 10000),
  filter_summary text check (char_length(filter_summary) <= 1000),
  total integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0
);

create index email_batches_created_by_idx on public.email_batches (created_by);

alter table public.email_batches enable row level security;

create trigger stamp_created_by before insert on public.email_batches
  for each row execute function app.stamp_created_by();

revoke all on table public.email_batches from anon, authenticated;
grant select on table public.email_batches to authenticated;
grant insert (subject_template, body_template, filter_summary, total) on table public.email_batches
  to authenticated;
grant all on table public.email_batches to service_role;

create policy "email_batches: owners read all, consultants their own"
  on public.email_batches for select to authenticated
  using ((select app.is_owner())
    or ((select app.current_app_role()) = 'consultant' and created_by = (select auth.uid())));

create policy "email_batches: owners and consultants create"
  on public.email_batches for insert to authenticated
  with check ((select app.current_app_role()) in ('owner', 'consultant'));

-- ---------------------------------------------------------------------------
-- email_threads: one Outlook conversation per client contact and engagement
-- ---------------------------------------------------------------------------
create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  subject text not null check (char_length(subject) <= 300),
  conversation_id text, -- Microsoft Graph conversationId
  root_internet_message_id text,
  created_at timestamptz not null default now()
);

create index email_threads_engagement_idx on public.email_threads (engagement_id);
create index email_threads_client_idx on public.email_threads (client_id);
create index email_threads_owner_idx on public.email_threads (owner_id);

alter table public.email_threads enable row level security;
revoke all on table public.email_threads from anon, authenticated;
grant select on table public.email_threads to authenticated;
grant all on table public.email_threads to service_role;

create policy "email_threads: owners read all, consultants their engagements"
  on public.email_threads for select to authenticated
  using ((select app.is_owner())
    or ((select app.current_app_role()) = 'consultant' and app.owns_engagement(engagement_id)));

-- ---------------------------------------------------------------------------
-- email_drafts: waiting for a person (Today view). Created by the daily engine, the Radar,
-- a person, Drishti, or a bulk send.
-- ---------------------------------------------------------------------------
create table public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  -- The sender: always the engagement's Relationship Owner (set by the trigger below).
  owner_id uuid references public.profiles (id) on delete restrict,
  kind text not null check (kind in ('follow_up', 'renewal', 'manual', 'bulk')),
  trigger_reason text check (char_length(trigger_reason) <= 300),
  thread_id uuid references public.email_threads (id) on delete restrict,
  to_email text check (to_email is null or to_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject text not null check (char_length(subject) <= 300),
  body text not null check (char_length(body) <= 10000),
  scheduled_for date not null default app.today_ist(),
  status text not null default 'waiting'
    check (status in ('waiting', 'rescheduled', 'sending', 'sent', 'skipped', 'failed')),
  failure_reason text check (char_length(failure_reason) <= 500),
  sent_at timestamptz,
  approved_by uuid references public.profiles (id),
  batch_id uuid references public.email_batches (id) on delete restrict,
  source text not null default 'manual' check (source in ('manual', 'system', 'drishti')),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_drafts_engagement_idx on public.email_drafts (engagement_id);
create index email_drafts_client_idx on public.email_drafts (client_id);
create index email_drafts_owner_status_idx on public.email_drafts (owner_id, status);
create index email_drafts_thread_idx on public.email_drafts (thread_id);
create index email_drafts_batch_idx on public.email_drafts (batch_id);
create index email_drafts_approved_by_idx on public.email_drafts (approved_by);
create index email_drafts_created_by_idx on public.email_drafts (created_by);
-- At most one open draft per engagement and kind, so the daily run can't pile them up.
create unique index email_drafts_one_open_per_kind on public.email_drafts (engagement_id, kind)
  where status in ('waiting', 'rescheduled', 'sending') and kind in ('follow_up', 'renewal');

alter table public.email_drafts enable row level security;

-- On insert: client, sender and thread come from the engagement, never from the browser.
-- From the browser, status may only move to skipped / rescheduled / waiting; 'sending',
-- 'sent' and 'failed' are set by the send-email function (service role).
create function app.prepare_email_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eng public.engagements%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into v_eng from public.engagements where id = new.engagement_id;
    new.client_id := v_eng.client_id;
    new.owner_id := v_eng.owner_id;
    if new.to_email is null then
      new.to_email := (select c.email from public.clients c where c.id = v_eng.client_id);
    end if;
    if new.thread_id is null then
      new.thread_id := (
        select t.id from public.email_threads t
        where t.engagement_id = new.engagement_id and t.owner_id = v_eng.owner_id
        order by t.created_at desc limit 1
      );
    end if;
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
      new.source := case
        when current_setting('app.change_source', true) = 'drishti' then 'drishti'
        else 'manual'
      end;
      new.status := 'waiting';
      new.sent_at := null;
      new.approved_by := null;
    end if;
    return new;
  end if;

  if (select auth.uid()) is not null then
    if new.engagement_id is distinct from old.engagement_id
      or new.client_id is distinct from old.client_id
      or new.owner_id is distinct from old.owner_id then
      raise exception 'A draft''s engagement and sender can''t change' using errcode = '42501';
    end if;
    if old.status in ('sent', 'sending') then
      raise exception 'A sent draft can''t be changed' using errcode = '42501';
    end if;
    if new.status not in ('waiting', 'rescheduled', 'skipped') then
      raise exception 'Only the send step can mark a draft sent or failed' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and new.status = 'skipped' then
      perform app.log('draft_skipped', new.engagement_id, new.client_id, jsonb_build_object('draft_id', new.id));
    elsif new.scheduled_for is distinct from old.scheduled_for then
      perform app.log('draft_rescheduled', new.engagement_id, new.client_id,
        jsonb_build_object('draft_id', new.id, 'to', new.scheduled_for));
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function app.prepare_email_draft() from public;

create trigger prepare_email_draft before insert or update on public.email_drafts
  for each row execute function app.prepare_email_draft();

revoke all on table public.email_drafts from anon, authenticated;
grant select on table public.email_drafts to authenticated;
grant insert (engagement_id, kind, trigger_reason, subject, body, scheduled_for, batch_id, to_email),
  update (subject, body, scheduled_for, status, to_email)
  on table public.email_drafts to authenticated;
grant all on table public.email_drafts to service_role;

create policy "email_drafts: owners read all, consultants their engagements"
  on public.email_drafts for select to authenticated
  using ((select app.is_owner())
    or ((select app.current_app_role()) = 'consultant' and app.owns_engagement(engagement_id)));

create policy "email_drafts: senders add"
  on public.email_drafts for insert to authenticated
  with check (app.can_email_engagement(engagement_id) and kind in ('renewal', 'manual', 'bulk', 'follow_up'));

create policy "email_drafts: senders edit, skip or reschedule"
  on public.email_drafts for update to authenticated
  using (app.can_email_engagement(engagement_id))
  with check (app.can_email_engagement(engagement_id));

-- ---------------------------------------------------------------------------
-- email_messages: what was sent and received. Written only by the server.
-- ---------------------------------------------------------------------------
create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads (id) on delete restrict,
  engagement_id uuid not null references public.engagements (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  draft_id uuid references public.email_drafts (id) on delete restrict,
  direction text not null check (direction in ('outbound', 'inbound')),
  sender_id uuid references public.profiles (id), -- outbound: the Relationship Owner
  approved_by uuid references public.profiles (id), -- outbound: the person who pressed Send
  from_email text not null,
  to_email text not null,
  subject text not null,
  body text not null,
  provider text not null check (provider in ('outlook', 'test')),
  provider_message_id text,
  internet_message_id text,
  sent_at timestamptz not null default now(),
  -- "likely opened" (FR-8): the tracking image loaded. Approximate.
  tracking_token uuid not null default gen_random_uuid() unique,
  opened_at timestamptz,
  open_count integer not null default 0
);

create index email_messages_thread_idx on public.email_messages (thread_id, sent_at);
create index email_messages_engagement_idx on public.email_messages (engagement_id);
create index email_messages_client_idx on public.email_messages (client_id);
create index email_messages_draft_idx on public.email_messages (draft_id);
create index email_messages_sender_idx on public.email_messages (sender_id);
create index email_messages_approved_by_idx on public.email_messages (approved_by);

alter table public.email_messages enable row level security;
revoke all on table public.email_messages from anon, authenticated;
grant select on table public.email_messages to authenticated;
grant all on table public.email_messages to service_role;

create policy "email_messages: owners read all, consultants their engagements"
  on public.email_messages for select to authenticated
  using ((select app.is_owner())
    or ((select app.current_app_role()) = 'consultant' and app.owns_engagement(engagement_id)));

-- Link clicks: recorded, shown only to Owners (FR-8 "not shown unless Pramila asks").
create table public.email_link_clicks (
  id bigint generated always as identity primary key,
  message_id uuid not null references public.email_messages (id) on delete restrict,
  url text not null check (char_length(url) <= 2000),
  clicked_at timestamptz not null default now()
);

create index email_link_clicks_message_idx on public.email_link_clicks (message_id);

alter table public.email_link_clicks enable row level security;
revoke all on table public.email_link_clicks from public, anon, authenticated;
grant select on table public.email_link_clicks to authenticated;
grant all on table public.email_link_clicks to service_role;

create policy "email_link_clicks: owners read"
  on public.email_link_clicks for select to authenticated
  using ((select app.is_owner()));

-- ---------------------------------------------------------------------------
-- Server-side effects of a message (service role inserts):
--   outbound: log, engagement last contacted + follow-up count + next follow-up date
--   inbound (a reply): engagement replied, open follow-up drafts stop (FR-8 stop rule), log
-- ---------------------------------------------------------------------------
create function app.after_email_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interval integer := (select s.follow_up_interval_days from public.app_settings s where s.id = 1);
begin
  if new.direction = 'outbound' then
    update public.engagements
    set last_contacted_on = (new.sent_at at time zone 'Asia/Kolkata')::date,
        next_follow_up_on = (new.sent_at at time zone 'Asia/Kolkata')::date + coalesce(v_interval, 7),
        follow_up_count = follow_up_count + 1
    where id = new.engagement_id;
    insert into public.activity_log (actor_id, source, kind, engagement_id, client_id, meta)
    values (new.approved_by, case when new.approved_by is null then 'system' else 'manual' end,
      'email_sent', new.engagement_id, new.client_id,
      jsonb_build_object('message_id', new.id, 'from', new.from_email, 'provider', new.provider));
  else
    update public.engagements
    set replied_at = new.sent_at,
        last_contacted_on = (new.sent_at at time zone 'Asia/Kolkata')::date
    where id = new.engagement_id;
    update public.email_drafts
    set status = 'skipped', failure_reason = 'Client replied: sequence stopped'
    where engagement_id = new.engagement_id
      and kind = 'follow_up'
      and status in ('waiting', 'rescheduled');
    insert into public.activity_log (actor_id, source, kind, engagement_id, client_id, meta)
    values (null, 'system', 'email_replied', new.engagement_id, new.client_id,
      jsonb_build_object('message_id', new.id));
  end if;
  return null;
end;
$$;

revoke all on function app.after_email_message() from public;

create trigger after_email_message after insert on public.email_messages
  for each row execute function app.after_email_message();
