-- Phase 1, step 14: the activity log (insert-only) and change_engagement_status(), which the
-- Pipeline drag calls (Phase 2). SECURITY.md A3 and A9; PRD FR-12; docs/PHASE-1-PLAN.md step 14.
--
-- What is logged (for now): every change of an engagement's status, whoever makes it and
-- however (this function, a direct update through the API, or server work). One row per
-- change: who (actor_id), when (created_at), from where (source), from and to.
-- Not yet: the first status of a new engagement, notes on engagements (moved to after the
-- demo), imports, emails, applied proposals. No history is invented for existing rows.
-- The log never holds a contract value or payment status, and has no free-form column
-- where one could be put.
--
-- Insert-only:
--   anon, authenticated   no insert, update, delete or truncate grant; authenticated reads
--   service_role          select and insert only (future imports and Edge Functions)
--   everyone              a trigger refuses every update, delete and truncate, including the
--                         table owner and the service role
--   Status-change rows are written only by the trigger on engagements below (security
--   definer), never by the caller. What can still remove the guard: the table owner (the
--   role that runs migrations) can disable or drop the triggers, and a superuser can also
--   skip them (session_replication_role). Both need a migration or a direct database login,
--   never the API, and migrations are reviewed in git.
--
-- Reading: a log row is visible only when the caller can read its engagement under the
-- step 8 rules. Owners and Consultants: every row. Marketing: only moves between lead
-- statuses (Lead, Proposal, On Hold, or no status), on engagements that are leads now, so a
-- lead that came back from delivery doesn't show Marketing its delivery history.
-- role-less and inactive users: nothing. anon: no grant.
--
-- change_engagement_status() is security invoker: its update runs as the caller, so the
-- step 8 row rules, column grants and guard trigger decide who may move what, exactly as
-- for a direct update.

-- ---------------------------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  -- Who: the logged-in user; null only for server work (migrations, seed, import).
  actor_id uuid references public.profiles (id) on delete restrict,
  -- From where (FR-12): 'manual' = a person in the app, 'system' = server work with no
  -- login. 'drishti' (an applied AI proposal) is reserved for Phase 4; it must never be
  -- settable from anything the browser sends.
  source text not null check (source in ('manual', 'drishti', 'system')),
  kind text not null check (kind in ('status_change')),
  engagement_id uuid references public.engagements (id) on delete restrict,
  -- Either can be empty: an engagement can have no status (needs_review).
  from_status text references public.statuses (code) on delete restrict,
  to_status text references public.statuses (code) on delete restrict,
  constraint activity_log_status_change_shape check (
    kind <> 'status_change'
    or (engagement_id is not null and from_status is distinct from to_status)
  ),
  constraint activity_log_system_has_no_actor check ((source = 'system') = (actor_id is null))
);

create index activity_log_engagement_idx on public.activity_log (engagement_id, created_at);
create index activity_log_actor_id_idx on public.activity_log (actor_id);

alter table public.activity_log enable row level security;

-- ---------------------------------------------------------------------------
-- Insert-only: refuse every update, delete and truncate, whoever asks.
-- ---------------------------------------------------------------------------
create function app.activity_log_insert_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The activity log is insert-only: entries cannot be changed or removed'
    using errcode = '42501';
end;
$$;

revoke all on function app.activity_log_insert_only() from public;

create trigger insert_only before update or delete on public.activity_log
  for each row execute function app.activity_log_insert_only();
create trigger insert_only_truncate before truncate on public.activity_log
  for each statement execute function app.activity_log_insert_only();

-- ---------------------------------------------------------------------------
-- Every status change on engagements writes one log row. security definer: the row is
-- written as the table owner, so no caller needs (or gets) an insert grant or policy.
-- It takes nothing from the caller except the row being changed and the login.
-- auth.uid() reads the request's login claims, which security definer doesn't change.
-- ---------------------------------------------------------------------------
create function app.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status)
  values (
    v_actor,
    case when v_actor is null then 'system' else 'manual' end,
    'status_change',
    new.id,
    old.status,
    new.status
  );
  return null;
end;
$$;

revoke all on function app.log_status_change() from public;

-- after: runs only once the step 8 rules have accepted the change.
create trigger log_status_change after update of status on public.engagements
  for each row when (old.status is distinct from new.status)
  execute function app.log_status_change();

-- ---------------------------------------------------------------------------
-- change_engagement_status: the one call the Pipeline drag makes.
--   no role, or inactive             42501
--   unknown or empty status          22023
--   engagement missing, or the caller may not change it (one message for both, so ids
--   can't be probed)                 42501
--   already has that status          22023, nothing logged
--   Marketing moving a lead out of the pipeline: the step 8 rule refuses the update (42501)
-- The log row is written by the trigger above.
-- ---------------------------------------------------------------------------
create function public.change_engagement_status(p_engagement_id uuid, p_new_status text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old text;
  v_count integer;
begin
  if (select app.current_app_role()) is null then
    raise exception 'You don''t have access to change statuses' using errcode = '42501';
  end if;

  if p_new_status is null
    or not exists (select 1 from public.statuses s where s.code = p_new_status) then
    raise exception 'Unknown status' using errcode = '22023';
  end if;

  -- for update: locks the row, and under row-level security returns it only if the caller
  -- may both read and change it.
  select e.status into v_old
  from public.engagements e
  where e.id = p_engagement_id
  for update;

  if not found then
    raise exception 'Engagement not found, or you can''t change its status' using errcode = '42501';
  end if;

  if v_old is not distinct from p_new_status then
    raise exception 'The engagement already has that status' using errcode = '22023';
  end if;

  update public.engagements set status = p_new_status where id = p_engagement_id;
  get diagnostics v_count = row_count;

  if v_count <> 1 then
    raise exception 'Engagement not found, or you can''t change its status' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.change_engagement_status(uuid, text) from public, anon, authenticated;
grant execute on function public.change_engagement_status(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grants. Supabase's default privileges can give a new table (and its identity sequence)
-- full access for anon, authenticated and service_role, so all are revoked first.
-- ---------------------------------------------------------------------------
revoke all on table public.activity_log from public, anon, authenticated, service_role;
grant select on table public.activity_log to authenticated;
grant select, insert on table public.activity_log to service_role;

revoke all on sequence public.activity_log_id_seq from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security (reading only; nobody has an insert, update or delete policy).
-- The engagements subquery runs under the caller's own step 8 rules.
-- ---------------------------------------------------------------------------
create policy "activity_log: owners and consultants read all"
  on public.activity_log for select to authenticated
  using (
    (select app.current_app_role()) in ('owner', 'consultant')
    and exists (select 1 from public.engagements e where e.id = activity_log.engagement_id)
  );

create policy "activity_log: marketing reads lead history"
  on public.activity_log for select to authenticated
  using (
    (select app.current_app_role()) = 'marketing'
    and exists (select 1 from public.engagements e where e.id = activity_log.engagement_id)
    and (from_status is null or app.is_lead_status(from_status))
    and (to_status is null or app.is_lead_status(to_status))
  );
