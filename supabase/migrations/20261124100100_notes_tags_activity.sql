-- Notes on engagements, client tags, extra engagement fields, and a wider activity log.
-- PRD §6.5 (meeting notes), FR-2, FR-5, FR-12; the tag filters asked for on 24-Nov-2026.
--
-- Reading and writing:
--   engagement_notes  read: whoever can read the engagement (step 8 rules).
--                     add: Owners and Consultants on any engagement they can read ("notes on
--                     any", FR-9); Marketing on leads it created. Nobody edits or deletes a note.
--   tags              read: every role-holder. add/change: Owners and Consultants.
--   client_tags       read: whoever can read the client. add/remove: Owners and Consultants on
--                     any client they can read; Marketing on clients it may edit.
--   activity_log      still insert-only and written only by security definer triggers here;
--                     never by the browser. New kinds below. `meta` holds only labels and
--                     column names, never a contract value or payment status.

-- ---------------------------------------------------------------------------
-- Engagement: closed reason (PRD §6.4 open question), follow-up count, replied
-- ---------------------------------------------------------------------------
alter table public.engagements
  add column closed_reason text check (
    closed_reason is null or closed_reason in
      ('Lost to competitor', 'No budget', 'Not interested', 'Relationship ended', 'Other')
  ),
  add column follow_up_count integer not null default 0 check (follow_up_count >= 0),
  add column replied_at timestamptz;

-- follow_up_count and replied_at are written by the email server code only.
grant insert (closed_reason), update (closed_reason) on table public.engagements to authenticated;

-- ---------------------------------------------------------------------------
-- engagement_notes
-- ---------------------------------------------------------------------------
create table public.engagement_notes (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete restrict,
  held_on date not null default app.today_ist(),
  held_by uuid references public.profiles (id) on delete restrict,
  summary text not null check (btrim(summary) <> '' and char_length(summary) <= 4000),
  next_step text check (char_length(next_step) <= 1000),
  source text not null default 'manual' check (source in ('manual', 'drishti', 'import', 'system')),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index engagement_notes_engagement_idx on public.engagement_notes (engagement_id, held_on desc);
create index engagement_notes_held_by_idx on public.engagement_notes (held_by);
create index engagement_notes_created_by_idx on public.engagement_notes (created_by);

alter table public.engagement_notes enable row level security;

create trigger stamp_created_by before insert on public.engagement_notes
  for each row execute function app.stamp_created_by();

-- A note from the browser is always 'manual'; 'drishti' only inside apply_drishti_proposal()
-- and 'import' only inside commit_import() (the only places that set app.change_source).
create function app.stamp_note_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.source := case
      when current_setting('app.change_source', true) in ('drishti', 'import')
        then current_setting('app.change_source', true)
      else 'manual'
    end;
  end if;
  return new;
end;
$$;

revoke all on function app.stamp_note_source() from public;

create trigger stamp_note_source before insert on public.engagement_notes
  for each row execute function app.stamp_note_source();

-- A meeting note counts as contact: it moves Last Contacted forward (never back).
create function app.note_touches_engagement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.engagements
  set last_contacted_on = greatest(coalesce(last_contacted_on, new.held_on), new.held_on)
  where id = new.engagement_id;
  return null;
end;
$$;

revoke all on function app.note_touches_engagement() from public;

create trigger note_touches_engagement after insert on public.engagement_notes
  for each row execute function app.note_touches_engagement();

revoke all on table public.engagement_notes from anon, authenticated;
grant select on table public.engagement_notes to authenticated;
grant insert (engagement_id, held_on, held_by, summary, next_step) on table public.engagement_notes
  to authenticated;
grant select, insert on table public.engagement_notes to service_role;

create policy "engagement_notes: read with the engagement"
  on public.engagement_notes for select to authenticated
  using (exists (select 1 from public.engagements e where e.id = engagement_notes.engagement_id));

create policy "engagement_notes: owners and consultants add on any"
  on public.engagement_notes for insert to authenticated
  with check (
    (select app.current_app_role()) in ('owner', 'consultant')
    and exists (select 1 from public.engagements e where e.id = engagement_notes.engagement_id)
  );

create policy "engagement_notes: marketing adds on its own leads"
  on public.engagement_notes for insert to authenticated
  with check (
    (select app.current_app_role()) = 'marketing'
    and exists (
      select 1 from public.engagements e
      where e.id = engagement_notes.engagement_id
        and e.created_by = (select auth.uid())
        and app.is_lead_status(e.status)
    )
  );

-- ---------------------------------------------------------------------------
-- tags and client_tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> '' and char_length(name) <= 40),
  -- A design token name, never a raw colour (CLAUDE.md rule 8).
  tone text not null default 'neutral'
    check (tone in ('neutral', 'primary', 'success', 'warning', 'danger', 'info')),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.client_tags (
  client_id uuid not null references public.clients (id) on delete restrict,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (client_id, tag_id)
);

create index client_tags_tag_idx on public.client_tags (tag_id);
create index tags_created_by_idx on public.tags (created_by);
create index client_tags_created_by_idx on public.client_tags (created_by);

alter table public.tags enable row level security;
alter table public.client_tags enable row level security;

create trigger stamp_created_by before insert on public.tags
  for each row execute function app.stamp_created_by();
create trigger stamp_created_by before insert on public.client_tags
  for each row execute function app.stamp_created_by();

revoke all on table public.tags, public.client_tags from anon, authenticated;
grant select on table public.tags, public.client_tags to authenticated;
grant insert (name, tone), update (name, tone), delete on table public.tags to authenticated;
grant insert (client_id, tag_id), delete on table public.client_tags to authenticated;
grant all on table public.tags, public.client_tags to service_role;

create policy "tags: role-holders read"
  on public.tags for select to authenticated
  using ((select app.current_app_role()) is not null);

create policy "tags: owners and consultants add"
  on public.tags for insert to authenticated
  with check ((select app.current_app_role()) in ('owner', 'consultant'));

create policy "tags: owners and consultants change"
  on public.tags for update to authenticated
  using ((select app.current_app_role()) in ('owner', 'consultant'))
  with check ((select app.current_app_role()) in ('owner', 'consultant'));

create policy "tags: owners remove"
  on public.tags for delete to authenticated
  using ((select app.is_owner()));

create policy "client_tags: read with the client"
  on public.client_tags for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_tags.client_id));

create policy "client_tags: owners and consultants tag any readable client"
  on public.client_tags for insert to authenticated
  with check (
    (select app.current_app_role()) in ('owner', 'consultant')
    and exists (select 1 from public.clients c where c.id = client_tags.client_id)
  );

create policy "client_tags: marketing tags clients it may edit"
  on public.client_tags for insert to authenticated
  with check (
    (select app.current_app_role()) = 'marketing'
    and app.marketing_can_edit_client(client_tags.client_id)
  );

create policy "client_tags: owners and consultants untag"
  on public.client_tags for delete to authenticated
  using (
    (select app.current_app_role()) in ('owner', 'consultant')
    and exists (select 1 from public.clients c where c.id = client_tags.client_id)
  );

create policy "client_tags: marketing untags clients it may edit"
  on public.client_tags for delete to authenticated
  using (
    (select app.current_app_role()) = 'marketing'
    and app.marketing_can_edit_client(client_tags.client_id)
  );

-- ---------------------------------------------------------------------------
-- Activity log: more kinds, a client link and a small server-written `meta`.
-- ---------------------------------------------------------------------------
alter table public.activity_log
  add column client_id uuid references public.clients (id) on delete restrict,
  add column meta jsonb not null default '{}'::jsonb;

create index activity_log_client_idx on public.activity_log (client_id, created_at);

alter table public.activity_log drop constraint activity_log_kind_check;
alter table public.activity_log add constraint activity_log_kind_check check (kind in (
  'status_change', 'engagement_created', 'engagement_updated', 'client_created', 'client_updated',
  'archived', 'restored', 'note_added', 'email_sent', 'email_failed', 'email_replied',
  'draft_skipped', 'draft_rescheduled', 'import_committed', 'proposal_applied', 'team_changed',
  'settings_changed', 'mailbox_changed', 'invoice', 'whatsapp', 'voice_call', 'web_lead',
  'reminder_run'
));

-- Who/where for every log row written by a trigger: the login, and 'drishti' while an applied
-- proposal runs (app.change_source is set only inside apply_drishti_proposal()).
create function app.log(
  p_kind text,
  p_engagement uuid,
  p_client uuid,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  insert into public.activity_log (actor_id, source, kind, engagement_id, client_id, meta)
  values (
    v_actor,
    case
      when v_actor is null then 'system'
      when current_setting('app.change_source', true) = 'drishti' then 'drishti'
      else 'manual'
    end,
    p_kind, p_engagement, p_client, coalesce(p_meta, '{}'::jsonb)
  );
end;
$$;

revoke all on function app.log(text, uuid, uuid, jsonb) from public;

-- Status changes now also carry the client and the Drishti source.
create or replace function app.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  insert into public.activity_log (actor_id, source, kind, engagement_id, client_id, from_status, to_status)
  values (
    v_actor,
    case
      when v_actor is null then 'system'
      when current_setting('app.change_source', true) = 'drishti' then 'drishti'
      else 'manual'
    end,
    'status_change', new.id, new.client_id, old.status, new.status
  );
  return null;
end;
$$;

-- Which columns changed (names only, never values).
create function app.changed_columns(p_old jsonb, p_new jsonb, p_skip text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
  from jsonb_object_keys(p_new) k
  where not (k = any (p_skip)) and (p_old -> k) is distinct from (p_new -> k)
$$;

revoke all on function app.changed_columns(jsonb, jsonb, text[]) from public;

create function app.log_engagement_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cols jsonb;
begin
  if tg_op = 'INSERT' then
    perform app.log('engagement_created', new.id, new.client_id,
      jsonb_build_object('certification', new.certification_type, 'status', new.status));
    return null;
  end if;

  if new.archived_at is distinct from old.archived_at then
    perform app.log(case when new.archived_at is null then 'restored' else 'archived' end,
      new.id, new.client_id, jsonb_build_object('entity', 'engagement'));
  end if;

  v_cols := app.changed_columns(to_jsonb(old), to_jsonb(new),
    array['status', 'archived_at', 'updated_at', 'last_contacted_on', 'follow_up_count', 'replied_at']);
  if jsonb_array_length(v_cols) > 0 then
    perform app.log('engagement_updated', new.id, new.client_id, jsonb_build_object('columns', v_cols));
  end if;
  return null;
end;
$$;

revoke all on function app.log_engagement_changes() from public;

create trigger log_engagement_changes after insert or update on public.engagements
  for each row execute function app.log_engagement_changes();

create function app.log_client_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cols jsonb;
begin
  if tg_op = 'INSERT' then
    perform app.log('client_created', null, new.id, jsonb_build_object('name', new.name));
    return null;
  end if;

  if new.archived_at is distinct from old.archived_at then
    perform app.log(case when new.archived_at is null then 'restored' else 'archived' end,
      null, new.id, jsonb_build_object('entity', 'client'));
  end if;

  v_cols := app.changed_columns(to_jsonb(old), to_jsonb(new), array['archived_at', 'updated_at']);
  if jsonb_array_length(v_cols) > 0 then
    perform app.log('client_updated', null, new.id, jsonb_build_object('columns', v_cols));
  end if;
  return null;
end;
$$;

revoke all on function app.log_client_changes() from public;

create trigger log_client_changes after insert or update on public.clients
  for each row execute function app.log_client_changes();

create function app.log_note_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.log('note_added', new.engagement_id,
    (select e.client_id from public.engagements e where e.id = new.engagement_id),
    jsonb_build_object('note_id', new.id));
  return null;
end;
$$;

revoke all on function app.log_note_added() from public;

create trigger log_note_added after insert on public.engagement_notes
  for each row execute function app.log_note_added();

-- Contract value and payment status changes: logged without the values.
create function app.log_financial_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.log('engagement_updated', new.engagement_id,
    (select e.client_id from public.engagements e where e.id = new.engagement_id),
    jsonb_build_object('columns',
      case when tg_op = 'INSERT' then '["financials"]'::jsonb
      else app.changed_columns(to_jsonb(old), to_jsonb(new), array['updated_at', 'created_at']) end));
  return null;
end;
$$;

revoke all on function app.log_financial_changes() from public;

create trigger log_financial_changes after insert or update on public.engagement_financials
  for each row execute function app.log_financial_changes();

-- Team changes (role, values access, active, mailbox): who and what, not values of others.
create function app.log_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cols jsonb := app.changed_columns(to_jsonb(old), to_jsonb(new), array['updated_at', 'theme_preference']);
begin
  if jsonb_array_length(v_cols) > 0 then
    perform app.log('team_changed', null, null,
      jsonb_build_object('member', new.full_name, 'member_id', new.id, 'columns', v_cols));
  end if;
  return null;
end;
$$;

revoke all on function app.log_profile_changes() from public;

create trigger log_profile_changes after update on public.profiles
  for each row execute function app.log_profile_changes();

-- Reading. Engagement rows as before; client-only rows with the client; rows about the team,
-- settings or imports (no engagement, no client): Owners only.
create policy "activity_log: owners and consultants read client history"
  on public.activity_log for select to authenticated
  using (
    (select app.current_app_role()) in ('owner', 'consultant')
    and engagement_id is null
    and client_id is not null
    and exists (select 1 from public.clients c where c.id = activity_log.client_id)
  );

create policy "activity_log: owners read firm-wide rows"
  on public.activity_log for select to authenticated
  using ((select app.is_owner()) and engagement_id is null and client_id is null);
