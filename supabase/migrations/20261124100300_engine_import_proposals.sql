-- The daily reminder engine (FR-10), the import commit (FR-3) and applying a Drishti proposal
-- (FR-11). None of these sends email: the engine only creates drafts for a person to review.

-- ---------------------------------------------------------------------------
-- Draft text (first person as the owner, under ~110 words, one ask, two IST times or the
-- booking link). Uses the latest meeting note for continuity (PRD P2).
-- ---------------------------------------------------------------------------
create function app.draft_text(p_engagement uuid, p_kind text, p_as_of date)
returns table (subject text, body text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_e public.engagements%rowtype;
  v_c public.clients%rowtype;
  v_owner public.profiles%rowtype;
  v_note public.engagement_notes%rowtype;
  v_first text;
  v_cert text;
  v_ask text;
  v_due record;
begin
  select * into v_e from public.engagements where id = p_engagement;
  select * into v_c from public.clients where id = v_e.client_id;
  select * into v_owner from public.profiles where id = v_e.owner_id;
  select * into v_note from public.engagement_notes n
    where n.engagement_id = p_engagement order by n.held_on desc, n.created_at desc limit 1;

  v_first := coalesce(nullif(split_part(coalesce(v_c.contact_person, ''), ' ', 1), ''), 'there');
  v_cert := coalesce(v_e.standard_framework, v_e.certification_type, 'certification');
  v_ask := case
    when v_owner.booking_link is not null
      then 'If easier, pick a slot here: ' || v_owner.booking_link
    else 'Would Thursday 11:30 IST or Friday 15:00 IST suit you for 20 minutes?'
  end;

  if p_kind = 'renewal' then
    select * into v_due from app.renewal_info(v_e.certification_type, v_e.surveillance_due_date,
      v_e.next_audit_date, v_e.valid_to, v_e.completion_date, p_as_of);
    subject := v_c.name || ' — ' || v_cert || ' ' || lower(coalesce(v_due.event_kind, 'renewal')) || ' planning';
    body := 'Hi ' || v_first || ',' || E'\n\n'
      || 'Your ' || v_cert || ' ' || lower(coalesce(v_due.event_kind, 'renewal')) || ' falls on '
      || to_char(v_due.due_date, 'DD-Mon-YYYY') || '. I''d like to plan the audit window early so it '
      || 'doesn''t clash with your release calendar.' || E'\n\n'
      || v_ask || E'\n\n'
      || 'Regards,' || E'\n' || coalesce(nullif(v_owner.full_name, ''), 'SQAS');
  else
    subject := 'Re: ' || v_cert || ' — ' || v_c.name;
    body := 'Hi ' || v_first || ',' || E'\n\n'
      || case
        when v_note.id is not null then
          'When we spoke on ' || to_char(v_note.held_on, 'DD Mon') || ', you mentioned '
          || lower(left(v_note.summary, 140)) || '. '
        else 'Following up on our ' || v_cert || ' conversation. '
      end
      || 'Is this still a priority for this quarter?' || E'\n\n'
      || v_ask || E'\n\n'
      || 'Regards,' || E'\n' || coalesce(nullif(v_owner.full_name, ''), 'SQAS');
  end if;
  return next;
end;
$$;

revoke all on function app.draft_text(uuid, text, date) from public;

-- ---------------------------------------------------------------------------
-- The engine. Stop rules (FR-10): client replied; maximum reached; status out of the
-- pipeline; On Hold; do-not-contact; no email address; no owner; already an open draft.
-- Delivery engagements never get sales follow-ups (CLAUDE.md rule 6).
-- Returns how many drafts it created. Idempotent for a given day.
-- ---------------------------------------------------------------------------
create function app.run_reminder_engine(p_as_of date)
returns table (renewal_drafts integer, follow_up_drafts integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.app_settings%rowtype;
  v_row record;
  v_text record;
  v_r integer := 0;
  v_f integer := 0;
begin
  select * into v_s from public.app_settings where id = 1;

  -- Renewal drafts: due date within a window (default 90 and 30 days), or already overdue.
  for v_row in
    select e.id, r.due_date, r.event_kind, r.days_until
    from public.engagements e
    join public.clients c on c.id = e.client_id
    join public.statuses s on s.code = e.status
    cross join lateral app.renewal_info(e.certification_type, e.surveillance_due_date,
      e.next_audit_date, e.valid_to, e.completion_date, p_as_of) r
    where s.status_group = 'active'
      and e.archived_at is null and c.archived_at is null
      and not c.do_not_contact
      and c.email is not null
      and e.owner_id is not null
      and r.due_date is not null
      and r.days_until <= (select max(w) from unnest(v_s.renewal_windows_days) w)
      and not exists (
        select 1 from public.email_drafts d
        where d.engagement_id = e.id and d.kind = 'renewal'
          and (d.status in ('waiting', 'rescheduled', 'sending')
               or (d.status in ('sent', 'skipped') and d.created_at > now() - interval '25 days'))
      )
  loop
    select * into v_text from app.draft_text(v_row.id, 'renewal', p_as_of);
    insert into public.email_drafts (engagement_id, client_id, kind, trigger_reason, subject, body,
      scheduled_for, source)
    values (v_row.id, (select client_id from public.engagements where id = v_row.id), 'renewal',
      v_row.event_kind || ' ' || case when v_row.days_until < 0 then 'overdue since '
        else 'due ' end || to_char(v_row.due_date, 'DD-Mon-YYYY'),
      v_text.subject, v_text.body, p_as_of, 'system');
    v_r := v_r + 1;
  end loop;

  -- Follow-up drafts: Lead or Proposal only (not On Hold, not delivery), quiet for the interval.
  for v_row in
    select e.id, coalesce(e.last_contacted_on, e.initial_engagement_date) as last_touch
    from public.engagements e
    join public.clients c on c.id = e.client_id
    where e.status in ('Lead', 'Proposal')
      and e.archived_at is null and c.archived_at is null
      and not c.do_not_contact
      and c.email is not null
      and e.owner_id is not null
      and e.replied_at is null
      and e.follow_up_count < v_s.max_follow_ups
      and coalesce(e.last_contacted_on, e.initial_engagement_date, (e.created_at at time zone 'Asia/Kolkata')::date)
        <= p_as_of - v_s.follow_up_interval_days
      and not exists (
        select 1 from public.email_drafts d
        where d.engagement_id = e.id and d.kind = 'follow_up'
          and d.status in ('waiting', 'rescheduled', 'sending')
      )
  loop
    select * into v_text from app.draft_text(v_row.id, 'follow_up', p_as_of);
    insert into public.email_drafts (engagement_id, client_id, kind, trigger_reason, subject, body,
      scheduled_for, source)
    values (v_row.id, (select client_id from public.engagements where id = v_row.id), 'follow_up',
      'No contact since ' || coalesce(to_char(v_row.last_touch, 'DD-Mon-YYYY'), 'creation')
        || ' (' || v_s.follow_up_interval_days || '-day interval)',
      v_text.subject, v_text.body, p_as_of, 'system');
    v_f := v_f + 1;
  end loop;

  -- Stop rule: open follow-ups for engagements that left the pipeline or went do-not-contact.
  update public.email_drafts d
  set status = 'skipped', failure_reason = 'Stopped: status changed, On Hold or do-not-contact'
  from public.engagements e, public.clients c
  where d.engagement_id = e.id and c.id = e.client_id
    and d.kind = 'follow_up' and d.status in ('waiting', 'rescheduled')
    and (e.status not in ('Lead', 'Proposal') or c.do_not_contact);

  insert into public.activity_log (actor_id, source, kind, meta)
  values ((select auth.uid()), case when (select auth.uid()) is null then 'system' else 'manual' end,
    'reminder_run', jsonb_build_object('as_of', p_as_of, 'renewal_drafts', v_r, 'follow_up_drafts', v_f));

  renewal_drafts := v_r;
  follow_up_drafts := v_f;
  return next;
end;
$$;

revoke all on function app.run_reminder_engine(date) from public;
grant execute on function app.run_reminder_engine(date) to service_role;

-- The "test clock" (FR-10 acceptance): Owners can run the engine for any date.
create function public.run_reminder_engine(p_as_of date default null)
returns table (renewal_drafts integer, follow_up_drafts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_owner() then
    raise exception 'Only an Owner can run the reminder engine' using errcode = '42501';
  end if;
  return query select * from app.run_reminder_engine(coalesce(p_as_of, app.today_ist()));
end;
$$;

revoke all on function public.run_reminder_engine(date) from public, anon, authenticated;
grant execute on function public.run_reminder_engine(date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Import commit (FR-3). The browser parses and flags the file (src/lib/import), shows the
-- preview, and sends only the rows to save. Owners only. Runs as the caller (security invoker)
-- so the normal row rules apply; records the batch with its flag report.
-- p_rows: [{client: {...clients columns}, engagement: {...}, financials: {...}}]
-- Rows sharing a client_code become one client (existing clients are reused, not changed).
-- ---------------------------------------------------------------------------
create function public.commit_import(
  p_file_name text,
  p_rows jsonb,
  p_counts jsonb,
  p_flags jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch uuid;
  v_row jsonb;
  v_client uuid;
  v_eng uuid;
  v_owner uuid;
  v_c jsonb;
  v_e jsonb;
  v_f jsonb;
begin
  if not (select app.is_owner()) then
    raise exception 'Only an Owner can import' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'Import must be a list of at most 5000 rows' using errcode = '22023';
  end if;

  perform set_config('app.change_source', 'import', true);

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_c := v_row -> 'client';
    v_e := v_row -> 'engagement';
    v_f := v_row -> 'financials';
    v_client := null;

    if nullif(v_c ->> 'client_code', '') is not null then
      select id into v_client from public.clients where client_code = v_c ->> 'client_code';
    end if;

    if v_client is null then
      insert into public.clients (client_code, name, industry, address, city, state_country,
        contact_person, designation, email, phone, website, priority)
      values (nullif(v_c ->> 'client_code', ''), v_c ->> 'name', nullif(v_c ->> 'industry', ''),
        nullif(v_c ->> 'address', ''), nullif(v_c ->> 'city', ''), nullif(v_c ->> 'state_country', ''),
        nullif(v_c ->> 'contact_person', ''), nullif(v_c ->> 'designation', ''),
        nullif(v_c ->> 'email', ''), nullif(v_c ->> 'phone', ''), nullif(v_c ->> 'website', ''),
        nullif(v_c ->> 'priority', ''))
      returning id into v_client;
    end if;

    v_owner := nullif(v_e ->> 'owner_id', '')::uuid;

    insert into public.engagements (client_id, certification_type, standard_framework, scope, status,
      initial_engagement_date, completion_date, certificate_number, valid_from, valid_to,
      certification_body, surveillance_due_date, last_audit_date, next_audit_date, owner_id,
      lead_source, remarks)
    values (v_client, nullif(v_e ->> 'certification_type', ''), nullif(v_e ->> 'standard_framework', ''),
      nullif(v_e ->> 'scope', ''), nullif(v_e ->> 'status', ''),
      nullif(v_e ->> 'initial_engagement_date', '')::date, nullif(v_e ->> 'completion_date', '')::date,
      nullif(v_e ->> 'certificate_number', ''), nullif(v_e ->> 'valid_from', '')::date,
      nullif(v_e ->> 'valid_to', '')::date, nullif(v_e ->> 'certification_body', ''),
      nullif(v_e ->> 'surveillance_due_date', '')::date, nullif(v_e ->> 'last_audit_date', '')::date,
      nullif(v_e ->> 'next_audit_date', '')::date, v_owner,
      nullif(v_e ->> 'lead_source', ''), nullif(v_e ->> 'remarks', ''))
    returning id into v_eng;

    if v_f is not null and (nullif(v_f ->> 'contract_value', '') is not null
        or nullif(v_f ->> 'payment_status', '') is not null) then
      insert into public.engagement_financials (engagement_id, contract_value, payment_status)
      values (v_eng, nullif(v_f ->> 'contract_value', '')::numeric, nullif(v_f ->> 'payment_status', ''));
    end if;

    -- Remarks (AD) become the first note in history (PRD §6.2).
    if nullif(v_e ->> 'remarks', '') is not null then
      insert into public.engagement_notes (engagement_id, held_on, held_by, summary)
      values (v_eng, coalesce(nullif(v_e ->> 'initial_engagement_date', '')::date, app.today_ist()),
        v_owner, left(v_e ->> 'remarks', 4000));
    end if;
  end loop;

  insert into public.import_batches (file_name, total_rows, accepted_count, flagged_count,
    duplicate_count, rejected_count, flags)
  values (left(p_file_name, 300), coalesce((p_counts ->> 'total')::int, 0),
    coalesce((p_counts ->> 'accepted')::int, 0), coalesce((p_counts ->> 'flagged')::int, 0),
    coalesce((p_counts ->> 'duplicates')::int, 0), coalesce((p_counts ->> 'rejected')::int, 0),
    coalesce(p_flags, '[]'::jsonb))
  returning id into v_batch;

  perform app.log('import_committed', null, null,
    jsonb_build_object('batch_id', v_batch, 'file', left(p_file_name, 300), 'rows', jsonb_array_length(p_rows)));
  perform set_config('app.change_source', '', true);
  return v_batch;
end;
$$;

-- commit_import runs as the caller, so Owners need to add batch rows (nobody else can).
grant insert (file_name, total_rows, accepted_count, flagged_count, duplicate_count, rejected_count, flags)
  on table public.import_batches to authenticated;
create policy "import_batches: owners add"
  on public.import_batches for insert to authenticated
  with check ((select app.is_owner()));

revoke all on function public.commit_import(text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_import(text, jsonb, jsonb, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Apply a Drishti proposal (FR-11): a person clicked Apply. Runs as the caller, so the normal
-- edit rules apply; everything it changes is logged with source 'drishti'.
-- p_changes: {status?, next_follow_up_on?, note_summary?, note_next_step?}
-- ---------------------------------------------------------------------------
create function public.apply_drishti_proposal(p_engagement_id uuid, p_changes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select app.current_app_role()) is null then
    raise exception 'You don''t have access' using errcode = '42501';
  end if;
  perform set_config('app.change_source', 'drishti', true);

  if p_changes ? 'status' and nullif(p_changes ->> 'status', '') is not null then
    perform public.change_engagement_status(p_engagement_id, p_changes ->> 'status');
  end if;

  if p_changes ? 'next_follow_up_on' then
    update public.engagements
    set next_follow_up_on = nullif(p_changes ->> 'next_follow_up_on', '')::date
    where id = p_engagement_id;
    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'Engagement not found, or you can''t change it' using errcode = '42501';
    end if;
  end if;

  if nullif(p_changes ->> 'note_summary', '') is not null then
    insert into public.engagement_notes (engagement_id, held_by, summary, next_step)
    values (p_engagement_id, (select auth.uid()), p_changes ->> 'note_summary',
      nullif(p_changes ->> 'note_next_step', ''));
  end if;

  perform app.log('proposal_applied', p_engagement_id,
    (select e.client_id from public.engagements e where e.id = p_engagement_id),
    jsonb_build_object('fields', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(p_changes) k)));
  perform set_config('app.change_source', '', true);
end;
$$;

revoke all on function public.apply_drishti_proposal(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_drishti_proposal(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 06:00 IST every day (00:30 UTC): the engine. pg_cron runs as postgres, no login, so drafts
-- are 'system'. The morning summary email is sent by the daily-digest Edge Function.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule(
  'drishti-daily-reminders',
  '30 0 * * *',
  $$select app.run_reminder_engine(app.today_ist())$$
);
