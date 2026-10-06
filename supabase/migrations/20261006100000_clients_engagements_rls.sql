-- Phase 1, step 8: who may read and change clients, engagements and engagement_financials.
-- PRD FR-9; SECURITY.md A3; docs/PHASE-1-PLAN.md step 8; DECISIONS 03-Oct-2026 and 04-Oct-2026.
--
-- Reading:
--   Owner, Consultant      every client and engagement
--   Marketing              leads only: engagements whose status is in the pipeline or paused
--                          group (Lead, Proposal, On Hold), the clients behind them, and a
--                          client it has just added that has no engagements yet
--   engagement_financials  active users with values access only (Owners always; Consultants
--                          when an Owner has switched it on; Marketing never)
-- Changing:
--   Owner                  everything
--   Consultant             engagements they own; the clients of those engagements; a client
--                          they added that has no engagements yet. Financials of their own
--                          engagements only with values access
--   Marketing              leads it created, and only while they stay leads; a client whose
--                          engagements are all leads and include one it created; a client it
--                          added that has no engagements yet
-- Adding:
--   every role-holder may add clients and engagements (FR-9 "Add leads"). Marketing adds
--   leads only, for clients it can read. Non-Owners add engagements owned by themselves or
--   by nobody (Marketing: by nobody); an Owner assigns the owner.
-- Always:
--   created_by is the logged-in user on insert, whatever was sent. Only an Owner may change
--   created_by, an engagement's client_id or owner_id. Nobody deletes through the API (no
--   delete grant): rows are archived. anon, role-less and inactive users get nothing.
-- Not here (DECISIONS 06-Oct-2026):
--   archived_at is ignored by these rules; archived rows are hidden on screen only.
--   Marketing can't see, or add a lead for, a client that has no lead (renewal/upsell gap,
--   to confirm with the client at Checkpoint A).
-- Notes on engagements come with the activity log (step 14).

-- ---------------------------------------------------------------------------
-- Helpers for the policies. security definer: they read engagements, clients and statuses
-- regardless of the caller's row-level security, so the clients and engagements policies
-- can refer to each other without recursion. Empty search_path, as in step 5.
-- ---------------------------------------------------------------------------

-- A lead status: the pipeline group (Lead, Proposal) or the paused group (On Hold).
-- An empty status is not a lead.
create function app.is_lead_status(p_status text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.statuses s
    where s.code = p_status and s.status_group in ('pipeline', 'paused')
  )
$$;

-- The client has at least one lead.
create function app.client_has_lead(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.engagements e
    join public.statuses s on s.code = e.status
    where e.client_id = p_client and s.status_group in ('pipeline', 'paused')
  )
$$;

-- The client has at least one engagement. Reads only engagements, so it also works while the
-- client row itself is being inserted (see "clients: marketing reads lead clients").
create function app.client_has_engagements(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.engagements e where e.client_id = p_client)
$$;

-- The caller added this client and it has no engagements yet: lets a user add a client and
-- then its first engagement. Not for the clients SELECT policy: it looks the client up in
-- public.clients, where a row being inserted isn't visible yet.
create function app.is_own_new_client(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.clients c
      where c.id = p_client and c.created_by = (select auth.uid())
    )
    and not exists (select 1 from public.engagements e where e.client_id = p_client)
$$;

-- The caller owns at least one engagement of this client.
create function app.owns_engagement_of_client(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.engagements e
    where e.client_id = p_client and e.owner_id = (select auth.uid())
  )
$$;

-- The caller owns this engagement.
create function app.owns_engagement(p_engagement uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.engagements e
    where e.id = p_engagement and e.owner_id = (select auth.uid())
  )
$$;

-- Marketing may change a client only when the caller created a lead for it and every one of
-- its engagements is a lead, so Marketing can't change the details of a client that has
-- delivery or certified work.
create function app.marketing_can_edit_client(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1
      from public.engagements e
      join public.statuses s on s.code = e.status
      where e.client_id = p_client
        and e.created_by = (select auth.uid())
        and s.status_group in ('pipeline', 'paused')
    )
    and not exists (
      select 1
      from public.engagements e
      left join public.statuses s on s.code = e.status
      where e.client_id = p_client
        and (s.status_group is null or s.status_group not in ('pipeline', 'paused'))
    )
$$;

revoke all on function app.is_lead_status(text) from public;
revoke all on function app.client_has_lead(uuid) from public;
revoke all on function app.client_has_engagements(uuid) from public;
revoke all on function app.is_own_new_client(uuid) from public;
revoke all on function app.owns_engagement_of_client(uuid) from public;
revoke all on function app.owns_engagement(uuid) from public;
revoke all on function app.marketing_can_edit_client(uuid) from public;
grant execute on function app.is_lead_status(text) to authenticated, service_role;
grant execute on function app.client_has_lead(uuid) to authenticated, service_role;
grant execute on function app.client_has_engagements(uuid) to authenticated, service_role;
grant execute on function app.is_own_new_client(uuid) to authenticated, service_role;
grant execute on function app.owns_engagement_of_client(uuid) to authenticated, service_role;
grant execute on function app.owns_engagement(uuid) to authenticated, service_role;
grant execute on function app.marketing_can_edit_client(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- created_by is always the logged-in user on insert. Server work (migrations, seed, import
-- by the service role) has no logged-in user and keeps the value it gives.
-- ---------------------------------------------------------------------------
create function app.stamp_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function app.stamp_created_by() from public;

create trigger stamp_created_by before insert on public.clients
  for each row execute function app.stamp_created_by();
create trigger stamp_created_by before insert on public.engagements
  for each row execute function app.stamp_created_by();

-- ---------------------------------------------------------------------------
-- Only an Owner may change who created a row, or move an engagement to another client or
-- another owner. Otherwise Marketing could claim someone else's lead, or a Consultant could
-- take over an engagement. Server work is trusted, as in step 5.
-- ---------------------------------------------------------------------------
create function app.guard_client_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and not app.is_owner()
    and new.created_by is distinct from old.created_by then
    raise exception 'Only an Owner can change who created a client' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function app.guard_engagement_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and not app.is_owner()
    and (
      new.created_by is distinct from old.created_by
      or new.client_id is distinct from old.client_id
      or new.owner_id is distinct from old.owner_id
    ) then
    raise exception 'Only an Owner can change an engagement''s creator, client or owner'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app.guard_client_changes() from public;
revoke all on function app.guard_engagement_changes() from public;

create trigger guard_changes before update on public.clients
  for each row execute function app.guard_client_changes();
create trigger guard_changes before update on public.engagements
  for each row execute function app.guard_engagement_changes();

-- ---------------------------------------------------------------------------
-- Grants. Still nothing for anon. No delete for anyone through the API. id, created_at and
-- updated_at are never written through the API. created_by is set by the trigger on insert,
-- so it isn't in any insert grant; it is in the update grant for Owners (the guard stops
-- everyone else). engagement_id can't change once a financials row exists.
-- ---------------------------------------------------------------------------
revoke all on table public.clients, public.engagements, public.engagement_financials
  from anon, authenticated;

grant select on table public.clients, public.engagements, public.engagement_financials
  to authenticated;

grant insert (client_code, name, industry, address, city, state_country, contact_person,
    designation, email, phone, website, priority, do_not_contact),
  update (client_code, name, industry, address, city, state_country, contact_person,
    designation, email, phone, website, priority, do_not_contact, created_by, archived_at)
  on table public.clients to authenticated;

grant insert (client_id, certification_type, standard_framework, scope, status,
    initial_engagement_date, completion_date, certificate_number, valid_from, valid_to,
    certification_body, surveillance_due_date, last_audit_date, next_audit_date, owner_id,
    lead_source, remarks, last_contacted_on, next_follow_up_on, date_is_estimated),
  update (client_id, certification_type, standard_framework, scope, status,
    initial_engagement_date, completion_date, certificate_number, valid_from, valid_to,
    certification_body, surveillance_due_date, last_audit_date, next_audit_date, owner_id,
    lead_source, remarks, last_contacted_on, next_follow_up_on, date_is_estimated,
    created_by, archived_at)
  on table public.engagements to authenticated;

grant insert (engagement_id, contract_value, payment_status),
  update (contract_value, payment_status)
  on table public.engagement_financials to authenticated;

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create policy "clients: owners and consultants read all"
  on public.clients for select to authenticated
  using ((select app.current_app_role()) in ('owner', 'consultant'));

-- created_by is checked on the row itself, not through app.is_own_new_client(): on
-- insert ... returning (supabase-js .insert().select()) Postgres checks the new row against
-- this policy before that row is visible in public.clients.
create policy "clients: marketing reads lead clients"
  on public.clients for select to authenticated
  using (
    (select app.current_app_role()) = 'marketing'
    and (
      app.client_has_lead(id)
      or (created_by = (select auth.uid()) and not app.client_has_engagements(id))
    )
  );

create policy "clients: role-holders add"
  on public.clients for insert to authenticated
  with check (
    (select app.current_app_role()) is not null
    and created_by = (select auth.uid())
  );

create policy "clients: owners change all"
  on public.clients for update to authenticated
  using ((select app.is_owner()))
  with check ((select app.is_owner()));

create policy "clients: consultants change clients of their engagements"
  on public.clients for update to authenticated
  using (
    (select app.current_app_role()) = 'consultant'
    and (app.owns_engagement_of_client(id) or app.is_own_new_client(id))
  )
  with check (
    (select app.current_app_role()) = 'consultant'
    and (app.owns_engagement_of_client(id) or app.is_own_new_client(id))
  );

create policy "clients: marketing changes its lead-only clients"
  on public.clients for update to authenticated
  using (
    (select app.current_app_role()) = 'marketing'
    and (app.marketing_can_edit_client(id) or app.is_own_new_client(id))
  )
  with check (
    (select app.current_app_role()) = 'marketing'
    and (app.marketing_can_edit_client(id) or app.is_own_new_client(id))
  );

-- ---------------------------------------------------------------------------
-- engagements
-- ---------------------------------------------------------------------------
create policy "engagements: owners and consultants read all"
  on public.engagements for select to authenticated
  using ((select app.current_app_role()) in ('owner', 'consultant'));

create policy "engagements: marketing reads leads"
  on public.engagements for select to authenticated
  using (
    (select app.current_app_role()) = 'marketing'
    and app.is_lead_status(status)
  );

create policy "engagements: owners add"
  on public.engagements for insert to authenticated
  with check (
    (select app.is_owner())
    and created_by = (select auth.uid())
  );

create policy "engagements: consultants add"
  on public.engagements for insert to authenticated
  with check (
    (select app.current_app_role()) = 'consultant'
    and created_by = (select auth.uid())
    and (owner_id is null or owner_id = (select auth.uid()))
  );

create policy "engagements: marketing adds leads"
  on public.engagements for insert to authenticated
  with check (
    (select app.current_app_role()) = 'marketing'
    and created_by = (select auth.uid())
    and owner_id is null
    and app.is_lead_status(status)
    and (app.client_has_lead(client_id) or app.is_own_new_client(client_id))
  );

create policy "engagements: owners change all"
  on public.engagements for update to authenticated
  using ((select app.is_owner()))
  with check ((select app.is_owner()));

create policy "engagements: consultants change their own"
  on public.engagements for update to authenticated
  using (
    (select app.current_app_role()) = 'consultant'
    and owner_id = (select auth.uid())
  )
  with check (
    (select app.current_app_role()) = 'consultant'
    and owner_id = (select auth.uid())
  );

-- A lead must stay a lead: Marketing can't move it into delivery or beyond.
create policy "engagements: marketing changes its own leads"
  on public.engagements for update to authenticated
  using (
    (select app.current_app_role()) = 'marketing'
    and created_by = (select auth.uid())
    and app.is_lead_status(status)
  )
  with check (
    (select app.current_app_role()) = 'marketing'
    and created_by = (select auth.uid())
    and app.is_lead_status(status)
  );

-- ---------------------------------------------------------------------------
-- engagement_financials (can_see_values is false for Marketing, role-less and inactive users)
-- ---------------------------------------------------------------------------
create policy "engagement_financials: values-access read"
  on public.engagement_financials for select to authenticated
  using ((select app.can_see_values()));

create policy "engagement_financials: owners add"
  on public.engagement_financials for insert to authenticated
  with check ((select app.is_owner()));

-- Consultants with values access, for engagements they own (names stay under 63 characters).
create policy "engagement_financials: consultants add for own"
  on public.engagement_financials for insert to authenticated
  with check (
    (select app.current_app_role()) = 'consultant'
    and (select app.can_see_values())
    and app.owns_engagement(engagement_id)
  );

create policy "engagement_financials: owners change all"
  on public.engagement_financials for update to authenticated
  using ((select app.is_owner()))
  with check ((select app.is_owner()));

create policy "engagement_financials: consultants change own"
  on public.engagement_financials for update to authenticated
  using (
    (select app.current_app_role()) = 'consultant'
    and (select app.can_see_values())
    and app.owns_engagement(engagement_id)
  )
  with check (
    (select app.current_app_role()) = 'consultant'
    and (select app.can_see_values())
    and app.owns_engagement(engagement_id)
  );
