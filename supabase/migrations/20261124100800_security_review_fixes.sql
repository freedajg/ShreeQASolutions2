-- Fixes from the fresh security review of 24-Nov-2026 (DECISIONS). Each part names its finding.

-- ---------------------------------------------------------------------------
-- H1: a draft always goes from the engagement's CURRENT Relationship Owner (CLAUDE.md rule 4).
-- When an engagement changes owner, its open drafts are stopped (they were written in the
-- old owner's voice and thread); the next daily run drafts again for the new owner.
-- send-email also re-checks the owner before sending.
-- ---------------------------------------------------------------------------
create function app.stop_drafts_on_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_drafts
  set status = 'skipped', failure_reason = 'Relationship Owner changed: draft stopped'
  where engagement_id = new.id
    and status in ('waiting', 'rescheduled', 'failed');
  return null;
end;
$$;

revoke all on function app.stop_drafts_on_owner_change() from public;

create trigger stop_drafts_on_owner_change after update of owner_id on public.engagements
  for each row when (old.owner_id is distinct from new.owner_id)
  execute function app.stop_drafts_on_owner_change();

-- ---------------------------------------------------------------------------
-- H2: never invent a date (CLAUDE.md rule 7). An imported remark with no start date becomes an
-- undated note, and an import never moves Last Contacted.
-- ---------------------------------------------------------------------------
alter table public.engagement_notes alter column held_on drop not null;

create or replace function app.note_touches_engagement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.held_on is null or new.source = 'import' then
    return null;
  end if;
  update public.engagements
  set last_contacted_on = greatest(coalesce(last_contacted_on, new.held_on), new.held_on)
  where id = new.engagement_id;
  return null;
end;
$$;

create or replace function public.commit_import(
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

    -- Remarks (AD) become the first note, dated only if the row has a start date (H2).
    if nullif(v_e ->> 'remarks', '') is not null then
      insert into public.engagement_notes (engagement_id, held_on, held_by, summary)
      values (v_eng, nullif(v_e ->> 'initial_engagement_date', '')::date, v_owner,
        left(v_e ->> 'remarks', 4000));
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

-- ---------------------------------------------------------------------------
-- M1: a sales follow-up only on a Lead or Proposal (CLAUDE.md rule 6), whoever inserts it.
-- L8: the recipient is always the client's own email; nobody sets it from the browser.
-- ---------------------------------------------------------------------------
revoke insert (to_email), update (to_email) on table public.email_drafts from authenticated;

create or replace function app.prepare_email_draft()
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
    if new.kind = 'follow_up' and v_eng.status is distinct from 'Lead'
      and v_eng.status is distinct from 'Proposal' then
      raise exception 'Sales follow-ups are only for Lead and Proposal engagements'
        using errcode = '42501';
    end if;
    new.client_id := v_eng.client_id;
    new.owner_id := v_eng.owner_id;
    if (select auth.uid()) is not null or new.to_email is null then
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

-- ---------------------------------------------------------------------------
-- M2: the activity log never carries a payment status (readable by roles without values
-- access). Only the invoice number is logged.
-- ---------------------------------------------------------------------------
create or replace function app.invoice_updates_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('Paid', 'Partially Paid', 'Overdue')
    and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    insert into public.engagement_financials (engagement_id, payment_status)
    values (new.engagement_id, new.status)
    on conflict (engagement_id) do update set payment_status = excluded.payment_status;
  end if;
  perform app.log('invoice', new.engagement_id,
    (select e.client_id from public.engagements e where e.id = new.engagement_id),
    jsonb_build_object('invoice_no', new.invoice_no));
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- M3: the Owner's "run cleanup now" always uses today; no future date can wipe data early.
-- ---------------------------------------------------------------------------
drop function public.run_retention(date);

create function public.run_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_owner() then
    raise exception 'Only an Owner can run the retention cleanup' using errcode = '42501';
  end if;
  return app.run_retention(app.today_ist());
end;
$$;

revoke all on function public.run_retention() from public, anon, authenticated;
grant execute on function public.run_retention() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- L6: the assistant's daily cap is one atomic check-and-count (no race past the limit).
-- Returns true when the question is allowed. Server only.
-- ---------------------------------------------------------------------------
create function public.bump_assistant_usage(p_profile uuid, p_limit integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with bumped as (
    insert into public.assistant_usage as u (profile_id, day, questions)
    values (p_profile, app.today_ist(), 1)
    on conflict (profile_id, day) do update
      set questions = u.questions + 1
      where u.questions < p_limit
    returning 1
  )
  select p_limit > 0 and exists (select 1 from bumped)
$$;

revoke all on function public.bump_assistant_usage(uuid, integer) from public, anon, authenticated;
grant execute on function public.bump_assistant_usage(uuid, integer) to service_role;
